package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
)

func canonicalStatePath(value string) (string, error) {
	absolute, err := filepath.Abs(value)
	if err != nil {
		return "", err
	}
	current := filepath.Clean(absolute)
	var suffix []string
	for {
		resolved, err := filepath.EvalSymlinks(current)
		if err == nil {
			for i := len(suffix) - 1; i >= 0; i-- {
				resolved = filepath.Join(resolved, suffix[i])
			}
			return filepath.Clean(resolved), nil
		}
		if !os.IsNotExist(err) {
			return "", err
		}
		parent := filepath.Dir(current)
		if parent == current {
			return "", fmt.Errorf("cannot resolve state path %q", value)
		}
		suffix = append(suffix, filepath.Base(current))
		current = parent
	}
}

func validateFactoryStateRoot(value string) error {
	target, err := canonicalStatePath(value)
	if err != nil {
		return err
	}
	workingDirectory, err := os.Getwd()
	if err != nil {
		return err
	}
	for directory := workingDirectory; ; directory = filepath.Dir(directory) {
		if directory == workingDirectory || isFactoryRepositoryRoot(directory) {
			shared, err := canonicalStatePath(filepath.Join(directory, "var"))
			if err != nil {
				return err
			}
			if statePathWithin(shared, target) {
				return fmt.Errorf("factory sync requires an isolated -state outside the shared var directory: %s", value)
			}
		}
		if filepath.Dir(directory) == directory {
			break
		}
	}
	return nil
}

func isFactoryRepositoryRoot(directory string) bool {
	_, manifestErr := os.Stat(filepath.Join(directory, "backend", "config", "sync-manifest.json"))
	_, indexErr := os.Stat(filepath.Join(directory, "storage", "data", "factorySpeciesIndex.json"))
	return manifestErr == nil && indexErr == nil
}

func statePathWithin(shared, target string) bool {
	if runtime.GOOS == "windows" {
		shared = strings.ToLower(shared)
		target = strings.ToLower(target)
	}
	relative, err := filepath.Rel(shared, target)
	return err == nil && (relative == "." || (relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))))
}

type factoryIndexEntry struct {
	Identifier string `json:"identifier"`
	SpeciesID  int    `json:"speciesId"`
	Gen        int    `json:"gen"`
}

var referenceSetPattern = regexp.MustCompile(`speciesId: (\d+), gen: (\d+), tier: \d+, moveNames: \[([^\]]*)\]`)
var quotedMovePattern = regexp.MustCompile(`'([^']+)'`)
var specialFormPattern = regexp.MustCompile(`pokeApiName: '([^']+)', gen: (\d+), requirement: '(DIRECT|HOLD_ITEM)'`)

func factorySeeds(indexPath, referenceDirectory, specialFormsPath string) ([]string, error) {
	var index []factoryIndexEntry
	if err := readJSON(indexPath, &index); err != nil {
		return nil, err
	}
	if len(index) == 0 {
		return nil, fmt.Errorf("factory index is empty")
	}
	byIdentifier := make(map[string]factoryIndexEntry, len(index))
	bySpecies := make(map[int]struct{}, len(index))
	keys := make([]string, 0, len(index)+1000)
	for _, entry := range index {
		if entry.SpeciesID <= 0 || entry.Gen < 1 || entry.Gen > 9 || entry.Identifier == "" {
			return nil, fmt.Errorf("invalid factory index entry: %+v", entry)
		}
		if _, exists := byIdentifier[entry.Identifier]; exists {
			return nil, fmt.Errorf("duplicate factory identifier: %s", entry.Identifier)
		}
		byIdentifier[entry.Identifier] = entry
		bySpecies[entry.SpeciesID] = struct{}{}
		if entry.SpeciesID != 201 {
			keys = append(keys, "pokemon/"+entry.Identifier)
		}
	}
	// The current global random path samples every baseline national ID in this range.
	for id := 1; id <= 1025; id++ {
		if id == 201 {
			continue
		}
		entry, ok := byIdentifier[strconv.Itoa(id)]
		if !ok || entry.SpeciesID != id {
			return nil, fmt.Errorf("factory index missing baseline pokemon/%d", id)
		}
	}
	formsSource, err := os.ReadFile(specialFormsPath)
	if err != nil {
		return nil, err
	}
	forms := specialFormPattern.FindAllStringSubmatch(string(formsSource), -1)
	if len(forms) == 0 {
		return nil, fmt.Errorf("no direct factory forms parsed from %s", specialFormsPath)
	}
	for _, match := range forms {
		if strings.HasPrefix(match[1], "unown-") {
			continue
		} // species 201 is banned from factory pools
		entry, ok := byIdentifier[match[1]]
		gen, _ := strconv.Atoi(match[2])
		if !ok || entry.Gen != gen {
			return nil, fmt.Errorf("factory index missing direct form %s gen %d", match[1], gen)
		}
	}
	files, err := filepath.Glob(filepath.Join(referenceDirectory, "chunk_*_*.ts"))
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return nil, fmt.Errorf("no factory reference chunks in %s", referenceDirectory)
	}
	setCount := 0
	for _, file := range files {
		source, err := os.ReadFile(file)
		if err != nil {
			return nil, err
		}
		for _, match := range referenceSetPattern.FindAllStringSubmatch(string(source), -1) {
			setCount++
			id, _ := strconv.Atoi(match[1])
			if id == 201 {
				continue
			}
			if _, ok := bySpecies[id]; !ok {
				return nil, fmt.Errorf("reference set species %d absent from factory index", id)
			}
			keys = append(keys, "pokemon/"+strconv.Itoa(id))
			moves := quotedMovePattern.FindAllStringSubmatch(match[3], -1)
			if len(moves) != 4 {
				return nil, fmt.Errorf("reference set species %d has %d moves", id, len(moves))
			}
			for _, move := range moves {
				keys = append(keys, "move/"+strings.ToLower(move[1]))
			}
		}
	}
	if setCount == 0 {
		return nil, fmt.Errorf("no factory reference sets parsed")
	}
	return uniqueSorted(keys), nil
}
