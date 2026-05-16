package db

import (
	"context"
	"embed"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	body, err := migrationFS.ReadFile("migrations/001_init.sql")
	if err != nil {
		return fmt.Errorf("read migration: %w", err)
	}

	var exists bool
	err = pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'users'
		)`).Scan(&exists)
	if err != nil {
		return fmt.Errorf("check schema: %w", err)
	}
	if exists {
		return nil
	}

	_, err = pool.Exec(ctx, string(body))
	if err != nil {
		return fmt.Errorf("apply migration: %w", err)
	}
	return nil
}
