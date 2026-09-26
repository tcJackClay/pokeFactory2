package content

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

var (
	ErrNotStored     = errors.New("content is not stored and upstream access is disabled")
	ErrInvalidKey    = errors.New("invalid content key")
	versionPattern   = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$`)
	pokeAPIURLPrefix = "https://pokeapi.co/api/v2/"
)

const runtimeCacheSchema = "v2"

type Entry struct {
	Key            string    `json:"key"`
	File           string    `json:"file"`
	SHA256         string    `json:"sha256"`
	ContentType    string    `json:"contentType"`
	Size           int64     `json:"size"`
	FetchedAt      time.Time `json:"fetchedAt"`
	DiscoveredFrom string    `json:"discoveredFrom,omitempty"`
}

type Manifest struct {
	Version   string           `json:"version"`
	CreatedAt time.Time        `json:"createdAt"`
	Source    string           `json:"source"`
	Entries   map[string]Entry `json:"entries"`
}

type ActivePointer struct {
	Version   string    `json:"version"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Response struct {
	Body        []byte
	ContentType string
	FetchedAt   time.Time
}

type SyncOptions struct {
	Version        string
	Keys           []string
	CrawlLinks     bool
	FactoryClosure bool
	Workers        int
	MaxEntries     int
	MaxBytes       int64
	MaxDuration    time.Duration
	Progress       func(SyncProgress)
}

type SyncProgress struct {
	Queued    int
	Completed int
	Bytes     int64
	Elapsed   time.Duration
	Types     map[string]int
	Parent    string
}

type upstreamError struct {
	StatusCode  int
	ContentType string
	Body        []byte
}

func (e *upstreamError) Error() string {
	return fmt.Sprintf("upstream returned HTTP %d", e.StatusCode)
}

func UpstreamStatus(err error) (int, string, []byte, bool) {
	var target *upstreamError
	if !errors.As(err, &target) {
		return 0, "", nil, false
	}
	return target.StatusCode, target.ContentType, target.Body, true
}

type flight struct {
	done     chan struct{}
	response Response
	err      error
}

type Store struct {
	namespace     string
	baseURL       string
	stateRoot     string
	allowUpstream bool
	rewriteJSON   bool
	client        *http.Client

	flightMu sync.Mutex
	flights  map[string]*flight
}

func NewStore(namespace, baseURL, stateRoot string, allowUpstream, rewriteJSON bool, client *http.Client) *Store {
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	return &Store{
		namespace:     namespace,
		baseURL:       strings.TrimRight(baseURL, "/"),
		stateRoot:     stateRoot,
		allowUpstream: allowUpstream,
		rewriteJSON:   rewriteJSON,
		client:        client,
		flights:       make(map[string]*flight),
	}
}

func NormalizeKey(pathValue, rawQuery string) (string, error) {
	decoded, err := url.PathUnescape(pathValue)
	if err != nil {
		return "", ErrInvalidKey
	}
	decoded = strings.Trim(decoded, "/")
	if decoded == "" || strings.Contains(decoded, "\\") || strings.ContainsRune(decoded, '\x00') {
		return "", ErrInvalidKey
	}
	for _, segment := range strings.Split(decoded, "/") {
		if segment == ".." || segment == "." {
			return "", ErrInvalidKey
		}
	}
	if rawQuery == "" {
		return decoded, nil
	}
	query, err := url.ParseQuery(rawQuery)
	if err != nil {
		return "", ErrInvalidKey
	}
	return decoded + "?" + query.Encode(), nil
}

func hashString(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func hashBytes(value []byte) string {
	sum := sha256.Sum256(value)
	return hex.EncodeToString(sum[:])
}

func (s *Store) namespaceRoot() string {
	return filepath.Join(s.stateRoot, s.namespace)
}

func (s *Store) runtimePaths(key string) (string, string) {
	hash := hashString(key)
	root := filepath.Join(s.namespaceRoot(), "runtime", runtimeCacheSchema)
	return filepath.Join(root, hash+".body"), filepath.Join(root, hash+".json")
}

func readJSONFile(path string, target any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, target)
}

func writeFileAtomic(path string, data []byte, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	temporary := fmt.Sprintf("%s.%d.tmp", path, time.Now().UnixNano())
	if err := os.WriteFile(temporary, data, mode); err != nil {
		return err
	}
	if err := renameWithRetry(temporary, path); err != nil {
		_ = os.Remove(temporary)
		return err
	}
	return nil
}

func renameWithRetry(oldPath, newPath string) error {
	var lastErr error
	for attempt := 0; attempt < 12; attempt++ {
		if err := os.Rename(oldPath, newPath); err == nil {
			return nil
		} else {
			lastErr = err
		}
		time.Sleep(time.Duration(attempt+1) * 50 * time.Millisecond)
	}
	return lastErr
}

func copyDirectory(sourceRoot, targetRoot string) error {
	if err := os.MkdirAll(targetRoot, 0o755); err != nil {
		return err
	}
	return filepath.WalkDir(sourceRoot, func(sourcePath string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		relativePath, err := filepath.Rel(sourceRoot, sourcePath)
		if err != nil || relativePath == "." {
			return err
		}
		targetPath := filepath.Join(targetRoot, relativePath)
		if entry.IsDir() {
			return os.MkdirAll(targetPath, 0o755)
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("refusing to copy symlink: %s", sourcePath)
		}
		data, err := os.ReadFile(sourcePath)
		if err != nil {
			return err
		}
		return os.WriteFile(targetPath, data, 0o644)
	})
}

func publishVersionDirectory(stagingRoot, finalRoot string) error {
	renameErr := renameWithRetry(stagingRoot, finalRoot)
	if renameErr == nil {
		return nil
	}
	if err := copyDirectory(stagingRoot, finalRoot); err != nil {
		_ = os.RemoveAll(finalRoot)
		return errors.Join(renameErr, err)
	}
	return nil
}

func (s *Store) activeManifest() (*Manifest, string, error) {
	pointerPath := filepath.Join(s.stateRoot, "current.json")
	var pointer ActivePointer
	if err := readJSONFile(pointerPath, &pointer); err != nil {
		if !os.IsNotExist(err) {
			return nil, "", err
		}
		pointerPath = filepath.Join(s.namespaceRoot(), "current.json")
		if err := readJSONFile(pointerPath, &pointer); err != nil {
			return nil, "", err
		}
	}
	if !versionPattern.MatchString(pointer.Version) {
		return nil, "", fmt.Errorf("invalid active version: %q", pointer.Version)
	}
	versionRoot := filepath.Join(s.namespaceRoot(), "versions", pointer.Version)
	var manifest Manifest
	if err := readJSONFile(filepath.Join(versionRoot, "manifest.json"), &manifest); err != nil {
		return nil, "", err
	}
	return &manifest, versionRoot, nil
}

func (s *Store) readVersioned(key string) (Response, bool) {
	manifest, versionRoot, err := s.activeManifest()
	if err != nil {
		return Response{}, false
	}
	entry, ok := manifest.Entries[key]
	if !ok || filepath.IsAbs(entry.File) || strings.Contains(filepath.ToSlash(entry.File), "../") {
		return Response{}, false
	}
	body, err := os.ReadFile(filepath.Join(versionRoot, filepath.FromSlash(entry.File)))
	if err != nil || hashBytes(body) != entry.SHA256 {
		return Response{}, false
	}
	return Response{Body: body, ContentType: entry.ContentType, FetchedAt: entry.FetchedAt}, true
}

func (s *Store) readRuntime(key string) (Response, bool) {
	bodyPath, metadataPath := s.runtimePaths(key)
	var entry Entry
	if err := readJSONFile(metadataPath, &entry); err != nil || entry.Key != key {
		return Response{}, false
	}
	body, err := os.ReadFile(bodyPath)
	if err != nil || hashBytes(body) != entry.SHA256 {
		return Response{}, false
	}
	return Response{Body: body, ContentType: entry.ContentType, FetchedAt: entry.FetchedAt}, true
}

func (s *Store) writeRuntime(key string, response Response) error {
	bodyPath, metadataPath := s.runtimePaths(key)
	entry := Entry{
		Key:         key,
		File:        filepath.Base(bodyPath),
		SHA256:      hashBytes(response.Body),
		ContentType: response.ContentType,
		Size:        int64(len(response.Body)),
		FetchedAt:   response.FetchedAt,
	}
	metadata, err := json.MarshalIndent(entry, "", "  ")
	if err != nil {
		return err
	}
	if err := writeFileAtomic(bodyPath, response.Body, 0o644); err != nil {
		return err
	}
	return writeFileAtomic(metadataPath, metadata, 0o644)
}

var upstreamURLReplacements = [][2]string{
	{"https://pokeapi.co/api/v2/", "/api/pokeapi/"},
	{"http://pokeapi.co/api/v2/", "/api/pokeapi/"},
	{"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/", "/api/pokeapi-sprites/"},
	{"https://raw.githubusercontent.com/PokeAPI/cries/main/cries/", "/api/pokeapi-cries/"},
	{"https://raw.githubusercontent.com/veekun/pokedex/master/pokedex/data/csv/", "/api/pokedex-csv/"},
	{"https://play.pokemonshowdown.com/sprites/", "/api/pokemon-showdown-sprites/"},
}

func rewriteExternalURLs(body []byte) []byte {
	result := append([]byte(nil), body...)
	for _, replacement := range upstreamURLReplacements {
		result = bytes.ReplaceAll(result, []byte(replacement[0]), []byte(replacement[1]))
	}
	return result
}

func (s *Store) fetchUpstream(ctx context.Context, key string) (Response, error) {
	upstreamURL := s.baseURL + "/" + key
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, upstreamURL, nil)
	if err != nil {
		return Response{}, err
	}
	request.Header.Set("Accept", "*/*")
	request.Header.Set("User-Agent", "PokeFactory-Go-Content-Sync/1.0")

	response, err := s.client.Do(request)
	if err != nil {
		return Response{}, err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, (64<<20)+1))
	if err != nil {
		return Response{}, err
	}
	if len(body) > 64<<20 {
		return Response{}, fmt.Errorf("response exceeds 64 MiB: %s", key)
	}
	contentType := response.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return Response{}, &upstreamError{StatusCode: response.StatusCode, ContentType: contentType, Body: body}
	}
	if s.rewriteJSON && strings.Contains(strings.ToLower(contentType), "application/json") {
		body = rewriteExternalURLs(body)
	}
	return Response{Body: body, ContentType: contentType, FetchedAt: time.Now().UTC()}, nil
}

func (s *Store) Get(ctx context.Context, key string) (Response, string, error) {
	if response, ok := s.readVersioned(key); ok {
		return response, "VERSION", nil
	}
	if response, ok := s.readRuntime(key); ok {
		return response, "RUNTIME", nil
	}
	if !s.allowUpstream {
		return Response{}, "MISS", ErrNotStored
	}

	s.flightMu.Lock()
	if existing := s.flights[key]; existing != nil {
		s.flightMu.Unlock()
		select {
		case <-ctx.Done():
			return Response{}, "MISS", ctx.Err()
		case <-existing.done:
			return existing.response, "RUNTIME", existing.err
		}
	}
	current := &flight{done: make(chan struct{})}
	s.flights[key] = current
	s.flightMu.Unlock()

	current.response, current.err = s.fetchUpstream(ctx, key)
	if current.err == nil {
		current.err = s.writeRuntime(key, current.response)
	}

	s.flightMu.Lock()
	delete(s.flights, key)
	close(current.done)
	s.flightMu.Unlock()
	return current.response, "UPSTREAM", current.err
}

func extractPokeAPIKeys(body []byte) []string {
	var value any
	if json.Unmarshal(body, &value) != nil {
		return nil
	}
	keys := make(map[string]struct{})
	var walk func(any)
	walk = func(current any) {
		switch typed := current.(type) {
		case string:
			var candidate string
			switch {
			case strings.HasPrefix(typed, pokeAPIURLPrefix):
				candidate = strings.TrimPrefix(typed, pokeAPIURLPrefix)
			case strings.HasPrefix(typed, "/api/pokeapi/"):
				candidate = strings.TrimPrefix(typed, "/api/pokeapi/")
			}
			if candidate != "" {
				parsed, err := url.Parse(candidate)
				if err == nil {
					key, keyErr := NormalizeKey(parsed.Path, parsed.RawQuery)
					if keyErr == nil && isCrawlableKey(key) {
						keys[key] = struct{}{}
					}
				}
			}
		case []any:
			for _, item := range typed {
				walk(item)
			}
		case map[string]any:
			for _, item := range typed {
				walk(item)
			}
		}
	}
	walk(value)
	result := make([]string, 0, len(keys))
	for key := range keys {
		result = append(result, key)
	}
	sort.Strings(result)
	return result
}

// Factory links are a one-hop dependency list from pokemon objects only.
// Subresources contain reverse relations that are not used by factory generation.
func extractFactoryKeys(parent string, body []byte) ([]string, error) {
	if !strings.HasPrefix(parent, "pokemon/") || strings.Contains(parent, "?") {
		return nil, nil
	}
	var value struct {
		Species struct {
			URL string `json:"url"`
		} `json:"species"`
		Abilities []struct {
			Ability struct {
				URL string `json:"url"`
			} `json:"ability"`
		} `json:"abilities"`
		Moves []struct {
			Move struct {
				URL string `json:"url"`
			} `json:"move"`
		} `json:"moves"`
	}
	if err := json.Unmarshal(body, &value); err != nil {
		return nil, fmt.Errorf("factory %s invalid JSON: %w", parent, err)
	}
	if value.Species.URL == "" || len(value.Abilities) == 0 || len(value.Moves) == 0 {
		return nil, fmt.Errorf("factory %s missing species, abilities or moves", parent)
	}
	result := make(map[string]struct{})
	add := func(rawURL, kind string) error {
		var resource string
		switch {
		case strings.HasPrefix(rawURL, pokeAPIURLPrefix):
			resource = strings.TrimPrefix(rawURL, pokeAPIURLPrefix)
		case strings.HasPrefix(rawURL, "http://pokeapi.co/api/v2/"):
			resource = strings.TrimPrefix(rawURL, "http://pokeapi.co/api/v2/")
		case strings.HasPrefix(rawURL, "/api/pokeapi/"):
			resource = strings.TrimPrefix(rawURL, "/api/pokeapi/")
		default:
			return fmt.Errorf("factory %s invalid %s URL: %q", parent, kind, rawURL)
		}
		resource = strings.Trim(resource, "/")
		key, err := NormalizeKey(resource, "")
		if err != nil || !strings.HasPrefix(key, kind+"/") || strings.Contains(key, "?") || strings.Count(key, "/") != 1 {
			return fmt.Errorf("factory %s invalid %s URL: %q", parent, kind, rawURL)
		}
		result[key] = struct{}{}
		return nil
	}
	if err := add(value.Species.URL, "pokemon-species"); err != nil {
		return nil, err
	}
	for _, item := range value.Abilities {
		if err := add(item.Ability.URL, "ability"); err != nil {
			return nil, err
		}
	}
	for _, item := range value.Moves {
		if err := add(item.Move.URL, "move"); err != nil {
			return nil, err
		}
	}
	keys := make([]string, 0, len(result))
	for key := range result {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys, nil
}

func isCrawlableKey(key string) bool {
	for _, prefix := range []string{"pokemon/", "pokemon-species/", "pokemon-form/", "move/", "ability/", "evolution-chain/"} {
		if strings.HasPrefix(key, prefix) {
			return true
		}
	}
	return false
}

type syncResult struct {
	key      string
	response Response
	err      error
}

func (s *Store) syncVersion(ctx context.Context, options SyncOptions, activate bool) (*Manifest, error) {
	if !versionPattern.MatchString(options.Version) {
		return nil, fmt.Errorf("invalid version %q", options.Version)
	}
	if options.Workers <= 0 {
		options.Workers = 4
	}
	if options.MaxEntries <= 0 {
		options.MaxEntries = 20_000
	}
	if options.FactoryClosure && options.CrawlLinks {
		return nil, errors.New("factory closure and generic crawl are mutually exclusive")
	}
	if options.MaxBytes < 0 || options.MaxDuration < 0 {
		return nil, errors.New("negative sync limit")
	}
	started := time.Now()
	if options.MaxDuration > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, options.MaxDuration)
		defer cancel()
	}

	seen := make(map[string]struct{})
	parentOf := make(map[string]string)
	pending := make([]string, 0, len(options.Keys))
	for _, rawKey := range options.Keys {
		parsed, err := url.Parse(rawKey)
		if err != nil {
			return nil, err
		}
		key, err := NormalizeKey(parsed.Path, parsed.RawQuery)
		if err != nil {
			return nil, err
		}
		if _, exists := seen[key]; !exists {
			seen[key] = struct{}{}
			parentOf[key] = "seed"
			pending = append(pending, key)
		}
	}
	if len(seen) > options.MaxEntries {
		return nil, fmt.Errorf("sync exceeded max entries at seeds: %d > %d", len(seen), options.MaxEntries)
	}

	root := s.namespaceRoot()
	finalRoot := filepath.Join(root, "versions", options.Version)
	if _, err := os.Stat(finalRoot); err == nil {
		return nil, fmt.Errorf("version already exists: %s", options.Version)
	}
	temporaryRoot := finalRoot + fmt.Sprintf(".%d.tmp", time.Now().UnixNano())
	if err := os.MkdirAll(filepath.Join(temporaryRoot, "objects"), 0o755); err != nil {
		return nil, err
	}
	defer os.RemoveAll(temporaryRoot)

	manifest := &Manifest{
		Version:   options.Version,
		CreatedAt: time.Now().UTC(),
		Source:    s.baseURL,
		Entries:   make(map[string]Entry),
	}
	var totalBytes int64
	typeCounts := make(map[string]int)

	for len(pending) > 0 {
		if err := ctx.Err(); err != nil {
			return nil, fmt.Errorf("sync deadline/cancellation: %w", err)
		}
		batchSize := options.Workers
		if len(pending) < batchSize {
			batchSize = len(pending)
		}
		batch := append([]string(nil), pending[:batchSize]...)
		pending = pending[batchSize:]
		results := make(chan syncResult, len(batch))
		var wait sync.WaitGroup
		for _, key := range batch {
			wait.Add(1)
			go func(key string) {
				defer wait.Done()
				response, err := s.fetchUpstream(ctx, key)
				results <- syncResult{key: key, response: response, err: err}
			}(key)
		}
		wait.Wait()
		close(results)

		ordered := make([]syncResult, 0, len(batch))
		for result := range results {
			ordered = append(ordered, result)
		}
		if options.FactoryClosure {
			sort.Slice(ordered, func(i, j int) bool { return ordered[i].key < ordered[j].key })
		}
		for _, result := range ordered {
			if result.err != nil {
				return nil, fmt.Errorf("sync %s: %w", result.key, result.err)
			}
			if err := ctx.Err(); err != nil {
				return nil, fmt.Errorf("sync %s deadline/cancellation: %w", result.key, err)
			}
			if options.MaxBytes > 0 && totalBytes+int64(len(result.response.Body)) > options.MaxBytes {
				return nil, fmt.Errorf("sync %s exceeded max bytes: %d > %d", result.key, totalBytes+int64(len(result.response.Body)), options.MaxBytes)
			}
			totalBytes += int64(len(result.response.Body))
			bodyHash := hashBytes(result.response.Body)
			relativeFile := filepath.ToSlash(filepath.Join("objects", bodyHash+".body"))
			if err := os.WriteFile(filepath.Join(temporaryRoot, filepath.FromSlash(relativeFile)), result.response.Body, 0o644); err != nil {
				return nil, err
			}
			manifest.Entries[result.key] = Entry{
				Key:            result.key,
				File:           relativeFile,
				SHA256:         bodyHash,
				ContentType:    result.response.ContentType,
				Size:           int64(len(result.response.Body)),
				FetchedAt:      result.response.FetchedAt,
				DiscoveredFrom: parentOf[result.key],
			}
			typeCounts[strings.SplitN(result.key, "/", 2)[0]]++

			if options.CrawlLinks && !strings.HasPrefix(result.key, "type/") && !strings.Contains(result.key, "?") {
				for _, discovered := range extractPokeAPIKeys(result.response.Body) {
					if _, exists := seen[discovered]; exists {
						continue
					}
					if len(seen) >= options.MaxEntries {
						return nil, fmt.Errorf("sync exceeded max entries: %d", options.MaxEntries)
					}
					seen[discovered] = struct{}{}
					parentOf[discovered] = result.key
					pending = append(pending, discovered)
				}
			}
			if options.FactoryClosure {
				discoveredKeys, err := extractFactoryKeys(result.key, result.response.Body)
				if err != nil {
					return nil, err
				}
				for _, discovered := range discoveredKeys {
					if _, exists := seen[discovered]; exists {
						continue
					}
					if len(seen) >= options.MaxEntries {
						return nil, fmt.Errorf("sync %s exceeded max entries: %d", result.key, options.MaxEntries)
					}
					seen[discovered] = struct{}{}
					parentOf[discovered] = result.key
					pending = append(pending, discovered)
				}
			}
			if options.Progress != nil {
				counts := make(map[string]int, len(typeCounts))
				for kind, count := range typeCounts {
					counts[kind] = count
				}
				options.Progress(SyncProgress{Queued: len(seen), Completed: len(manifest.Entries), Bytes: totalBytes, Elapsed: time.Since(started), Types: counts, Parent: parentOf[result.key]})
			}
		}
	}
	if err := ctx.Err(); err != nil {
		return nil, fmt.Errorf("sync deadline/cancellation before publish: %w", err)
	}
	if len(manifest.Entries) > options.MaxEntries {
		return nil, fmt.Errorf("sync manifest exceeded max entries: %d > %d", len(manifest.Entries), options.MaxEntries)
	}

	manifestData, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(filepath.Join(temporaryRoot, "manifest.json"), manifestData, 0o644); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(finalRoot), 0o755); err != nil {
		return nil, err
	}
	if err := publishVersionDirectory(temporaryRoot, finalRoot); err != nil {
		return nil, err
	}
	if activate {
		if err := ctx.Err(); err != nil {
			return nil, fmt.Errorf("sync deadline/cancellation before activation: %w", err)
		}
		pointerData, err := json.MarshalIndent(ActivePointer{Version: options.Version, UpdatedAt: time.Now().UTC()}, "", "  ")
		if err != nil {
			return nil, err
		}
		if err := writeFileAtomic(filepath.Join(root, "current.json"), pointerData, 0o644); err != nil {
			return nil, err
		}
	}
	return manifest, nil
}

func (s *Store) PrepareVersion(ctx context.Context, options SyncOptions) (*Manifest, error) {
	return s.syncVersion(ctx, options, false)
}

func (s *Store) SyncVersion(ctx context.Context, options SyncOptions) (*Manifest, error) {
	return s.syncVersion(ctx, options, true)
}

func ActivateRelease(stateRoot, version string) error {
	if !versionPattern.MatchString(version) {
		return fmt.Errorf("invalid version %q", version)
	}
	pointerData, err := json.MarshalIndent(ActivePointer{Version: version, UpdatedAt: time.Now().UTC()}, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomic(filepath.Join(stateRoot, "current.json"), pointerData, 0o644)
}

func (s *Store) ActiveVersion() string {
	manifest, _, err := s.activeManifest()
	if err != nil {
		return ""
	}
	return manifest.Version
}
