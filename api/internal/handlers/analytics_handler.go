package handlers

import (
	"net/http"

	"github.com/joeydekruis/ai-trading-system/api/internal/duckdbstore"
)

type AnalyticsHandler struct {
	Store   func() *duckdbstore.Store
	DuckPath string
}

func (h AnalyticsHandler) Status(w http.ResponseWriter, r *http.Request) {
	store := h.Store()
	if store == nil {
		WriteError(w, http.StatusServiceUnavailable, "duckdb not ready")
		return
	}

	body, err := store.Status(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "duckdb status failed")
		return
	}
	body["path"] = h.DuckPath
	writeJSON(w, http.StatusOK, body)
}
