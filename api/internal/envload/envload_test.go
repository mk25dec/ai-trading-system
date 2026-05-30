package envload

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadRepoDotenv(t *testing.T) {
	root := t.TempDir()
	envPath := filepath.Join(root, ".env")
	if err := os.WriteFile(envPath, []byte("ENVLOAD_TEST_KEY=from-dotenv\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	sub := filepath.Join(root, "api", "cmd")
	if err := os.MkdirAll(sub, 0o755); err != nil {
		t.Fatal(err)
	}
	t.Chdir(sub)

	_ = os.Unsetenv("ENVLOAD_TEST_KEY")
	if err := LoadRepoDotenv(); err != nil {
		t.Fatalf("LoadRepoDotenv: %v", err)
	}
	if got := os.Getenv("ENVLOAD_TEST_KEY"); got != "from-dotenv" {
		t.Fatalf("ENVLOAD_TEST_KEY = %q, want from-dotenv", got)
	}
}

func TestLoadRepoDotenvDoesNotOverrideExisting(t *testing.T) {
	root := t.TempDir()
	envPath := filepath.Join(root, ".env")
	if err := os.WriteFile(envPath, []byte("ENVLOAD_TEST_KEY=from-file\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(root); err != nil {
		t.Fatal(err)
	}
	t.Setenv("ENVLOAD_TEST_KEY", "preset")
	if err := LoadRepoDotenv(); err != nil {
		t.Fatalf("LoadRepoDotenv: %v", err)
	}
	if got := os.Getenv("ENVLOAD_TEST_KEY"); got != "preset" {
		t.Fatalf("ENVLOAD_TEST_KEY = %q, want preset", got)
	}
}
