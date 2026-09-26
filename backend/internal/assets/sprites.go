package assets

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"pokefactory/backend/internal/content"
)

type spriteReport struct {
	GeneratedAt string        `json:"generatedAt"`
	Entries     []spriteEntry `json:"entries"`
}

type spriteEntry struct {
	ID    int               `json:"id"`
	Name  string            `json:"name"`
	Local map[string]string `json:"local"`
}

type SpriteLibrary struct {
	assetRoot   string
	generatedAt string
	byID        map[int]spriteEntry
	fallback    *content.Store
}

var spriteRequestPattern = regexp.MustCompile(`^(?:pokemon/)?(?:(back|other/home|other/official-artwork)/)?(\d+)\.png$`)

func NewSpriteLibrary(assetRoot string, fallback *content.Store) (*SpriteLibrary, error) {
	reportPath := filepath.Join(assetRoot, "pokemon-sprites", "report.json")
	reportData, err := os.ReadFile(reportPath)
	if err != nil {
		return nil, fmt.Errorf("read sprite report: %w", err)
	}
	var report spriteReport
	if err := json.Unmarshal(reportData, &report); err != nil {
		return nil, fmt.Errorf("parse sprite report: %w", err)
	}
	byID := make(map[int]spriteEntry, len(report.Entries))
	for _, entry := range report.Entries {
		byID[entry.ID] = entry
	}
	return &SpriteLibrary{
		assetRoot:   assetRoot,
		generatedAt: report.GeneratedAt,
		byID:        byID,
		fallback:    fallback,
	}, nil
}

func (library *SpriteLibrary) Version() string {
	return library.generatedAt
}

func (library *SpriteLibrary) resolveLocalPath(requestPath string) (string, bool) {
	match := spriteRequestPattern.FindStringSubmatch(strings.TrimLeft(requestPath, "/"))
	if match == nil {
		return "", false
	}
	id, err := strconv.Atoi(match[2])
	if err != nil {
		return "", false
	}
	entry, ok := library.byID[id]
	if !ok {
		return "", false
	}

	variant := "front_default"
	switch match[1] {
	case "back":
		variant = "back_default"
	case "other/home", "other/official-artwork":
		variant = "official_artwork"
	}
	relativePath := entry.Local[variant]
	if relativePath == "" && variant != "front_default" {
		relativePath = entry.Local["front_default"]
	}
	if relativePath == "" {
		return "", false
	}

	cleanRelative := filepath.Clean(filepath.FromSlash(relativePath))
	if filepath.IsAbs(cleanRelative) || strings.HasPrefix(filepath.ToSlash(cleanRelative), "../") {
		return "", false
	}
	resolved := filepath.Join(library.assetRoot, cleanRelative)
	if _, err := os.Stat(resolved); err != nil {
		return "", false
	}
	return resolved, true
}

func (library *SpriteLibrary) ServeHTTP(responseWriter http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		responseWriter.Header().Set("Allow", "GET, HEAD")
		http.Error(responseWriter, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	requestPath := strings.TrimPrefix(request.URL.Path, "/api/pokeapi-sprites/")
	if localPath, ok := library.resolveLocalPath(requestPath); ok {
		responseWriter.Header().Set("Cache-Control", "public, max-age=604800")
		responseWriter.Header().Set("X-Content-Store", "BUNDLED")
		http.ServeFile(responseWriter, request, localPath)
		return
	}

	key, err := content.NormalizeKey(requestPath, request.URL.RawQuery)
	if err != nil {
		http.Error(responseWriter, "invalid asset path", http.StatusBadRequest)
		return
	}
	if library.fallback == nil {
		http.Error(responseWriter, "asset not synchronized", http.StatusNotFound)
		return
	}
	stored, source, err := library.fallback.Get(request.Context(), key)
	if err != nil {
		if status, contentType, body, ok := content.UpstreamStatus(err); ok {
			responseWriter.Header().Set("Content-Type", contentType)
			responseWriter.WriteHeader(status)
			_, _ = responseWriter.Write(body)
			return
		}
		if err == content.ErrNotStored {
			http.Error(responseWriter, "asset not synchronized", http.StatusNotFound)
			return
		}
		http.Error(responseWriter, "asset unavailable", http.StatusBadGateway)
		return
	}
	responseWriter.Header().Set("Content-Type", stored.ContentType)
	responseWriter.Header().Set("Cache-Control", "public, max-age=604800")
	responseWriter.Header().Set("X-Content-Store", source)
	if request.Method == http.MethodHead {
		return
	}
	_, _ = responseWriter.Write(stored.Body)
}
