//go:build windows

package content

import (
	"context"
	"os"
	"path/filepath"
	"syscall"
	"testing"
	"time"
)

func holdDirectoryWithoutDeleteShare(t *testing.T, directory string) syscall.Handle {
	t.Helper()
	name, err := syscall.UTF16PtrFromString(directory)
	if err != nil {
		t.Fatal(err)
	}
	handle, err := syscall.CreateFile(name, syscall.GENERIC_READ,
		syscall.FILE_SHARE_READ|syscall.FILE_SHARE_WRITE, nil, syscall.OPEN_EXISTING,
		syscall.FILE_FLAG_BACKUP_SEMANTICS, 0)
	if err != nil {
		t.Fatal(err)
	}
	return handle
}

func TestPublishRetriesTransientWindowsDirectoryOccupancy(t *testing.T) {
	root := t.TempDir()
	staging := filepath.Join(root, "candidate.1.tmp")
	final := filepath.Join(root, "candidate")
	if err := os.Mkdir(staging, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(staging, "manifest.json"), []byte(`{}`), 0o644); err != nil {
		t.Fatal(err)
	}
	handle := holdDirectoryWithoutDeleteShare(t, staging)
	released := make(chan struct{})
	go func() {
		time.Sleep(350 * time.Millisecond)
		_ = syscall.CloseHandle(handle)
		close(released)
	}()
	if err := publishVersionDirectoryWithMover(context.Background(), staging, final, moveDirectoryNoReplace, 2*time.Second); err != nil {
		t.Fatal(err)
	}
	<-released
	if _, err := os.Stat(filepath.Join(final, "manifest.json")); err != nil {
		t.Fatal(err)
	}
}

func TestPublishStopsAfterBoundedWindowsOccupancy(t *testing.T) {
	root := t.TempDir()
	staging := filepath.Join(root, "candidate.1.tmp")
	final := filepath.Join(root, "candidate")
	if err := os.Mkdir(staging, 0o755); err != nil {
		t.Fatal(err)
	}
	handle := holdDirectoryWithoutDeleteShare(t, staging)
	defer syscall.CloseHandle(handle)
	started := time.Now()
	if err := publishVersionDirectoryWithMover(context.Background(), staging, final, moveDirectoryNoReplace, 350*time.Millisecond); err == nil {
		t.Fatal("published while directory remained occupied")
	}
	if elapsed := time.Since(started); elapsed > time.Second {
		t.Fatalf("bounded retry took %s", elapsed)
	}
	if _, err := os.Stat(staging); err != nil {
		t.Fatalf("occupied staging was removed: %v", err)
	}
	if _, err := os.Stat(final); !os.IsNotExist(err) {
		t.Fatalf("occupied publish created target: %v", err)
	}
}
