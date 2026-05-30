package handlers

import (
	"context"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/joeydekruis/ai-trading-system/api/internal/middleware"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/services"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

type PriceChartHandler struct {
	Store      *store.PipelineStore
	Workspaces *store.WorkspaceStore
	Alpaca     *services.AlpacaClient
}

func (h PriceChartHandler) GetSeries(w http.ResponseWriter, r *http.Request) {
	workspaceID := chi.URLParam(r, "id")
	user := middleware.UserFromContext(r.Context())
	if !h.canAccessWorkspace(r, workspaceID, user) {
		WriteError(w, http.StatusForbidden, "access denied")
		return
	}
	symbol := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("symbol")))
	if symbol == "" {
		WriteError(w, http.StatusBadRequest, "symbol query required")
		return
	}
	ok, err := watchlistContainsSymbol(r.Context(), h.Store, workspaceID, symbol)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "watchlist check failed")
		return
	}
	if !ok {
		WriteError(w, http.StatusForbidden, "symbol not on workspace watchlist")
		return
	}
	timeframe := normalizeChartTimeframe(r.URL.Query().Get("timeframe"))
	points, err := h.Store.ListPriceChartPoints(r.Context(), symbol, timeframe)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "chart query failed")
		return
	}
	if points == nil {
		points = []models.PriceChartPoint{}
	}
	writeJSON(w, http.StatusOK, models.PriceChartSeries{
		Symbol:    symbol,
		Timeframe: timeframe,
		Points:    points,
	})
}

func normalizeChartTimeframe(raw string) string {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "1DAY", "DAILY", "DAY":
		return "1Day"
	case "30MIN", "30M", "INTRADAY":
		return services.ChartIntradayTimeframe
	default:
		return services.ChartIntradayTimeframe
	}
}

func (h PriceChartHandler) Sync(w http.ResponseWriter, r *http.Request) {
	workspaceID := chi.URLParam(r, "id")
	user := middleware.UserFromContext(r.Context())
	if !h.canAccessWorkspace(r, workspaceID, user) {
		WriteError(w, http.StatusForbidden, "access denied")
		return
	}
	watchlist, err := h.Store.Watchlist(r.Context(), workspaceID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "watchlist failed")
		return
	}
	symbols := make([]string, 0, len(watchlist))
	for _, e := range watchlist {
		if e.IsActive {
			symbols = append(symbols, e.Symbol)
		}
	}
	result := models.PriceChartSyncResult{SymbolsProcessed: len(symbols)}
	if len(symbols) == 0 {
		writeJSON(w, http.StatusOK, result)
		return
	}
	fetched, updated, err := services.SyncWatchlistPriceHistory(r.Context(), h.Store, h.Alpaca, symbols)
	result.CandlesFetched = fetched
	result.PredictionsUpdated = updated
	if err != nil {
		result.Errors = []string{err.Error()}
	}
	writeJSON(w, http.StatusOK, result)
}

func (h PriceChartHandler) canAccessWorkspace(r *http.Request, workspaceID string, user *models.User) bool {
	if user == nil {
		return false
	}
	if user.PlatformRole == models.PlatformRoleAdmin {
		return true
	}
	_, ok, err := h.Workspaces.GetMemberRole(r.Context(), workspaceID, user.ID)
	return err == nil && ok
}

func watchlistContainsSymbol(ctx context.Context, st *store.PipelineStore, workspaceID, symbol string) (bool, error) {
	list, err := st.Watchlist(ctx, workspaceID)
	if err != nil {
		return false, err
	}
	for _, e := range list {
		if e.IsActive && e.Symbol == symbol {
			return true, nil
		}
	}
	return false, nil
}
