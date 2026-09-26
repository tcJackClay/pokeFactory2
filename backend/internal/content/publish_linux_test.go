//go:build linux && (amd64 || arm64)

package content

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLinuxPublishNeverReplacesExistingEmptyDirectory(t *testing.T) {
	root := t.TempDir()
	staging := filepath.Join(root, "candidate.tmp")
	final := filepath.Join(root, "candidate")
	if err := os.Mkdir(staging, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(final, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := moveDirectoryNoReplace(staging, final); err == nil {
		t.Fatal("replaced an existing empty directory")
	}
	if _, err := os.Stat(staging); err != nil {
		t.Fatalf("staging changed: %v", err)
	}
	if _, err := os.Stat(final); err != nil {
		t.Fatalf("target changed: %v", err)
	}
}
