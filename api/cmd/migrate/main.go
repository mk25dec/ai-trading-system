package main

import (
	"context"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joeydekruis/ai-trading-system/api/internal/db"
	"github.com/joeydekruis/ai-trading-system/api/internal/envload"
)

func main() {
	if err := envload.LoadRepoDotenv(); err != nil {
		log.Fatalf("load .env: %v", err)
	}
	ctx := context.Background()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		log.Fatal("DATABASE_URL is required")
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatal(err)
	}
	log.Println("migrations applied")
}
