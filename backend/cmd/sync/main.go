package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"pokefactory/backend/internal/content"
)

type syncManifest struct {
	PokeAPI []string `json:"pokeapi"`
	CSV     []string `json:"csv"`
}

type factorySpeciesEntry struct {
	Identifier string `json:"identifier"`
	SpeciesID  int    `json:"speciesId"`
	PokemonID  int    `json:"pokemonId"`
}

func readJSON(path string, target any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, target)
}

func uniqueSorted(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		if value != "" {
			seen[value] = struct{}{}
		}
	}
	result := make([]string, 0, len(seen))
	for value := range seen {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func main() {
	defaultVersion := time.Now().UTC().Format("20060102T150405Z")
	version := flag.String("version", defaultVersion, "要创建的内容版本；-factory 仅准备，常规模式激活")
	stateRoot := flag.String("state", "var", "版本与运行缓存目录")
	manifestPath := flag.String("manifest", "backend/config/sync-manifest.json", "基础同步清单")
	factoryIndexPath := flag.String("factory-index", "storage/data/factorySpeciesIndex.json", "工厂物种索引")
	full := flag.Bool("full", false, "同步工厂物种并递归同步其招式、特性、形态和进化链")
	factory := flag.Bool("factory", false, "仅在隔离 state 准备 Classic 工厂有限闭包；不激活版本")
	factorySample := flag.String("factory-sample", "", "只准备一个索引中的 pokemon 标识符；不激活版本或同步基础清单/CSV")
	factoryGenerationRaw := flag.String("factory-generation", "", "仅在隔离 state 准备第 1–9 世代工厂闭包；不激活版本或同步基础清单/CSV")
	factoryTMManifestPath := flag.String("factory-tm-manifest", "backend/config/rogue-tm-moves.json", "固定 Rogue TM50 招式种子清单；工厂正式准备模式使用")
	referenceDirectory := flag.String("factory-reference-sets", "src/features/game/config/factoryReferenceSets/chunks", "工厂参考 set 分片目录")
	specialFormsPath := flag.String("factory-special-forms", "src/features/game/config/specialForms.ts", "允许直接抽取形态清单")
	workers := flag.Int("workers", 6, "并发请求数")
	maxEntries := flag.Int("max-entries", 0, "同步的最大条目数；0 使用范围默认值")
	maxBytes := flag.Int64("max-bytes", 0, "同步对象的最大累计字节数；0 使用范围默认值")
	maxDuration := flag.Duration("max-duration", 0, "同步总期限；0 使用范围默认值")
	pokeAPIBase := flag.String("pokeapi-base-url", "https://pokeapi.co/api/v2", "PokeAPI 来源根地址")
	flag.Parse()
	generation, err := parseFactoryGeneration(*factoryGenerationRaw)
	if err != nil {
		log.Fatal(err)
	}
	if *full && (*factory || *factorySample != "" || generation != 0) {
		log.Fatal("-full and factory modes are mutually exclusive")
	}
	if *factorySample != "" && generation != 0 {
		log.Fatal("-factory-sample and -factory-generation are mutually exclusive")
	}
	if *maxEntries < 0 || *maxBytes < 0 || *maxDuration < 0 {
		log.Fatal("sync limits must be nonnegative")
	}
	if *factorySample != "" || generation != 0 {
		*factory = true
	}
	if *factory {
		if err := validateFactoryStateRoot(*stateRoot); err != nil {
			log.Fatal(err)
		}
	}
	if *factorySample != "" {
		var index []factoryIndexEntry
		if err := readJSON(*factoryIndexPath, &index); err != nil {
			log.Fatal(err)
		}
		found := false
		for _, entry := range index {
			if entry.Identifier == *factorySample && entry.SpeciesID != 201 {
				found = true
				break
			}
		}
		if !found {
			log.Fatalf("factory sample %q is absent or banned", *factorySample)
		}
	}

	var configured syncManifest
	if err := readJSON(*manifestPath, &configured); err != nil {
		log.Fatal(err)
	}
	if *full {
		var species []factorySpeciesEntry
		if err := readJSON(*factoryIndexPath, &species); err != nil {
			log.Fatal(err)
		}
		for _, entry := range species {
			identifier := entry.Identifier
			if identifier == "" {
				identifier = strconv.Itoa(entry.PokemonID)
			}
			configured.PokeAPI = append(configured.PokeAPI,
				"pokemon/"+identifier,
				fmt.Sprintf("pokemon-species/%d", entry.SpeciesID),
			)
		}
	}
	if *factorySample != "" {
		configured.PokeAPI = []string{"pokemon/" + *factorySample}
	} else if generation != 0 {
		factoryKeys, err := factorySeedsForGeneration(*factoryIndexPath, *referenceDirectory, *specialFormsPath, generation)
		if err != nil {
			log.Fatal(err)
		}
		configured.PokeAPI = factoryKeys
	} else if *factory {
		factoryKeys, err := factorySeeds(*factoryIndexPath, *referenceDirectory, *specialFormsPath)
		if err != nil {
			log.Fatal(err)
		}
		configured.PokeAPI = append(configured.PokeAPI, factoryKeys...)
	}
	var factoryTMKeys []string
	var factoryTMSource *content.SeedProvenance
	if *factory && *factorySample == "" {
		factoryTMKeys, factoryTMSource, err = loadFactoryTMSeeds(*factoryTMManifestPath)
		if err != nil {
			log.Fatal(err)
		}
		configured.PokeAPI = appendFactoryTMSeeds(configured.PokeAPI, factoryTMKeys)
		log.Printf("pinned factory TMs=%d source=%s inputDigest=%s mappingDigest=%s", len(factoryTMKeys), factoryTMSource.Commit, factoryTMSource.InputDigestSHA256, factoryTMSource.MappingDigestSHA256)
	}
	configured.PokeAPI = uniqueSorted(configured.PokeAPI)
	configured.CSV = uniqueSorted(configured.CSV)
	if *maxEntries == 0 {
		switch {
		case *factorySample != "":
			*maxEntries = 200
		case generation != 0:
			*maxEntries = 3000
		case *factory:
			*maxEntries = 6000
		default:
			*maxEntries = 20000
		}
	}
	if *maxBytes == 0 {
		switch {
		case *factorySample != "":
			*maxBytes = 100 << 20
		case generation != 0:
			*maxBytes = 512 << 20
		case *factory:
			*maxBytes = 1 << 30
		}
	}
	if *maxDuration == 0 {
		switch {
		case *factorySample != "":
			*maxDuration = 2 * time.Minute
		case generation != 0:
			*maxDuration = 30 * time.Minute
		case *factory:
			*maxDuration = 90 * time.Minute
		}
	}
	if (*factorySample != "" || generation != 0) && *workers == 6 {
		*workers = 2
	}
	if *factory && *factorySample == "" && generation == 0 && *workers == 6 {
		*workers = 4
	}

	client := &http.Client{Timeout: 30 * time.Second}
	pokeAPIStore := content.NewStore("pokeapi", strings.TrimRight(*pokeAPIBase, "/"), *stateRoot, true, true, client)
	csvStore := content.NewStore("pokedex-csv", "https://raw.githubusercontent.com/veekun/pokedex/master/pokedex/data/csv", *stateRoot, true, false, client)
	ctx := context.Background()
	if *factory && *maxDuration > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, *maxDuration)
		defer cancel()
	}

	log.Printf("syncing PokeAPI version=%s seeds=%d full=%t factory=%t sample=%q generation=%d", *version, len(configured.PokeAPI), *full, *factory, *factorySample, generation)
	pokeManifest, err := pokeAPIStore.PrepareVersion(ctx, content.SyncOptions{
		Version:        *version,
		Keys:           configured.PokeAPI,
		CrawlLinks:     *full,
		FactoryClosure: *factory,
		Workers:        *workers,
		MaxEntries:     *maxEntries,
		MaxBytes:       *maxBytes,
		MaxDuration:    *maxDuration,
		RequiredKeys:   factoryTMKeys,
		ValidateObject: factoryTMValidator(factoryTMKeys),
		SeedProvenance: factoryTMSource,
		Progress: func(progress content.SyncProgress) {
			if progress.Completed == 1 || progress.Completed%25 == 0 || progress.Completed == progress.Queued {
				log.Printf("progress queued=%d completed=%d bytes=%d elapsed=%s parent=%s types=%v", progress.Queued, progress.Completed, progress.Bytes, progress.Elapsed.Round(time.Second), progress.Parent, progress.Types)
			}
		},
	})
	if err != nil {
		log.Fatal(err)
	}
	if *factorySample != "" || generation != 0 {
		log.Printf("factory subset prepared, not activated: version=%s generation=%d entries=%d", *version, generation, len(pokeManifest.Entries))
		return
	}
	if *factory && len(pokeManifest.Entries)+len(configured.CSV) > *maxEntries {
		log.Fatalf("factory entry limit exceeded including CSV: %d > %d", len(pokeManifest.Entries)+len(configured.CSV), *maxEntries)
	}
	csvOptions := content.SyncOptions{Version: *version, Keys: configured.CSV, Workers: *workers}
	if *factory {
		var usedBytes int64
		for _, entry := range pokeManifest.Entries {
			usedBytes += entry.Size
		}
		if len(configured.CSV) > 0 {
			remaining := *maxBytes - usedBytes
			if remaining <= 0 {
				log.Fatalf("factory byte limit exhausted before CSV: %d / %d", usedBytes, *maxBytes)
			}
			csvOptions.MaxBytes = remaining
		}
	}

	log.Printf("syncing CSV version=%s entries=%d", *version, len(configured.CSV))
	csvManifest, err := csvStore.PrepareVersion(ctx, csvOptions)
	if err != nil {
		log.Fatal(err)
	}
	if *factory {
		log.Printf("factory version prepared, not activated: version=%s pokeapi=%d csv=%d", *version, len(pokeManifest.Entries), len(csvManifest.Entries))
		return
	}
	if err := content.ActivateRelease(*stateRoot, *version); err != nil {
		log.Fatal(err)
	}

	log.Printf("activated version %s: pokeapi=%d csv=%d", *version, len(pokeManifest.Entries), len(csvManifest.Entries))
}
