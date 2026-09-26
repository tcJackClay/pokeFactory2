package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"

	"pokefactory/backend/internal/content"
)

const (
	rogueTMSourceCommit  = "a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014"
	rogueTMInputDigest   = "353a1226dae0a7601cef5a3613572d35d0cf9a780299426a9cadc6a36e21bb9e"
	rogueTMMappingDigest = "20d76b0c244a45edd20ee5d789c64ce467a2efe2278e2e4c193037368f8953dc"
)

var factoryTMMoveKeyPattern = regexp.MustCompile(`^move/[a-z0-9]+(?:-[a-z0-9]+)*$`)

type factoryTMEntry struct {
	TM  string `json:"tm"`
	Key string `json:"key"`
}

type factoryTMSeedManifest struct {
	Source content.SeedProvenance `json:"source"`
	TMs    []factoryTMEntry       `json:"tms"`
}

func loadFactoryTMSeeds(path string) ([]string, *content.SeedProvenance, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, nil, err
	}
	var manifest factoryTMSeedManifest
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&manifest); err != nil {
		return nil, nil, fmt.Errorf("factory TM manifest: %w", err)
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return nil, nil, fmt.Errorf("factory TM manifest has trailing data: %v", err)
	}
	if manifest.Source.Repository != "Pokabbie/pokeemerald-rogue" ||
		manifest.Source.Commit != rogueTMSourceCommit ||
		manifest.Source.InputDigestSHA256 != rogueTMInputDigest ||
		manifest.Source.MappingDigestSHA256 != rogueTMMappingDigest {
		return nil, nil, fmt.Errorf("factory TM source provenance differs from pinned Rogue extraction")
	}
	if len(manifest.TMs) != 50 {
		return nil, nil, fmt.Errorf("factory TM manifest has %d entries, want 50", len(manifest.TMs))
	}
	keys := make([]string, 0, 50)
	seen := make(map[string]bool, 50)
	var canonical strings.Builder
	for index, entry := range manifest.TMs {
		wantTM := fmt.Sprintf("TM%02d", index+1)
		if entry.TM != wantTM || !factoryTMMoveKeyPattern.MatchString(entry.Key) || seen[entry.Key] {
			return nil, nil, fmt.Errorf("factory TM %d is missing, duplicate, or invalid: %+v", index+1, entry)
		}
		seen[entry.Key] = true
		keys = append(keys, entry.Key)
		fmt.Fprintf(&canonical, "%s %s\n", entry.TM, entry.Key)
	}
	if manifest.TMs[16].Key != "move/freeze-dry" || manifest.TMs[32].Key != "move/quiver-dance" {
		return nil, nil, fmt.Errorf("factory TM17 or TM33 differs from pinned Rogue moves")
	}
	digest := sha256.Sum256([]byte(canonical.String()))
	if hex.EncodeToString(digest[:]) != rogueTMMappingDigest {
		return nil, nil, fmt.Errorf("factory TM mapping digest differs from pinned Rogue extraction")
	}
	return keys, &manifest.Source, nil
}

func appendFactoryTMSeeds(base []string, tmKeys []string) []string {
	return uniqueSorted(append(append([]string(nil), base...), tmKeys...))
}

func factoryTMValidator(tmKeys []string) func(string, []byte) error {
	required := make(map[string]bool, len(tmKeys))
	for _, key := range tmKeys {
		required[key] = true
	}
	return func(key string, body []byte) error {
		if !required[key] {
			return nil
		}
		var value struct {
			ID   int    `json:"id"`
			Name string `json:"name"`
			PP   int    `json:"pp"`
			Type *struct {
				Name string `json:"name"`
			} `json:"type"`
			DamageClass *struct {
				Name string `json:"name"`
			} `json:"damage_class"`
			Target *struct {
				Name string `json:"name"`
			} `json:"target"`
			Meta        json.RawMessage `json:"meta"`
			StatChanges json.RawMessage `json:"stat_changes"`
		}
		if err := json.Unmarshal(body, &value); err != nil {
			return fmt.Errorf("invalid move JSON: %w", err)
		}
		if value.ID <= 0 || value.Name != strings.TrimPrefix(key, "move/") || value.PP <= 0 ||
			value.Type == nil || value.Type.Name == "" ||
			value.DamageClass == nil || !isFactoryMoveDamageClass(value.DamageClass.Name) ||
			value.Target == nil || value.Target.Name == "" ||
			len(value.Meta) == 0 || value.Meta[0] != '{' ||
			len(value.StatChanges) == 0 || value.StatChanges[0] != '[' {
			return fmt.Errorf("required move fields missing or disagree with %s", key)
		}
		return nil
	}
}

func isFactoryMoveDamageClass(value string) bool {
	return value == "physical" || value == "special" || value == "status"
}
