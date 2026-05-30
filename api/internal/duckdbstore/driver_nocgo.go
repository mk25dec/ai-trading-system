//go:build !cgo

package duckdbstore

import (
	"database/sql"
	"errors"
)

// ErrUnavailable is returned when the API was built with CGO disabled. DuckDB
// requires CGO and a C toolchain (e.g. mingw-w64 on Windows).
var ErrUnavailable = errors.New(
	"duckdb unavailable: CGO is disabled — set CGO_ENABLED=1 and install a C compiler (mingw-w64 on Windows), or run the API in Docker/Linux",
)

func openDuckDB(path string) (*sql.DB, error) {
	return nil, ErrUnavailable
}
