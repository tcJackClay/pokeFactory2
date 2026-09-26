package assets

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveLocalSpriteVariants(t *testing.T) {
	root := t.TempDir()
	paths := map[string][]byte{
		"pokemon-sprites/front_default/0025-pikachu.png":    []byte("front"),
		"pokemon-sprites/back_default/0025-pikachu.png":     []byte("back"),
		"pokemon-sprites/official_artwork/0025-pikachu.png": []byte("art"),
	}
	for relative, body := range paths {
		fullPath := filepath.Join(root, filepath.FromSlash(relative))
		if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(fullPath, body, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	report := `{"generatedAt":"2026-08-19T00:00:00Z","entries":[{"id":25,"name":"pikachu","local":{"front_default":"pokemon-sprites/front_default/0025-pikachu.png","back_default":"pokemon-sprites/back_default/0025-pikachu.png","official_artwork":"pokemon-sprites/official_artwork/0025-pikachu.png"}}]}`
	if err := os.WriteFile(filepath.Join(root, "pokemon-sprites", "report.json"), []byte(report), 0o644); err != nil {
		t.Fatal(err)
	}
	library, err := NewSpriteLibrary(root, nil)
	if err != nil {
		t.Fatal(err)
	}

	for requestPath, expectedDirectory := range map[string]string{
		"pokemon/25.png":                        "front_default",
		"pokemon/back/25.png":                   "back_default",
		"pokemon/other/home/25.png":             "official_artwork",
		"pokemon/other/official-artwork/25.png": "official_artwork",
	} {
		resolved, ok := library.resolveLocalPath(requestPath)
		if !ok {
			t.Fatalf("expected %s to resolve", requestPath)
		}
		if filepath.Base(filepath.Dir(resolved)) != expectedDirectory || filepath.Base(resolved) != "0025-pikachu.png" {
			t.Fatalf("unexpected path for %s: %s", requestPath, resolved)
		}
	}
}
