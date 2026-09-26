package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestValidateFactoryStateRootRejectsSharedPathAliases(t *testing.T) {
	for _, value := range []string{"var", "." + string(filepath.Separator) + "var", filepath.Join("var", "sample")} {
		if err := validateFactoryStateRoot(value); err == nil {
			t.Fatalf("accepted shared state path %q", value)
		}
	}
	shared, err := filepath.Abs("var")
	if err != nil {
		t.Fatal(err)
	}
	if err := validateFactoryStateRoot(shared); err == nil {
		t.Fatalf("accepted absolute shared state path %q", shared)
	}
	repositoryShared, err := filepath.Abs(filepath.Join("..", "..", "..", "var"))
	if err != nil {
		t.Fatal(err)
	}
	if err := validateFactoryStateRoot(repositoryShared); err == nil {
		t.Fatalf("accepted repository shared state path %q", repositoryShared)
	}
	if err := validateFactoryStateRoot(t.TempDir()); err != nil {
		t.Fatalf("rejected isolated state: %v", err)
	}
	alias := filepath.Join(t.TempDir(), "shared-alias")
	if err := os.Symlink(repositoryShared, alias); err == nil {
		if err := validateFactoryStateRoot(alias); err == nil {
			t.Fatalf("accepted shared state symlink %q", alias)
		}
	}
}

func TestFactorySeedsCoverCurrentIndexAndReferenceSets(t *testing.T) {
	root := filepath.Join("..", "..", "..")
	keys, err := factorySeeds(
		filepath.Join(root, "storage/data/factorySpeciesIndex.json"),
		filepath.Join(root, "src/features/game/config/factoryReferenceSets/chunks"),
		filepath.Join(root, "src/features/game/config/specialForms.ts"),
	)
	if err != nil {
		t.Fatal(err)
	}
	seen := make(map[string]bool, len(keys))
	for _, key := range keys {
		seen[key] = true
	}
	for _, key := range []string{"pokemon/1", "pokemon/132", "pokemon/ogerpon-wellspring-mask", "move/sludge", "move/rock-tomb"} {
		if !seen[key] {
			t.Fatalf("missing %s", key)
		}
	}
	if seen["pokemon/201"] {
		t.Fatal("banned Unown became a factory seed")
	}
	if len(keys) < 1200 || len(keys) > 2000 {
		t.Fatalf("unexpected seed count %d", len(keys))
	}
}

func TestFactoryGenerationSeedsMatchCurrentPools(t *testing.T) {
	root := filepath.Join("..", "..", "..")
	index := filepath.Join(root, "storage/data/factorySpeciesIndex.json")
	sets := filepath.Join(root, "src/features/game/config/factoryReferenceSets/chunks")
	forms := filepath.Join(root, "src/features/game/config/specialForms.ts")
	// Counts include candidate pokemon keys and unique fixed reference move keys.
	for gen, expected := range []int{368, 271, 332, 116, 161, 79, 93, 95, 143} {
		keys, err := factorySeedsForGeneration(index, sets, forms, gen+1)
		if err != nil {
			t.Fatalf("generation %d: %v", gen+1, err)
		}
		if len(keys) != expected {
			t.Fatalf("generation %d: got %d seeds, want %d", gen+1, len(keys), expected)
		}
		if containsKey(keys, "pokemon/201") {
			t.Fatalf("generation %d includes banned Unown", gen+1)
		}
		if gen >= 3 {
			for _, key := range keys {
				if strings.HasPrefix(key, "move/") {
					t.Fatalf("generation %d unexpectedly has fixed reference move %s", gen+1, key)
				}
			}
		}
	}
	gen1, err := factorySeedsForGeneration(index, sets, forms, 1)
	if err != nil {
		t.Fatal(err)
	}
	if !containsKey(gen1, "pokemon/132") || containsKey(gen1, "pokemon/152") || !containsKey(gen1, "move/sludge") {
		t.Fatal("generation 1 mixed another pool or missed reference moves")
	}
	gen9, err := factorySeedsForGeneration(index, sets, forms, 9)
	if err != nil {
		t.Fatal(err)
	}
	if !containsKey(gen9, "pokemon/ogerpon-wellspring-mask") || containsKey(gen9, "pokemon/132") {
		t.Fatal("generation 9 special form or pool isolation mismatch")
	}
}

func TestFactoryGenerationRejectsInvalidValue(t *testing.T) {
	for _, raw := range []string{"0", "10", "-1", "1.5", "all", " 1"} {
		if _, err := parseFactoryGeneration(raw); err == nil {
			t.Fatalf("accepted %q", raw)
		}
	}
	for _, raw := range []string{"1", "9"} {
		if _, err := parseFactoryGeneration(raw); err != nil {
			t.Fatalf("rejected %q: %v", raw, err)
		}
	}
}

func containsKey(keys []string, target string) bool {
	for _, key := range keys {
		if key == target {
			return true
		}
	}
	return false
}
