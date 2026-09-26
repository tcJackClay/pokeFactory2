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
	version := flag.String("version", defaultVersion, "要创建并激活的内容版本")
	stateRoot := flag.String("state", "var", "版本与运行缓存目录")
	manifestPath := flag.String("manifest", "backend/config/sync-manifest.json", "基础同步清单")
	factoryIndexPath := flag.String("factory-index", "storage/data/factorySpeciesIndex.json", "工厂物种索引")
	full := flag.Bool("full", false, "同步工厂物种并递归同步其招式、特性、形态和进化链")
	workers := flag.Int("workers", 6, "并发请求数")
	maxEntries := flag.Int("max-entries", 20000, "递归同步的最大条目数")
	flag.Parse()

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
	configured.PokeAPI = uniqueSorted(configured.PokeAPI)
	configured.CSV = uniqueSorted(configured.CSV)

	client := &http.Client{Timeout: 30 * time.Second}
	pokeAPIStore := content.NewStore("pokeapi", "https://pokeapi.co/api/v2", *stateRoot, true, true, client)
	csvStore := content.NewStore("pokedex-csv", "https://raw.githubusercontent.com/veekun/pokedex/master/pokedex/data/csv", *stateRoot, true, false, client)
	ctx := context.Background()

	log.Printf("syncing PokeAPI version=%s seeds=%d full=%t", *version, len(configured.PokeAPI), *full)
	pokeManifest, err := pokeAPIStore.PrepareVersion(ctx, content.SyncOptions{
		Version:    *version,
		Keys:       configured.PokeAPI,
		CrawlLinks: *full,
		Workers:    *workers,
		MaxEntries: *maxEntries,
	})
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("syncing CSV version=%s entries=%d", *version, len(configured.CSV))
	csvManifest, err := csvStore.PrepareVersion(ctx, content.SyncOptions{
		Version: *version,
		Keys:    configured.CSV,
		Workers: *workers,
	})
	if err != nil {
		log.Fatal(err)
	}
	if err := content.ActivateRelease(*stateRoot, *version); err != nil {
		log.Fatal(err)
	}

	log.Printf("activated version %s: pokeapi=%d csv=%d", *version, len(pokeManifest.Entries), len(csvManifest.Entries))
}
