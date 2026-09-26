package web

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"pokefactory/backend/internal/assets"
	"pokefactory/backend/internal/content"
)

type Config struct {
	WebRoot            string
	StorageRoot        string
	StateRoot          string
	AllowUpstreamFetch bool
	HTTPClient         *http.Client
}

type App struct {
	handler       http.Handler
	pokeAPIStore  *content.Store
	csvStore      *content.Store
	cryStore      *content.Store
	spriteLibrary *assets.SpriteLibrary
	factoryIndex  string
	webRoot       string
}

func New(config Config) (*App, error) {
	if config.HTTPClient == nil {
		config.HTTPClient = &http.Client{Timeout: 20 * time.Second}
	}
	pokeAPIStore := content.NewStore(
		"pokeapi",
		"https://pokeapi.co/api/v2",
		config.StateRoot,
		config.AllowUpstreamFetch,
		true,
		config.HTTPClient,
	)
	csvStore := content.NewStore(
		"pokedex-csv",
		"https://raw.githubusercontent.com/veekun/pokedex/master/pokedex/data/csv",
		config.StateRoot,
		config.AllowUpstreamFetch,
		false,
		config.HTTPClient,
	)
	cryStore := content.NewStore(
		"pokeapi-cries",
		"https://raw.githubusercontent.com/PokeAPI/cries/main/cries",
		config.StateRoot,
		config.AllowUpstreamFetch,
		false,
		config.HTTPClient,
	)
	spriteFallback := content.NewStore(
		"pokeapi-sprites",
		"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites",
		config.StateRoot,
		config.AllowUpstreamFetch,
		false,
		config.HTTPClient,
	)
	spriteLibrary, err := assets.NewSpriteLibrary(filepath.Join(config.StorageRoot, "assets"), spriteFallback)
	if err != nil {
		return nil, err
	}

	app := &App{
		pokeAPIStore:  pokeAPIStore,
		csvStore:      csvStore,
		cryStore:      cryStore,
		spriteLibrary: spriteLibrary,
		factoryIndex:  filepath.Join(config.StorageRoot, "data", "factorySpeciesIndex.json"),
		webRoot:       config.WebRoot,
	}
	app.handler = app.routes()
	return app, nil
}

func (app *App) Handler() http.Handler {
	return app.handler
}

func (app *App) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", app.serveHealth)
	mux.HandleFunc("/api/content/version", app.serveContentVersion)
	mux.HandleFunc("/api/data/factory-species-index", app.serveFactoryIndex)
	mux.Handle("/api/pokeapi/", app.contentHandler("/api/pokeapi/", app.pokeAPIStore, "public, max-age=300"))
	mux.Handle("/api/pokedex-csv/", app.contentHandler("/api/pokedex-csv/", app.csvStore, "public, max-age=86400"))
	mux.Handle("/api/pokeapi-cries/", app.contentHandler("/api/pokeapi-cries/", app.cryStore, "public, max-age=604800"))
	mux.Handle("/api/pokeapi-sprites/", app.spriteLibrary)
	mux.HandleFunc("/api/", func(responseWriter http.ResponseWriter, _ *http.Request) {
		http.Error(responseWriter, "api route not found", http.StatusNotFound)
	})
	mux.Handle("/", app.frontendHandler())
	return requestLogger(securityHeaders(mux))
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		responseWriter.Header().Set("X-Content-Type-Options", "nosniff")
		responseWriter.Header().Set("Referrer-Policy", "same-origin")
		next.ServeHTTP(responseWriter, request)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (recorder *statusRecorder) WriteHeader(status int) {
	recorder.status = status
	recorder.ResponseWriter.WriteHeader(status)
}

func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		startedAt := time.Now()
		recorder := &statusRecorder{ResponseWriter: responseWriter, status: http.StatusOK}
		next.ServeHTTP(recorder, request)
		log.Printf("%s %s %d %s", request.Method, request.URL.RequestURI(), recorder.status, time.Since(startedAt).Round(time.Millisecond))
	})
}

func writeJSON(responseWriter http.ResponseWriter, status int, value any) {
	responseWriter.Header().Set("Content-Type", "application/json; charset=utf-8")
	responseWriter.WriteHeader(status)
	_ = json.NewEncoder(responseWriter).Encode(value)
}

func (app *App) serveHealth(responseWriter http.ResponseWriter, _ *http.Request) {
	writeJSON(responseWriter, http.StatusOK, map[string]string{"status": "ok", "runtime": "go"})
}

func (app *App) serveContentVersion(responseWriter http.ResponseWriter, _ *http.Request) {
	writeJSON(responseWriter, http.StatusOK, map[string]string{
		"pokeapi": app.pokeAPIStore.ActiveVersion(),
		"csv":     app.csvStore.ActiveVersion(),
		"cries":   app.cryStore.ActiveVersion(),
		"sprites": app.spriteLibrary.Version(),
	})
}

func (app *App) serveFactoryIndex(responseWriter http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		responseWriter.Header().Set("Allow", "GET, HEAD")
		http.Error(responseWriter, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	responseWriter.Header().Set("Cache-Control", "public, max-age=86400")
	http.ServeFile(responseWriter, request, app.factoryIndex)
}

func (app *App) contentHandler(prefix string, store *content.Store, cacheControl string) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet && request.Method != http.MethodHead {
			responseWriter.Header().Set("Allow", "GET, HEAD")
			http.Error(responseWriter, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		key, err := content.NormalizeKey(strings.TrimPrefix(request.URL.Path, prefix), request.URL.RawQuery)
		if err != nil {
			http.Error(responseWriter, "invalid content path", http.StatusBadRequest)
			return
		}
		stored, source, err := store.Get(request.Context(), key)
		if err != nil {
			if status, contentType, body, ok := content.UpstreamStatus(err); ok {
				responseWriter.Header().Set("Content-Type", contentType)
				responseWriter.WriteHeader(status)
				_, _ = responseWriter.Write(body)
				return
			}
			if errors.Is(err, content.ErrNotStored) {
				writeJSON(responseWriter, http.StatusNotFound, map[string]string{"error": "content_not_synchronized"})
				return
			}
			log.Printf("content error: %v", err)
			writeJSON(responseWriter, http.StatusBadGateway, map[string]string{"error": "upstream_unavailable"})
			return
		}
		responseWriter.Header().Set("Content-Type", stored.ContentType)
		responseWriter.Header().Set("Cache-Control", cacheControl)
		responseWriter.Header().Set("X-Content-Store", source)
		if request.Method == http.MethodHead {
			return
		}
		_, _ = responseWriter.Write(stored.Body)
	})
}

func (app *App) frontendHandler() http.Handler {
	fileServer := http.FileServer(http.Dir(app.webRoot))
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet && request.Method != http.MethodHead {
			http.Error(responseWriter, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		requestPath := strings.TrimLeft(request.URL.Path, "/")
		cleanPath := filepath.Clean(requestPath)
		if filepath.IsAbs(cleanPath) || cleanPath == ".." || strings.HasPrefix(filepath.ToSlash(cleanPath), "../") {
			writeJSON(responseWriter, http.StatusBadRequest, map[string]string{"error": "invalid_path"})
			return
		}
		if cleanPath == "." {
			cleanPath = "index.html"
		}
		candidate := filepath.Join(app.webRoot, cleanPath)
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			if strings.Contains(request.URL.Path, "/assets/") {
				responseWriter.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else if extension := filepath.Ext(candidate); extension != "" {
				if mediaType := mime.TypeByExtension(extension); mediaType != "" {
					responseWriter.Header().Set("Content-Type", mediaType)
				}
				responseWriter.Header().Set("Cache-Control", "public, max-age=604800")
			}
			fileServer.ServeHTTP(responseWriter, request)
			return
		}

		indexPath := filepath.Join(app.webRoot, "index.html")
		indexFile, err := os.Open(indexPath)
		if err != nil {
			writeJSON(responseWriter, http.StatusServiceUnavailable, map[string]string{"error": "frontend_not_built"})
			return
		}
		defer indexFile.Close()
		responseWriter.Header().Set("Content-Type", "text/html; charset=utf-8")
		responseWriter.Header().Set("Cache-Control", "no-cache")
		responseWriter.WriteHeader(http.StatusOK)
		_, _ = io.Copy(responseWriter, indexFile)
	})
}

func (app *App) String() string {
	return fmt.Sprintf("PokeFactory(web=%s)", app.webRoot)
}
