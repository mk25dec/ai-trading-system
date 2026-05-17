package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port              int
	DatabaseURL       string
	DuckDBPath        string
	JWTSecret         string
	CORSOrigin        string
	AdminEmail        string
	AdminPassword     string
	SecureCookies     bool
	InternalAPIKey    string
	FinbertURL        string
	FinbertAPIKey     string
	AlpacaDataURL     string
	AlpacaAPIKey      string
	AlpacaAPISecret   string
	FinnhubAPIKey     string
}

func Load() (Config, error) {
	port := 8090
	if v := os.Getenv("API_PORT"); v != "" {
		p, err := strconv.Atoi(v)
		if err != nil {
			return Config{}, fmt.Errorf("API_PORT: %w", err)
		}
		port = p
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return Config{}, fmt.Errorf("JWT_SECRET is required")
	}

	corsOrigin := os.Getenv("CORS_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "http://localhost:5173"
	}

	secure := os.Getenv("SECURE_COOKIES") == "true"

	duckPath := os.Getenv("DUCKDB_PATH")
	if duckPath == "" {
		duckPath = "/data/analytics.duckdb"
	}

	return Config{
		Port:            port,
		DatabaseURL:     dbURL,
		DuckDBPath:      duckPath,
		JWTSecret:       jwtSecret,
		CORSOrigin:      corsOrigin,
		AdminEmail:      os.Getenv("ADMIN_EMAIL"),
		AdminPassword:   os.Getenv("ADMIN_PASSWORD"),
		SecureCookies:   secure,
		InternalAPIKey:  os.Getenv("INTERNAL_API_KEY"),
		FinbertURL:      stringsTrimSuffix(envOr("FINBERT_URL", envOr("FINBERT_API_URL", "")), "/"),
		FinbertAPIKey:   os.Getenv("FINBERT_API_KEY"),
		AlpacaDataURL:   stringsTrimSuffix(envOr("ALPACA_DATA_URL", "https://data.alpaca.markets/v2"), "/"),
		AlpacaAPIKey:    os.Getenv("ALPACA_API_KEY"),
		AlpacaAPISecret: os.Getenv("ALPACA_API_SECRET"),
		FinnhubAPIKey:   os.Getenv("FINNHUB_API_KEY"),
	}, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func stringsTrimSuffix(s, suffix string) string {
	if s == "" {
		return s
	}
	return strings.TrimSuffix(s, suffix)
}
