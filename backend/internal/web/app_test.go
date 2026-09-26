package web

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func writeFixture(t *testing.T, path string, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestGoAppServesHealthDataSpritesAndSPA(t *testing.T) {
	root := t.TempDir()
	webRoot := filepath.Join(root, "dist")
	storageRoot := filepath.Join(root, "storage")
	writeFixture(t, filepath.Join(webRoot, "index.html"), "<html>go frontend</html>")
	writeFixture(t, filepath.Join(storageRoot, "data", "factorySpeciesIndex.json"), "[]")
	writeFixture(t, filepath.Join(storageRoot, "assets", "pokemon-sprites", "front_default", "0025-pikachu.png"), "sprite")
	writeFixture(t, filepath.Join(storageRoot, "assets", "pokemon-sprites", "report.json"), `{"generatedAt":"v1","entries":[{"id":25,"name":"pikachu","local":{"front_default":"pokemon-sprites/front_default/0025-pikachu.png"}}]}`)

	app, err := New(Config{WebRoot: webRoot, StorageRoot: storageRoot, StateRoot: filepath.Join(root, "var")})
	if err != nil {
		t.Fatal(err)
	}

	for path, expectedStatus := range map[string]int{
		"/api/health":                         http.StatusOK,
		"/api/content/version":                http.StatusOK,
		"/api/data/factory-species-index":     http.StatusOK,
		"/api/pokeapi-sprites/pokemon/25.png": http.StatusOK,
		"/some/spa/route":                     http.StatusOK,
	} {
		request := httptest.NewRequest(http.MethodGet, path, nil)
		response := httptest.NewRecorder()
		app.Handler().ServeHTTP(response, request)
		if response.Code != expectedStatus {
			t.Fatalf("%s: expected %d, got %d: %s", path, expectedStatus, response.Code, response.Body.String())
		}
	}
}
