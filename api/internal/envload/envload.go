// Package envload loads the repository root .env for local development.
// Variables already set in the process environment are not overwritten.
package envload

import (
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

// LoadRepoDotenv walks up from the working directory and loads the first .env found.
// If ENV_FILE is set, that path is loaded instead. Missing .env is not an error.
func LoadRepoDotenv() error {
	if p := os.Getenv("ENV_FILE"); p != "" {
		if _, err := os.Stat(p); err != nil {
			return err
		}
		return godotenv.Load(p)
	}
	dir, err := os.Getwd()
	if err != nil {
		return err
	}
	for {
		candidate := filepath.Join(dir, ".env")
		if _, err := os.Stat(candidate); err == nil {
			return godotenv.Load(candidate)
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return nil
		}
		dir = parent
	}
}
