//go:build !cgo

package duckdbstore

import "database/sql"

func openDuckDB(path string) (*sql.DB, error) {
	return nil, ErrUnavailable
}
