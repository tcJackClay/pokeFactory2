//go:build !windows && !linux

package content

import (
	"fmt"
	"runtime"
)

func moveDirectoryNoReplace(_, _ string) error {
	return fmt.Errorf("atomic no-replace directory publish is unavailable on %s", runtime.GOOS)
}
