package db

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	return pgxpool.New(ctx, databaseURL)
}

// ConnectWithRetry pings Postgres until reachable or attempts are exhausted.
func ConnectWithRetry(ctx context.Context, databaseURL string, attempts int, delay time.Duration) (*pgxpool.Pool, error) {
	if attempts < 1 {
		attempts = 1
	}

	logDatabaseTarget(databaseURL)

	var lastErr error
	for i := 1; i <= attempts; i++ {
		pool, err := pgxpool.New(ctx, databaseURL)
		if err != nil {
			lastErr = err
		} else if err := pool.Ping(ctx); err != nil {
			pool.Close()
			lastErr = err
		} else {
			if i > 1 {
				slog.Info("database connected", "attempt", i)
			}
			return pool, nil
		}

		slog.Warn("database connect retry", "attempt", i, "max", attempts, "err", lastErr)
		if i < attempts {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
		}
	}
	return nil, fmt.Errorf("database unavailable after %d attempts: %w", attempts, lastErr)
}

func logDatabaseTarget(databaseURL string) {
	u, err := url.Parse(databaseURL)
	if err != nil {
		slog.Info("database target", "parse", "failed")
		return
	}
	slog.Info("database target", "host", u.Host, "database", u.Path)
}
