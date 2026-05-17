package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/joeydekruis/ai-trading-system/api/internal/middleware"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/services"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

type ResearchHandler struct {
	Store         *store.PipelineStore
	Workspaces    *store.WorkspaceStore
	Finbert       *services.FinbertClient
	Alpaca        *services.AlpacaClient
	AlpacaFeed    string
	AlpacaKeySet  bool
}

func (h ResearchHandler) GetBoard(w http.ResponseWriter, r *http.Request) {
	workspaceID := chi.URLParam(r, "id")
	user := middleware.UserFromContext(r.Context())
	if !h.canAccessWorkspace(r, workspaceID, user) {
		WriteError(w, http.StatusForbidden, "access denied")
		return
	}

	ws, err := h.Workspaces.GetByID(r.Context(), workspaceID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "workspace not found")
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

	storedSignals, _ := h.Store.LatestSignalsBySymbol(r.Context(), workspaceID)
	rows := make([]models.ResearchStockRow, 0, len(symbols))
	diag := models.ResearchDiagnostics{
		AlpacaConfigured: h.AlpacaKeySet,
		AlpacaFeed:       h.AlpacaFeed,
	}

	for _, sym := range symbols {
		row, err := h.buildRow(r.Context(), sym, storedSignals[sym])
		if err != nil {
			continue
		}
		rows = append(rows, row)
		if len(row.Candles) > 0 {
			diag.SymbolsWithCandles++
		}
		if row.Market != nil {
			diag.SymbolsWithMarketFeatures++
		}
	}

	var refreshedAt *time.Time
	if len(rows) > 0 && rows[0].UpdatedAt != nil {
		t := *rows[0].UpdatedAt
		refreshedAt = &t
	}

	diag.Hint = researchHint(diag, len(symbols))

	writeJSON(w, http.StatusOK, models.ResearchBoard{
		WorkspaceID:   workspaceID,
		WorkspaceName: ws.Name,
		Symbols:       symbols,
		Rows:          rows,
		RefreshedAt:   refreshedAt,
		Diagnostics:   diag,
	})
}

func researchHint(d models.ResearchDiagnostics, symbolCount int) string {
	if symbolCount == 0 {
		return "Add symbols to your watchlist, then click Refresh data."
	}
	if !d.AlpacaConfigured {
		return "Set ALPACA_API_KEY and ALPACA_API_SECRET on the API service, then redeploy and click Refresh data."
	}
	if d.SymbolsWithCandles == 0 {
		return "No price candles in the database. Click Refresh data. Free Alpaca accounts need ALPACA_DATA_FEED=iex (default)."
	}
	if d.SymbolsWithMarketFeatures == 0 {
		return "Candles exist but market features are missing — click Refresh data again."
	}
	return ""
}

func (h ResearchHandler) Refresh(w http.ResponseWriter, r *http.Request) {
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

	result := models.ResearchRefreshResult{}
	var errs []string

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
	if len(symbols) == 0 {
		writeJSON(w, http.StatusOK, result)
		return
	}

	result.SymbolsProcessed = len(symbols)

	if err := h.Store.EnsureSymbols(r.Context(), symbols); err != nil {
		errs = append(errs, "ensure symbols: "+err.Error())
	}

	if h.Alpaca != nil && h.Alpaca.Key != "" {
		candles, err := h.Alpaca.FetchDailyBars(r.Context(), symbols, 90)
		if err != nil {
			errs = append(errs, "alpaca: "+err.Error())
		} else {
			result.CandlesFetched = len(candles)
			n, err := h.Store.UpsertCandles(r.Context(), candles)
			if err != nil {
				errs = append(errs, "candles: "+err.Error())
			} else {
				result.CandlesInserted = n
			}
		}
	} else {
		errs = append(errs, "alpaca credentials not configured")
	}

	now := time.Now().UTC()
	sentRows, _ := h.Store.SentimentRowsSince(r.Context(), now.Add(-24*time.Hour))

	for _, sym := range symbols {
		candles, err := h.Store.CandlesForSymbol(r.Context(), sym, "1Day", 90)
		if err != nil || len(candles) == 0 {
			continue
		}
		f := services.ComputeMarketFeatures(candles, "1Day")
		if f == nil {
			continue
		}
		_ = h.Store.UpsertMarketFeatures(r.Context(), *f)
	}

	allSent := make([]services.SentimentRow, 0, len(sentRows))
	for _, row := range sentRows {
		allSent = append(allSent, services.SentimentRow{
			Symbol: row.Symbol, Score: row.Score, Relevance: row.Relevance, At: row.At,
		})
	}
	for _, sym := range symbols {
		f := services.AggregateNewsFeatures(sym, allSent, now)
		_ = h.Store.UpsertNewsFeatures(r.Context(), f)
	}

	result.SentimentRuns = h.runSentimentBatch(r.Context(), 40)

	for _, sym := range symbols {
		mf, _ := h.Store.LatestMarketFeatures(r.Context(), sym)
		nf, _ := h.Store.LatestNewsFeatures(r.Context(), sym)
		snap := services.BuildSnapshot(sym, mf, nf)
		_ = h.Store.UpsertSnapshot(r.Context(), snap)
	}

	signals, sigErr := h.generateSignals(r.Context(), workspaceID, symbols)
	if sigErr != nil {
		errs = append(errs, sigErr.Error())
	} else {
		result.SignalsGenerated = len(signals)
		if err := h.Store.InsertSignals(r.Context(), signals); err != nil {
			errs = append(errs, "store signals: "+err.Error())
		}
	}

	if len(errs) > 0 {
		result.Errors = errs
	}
	writeJSON(w, http.StatusOK, result)
}

func (h ResearchHandler) buildRow(ctx context.Context, symbol string, stored models.WorkspaceSignal) (models.ResearchStockRow, error) {
	name, _ := h.Store.SymbolName(ctx, symbol)
	mf, _ := h.Store.LatestMarketFeatures(ctx, symbol)
	nf, _ := h.Store.LatestNewsFeatures(ctx, symbol)
	candles, _ := h.Store.CandlesForSymbol(ctx, symbol, "1Day", 90)
	headlines, _ := h.Store.RecentHeadlines(ctx, symbol, 5)

	for i, j := 0, len(candles)-1; i < j; i, j = i+1, j-1 {
		candles[i], candles[j] = candles[j], candles[i]
	}

	rec := services.ComputeRecommendation(symbol, mf, nf)
	var lastClose *float64
	if len(candles) > 0 {
		c := candles[len(candles)-1].Close
		lastClose = &c
	}

	var updatedAt *time.Time
	if mf != nil {
		t := mf.Timestamp
		updatedAt = &t
	} else if nf != nil {
		t := nf.Timestamp
		updatedAt = &t
	}

	var sigPtr *models.WorkspaceSignal
	if stored.ID != "" {
		s := stored
		sigPtr = &s
	}

	return models.ResearchStockRow{
		Symbol:         symbol,
		Name:           name,
		Recommendation: rec.Action,
		Confidence:     rec.Confidence,
		Score:          rec.Score,
		Bullets:        rec.Bullets,
		LastClose:      lastClose,
		Market:         mf,
		News:           nf,
		Candles:        candles,
		Headlines:      headlines,
		Signal:         sigPtr,
		UpdatedAt:      updatedAt,
	}, nil
}

func (h ResearchHandler) generateSignals(ctx context.Context, workspaceID string, symbols []string) ([]models.WorkspaceSignal, error) {
	now := time.Now().UTC()
	expires := now.Add(6 * time.Hour)
	var signals []models.WorkspaceSignal

	for _, sym := range symbols {
		mf, _ := h.Store.LatestMarketFeatures(ctx, sym)
		nf, _ := h.Store.LatestNewsFeatures(ctx, sym)
		rec := services.ComputeRecommendation(sym, mf, nf)
		sig := services.WorkspaceSignalFromRecommendation(workspaceID, sym, rec)
		sig.Timestamp = now
		sig.ExpiresAt = &expires
		signals = append(signals, sig)
	}
	return signals, nil
}

func (h ResearchHandler) runSentimentBatch(ctx context.Context, limit int) int {
	if h.Finbert == nil {
		return 0
	}
	pending, err := h.Store.PendingSentiment(ctx, limit)
	if err != nil {
		return 0
	}
	processed := 0
	for _, p := range pending {
		text := services.ExcerptForSentiment(p.Title, p.CleanedText, 1500)
		if strings.TrimSpace(text) == "" {
			continue
		}
		label, score, conf, err := h.Finbert.Analyze(ctx, text)
		if err != nil {
			continue
		}
		sent := models.ArticleSentiment{
			ArticleID:      p.ArticleID,
			Symbol:         p.Symbol,
			SentimentLabel: label,
			SentimentScore: score,
			Confidence:     conf,
			ModelName:      "finbert",
			InputMode:      "excerpt",
		}
		if err := h.Store.UpsertSentiment(ctx, sent); err != nil {
			continue
		}
		processed++
	}
	return processed
}

func (h ResearchHandler) canAccessWorkspace(r *http.Request, workspaceID string, user *models.User) bool {
	if user.PlatformRole == models.PlatformRoleAdmin {
		return true
	}
	_, ok, err := h.Workspaces.GetMemberRole(r.Context(), workspaceID, user.ID)
	return err == nil && ok
}

func normalizeSymbols(raw []string) []string {
	seen := make(map[string]struct{})
	var out []string
	for _, s := range raw {
		s = strings.ToUpper(strings.TrimSpace(s))
		if s == "" || len(s) > 12 {
			continue
		}
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}
