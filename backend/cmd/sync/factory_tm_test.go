package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"pokefactory/backend/internal/content"
)

func factoryTMManifestPath() string {
	return filepath.Join("..", "..", "config", "rogue-tm-moves.json")
}

func TestFactoryTMSeedsArePinnedAcrossEveryGeneration(t *testing.T) {
	tmKeys, provenance, err := loadFactoryTMSeeds(factoryTMManifestPath())
	if err != nil {
		t.Fatal(err)
	}
	if len(tmKeys) != 50 || tmKeys[16] != "move/freeze-dry" || tmKeys[32] != "move/quiver-dance" || provenance.Commit != rogueTMSourceCommit {
		t.Fatalf("wrong pinned TM list: count=%d TM17=%s TM33=%s source=%+v", len(tmKeys), tmKeys[16], tmKeys[32], provenance)
	}
	root := filepath.Join("..", "..", "..")
	index := filepath.Join(root, "storage/data/factorySpeciesIndex.json")
	sets := filepath.Join(root, "src/features/game/config/factoryReferenceSets/chunks")
	forms := filepath.Join(root, "src/features/game/config/specialForms.ts")
	for generation := 0; generation <= 9; generation++ {
		var base []string
		if generation == 0 {
			base, err = factorySeeds(index, sets, forms)
		} else {
			base, err = factorySeedsForGeneration(index, sets, forms, generation)
		}
		if err != nil {
			t.Fatalf("generation %d: %v", generation, err)
		}
		combined := appendFactoryTMSeeds(base, tmKeys)
		for _, key := range tmKeys {
			if !containsKey(combined, key) {
				t.Fatalf("generation %d lost %s", generation, key)
			}
		}
		if len(combined) < len(base) || len(combined) > len(base)+50 {
			t.Fatalf("generation %d invalid seed count %d -> %d", generation, len(base), len(combined))
		}
		t.Logf("generation=%d base=%d preparedSeeds=%d fixedTM=50", generation, len(base), len(combined))
	}
}

func TestFactoryTMManifestRejectsTampering(t *testing.T) {
	data, err := os.ReadFile(factoryTMManifestPath())
	if err != nil {
		t.Fatal(err)
	}
	for name, mutate := range map[string]func(*factoryTMSeedManifest){
		"wrong commit":       func(value *factoryTMSeedManifest) { value.Source.Commit = "other" },
		"wrong input digest": func(value *factoryTMSeedManifest) { value.Source.InputDigestSHA256 = "other" },
		"missing TM":         func(value *factoryTMSeedManifest) { value.TMs = value.TMs[:49] },
		"wrong TM17":         func(value *factoryTMSeedManifest) { value.TMs[16].Key = "move/ice-beam" },
		"duplicate":          func(value *factoryTMSeedManifest) { value.TMs[17].Key = value.TMs[16].Key },
	} {
		t.Run(name, func(t *testing.T) {
			var value factoryTMSeedManifest
			if err := json.Unmarshal(data, &value); err != nil {
				t.Fatal(err)
			}
			mutate(&value)
			bad, err := json.Marshal(value)
			if err != nil {
				t.Fatal(err)
			}
			path := filepath.Join(t.TempDir(), "bad.json")
			if err := os.WriteFile(path, bad, 0o600); err != nil {
				t.Fatal(err)
			}
			if _, _, err := loadFactoryTMSeeds(path); err == nil {
				t.Fatal("accepted changed pinned TM manifest")
			}
		})
	}
}

func TestFactoryTMRequiredBodiesPrepareWithoutActivation(t *testing.T) {
	keys := []string{"move/freeze-dry", "move/quiver-dance"}
	validBody := func(key string) string {
		return `{"id":1,"name":"` + strings.TrimPrefix(key, "move/") + `","pp":10,"type":{"name":"ice"},"damage_class":{"name":"special"},"target":{"name":"selected-pokemon"},"meta":{},"stat_changes":[]}`
	}
	for _, tc := range []struct {
		name        string
		badKey      string
		badBody     string
		maxEntries  int
		maxBytes    int64
		slow        bool
		wantFailure bool
	}{
		{name: "complete"},
		{name: "missing key", badKey: keys[1], wantFailure: true},
		{name: "invalid body", badKey: keys[0], badBody: `{"name":"freeze-dry"}`, wantFailure: true},
		{name: "entry limit", maxEntries: 1, wantFailure: true},
		{name: "byte limit", maxBytes: 10, wantFailure: true},
		{name: "deadline", slow: true, wantFailure: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tc.slow {
					time.Sleep(20 * time.Millisecond)
				}
				w.Header().Set("Content-Type", "application/json")
				key := strings.TrimPrefix(r.URL.Path, "/")
				if key == tc.badKey && tc.badBody == "" {
					http.NotFound(w, r)
					return
				}
				if key == tc.badKey {
					_, _ = w.Write([]byte(tc.badBody))
					return
				}
				_, _ = w.Write([]byte(validBody(key)))
			}))
			defer upstream.Close()
			state := t.TempDir()
			store := content.NewStore("pokeapi", upstream.URL, state, true, true, upstream.Client())
			maxEntries := tc.maxEntries
			if maxEntries == 0 {
				maxEntries = 10
			}
			provenance := &content.SeedProvenance{Commit: rogueTMSourceCommit}
			ctx := context.Background()
			if tc.slow {
				var cancel context.CancelFunc
				ctx, cancel = context.WithTimeout(ctx, time.Millisecond)
				defer cancel()
			}
			manifest, err := store.PrepareVersion(ctx, content.SyncOptions{
				Version: "tm-fixture", Keys: keys, RequiredKeys: keys, ValidateObject: factoryTMValidator(keys),
				SeedProvenance: provenance, Workers: 2, MaxEntries: maxEntries, MaxBytes: tc.maxBytes,
			})
			if tc.wantFailure {
				if err == nil {
					t.Fatal("expected prepare failure")
				}
				if _, statErr := os.Stat(filepath.Join(state, "pokeapi", "versions", "tm-fixture")); !os.IsNotExist(statErr) {
					t.Fatal("failed prepare published a version")
				}
				matches, _ := filepath.Glob(filepath.Join(state, "pokeapi", "versions", "tm-fixture.*.tmp"))
				if len(matches) != 0 {
					t.Fatalf("failed prepare left staging: %v", matches)
				}
			} else {
				if err != nil {
					t.Fatal(err)
				}
				if manifest.SeedProvenance == nil || manifest.SeedProvenance.Commit != rogueTMSourceCommit {
					t.Fatal("lost source provenance")
				}
				for _, key := range keys {
					entry, ok := manifest.Entries[key]
					if !ok {
						t.Fatalf("missing %s", key)
					}
					body, err := os.ReadFile(filepath.Join(state, "pokeapi", "versions", "tm-fixture", filepath.FromSlash(entry.File)))
					digest := sha256.Sum256(body)
					if err != nil || int64(len(body)) != entry.Size || string(body) != validBody(key) || hex.EncodeToString(digest[:]) != entry.SHA256 {
						t.Fatalf("invalid stored %s: %v", key, err)
					}
				}
			}
			if _, statErr := os.Stat(filepath.Join(state, "current.json")); !os.IsNotExist(statErr) {
				t.Fatal("prepare activated version")
			}
			if _, statErr := os.Stat(filepath.Join(state, "pokeapi", "current.json")); !os.IsNotExist(statErr) {
				t.Fatal("prepare activated namespace")
			}
		})
	}
}
