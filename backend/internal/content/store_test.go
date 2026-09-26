package content

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRuntimeStoreFetchesOnceAndRewritesURLs(t *testing.T) {
	requestCount := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		requestCount++
		responseWriter.Header().Set("Content-Type", "application/json")
		_, _ = responseWriter.Write([]byte(`{"species":{"url":"https://pokeapi.co/api/v2/pokemon-species/25/"},"sprite":"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png","cry":"https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/25.ogg"}`))
	}))
	defer upstream.Close()

	store := NewStore("pokeapi", upstream.URL, t.TempDir(), true, true, upstream.Client())
	first, source, err := store.Get(context.Background(), "pokemon/25")
	if err != nil {
		t.Fatal(err)
	}
	if source != "UPSTREAM" {
		t.Fatalf("expected UPSTREAM, got %s", source)
	}
	if string(first.Body) != `{"species":{"url":"/api/pokeapi/pokemon-species/25/"},"sprite":"/api/pokeapi-sprites/pokemon/25.png","cry":"/api/pokeapi-cries/pokemon/latest/25.ogg"}` {
		t.Fatalf("unexpected rewritten body: %s", first.Body)
	}

	second, source, err := store.Get(context.Background(), "pokemon/25")
	if err != nil {
		t.Fatal(err)
	}
	if source != "RUNTIME" || string(second.Body) != string(first.Body) || requestCount != 1 {
		t.Fatalf("expected persistent runtime hit, source=%s requests=%d", source, requestCount)
	}
}

func TestFactoryClosureStopsAtOnePokemonDependencies(t *testing.T) {
	requests := make(map[string]int)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests[r.URL.Path]++
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/pokemon/132":
			_, _ = w.Write([]byte(`{"species":{"url":"https://pokeapi.co/api/v2/pokemon-species/132/"},"abilities":[{"ability":{"url":"https://pokeapi.co/api/v2/ability/limber/"}},{"ability":{"url":"https://pokeapi.co/api/v2/ability/limber/"}}],"moves":[{"move":{"url":"https://pokeapi.co/api/v2/move/transform/"}}],"forms":[{"url":"https://pokeapi.co/api/v2/pokemon-form/132/"}]}`))
		case "/pokemon-species/132", "/ability/limber", "/move/transform":
			var reverse strings.Builder
			for id := 1; id <= 400; id++ {
				reverse.WriteString(fmt.Sprintf(`{"url":"https://pokeapi.co/api/v2/pokemon/%d/"},`, id))
			}
			_, _ = w.Write([]byte(`{"reverse":[` + strings.TrimSuffix(reverse.String(), ",") + `],"evolution_chain":{"url":"https://pokeapi.co/api/v2/evolution-chain/50/"}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()
	state := t.TempDir()
	store := NewStore("pokeapi", upstream.URL, state, true, true, upstream.Client())
	var latest SyncProgress
	manifest, err := store.PrepareVersion(context.Background(), SyncOptions{
		Version: "factory.1", Keys: []string{"pokemon/132"}, FactoryClosure: true,
		Workers: 2, MaxEntries: 200, MaxBytes: 100 << 20, MaxDuration: 2 * time.Minute,
		Progress: func(progress SyncProgress) { latest = progress },
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(manifest.Entries) != 4 || latest.Completed != 4 || latest.Queued != 4 {
		t.Fatalf("unexpected closure: %+v", latest)
	}
	for _, key := range []string{"pokemon/132", "pokemon-species/132", "ability/limber", "move/transform"} {
		entry, ok := manifest.Entries[key]
		if !ok {
			t.Fatalf("missing %s", key)
		}
		if key != "pokemon/132" && entry.DiscoveredFrom != "pokemon/132" {
			t.Fatalf("wrong parent for %s: %s", key, entry.DiscoveredFrom)
		}
	}
	if len(requests) != 4 {
		t.Fatalf("reverse links expanded to %d requests", len(requests))
	}
	for _, count := range requests {
		if count != 1 {
			t.Fatalf("object fetched %d times", count)
		}
	}
	if _, err := os.Stat(filepath.Join(state, "current.json")); !os.IsNotExist(err) {
		t.Fatal("prepared factory version became active")
	}
}

func TestFactoryLimitsFailWithoutPublishingOrActivating(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/pokemon/132" {
			_, _ = w.Write([]byte(`{"species":{"url":"/api/pokeapi/pokemon-species/132/"},"abilities":[{"ability":{"url":"/api/pokeapi/ability/limber/"}}],"moves":[{"move":{"url":"/api/pokeapi/move/transform/"}}]}`))
			return
		}
		_, _ = w.Write([]byte(`{"name":"fixture"}`))
	}))
	defer upstream.Close()
	for _, limit := range []struct {
		name     string
		entries  int
		bytes    int64
		duration time.Duration
	}{
		{"keys", 3, 0, 0}, {"bytes", 200, 20, 0}, {"deadline", 200, 0, time.Nanosecond},
	} {
		t.Run(limit.name, func(t *testing.T) {
			state := t.TempDir()
			store := NewStore("pokeapi", upstream.URL, state, true, true, upstream.Client())
			_, err := store.PrepareVersion(context.Background(), SyncOptions{Version: "limited", Keys: []string{"pokemon/132"}, FactoryClosure: true, MaxEntries: limit.entries, MaxBytes: limit.bytes, MaxDuration: limit.duration})
			if err == nil {
				t.Fatal("expected sync limit error")
			}
			if _, statErr := os.Stat(filepath.Join(state, "current.json")); !os.IsNotExist(statErr) {
				t.Fatal("failure activated version")
			}
			if _, statErr := os.Stat(filepath.Join(state, "pokeapi/versions/limited")); !os.IsNotExist(statErr) {
				t.Fatal("failure published version")
			}
			matches, _ := filepath.Glob(filepath.Join(state, "pokeapi/versions/limited.*.tmp"))
			if len(matches) != 0 {
				t.Fatalf("temporary objects survived: %v", matches)
			}
		})
	}
}

func TestFactoryDiscoveryRejectsExternalAndMissingLinks(t *testing.T) {
	for _, body := range []string{
		`{"species":{"url":"https://evil.test/pokemon-species/132"},"abilities":[{"ability":{"url":"/api/pokeapi/ability/limber/"}}],"moves":[{"move":{"url":"/api/pokeapi/move/transform/"}}]}`,
		`{"species":{"url":"/api/pokeapi/pokemon-species/132/"},"abilities":[],"moves":[]}`,
	} {
		if _, err := extractFactoryKeys("pokemon/132", []byte(body)); err == nil {
			t.Fatalf("accepted invalid payload: %s", body)
		}
	}
	if keys, err := extractFactoryKeys("move/transform", []byte(`{"pokemon":[{"url":"/api/pokeapi/pokemon/1/"}]}`)); err != nil || len(keys) != 0 {
		t.Fatalf("subresource expanded: %v %v", keys, err)
	}
}

func TestFactoryHTTPFailurePreservesExistingPointer(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/pokemon/132" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"species":{"url":"/api/pokeapi/pokemon-species/132/"},"abilities":[{"ability":{"url":"/api/pokeapi/ability/limber/"}}],"moves":[{"move":{"url":"/api/pokeapi/move/transform/"}}]}`))
			return
		}
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
	}))
	defer upstream.Close()
	state := t.TempDir()
	pointer := []byte(`{"version":"previous"}`)
	if err := os.WriteFile(filepath.Join(state, "current.json"), pointer, 0o644); err != nil {
		t.Fatal(err)
	}
	store := NewStore("pokeapi", upstream.URL, state, true, true, upstream.Client())
	if _, err := store.PrepareVersion(context.Background(), SyncOptions{Version: "failed", Keys: []string{"pokemon/132"}, FactoryClosure: true}); err == nil {
		t.Fatal("expected HTTP failure")
	}
	after, err := os.ReadFile(filepath.Join(state, "current.json"))
	if err != nil || string(after) != string(pointer) {
		t.Fatalf("pointer changed after failure: %s %v", after, err)
	}
	if _, err := os.Stat(filepath.Join(state, "pokeapi/versions/failed")); !os.IsNotExist(err) {
		t.Fatal("failed version published")
	}
	matches, _ := filepath.Glob(filepath.Join(state, "pokeapi/versions/failed.*.tmp"))
	if len(matches) != 0 {
		t.Fatalf("failed staging survived: %v", matches)
	}
}

func TestVersionSyncActivatesImmutableManifest(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		responseWriter.Header().Set("Content-Type", "application/json")
		_, _ = responseWriter.Write([]byte(`{"name":"pikachu"}`))
	}))
	defer upstream.Close()

	stateRoot := t.TempDir()
	store := NewStore("pokeapi", upstream.URL, stateRoot, false, true, upstream.Client())
	store.allowUpstream = true
	manifest, err := store.SyncVersion(context.Background(), SyncOptions{
		Version: "20260819.1",
		Keys:    []string{"pokemon/25"},
		Workers: 2,
	})
	if err != nil {
		t.Fatal(err)
	}
	store.allowUpstream = false
	if len(manifest.Entries) != 1 || store.ActiveVersion() != "20260819.1" {
		t.Fatalf("unexpected manifest: %#v", manifest)
	}

	stored, source, err := store.Get(context.Background(), "pokemon/25")
	if err != nil {
		t.Fatal(err)
	}
	if source != "VERSION" || string(stored.Body) != `{"name":"pikachu"}` {
		t.Fatalf("unexpected versioned response: source=%s body=%s", source, stored.Body)
	}

	pointerData, err := os.ReadFile(filepath.Join(stateRoot, "pokeapi", "current.json"))
	if err != nil {
		t.Fatal(err)
	}
	var pointer ActivePointer
	if err := json.Unmarshal(pointerData, &pointer); err != nil || pointer.Version != "20260819.1" {
		t.Fatalf("invalid pointer: %s", pointerData)
	}

	if _, err := store.SyncVersion(context.Background(), SyncOptions{
		Version: "20260819.2",
		Keys:    []string{"pokemon/25"},
	}); err != nil {
		t.Fatal(err)
	}
	if store.ActiveVersion() != "20260819.2" {
		t.Fatalf("expected second version to be activated, got %s", store.ActiveVersion())
	}
}

func TestVersionSyncCrawlsReferencedPokeAPIResources(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		responseWriter.Header().Set("Content-Type", "application/json")
		if request.URL.Path == "/pokemon/25" {
			_, _ = responseWriter.Write([]byte(`{"species":{"url":"https://pokeapi.co/api/v2/pokemon-species/25/"}}`))
			return
		}
		if request.URL.Path == "/pokemon-species/25/" || request.URL.Path == "/pokemon-species/25" {
			_, _ = responseWriter.Write([]byte(`{"name":"pikachu"}`))
			return
		}
		http.NotFound(responseWriter, request)
	}))
	defer upstream.Close()

	store := NewStore("pokeapi", upstream.URL, t.TempDir(), true, true, upstream.Client())
	manifest, err := store.SyncVersion(context.Background(), SyncOptions{
		Version:    "crawl.1",
		Keys:       []string{"pokemon/25"},
		CrawlLinks: true,
		Workers:    2,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := manifest.Entries["pokemon-species/25"]; !ok {
		t.Fatalf("referenced species was not synchronized: %#v", manifest.Entries)
	}
}

func TestActivateReleaseCoordinatesPreparedStores(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(responseWriter http.ResponseWriter, _ *http.Request) {
		responseWriter.Header().Set("Content-Type", "application/json")
		_, _ = responseWriter.Write([]byte(`{"ok":true}`))
	}))
	defer upstream.Close()

	stateRoot := t.TempDir()
	first := NewStore("pokeapi", upstream.URL, stateRoot, true, true, upstream.Client())
	second := NewStore("pokedex-csv", upstream.URL, stateRoot, true, false, upstream.Client())
	for _, store := range []*Store{first, second} {
		if _, err := store.PrepareVersion(context.Background(), SyncOptions{
			Version: "release.1",
			Keys:    []string{"fixture"},
		}); err != nil {
			t.Fatal(err)
		}
		if store.ActiveVersion() != "" {
			t.Fatal("prepared version became visible before release activation")
		}
	}

	if err := ActivateRelease(stateRoot, "release.1"); err != nil {
		t.Fatal(err)
	}
	if first.ActiveVersion() != "release.1" || second.ActiveVersion() != "release.1" {
		t.Fatalf("coordinated release did not activate: first=%s second=%s", first.ActiveVersion(), second.ActiveVersion())
	}
}

func TestNormalizeKeyRejectsTraversal(t *testing.T) {
	for _, value := range []string{"../secret", "%2e%2e/secret", "folder\\secret", ""} {
		if _, err := NormalizeKey(value, ""); err == nil {
			t.Fatalf("expected %q to be rejected", value)
		}
	}
}

func TestRenameWithRetryPublishesNonEmptyDirectory(t *testing.T) {
	root := t.TempDir()
	staging := filepath.Join(root, "staging.tmp")
	published := filepath.Join(root, "published")
	if err := os.MkdirAll(staging, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(staging, "manifest.json"), []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := renameWithRetry(staging, published); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(published, "manifest.json")); err != nil {
		t.Fatal(err)
	}
}
