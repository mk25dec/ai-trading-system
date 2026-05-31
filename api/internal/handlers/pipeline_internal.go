package handlers

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/joeydekruis/ai-trading-system/api/internal/config"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/services"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

type PipelineDeps struct {
	Store      *store.PipelineStore
	Cfg        config.Config
	Finbert    *services.FinbertClient
	Alpaca     *services.AlpacaClient
	YahooNews  *services.YahooNewsClient
}

type PipelineInternalHandler struct {
	PipelineDeps
}

type backlogUpsertRequest struct {
	Source         string         `json:"source"`
	URL            string         `json:"url"`
	Title          string         `json:"title"`
	PublishedAt    *time.Time     `json:"publishedAt"`
	DiscoveredAt   *time.Time     `json:"discoveredAt"`
	RawSymbolGuess []string       `json:"rawSymbolGuess"`
	Metadata       map[string]any `json:"metadata"`
}

func (h PipelineInternalHandler) UpsertBacklog(w http.ResponseWriter, r *http.Request) {
	var req backlogUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if req.Source == "" || req.URL == "" || req.Title == "" {
		WriteError(w, http.StatusBadRequest, "source, url, title required")
		return
	}
	item := models.NewsBacklogItem{
		Source:         req.Source,
		URL:            req.URL,
		CanonicalURL:   services.CanonicalURL(req.URL),
		Title:          req.Title,
		PublishedAt:    req.PublishedAt,
		RawSymbolGuess: req.RawSymbolGuess,
		Metadata:       req.Metadata,
	}
	if req.DiscoveredAt != nil {
		item.DiscoveredAt = *req.DiscoveredAt
	} else {
		item.DiscoveredAt = time.Now().UTC()
	}

	out, err := h.Store.UpsertBacklog(r.Context(), item)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "upsert failed")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h PipelineInternalHandler) NextBacklog(w http.ResponseWriter, r *http.Request) {
	limit := queryInt(r, "limit", 25)
	items, err := h.Store.NextBacklog(r.Context(), limit)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "query failed")
		return
	}
	if items == nil {
		items = []models.NewsBacklogItem{}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h PipelineInternalHandler) SetBacklogStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Status       models.BacklogStatus `json:"status"`
		ErrorMessage *string              `json:"errorMessage"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if err := h.Store.SetBacklogStatus(r.Context(), id, req.Status, req.ErrorMessage); err != nil {
		WriteError(w, http.StatusInternalServerError, "update failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h PipelineInternalHandler) ProcessBacklogBatch(w http.ResponseWriter, r *http.Request) {
	limit := queryInt(r, "limit", 10)
	items, err := h.Store.NextBacklog(r.Context(), limit)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "query failed")
		return
	}

	processed := 0
	for _, item := range items {
		raw, cleaned, fetchErr := services.FetchAndCleanArticle(r.Context(), item.URL, nil)
		if fetchErr != nil || len(cleaned) < 80 {
			msg := "fetch failed"
			if fetchErr != nil {
				msg = fetchErr.Error()
			}
			_ = h.Store.SetBacklogStatus(r.Context(), item.ID, models.BacklogFailed, &msg)
			continue
		}

		var rawPtr *string
		if raw != "" {
			rawPtr = &raw
		}
		article := models.NewsArticle{
			BacklogID:    &item.ID,
			Source:       item.Source,
			URL:          item.URL,
			CanonicalURL: item.CanonicalURL,
			Title:        item.Title,
			PublishedAt:  item.PublishedAt,
			DiscoveredAt: item.DiscoveredAt,
			RawText:      rawPtr,
			CleanedText:  cleaned,
			Language:     "en",
			TextHash:     services.TextHash(cleaned),
			Metadata:     item.Metadata,
		}
		if _, err := h.Store.UpsertArticle(r.Context(), article); err != nil {
			msg := err.Error()
			_ = h.Store.SetBacklogStatus(r.Context(), item.ID, models.BacklogFailed, &msg)
			continue
		}
		_ = h.Store.SetBacklogStatus(r.Context(), item.ID, models.BacklogFetched, nil)
		processed++
	}
	writeJSON(w, http.StatusOK, map[string]int{"processed": processed})
}

func (h PipelineInternalHandler) UpsertArticle(w http.ResponseWriter, r *http.Request) {
	var a models.NewsArticle
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if a.CanonicalURL == "" {
		a.CanonicalURL = services.CanonicalURL(a.URL)
	}
	if a.TextHash == "" {
		a.TextHash = services.TextHash(a.CleanedText)
	}
	out, err := h.Store.UpsertArticle(r.Context(), a)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "upsert failed")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h PipelineInternalHandler) UnmappedArticles(w http.ResponseWriter, r *http.Request) {
	limit := queryInt(r, "limit", 50)
	items, err := h.Store.UnmappedArticles(r.Context(), limit)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "query failed")
		return
	}
	if items == nil {
		items = []models.NewsArticle{}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h PipelineInternalHandler) MapArticleSymbols(w http.ResponseWriter, r *http.Request) {
	limit := queryInt(r, "limit", 50)
	remap := r.URL.Query().Get("remap") == "true"
	mapped, err := services.RemapArticleSymbols(r.Context(), h.Store, limit, remap)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "map failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"mapped": mapped})
}

func mergeSymbolGuesses(primary, extra []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, list := range [][]string{primary, extra} {
		for _, g := range list {
			sym := strings.ToUpper(strings.TrimSpace(g))
			if sym == "" || seen[sym] {
				continue
			}
			seen[sym] = true
			out = append(out, sym)
		}
	}
	return out
}

func mergeArticlesByID(primary, extra []models.NewsArticle) []models.NewsArticle {
	seen := map[string]bool{}
	out := make([]models.NewsArticle, 0, len(primary)+len(extra))
	for _, list := range [][]models.NewsArticle{primary, extra} {
		for _, a := range list {
			if seen[a.ID] {
				continue
			}
			seen[a.ID] = true
			out = append(out, a)
		}
	}
	return out
}

func (h PipelineInternalHandler) SetArticleSymbols(w http.ResponseWriter, r *http.Request) {
	articleID := chi.URLParam(r, "id")
	var req struct {
		Symbols []models.ArticleSymbol `json:"symbols"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	for i := range req.Symbols {
		req.Symbols[i].ArticleID = articleID
	}
	if err := h.Store.ReplaceArticleSymbols(r.Context(), articleID, req.Symbols); err != nil {
		WriteError(w, http.StatusInternalServerError, "save failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h PipelineInternalHandler) PendingSentiment(w http.ResponseWriter, r *http.Request) {
	limit := queryInt(r, "limit", 50)
	items, err := h.Store.PendingSentiment(r.Context(), limit)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "query failed")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h PipelineInternalHandler) RunSentimentBatch(w http.ResponseWriter, r *http.Request) {
	limit := queryInt(r, "limit", 20)
	pending, err := h.Store.PendingSentiment(r.Context(), limit)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "query failed")
		return
	}
	processed := 0
	var lastErr string

	type pendingItem struct {
		p         store.PendingSentimentRow
		text      string
		inputMode string
	}
	var batchItems []pendingItem
	var finbertBatch []services.FinbertBatchItem

	for _, p := range pending {
		text, inputMode := services.TextForFinBERT(p.Title, p.CleanedText)
		if strings.TrimSpace(text) == "" {
			lastErr = "empty text for sentiment"
			continue
		}
		id := p.ArticleID + ":" + p.Symbol
		batchItems = append(batchItems, pendingItem{p: p, text: text, inputMode: inputMode})
		finbertBatch = append(finbertBatch, services.FinbertBatchItem{ID: id, Text: text})
	}

	results := map[string]services.FinbertResult{}
	if len(finbertBatch) > 1 {
		var err error
		results, err = h.Finbert.AnalyzeBatch(r.Context(), finbertBatch)
		if err != nil {
			lastErr = err.Error()
			results = nil
		}
	}

	for _, item := range batchItems {
		id := item.p.ArticleID + ":" + item.p.Symbol
		var res services.FinbertResult
		if fr, ok := results[id]; ok {
			res = fr
		} else {
			var err error
			res, err = h.Finbert.AnalyzeFull(r.Context(), item.text)
			if err != nil {
				lastErr = err.Error()
				continue
			}
		}
		sent := services.ArticleSentimentFromFinbert(item.p.ArticleID, item.p.Symbol, res, item.inputMode)
		if err := h.Store.UpsertSentiment(r.Context(), sent); err != nil {
			lastErr = err.Error()
			continue
		}
		processed++
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"processed": processed,
		"attempted": len(pending),
		"lastError": lastErr,
		"finbertUrlConfigured":  h.Cfg.FinbertURL != "",
		"finbertKeyConfigured": h.Cfg.FinbertAPIKey != "",
	})
}

func (h PipelineInternalHandler) FinbertDiagnostics(w http.ResponseWriter, r *http.Request) {
	_, _, _, err := h.Finbert.Analyze(r.Context(), "Markets rally on strong earnings")
	out := map[string]any{
		"finbertUrlConfigured":  h.Cfg.FinbertURL != "",
		"finbertKeyConfigured": h.Cfg.FinbertAPIKey != "",
		"finbertUrl":           h.Cfg.FinbertURL,
	}
	if err != nil {
		out["ok"] = false
		out["error"] = err.Error()
	} else {
		out["ok"] = true
	}
	writeJSON(w, http.StatusOK, out)
}

func (h PipelineInternalHandler) UpsertSentiment(w http.ResponseWriter, r *http.Request) {
	var sent models.ArticleSentiment
	if err := json.NewDecoder(r.Body).Decode(&sent); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if err := h.Store.UpsertSentiment(r.Context(), sent); err != nil {
		WriteError(w, http.StatusInternalServerError, "upsert failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h PipelineInternalHandler) UpsertCandles(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Candles []models.MarketCandle `json:"candles"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	n, err := h.Store.UpsertCandles(r.Context(), req.Candles)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "upsert failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"inserted": n})
}

func (h PipelineInternalHandler) IngestAlpaca(w http.ResponseWriter, r *http.Request) {
	syms, err := h.Store.ActiveSymbols(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "symbols failed")
		return
	}
	candles, err := h.Alpaca.FetchDailyBars(r.Context(), syms, 60)
	if err != nil {
		WriteError(w, http.StatusBadGateway, err.Error())
		return
	}
	n, err := h.Store.UpsertCandles(r.Context(), candles)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "store failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"fetched": len(candles), "inserted": n})
}

func (h PipelineInternalHandler) GenerateMarketFeatures(w http.ResponseWriter, r *http.Request) {
	syms, err := h.Store.ActiveSymbols(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "symbols failed")
		return
	}
	generated := 0
	for _, sym := range syms {
		candles, err := h.Store.CandlesForSymbol(r.Context(), sym, "1Day", 60)
		if err != nil || len(candles) == 0 {
			continue
		}
		f := services.ComputeMarketFeatures(candles, "1Day")
		if f == nil {
			continue
		}
		if err := h.Store.UpsertMarketFeatures(r.Context(), *f); err != nil {
			continue
		}
		generated++
	}
	writeJSON(w, http.StatusOK, map[string]int{"generated": generated})
}

func (h PipelineInternalHandler) GenerateNewsFeatures(w http.ResponseWriter, r *http.Request) {
	now := time.Now().UTC()
	rows, err := h.Store.SentimentRowsSince(r.Context(), now.Add(-24*time.Hour))
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "query failed")
		return
	}
	syms, err := h.Store.ActiveSymbols(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "symbols failed")
		return
	}
	generated := 0
	for _, sym := range syms {
		sentRows := services.SentimentRowsFromDetails(rows)
		f := services.AggregateNewsFeatures(sym, sentRows, now)
		if err := h.Store.UpsertNewsFeatures(r.Context(), f); err != nil {
			continue
		}
		generated++
	}
	writeJSON(w, http.StatusOK, map[string]int{"generated": generated})
}

func (h PipelineInternalHandler) GenerateSnapshots(w http.ResponseWriter, r *http.Request) {
	syms, err := h.Store.ActiveSymbols(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "symbols failed")
		return
	}
	generated := 0
	for _, sym := range syms {
		mf, _ := h.Store.LatestMarketFeatures(r.Context(), sym)
		nf, _ := h.Store.LatestNewsFeatures(r.Context(), sym)
		snap := services.BuildSnapshot(sym, mf, nf)
		if err := h.Store.UpsertSnapshot(r.Context(), snap); err != nil {
			continue
		}
		generated++
	}
	writeJSON(w, http.StatusOK, map[string]int{"generated": generated})
}

func (h PipelineInternalHandler) GenerateWorkspaceSignals(w http.ResponseWriter, r *http.Request) {
	workspaceID := chi.URLParam(r, "workspace_id")
	n, err := h.generateSignalsForWorkspace(r.Context(), workspaceID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"generated": n})
}

func (h PipelineInternalHandler) generateSignalsForWorkspace(ctx context.Context, workspaceID string) (int, error) {
	watchlist, err := h.Store.Watchlist(ctx, workspaceID)
	if err != nil {
		return 0, err
	}
	if len(watchlist) == 0 {
		syms, _ := h.Store.ActiveSymbols(ctx)
		_ = h.Store.SetWatchlist(ctx, workspaceID, syms)
		watchlist, _ = h.Store.Watchlist(ctx, workspaceID)
	}

	var signals []models.WorkspaceSignal
	now := time.Now().UTC()
	expires := now.Add(6 * time.Hour)

	for _, w := range watchlist {
		if !w.IsActive {
			continue
		}
		mf, _ := h.Store.LatestMarketFeatures(ctx, w.Symbol)
		nf, _ := h.Store.LatestNewsFeatures(ctx, w.Symbol)
		rec := services.ComputeRecommendation(w.Symbol, mf, nf)
		sig := services.WorkspaceSignalFromRecommendation(workspaceID, w.Symbol, rec)
		sig.Timestamp = now
		sig.ExpiresAt = &expires
		signals = append(signals, sig)
	}

	if err := h.Store.InsertSignals(ctx, signals); err != nil {
		return 0, err
	}
	return len(signals), nil
}

func (h PipelineInternalHandler) GenerateAllWorkspaceSignals(w http.ResponseWriter, r *http.Request) {
	ids, err := h.Store.ListWorkspaceIDs(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "list workspaces failed")
		return
	}
	total := 0
	for _, id := range ids {
		n, err := h.generateSignalsForWorkspace(r.Context(), id)
		if err == nil {
			total += n
		}
	}
	writeJSON(w, http.StatusOK, map[string]int{"generated": total, "workspaces": len(ids)})
}

type workflowRunStartReq struct {
	WorkflowName string         `json:"workflowName"`
	RunID        *string        `json:"runId"`
	Metadata     map[string]any `json:"metadata"`
}

type workflowRunEndReq struct {
	RunID          string                  `json:"runId"`
	Status         models.WorkflowRunStatus `json:"status"`
	ItemsProcessed int                     `json:"itemsProcessed"`
	ErrorMessage   *string                 `json:"errorMessage"`
	DurationMs     int                     `json:"durationMs"`
}

func (h PipelineInternalHandler) StartWorkflowRun(w http.ResponseWriter, r *http.Request) {
	var req workflowRunStartReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	id, err := h.Store.StartWorkflowRun(r.Context(), req.WorkflowName, req.RunID, req.Metadata)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "start failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h PipelineInternalHandler) EndWorkflowRun(w http.ResponseWriter, r *http.Request) {
	var req workflowRunEndReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	// runId here is our DB id from start response
	if err := h.Store.EndWorkflowRun(r.Context(), req.RunID, req.Status, req.ItemsProcessed, req.ErrorMessage, req.DurationMs); err != nil {
		WriteError(w, http.StatusInternalServerError, "end failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// IngestRSS fetches a feed URL and upserts items (used by n8n or directly).
func (h PipelineInternalHandler) IngestRSS(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FeedURL string `json:"feedUrl"`
		Source  string `json:"source"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if req.FeedURL == "" {
		WriteError(w, http.StatusBadRequest, "feedUrl required")
		return
	}
	if req.Source == "" {
		req.Source = "rss"
	}

	httpReq, err := http.NewRequestWithContext(r.Context(), http.MethodGet, req.FeedURL, nil)
	if err != nil {
		WriteError(w, http.StatusBadGateway, "feed request failed")
		return
	}
	httpReq.Header.Set("User-Agent", "TradingAI-Bot/1.0")
	httpReq.Header.Set("Accept", "application/rss+xml, application/xml, text/xml, */*")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		WriteError(w, http.StatusBadGateway, "feed fetch failed")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		WriteError(w, http.StatusBadGateway, "feed returned non-200")
		return
	}

	var feed rssFeed
	if err := xml.NewDecoder(resp.Body).Decode(&feed); err != nil {
		WriteError(w, http.StatusBadGateway, "invalid rss")
		return
	}

	var yahooIndex *services.YahooRelatedTickersIndex
	if services.IsYahooFinanceRSS(req.FeedURL, req.Source) {
		yahoo := h.YahooNews
		if yahoo == nil {
			yahoo = &services.YahooNewsClient{}
		}
		var titleTickers []string
		for _, item := range feed.Channel.Items {
			titleTickers = append(titleTickers, services.SourceTickersFromTitle(strings.TrimSpace(item.Title))...)
		}
		trending, _ := yahoo.FetchTrendingSymbols(r.Context())
		querySymbols := services.CollectYahooNewsQuerySymbols(titleTickers, trending)
		if idx, err := yahoo.BuildYahooRelatedTickersIndex(r.Context(), querySymbols); err == nil {
			yahooIndex = idx
		}
	}

	upserted := 0
	for _, item := range feed.Channel.Items {
		if item.Link == "" || item.Title == "" {
			continue
		}
		var pub *time.Time
		if item.PubDate != "" {
			if t, err := time.Parse(time.RFC1123Z, item.PubDate); err == nil {
				pub = &t
			} else if t, err := time.Parse(time.RFC1123, item.PubDate); err == nil {
				pub = &t
			} else if t, err := time.Parse(time.RFC3339, item.PubDate); err == nil {
				pub = &t
			}
		}
		title := strings.TrimSpace(item.Title)
		related := []string(nil)
		if yahooIndex != nil {
			related = yahooIndex.Lookup(item.Link, item.GUID, title)
		}
		meta := map[string]any{"rss": true}
		if len(related) > 0 {
			meta["relatedTickers"] = related
		}
		_, err := h.Store.UpsertBacklog(r.Context(), models.NewsBacklogItem{
			Source:         req.Source,
			URL:            item.Link,
			CanonicalURL:   services.CanonicalURL(item.Link),
			Title:          title,
			PublishedAt:    pub,
			DiscoveredAt:   time.Now().UTC(),
			RawSymbolGuess: services.RSSSourceTickers(title, related),
			Metadata:       meta,
		})
		if err == nil {
			upserted++
		}
	}
	writeJSON(w, http.StatusOK, map[string]int{"upserted": upserted})
}

type rssFeed struct {
	Channel struct {
		Items []rssFeedItem `xml:"item"`
	} `xml:"channel"`
}

type rssFeedItem struct {
	Title   string `xml:"title"`
	Link    string `xml:"link"`
	PubDate string `xml:"pubDate"`
	GUID    string `xml:"guid"`
}

func queryInt(r *http.Request, key string, def int) int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}
