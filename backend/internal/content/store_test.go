package content

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
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
