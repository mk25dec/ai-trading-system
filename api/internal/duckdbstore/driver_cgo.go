//go:build cgo

package duckdbstore

import (
	"database/sql"

	_ "github.com/duckdb/duckdb-go/v2"
)

func openDuckDB(path string) (*sql.DB, error) {
	return sql.Open("duckdb", path)
}
