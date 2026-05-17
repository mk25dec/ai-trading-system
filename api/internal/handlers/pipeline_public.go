package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/joeydekruis/ai-trading-system/api/internal/middleware"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

type PipelinePublicHandler struct {
	Store      *store.PipelineStore
	Workspaces *store.WorkspaceStore
}

func (h PipelinePublicHandler) ListWorkflowRuns(w http.ResponseWriter, r *http.Request) {
	runs, err := h.Store.ListWorkflowRuns(r.Context(), 100)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "query failed")
		return
	}
	if runs == nil {
		runs = []models.WorkflowRun{}
	}
	writeJSON(w, http.StatusOK, runs)
}

func (h PipelinePublicHandler) ListBacklog(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	items, err := h.Store.ListBacklog(r.Context(), status, 100)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "query failed")
		return
	}
	if items == nil {
		items = []models.NewsBacklogItem{}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h PipelinePublicHandler) ListArticles(w http.ResponseWriter, r *http.Request) {
	items, err := h.Store.ListArticles(r.Context(), 100)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "query failed")
		return
	}
	if items == nil {
		items = []models.ArticleWithDetails{}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h PipelinePublicHandler) ListSymbols(w http.ResponseWriter, r *http.Request) {
	items, err := h.Store.ListSymbolsWithMarketStatus(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "query failed")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h PipelinePublicHandler) LatestSnapshots(w http.ResponseWriter, r *http.Request) {
	snaps, err := h.Store.LatestSnapshots(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "query failed")
		return
	}
	if snaps == nil {
		snaps = []models.SymbolFeatureSnapshot{}
	}
	writeJSON(w, http.StatusOK, snaps)
}

func (h PipelinePublicHandler) LatestMarketFeatures(w http.ResponseWriter, r *http.Request) {
	symbol := r.URL.Query().Get("symbol")
	if symbol == "" {
		WriteError(w, http.StatusBadRequest, "symbol required")
		return
	}
	f, err := h.Store.LatestMarketFeatures(r.Context(), symbol)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "query failed")
		return
	}
	if f == nil {
		writeJSON(w, http.StatusOK, map[string]any{})
		return
	}
	writeJSON(w, http.StatusOK, f)
}

func (h PipelinePublicHandler) LatestNewsFeatures(w http.ResponseWriter, r *http.Request) {
	symbol := r.URL.Query().Get("symbol")
	if symbol == "" {
		WriteError(w, http.StatusBadRequest, "symbol required")
		return
	}
	f, err := h.Store.LatestNewsFeatures(r.Context(), symbol)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "query failed")
		return
	}
	if f == nil {
		writeJSON(w, http.StatusOK, map[string]any{})
		return
	}
	writeJSON(w, http.StatusOK, f)
}

func (h PipelinePublicHandler) ListWorkspaceSignals(w http.ResponseWriter, r *http.Request) {
	workspaceID := chi.URLParam(r, "id")
	user := middleware.UserFromContext(r.Context())
	if !h.canAccessWorkspace(r, workspaceID, user) {
		WriteError(w, http.StatusForbidden, "access denied")
		return
	}
	signals, err := h.Store.ListSignals(r.Context(), workspaceID, 100)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "query failed")
		return
	}
	if signals == nil {
		signals = []models.WorkspaceSignal{}
	}
	writeJSON(w, http.StatusOK, signals)
}

func (h PipelinePublicHandler) GetWatchlist(w http.ResponseWriter, r *http.Request) {
	workspaceID := chi.URLParam(r, "id")
	user := middleware.UserFromContext(r.Context())
	if !h.canAccessWorkspace(r, workspaceID, user) {
		WriteError(w, http.StatusForbidden, "access denied")
		return
	}
	list, err := h.Store.Watchlist(r.Context(), workspaceID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "query failed")
		return
	}
	if list == nil {
		list = []models.WorkspaceWatchlistEntry{}
	}
	writeJSON(w, http.StatusOK, list)
}

func (h PipelinePublicHandler) SetWatchlist(w http.ResponseWriter, r *http.Request) {
	workspaceID := chi.URLParam(r, "id")
	user := middleware.UserFromContext(r.Context())
	role, ok, err := h.Workspaces.GetMemberRole(r.Context(), workspaceID, user.ID)
	if err != nil || (!ok && user.PlatformRole != models.PlatformRoleAdmin) {
		WriteError(w, http.StatusForbidden, "access denied")
		return
	}
	if ok && !store.CanManageWorkspace(role) && user.PlatformRole != models.PlatformRoleAdmin {
		WriteError(w, http.StatusForbidden, "admin required")
		return
	}

	var req struct {
		Symbols []string `json:"symbols"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	symbols := normalizeSymbols(req.Symbols)
	if err := h.Store.EnsureSymbols(r.Context(), symbols); err != nil {
		WriteError(w, http.StatusInternalServerError, "symbol setup failed")
		return
	}
	if err := h.Store.SetWatchlist(r.Context(), workspaceID, symbols); err != nil {
		WriteError(w, http.StatusInternalServerError, "save failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h PipelinePublicHandler) canAccessWorkspace(r *http.Request, workspaceID string, user *models.User) bool {
	if user.PlatformRole == models.PlatformRoleAdmin {
		return true
	}
	_, ok, err := h.Workspaces.GetMemberRole(r.Context(), workspaceID, user.ID)
	return err == nil && ok
}
