package dbstore

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"path/filepath"
	"strings"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	migrations "github.com/radch-ai/esk-code/cgo/migrations"
	moderncsqlite "modernc.org/sqlite"
)

// HeadVersion returns the highest .up.sql migration version embedded in the binary.
func HeadVersion() (uint, error) {
	entries, err := fs.ReadDir(migrations.FS, ".")
	if err != nil {
		return 0, fmt.Errorf("read migrations: %w", err)
	}

	var max uint
	found := false
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".up.sql") {
			continue
		}
		m, err := source.DefaultParse(e.Name())
		if err != nil {
			continue
		}
		if !found || m.Version > max {
			max = m.Version
			found = true
		}
	}
	if !found {
		return 0, fmt.Errorf("no .up.sql migrations found")
	}
	return max, nil
}

func runMigrations(conn *sql.DB, path string) error {
	driver, err := sqlite.WithInstance(conn, &sqlite.Config{})
	if err != nil {
		return fmt.Errorf("migrate driver: %w", err)
	}

	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("migrate source: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", src, "sqlite", driver)
	if err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	version, dirty, verErr := m.Version()
	switch {
	case verErr == migrate.ErrNilVersion:
		// Fresh database — apply all migrations without a backup.
	case verErr != nil:
		return fmt.Errorf("migrate version: %w", verErr)
	case dirty:
		return fmt.Errorf("dirty database version %d; restore from backup or fix manually", version)
	default:
		if !isMemoryURI(path) {
			head, err := HeadVersion()
			if err != nil {
				return err
			}
			if version < head {
				if err := backupSQLite(conn, path); err != nil {
					return fmt.Errorf("backup before migrate: %w", err)
				}
			}
		}
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migrate up: %w", err)
	}
	// Do not call m.Close(): it closes the shared *sql.DB.
	return nil
}

type sqliteBackuper interface {
	NewBackup(dstURI string) (*moderncsqlite.Backup, error)
}

// backupSQLite writes a full online backup next to the database file.
// Destination: <dbPath>.bak-<unix>.
func backupSQLite(db *sql.DB, path string) error {
	fsPath, err := filesystemPath(path)
	if err != nil {
		return err
	}
	bakPath := fmt.Sprintf("%s.bak-%d", fsPath, time.Now().Unix())
	dstURI := "file:" + filepath.ToSlash(bakPath) + "?mode=rwc"

	ctx := context.Background()
	sqlConn, err := db.Conn(ctx)
	if err != nil {
		return fmt.Errorf("conn: %w", err)
	}
	defer sqlConn.Close()

	return sqlConn.Raw(func(driverConn any) error {
		backuper, ok := driverConn.(sqliteBackuper)
		if !ok {
			return fmt.Errorf("driver does not support NewBackup")
		}
		bk, err := backuper.NewBackup(dstURI)
		if err != nil {
			return fmt.Errorf("new backup: %w", err)
		}
		for {
			more, err := bk.Step(-1)
			if err != nil {
				_ = bk.Finish()
				return fmt.Errorf("backup step: %w", err)
			}
			if !more {
				break
			}
		}
		if err := bk.Finish(); err != nil {
			return fmt.Errorf("backup finish: %w", err)
		}
		return nil
	})
}

// filesystemPath returns a bare filesystem path for backup naming.
func filesystemPath(path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" || isMemoryURI(path) {
		return "", fmt.Errorf("backup requires a file-backed database path")
	}
	if strings.HasPrefix(path, "file:") {
		rest := strings.TrimPrefix(path, "file:")
		if i := strings.IndexByte(rest, '?'); i >= 0 {
			rest = rest[:i]
		}
		// file:///abs or file:/abs
		rest = strings.TrimPrefix(rest, "//")
		if rest == "" {
			return "", fmt.Errorf("empty file URI path")
		}
		return rest, nil
	}
	return path, nil
}
