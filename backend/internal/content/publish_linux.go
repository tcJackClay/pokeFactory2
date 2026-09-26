//go:build linux

package content

import (
	"fmt"
	"runtime"
	"syscall"
	"unsafe"
)

// renameat2 with RENAME_NOREPLACE publishes a directory atomically without
// allowing another publisher's target to be replaced. Unsupported kernels
// and architectures fail closed rather than falling back to os.Rename.
func moveDirectoryNoReplace(source, target string) error {
	var renameat2 uintptr
	switch runtime.GOARCH {
	case "amd64":
		renameat2 = 316
	case "arm64":
		renameat2 = 276
	default:
		return fmt.Errorf("atomic no-replace directory publish is unavailable on linux/%s", runtime.GOARCH)
	}
	from, err := syscall.BytePtrFromString(source)
	if err != nil {
		return err
	}
	to, err := syscall.BytePtrFromString(target)
	if err != nil {
		return err
	}
	const renameNoReplace = 1
	_, _, errno := syscall.RawSyscall6(
		renameat2,
		^uintptr(99), uintptr(unsafe.Pointer(from)),
		^uintptr(99), uintptr(unsafe.Pointer(to)),
		renameNoReplace, 0,
	)
	runtime.KeepAlive(from)
	runtime.KeepAlive(to)
	if errno != 0 {
		return errno
	}
	return nil
}
