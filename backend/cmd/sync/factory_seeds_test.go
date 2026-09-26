package main

import (
	"os"
	"path/filepath"
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
