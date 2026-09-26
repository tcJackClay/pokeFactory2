package main

import (
	"path/filepath"
	"testing"
)

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
