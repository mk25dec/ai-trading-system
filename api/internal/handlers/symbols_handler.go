package handlers

import (
	"net/http"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/services"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

type SymbolsHandler struct {
	Store *store.PipelineStore
	SEC   *services.SECClient
}

type secSymbolSyncResponse = models.SECSymbolSyncResult

func (h SymbolsHandler) SyncSECCompanyTickers(w http.ResponseWriter, r *http.Request) {
	if h.Store == nil {
		WriteError(w, http.StatusServiceUnavailable, "symbol store not configured")
		return
	}
	sec := h.SEC
	if sec == nil {
		sec = &services.SECClient{}
	}

	entries, err := sec.FetchCompanyTickers(r.Context())
	if err != nil {
		WriteError(w, http.StatusBadGateway, err.Error())
		return
	}

	upserted, err := h.Store.UpsertSECSymbols(r.Context(), entries)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "database upsert failed")
		return
	}

	writeJSON(w, http.StatusOK, secSymbolSyncResponse{
		Fetched:  len(entries),
		Upserted: upserted,
	})
}
