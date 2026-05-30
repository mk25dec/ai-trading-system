package duckdbstore

import (
	"context"
	"database/sql"
	_ "embed"
	"fmt"
	"os"
	"path/filepath"
)

//go:embed schema.sql
var schemaSQL string

type Store struct {
	db *sql.DB
}

func Open(path string) (*Store, error) {
	if path == "" {
		return nil, fmt.Errorf("duckdb path is empty")
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("create duckdb directory: %w", err)
	}

	db, err := openDuckDB(path)
	if err != nil {
		return nil, fmt.Errorf("open duckdb: %w", err)
	}

	db.SetMaxOpenConns(1)

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping duckdb: %w", err)
	}

	s := &Store{db: db}
	if err := s.migrate(context.Background()); err != nil {
		_ = db.Close()
		return nil, err
	}

	return s, nil
}

func (s *Store) DB() *sql.DB {
	return s.db
}

func (s *Store) Close() error {
	if s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *Store) migrate(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, schemaSQL); err != nil {
		return fmt.Errorf("apply duckdb schema: %w", err)
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO schema_migrations (version)
		SELECT 1
		WHERE NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 1)
	`)
	if err != nil {
		return fmt.Errorf("record duckdb migration: %w", err)
	}

	return nil
}

// Status reports migration version and row counts for operational checks.
func (s *Store) Status(ctx context.Context) (map[string]any, error) {
	var version int
	if err := s.db.QueryRowContext(ctx, `SELECT COALESCE(MAX(version), 0) FROM schema_migrations`).Scan(&version); err != nil {
		return nil, fmt.Errorf("schema version: %w", err)
	}

	counts := make(map[string]int64)
	for table, query := range map[string]string{
		"symbols":       `SELECT COUNT(*) FROM symbols`,
		"decision_logs": `SELECT COUNT(*) FROM decision_logs`,
	} {
		var n int64
		if err := s.db.QueryRowContext(ctx, query).Scan(&n); err != nil {
			return nil, fmt.Errorf("count %s: %w", table, err)
		}
		counts[table] = n
	}

	return map[string]any{
		"schema_version": version,
		"tables":         counts,
	}, nil
}
