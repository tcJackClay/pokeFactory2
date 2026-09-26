//go:build windows

package content

import (
	"syscall"
	"unsafe"
)

var moveFileEx = syscall.NewLazyDLL("kernel32.dll").NewProc("MoveFileExW")

func moveDirectoryNoReplace(source, target string) error {
	from, err := syscall.UTF16PtrFromString(source)
	if err != nil {
		return err
	}
	to, err := syscall.UTF16PtrFromString(target)
	if err != nil {
		return err
	}
	// Flags=0: no MOVEFILE_REPLACE_EXISTING and no cross-volume copy.
	result, _, callErr := moveFileEx.Call(uintptr(unsafe.Pointer(from)), uintptr(unsafe.Pointer(to)), 0)
	if result != 0 {
		return nil
	}
	return callErr
}
