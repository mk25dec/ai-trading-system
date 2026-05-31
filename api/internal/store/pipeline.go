package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joeydekruis/ai-trading-system/api/internal/catalog"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

type PipelineStore struct {
	pool *pgxpool.Pool
}

func NewPipelineStore(pool *pgxpool.Pool) *PipelineStore {
	return &PipelineStore{pool: pool}
}

func (s *PipelineStore) UpsertBacklog(ctx context.Context, item models.NewsBacklogItem) (models.NewsBacklogItem, error) {
	rawGuess, _ := json.Marshal(item.RawSymbolGuess)
	meta, _ := json.Marshal(item.Metadata)
	if item.Metadata == nil {
		meta = []byte("{}")
	}
	if item.RawSymbolGuess == nil {
		rawGuess = []byte("[]")
	}

	var out models.NewsBacklogItem
	err := s.pool.QueryRow(ctx, `
		INSERT INTO news_backlog (source, url, canonical_url, title, published_at, discovered_at, raw_symbol_guess, status, metadata)
		VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()), $7::jsonb, 'new', $8::jsonb)
		ON CONFLICT (canonical_url) DO UPDATE SET
			title = EXCLUDED.title,
			raw_symbol_guess = EXCLUDED.raw_symbol_guess,
			metadata = news_backlog.metadata || EXCLUDED.metadata,
			updated_at = NOW()
		RETURNING id, source, url, canonical_url, title, published_at, discovered_at, raw_symbol_guess, status, error_message, metadata, created_at, updated_at`,
		item.Source, item.URL, item.CanonicalURL, item.Title, item.PublishedAt, item.DiscoveredAt, rawGuess, meta,
	).Scan(
		&out.ID, &out.Source, &out.URL, &out.CanonicalURL, &out.Title, &out.PublishedAt, &out.DiscoveredAt,
		&rawGuess, &out.Status, &out.ErrorMessage, &meta, &out.CreatedAt, &out.UpdatedAt,
	)
	if err != nil {
		return out, err
	}
	_ = json.Unmarshal(rawGuess, &out.RawSymbolGuess)
	_ = json.Unmarshal(meta, &out.Metadata)
	return out, nil
}

func (s *PipelineStore) ListBacklog(ctx context.Context, status string, limit int) ([]models.NewsBacklogItem, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	q := `SELECT id, source, url, canonical_url, title, published_at, discovered_at, raw_symbol_guess, status, error_message, metadata, created_at, updated_at
		FROM news_backlog`
	args := []any{limit}
	if status != "" {
		q += ` WHERE status = $2`
		args = []any{limit, status}
	}
	q += ` ORDER BY discovered_at DESC LIMIT $1`

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBacklogRows(rows)
}

func (s *PipelineStore) NextBacklog(ctx context.Context, limit int) ([]models.NewsBacklogItem, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, source, url, canonical_url, title, published_at, discovered_at, raw_symbol_guess, status, error_message, metadata, created_at, updated_at
		FROM news_backlog WHERE status = 'new'
		ORDER BY discovered_at ASC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBacklogRows(rows)
}

func scanBacklogRows(rows pgx.Rows) ([]models.NewsBacklogItem, error) {
	var list []models.NewsBacklogItem
	for rows.Next() {
		var item models.NewsBacklogItem
		var rawGuess, meta []byte
		if err := rows.Scan(
			&item.ID, &item.Source, &item.URL, &item.CanonicalURL, &item.Title, &item.PublishedAt, &item.DiscoveredAt,
			&rawGuess, &item.Status, &item.ErrorMessage, &meta, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(rawGuess, &item.RawSymbolGuess)
		_ = json.Unmarshal(meta, &item.Metadata)
		list = append(list, item)
	}
	return list, rows.Err()
}

func (s *PipelineStore) SetBacklogStatus(ctx context.Context, id string, status models.BacklogStatus, errMsg *string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE news_backlog SET status = $2, error_message = $3, updated_at = NOW() WHERE id = $1`,
		id, status, errMsg)
	return err
}

func (s *PipelineStore) GetBacklogByID(ctx context.Context, id string) (models.NewsBacklogItem, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, source, url, canonical_url, title, published_at, discovered_at, raw_symbol_guess, status, error_message, metadata, created_at, updated_at
		FROM news_backlog WHERE id = $1`, id)
	var item models.NewsBacklogItem
	var rawGuess, meta []byte
	if err := row.Scan(
		&item.ID, &item.Source, &item.URL, &item.CanonicalURL, &item.Title, &item.PublishedAt, &item.DiscoveredAt,
		&rawGuess, &item.Status, &item.ErrorMessage, &meta, &item.CreatedAt, &item.UpdatedAt,
	); err != nil {
		return item, err
	}
	_ = json.Unmarshal(rawGuess, &item.RawSymbolGuess)
	_ = json.Unmarshal(meta, &item.Metadata)
	return item, nil
}

func (s *PipelineStore) UpsertArticle(ctx context.Context, a models.NewsArticle) (models.NewsArticle, error) {
	meta, _ := json.Marshal(a.Metadata)
	if a.Metadata == nil {
		meta = []byte("{}")
	}
	var out models.NewsArticle
	err := s.pool.QueryRow(ctx, `
		INSERT INTO news_articles (backlog_id, source, url, canonical_url, title, published_at, discovered_at, fetched_at, raw_text, cleaned_text, language, text_hash, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, NOW()), NOW(), $8, $9, $10, $11, $12::jsonb)
		ON CONFLICT (canonical_url) DO UPDATE SET
			cleaned_text = EXCLUDED.cleaned_text,
			raw_text = EXCLUDED.raw_text,
			fetched_at = NOW(),
			updated_at = NOW()
		RETURNING id, backlog_id, source, url, canonical_url, title, published_at, discovered_at, fetched_at, raw_text, cleaned_text, language, text_hash, metadata, created_at, updated_at`,
		a.BacklogID, a.Source, a.URL, a.CanonicalURL, a.Title, a.PublishedAt, a.DiscoveredAt, a.RawText, a.CleanedText, a.Language, a.TextHash, meta,
	).Scan(
		&out.ID, &out.BacklogID, &out.Source, &out.URL, &out.CanonicalURL, &out.Title, &out.PublishedAt, &out.DiscoveredAt,
		&out.FetchedAt, &out.RawText, &out.CleanedText, &out.Language, &out.TextHash, &meta, &out.CreatedAt, &out.UpdatedAt,
	)
	if err != nil {
		return out, err
	}
	_ = json.Unmarshal(meta, &out.Metadata)
	return out, nil
}

func (s *PipelineStore) ListArticles(ctx context.Context, limit int) ([]models.ArticleWithDetails, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, backlog_id, source, url, canonical_url, title, published_at, discovered_at, fetched_at,
			raw_text, cleaned_text, language, text_hash, metadata, created_at, updated_at
		FROM news_articles ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var articles []models.ArticleWithDetails
	for rows.Next() {
		var a models.ArticleWithDetails
		var meta []byte
		if err := rows.Scan(
			&a.ID, &a.BacklogID, &a.Source, &a.URL, &a.CanonicalURL, &a.Title, &a.PublishedAt, &a.DiscoveredAt,
			&a.FetchedAt, &a.RawText, &a.CleanedText, &a.Language, &a.TextHash, &meta, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(meta, &a.Metadata)
		articles = append(articles, a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range articles {
		syms, _ := s.GetArticleSymbols(ctx, articles[i].ID)
		sent, _ := s.GetArticleSentiment(ctx, articles[i].ID)
		articles[i].Symbols = syms
		articles[i].Sentiment = sent
	}
	return articles, nil
}

func (s *PipelineStore) ListBacklogForSymbols(ctx context.Context, symbols []string, status string, limit int) ([]models.NewsBacklogItem, error) {
	if len(symbols) == 0 {
		return []models.NewsBacklogItem{}, nil
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	q := `SELECT id, source, url, canonical_url, title, published_at, discovered_at, raw_symbol_guess, status, error_message, metadata, created_at, updated_at
		FROM news_backlog b
		WHERE EXISTS (
			SELECT 1 FROM jsonb_array_elements_text(COALESCE(b.raw_symbol_guess, '[]'::jsonb)) AS elem
			WHERE upper(elem) = ANY($2)
		)`
	args := []any{limit, symbols}
	if status != "" {
		q += ` AND status = $3`
		args = []any{limit, symbols, status}
	}
	q += ` ORDER BY discovered_at DESC LIMIT $1`

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBacklogRows(rows)
}

func (s *PipelineStore) ListArticlesForSymbols(ctx context.Context, symbols []string, limit int) ([]models.ArticleWithDetails, error) {
	if len(symbols) == 0 {
		return []models.ArticleWithDetails{}, nil
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `
		SELECT a.id, a.backlog_id, a.source, a.url, a.canonical_url, a.title, a.published_at, a.discovered_at, a.fetched_at,
			a.raw_text, a.cleaned_text, a.language, a.text_hash, a.metadata, a.created_at, a.updated_at
		FROM news_articles a
		WHERE EXISTS (
			SELECT 1 FROM article_symbols s WHERE s.article_id = a.id AND s.symbol = ANY($2)
		)
		ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC LIMIT $1`, limit, symbols)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var articles []models.ArticleWithDetails
	for rows.Next() {
		var a models.ArticleWithDetails
		var meta []byte
		if err := rows.Scan(
			&a.ID, &a.BacklogID, &a.Source, &a.URL, &a.CanonicalURL, &a.Title, &a.PublishedAt, &a.DiscoveredAt,
			&a.FetchedAt, &a.RawText, &a.CleanedText, &a.Language, &a.TextHash, &meta, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(meta, &a.Metadata)
		articles = append(articles, a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	symbolSet := make(map[string]bool, len(symbols))
	for _, sym := range symbols {
		symbolSet[strings.ToUpper(sym)] = true
	}
	for i := range articles {
		syms, _ := s.GetArticleSymbols(ctx, articles[i].ID)
		sent, _ := s.GetArticleSentiment(ctx, articles[i].ID)
		articles[i].Symbols = filterArticleSymbols(syms, symbolSet)
		articles[i].Sentiment = filterArticleSentiment(sent, symbolSet)
	}
	return articles, nil
}

func filterArticleSymbols(syms []models.ArticleSymbol, allowed map[string]bool) []models.ArticleSymbol {
	if len(syms) == 0 {
		return syms
	}
	out := make([]models.ArticleSymbol, 0, len(syms))
	for _, sym := range syms {
		if allowed[strings.ToUpper(sym.Symbol)] {
			out = append(out, sym)
		}
	}
	return out
}

func filterArticleSentiment(sent []models.ArticleSentiment, allowed map[string]bool) []models.ArticleSentiment {
	if len(sent) == 0 {
		return sent
	}
	out := make([]models.ArticleSentiment, 0, len(sent))
	for _, s := range sent {
		if allowed[strings.ToUpper(s.Symbol)] {
			out = append(out, s)
		}
	}
	return out
}

func (s *PipelineStore) UnmappedArticles(ctx context.Context, limit int) ([]models.NewsArticle, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `
		SELECT a.id, a.backlog_id, a.source, a.url, a.canonical_url, a.title, a.published_at, a.discovered_at,
			a.fetched_at, a.raw_text, a.cleaned_text, a.language, a.text_hash, a.metadata, a.created_at, a.updated_at
		FROM news_articles a
		LEFT JOIN article_symbols s ON s.article_id = a.id
		WHERE s.article_id IS NULL AND length(a.cleaned_text) > 50
		ORDER BY a.created_at ASC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.NewsArticle
	for rows.Next() {
		var a models.NewsArticle
		var meta []byte
		if err := rows.Scan(
			&a.ID, &a.BacklogID, &a.Source, &a.URL, &a.CanonicalURL, &a.Title, &a.PublishedAt, &a.DiscoveredAt,
			&a.FetchedAt, &a.RawText, &a.CleanedText, &a.Language, &a.TextHash, &meta, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(meta, &a.Metadata)
		list = append(list, a)
	}
	return list, rows.Err()
}

func (s *PipelineStore) ArticlesForSymbolRemap(ctx context.Context, limit int) ([]models.NewsArticle, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `
		SELECT a.id, a.backlog_id, a.source, a.url, a.canonical_url, a.title, a.published_at, a.discovered_at,
			a.fetched_at, a.raw_text, a.cleaned_text, a.language, a.text_hash, a.metadata, a.created_at, a.updated_at
		FROM news_articles a
		WHERE length(a.cleaned_text) > 50
			AND EXISTS (SELECT 1 FROM article_symbols s WHERE s.article_id = a.id)
			AND (
				(SELECT count(*) FROM article_symbols s WHERE s.article_id = a.id) > 2
				OR NOT EXISTS (
					SELECT 1 FROM article_symbols s
					WHERE s.article_id = a.id
						AND strpos(upper(a.title), '(' || s.symbol || ')') > 0
				)
			)
		ORDER BY a.created_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanNewsArticleRows(rows)
}

func scanNewsArticleRows(rows pgx.Rows) ([]models.NewsArticle, error) {
	var list []models.NewsArticle
	for rows.Next() {
		var a models.NewsArticle
		var meta []byte
		if err := rows.Scan(
			&a.ID, &a.BacklogID, &a.Source, &a.URL, &a.CanonicalURL, &a.Title, &a.PublishedAt, &a.DiscoveredAt,
			&a.FetchedAt, &a.RawText, &a.CleanedText, &a.Language, &a.TextHash, &meta, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(meta, &a.Metadata)
		list = append(list, a)
	}
	return list, rows.Err()
}

func (s *PipelineStore) ReplaceArticleSymbols(ctx context.Context, articleID string, symbols []models.ArticleSymbol) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM article_symbols WHERE article_id = $1`, articleID); err != nil {
		return err
	}
	for _, sym := range symbols {
		if _, err := tx.Exec(ctx, `
			INSERT INTO article_symbols (article_id, symbol, relevance_score, detection_method, confidence)
			VALUES ($1, $2, $3, $4, $5)`,
			articleID, sym.Symbol, sym.RelevanceScore, sym.DetectionMethod, sym.Confidence); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *PipelineStore) GetArticleSymbols(ctx context.Context, articleID string) ([]models.ArticleSymbol, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT article_id, symbol, relevance_score, detection_method, confidence, created_at
		FROM article_symbols WHERE article_id = $1 ORDER BY relevance_score DESC`, articleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.ArticleSymbol
	for rows.Next() {
		var s models.ArticleSymbol
		if err := rows.Scan(&s.ArticleID, &s.Symbol, &s.RelevanceScore, &s.DetectionMethod, &s.Confidence, &s.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

type PendingSentimentRow struct {
	ArticleID   string
	Title       string
	CleanedText string
	Symbol      string
}

func (s *PipelineStore) PendingSentiment(ctx context.Context, limit int) ([]PendingSentimentRow, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `
		SELECT a.id, a.title, left(a.cleaned_text, 2000), s.symbol
		FROM article_symbols s
		JOIN news_articles a ON a.id = s.article_id
		LEFT JOIN article_sentiment sent ON sent.article_id = s.article_id AND sent.symbol = s.symbol
		WHERE sent.article_id IS NULL AND length(trim(a.cleaned_text)) > 0
		ORDER BY a.created_at ASC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []PendingSentimentRow
	for rows.Next() {
		var row PendingSentimentRow
		if err := rows.Scan(&row.ArticleID, &row.Title, &row.CleanedText, &row.Symbol); err != nil {
			return nil, err
		}
		list = append(list, row)
	}
	return list, rows.Err()
}

func (s *PipelineStore) UpsertSentiment(ctx context.Context, sent models.ArticleSentiment) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO article_sentiment (article_id, symbol, sentiment_label, sentiment_score, confidence,
			prob_positive, prob_negative, prob_neutral, model_name, model_version, input_mode)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (article_id, symbol) DO UPDATE SET
			sentiment_label = EXCLUDED.sentiment_label,
			sentiment_score = EXCLUDED.sentiment_score,
			confidence = EXCLUDED.confidence,
			prob_positive = EXCLUDED.prob_positive,
			prob_negative = EXCLUDED.prob_negative,
			prob_neutral = EXCLUDED.prob_neutral,
			model_name = EXCLUDED.model_name,
			model_version = EXCLUDED.model_version,
			input_mode = EXCLUDED.input_mode`,
		sent.ArticleID, sent.Symbol, sent.SentimentLabel, sent.SentimentScore, sent.Confidence,
		sent.ProbPositive, sent.ProbNegative, sent.ProbNeutral,
		sent.ModelName, sent.ModelVersion, sent.InputMode)
	return err
}

func (s *PipelineStore) DeleteSentimentForArticle(ctx context.Context, articleID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM article_sentiment WHERE article_id = $1`, articleID)
	return err
}

func (s *PipelineStore) GetArticleSentiment(ctx context.Context, articleID string) ([]models.ArticleSentiment, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT article_id, symbol, sentiment_label, sentiment_score, confidence,
			prob_positive, prob_negative, prob_neutral, model_name, model_version, input_mode, created_at
		FROM article_sentiment WHERE article_id = $1`, articleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.ArticleSentiment
	for rows.Next() {
		var s models.ArticleSentiment
		if err := rows.Scan(&s.ArticleID, &s.Symbol, &s.SentimentLabel, &s.SentimentScore, &s.Confidence,
			&s.ProbPositive, &s.ProbNegative, &s.ProbNeutral,
			&s.ModelName, &s.ModelVersion, &s.InputMode, &s.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

func (s *PipelineStore) ActiveSymbols(ctx context.Context) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT symbol FROM symbols WHERE is_active = TRUE ORDER BY symbol`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var syms []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			return nil, err
		}
		syms = append(syms, s)
	}
	return syms, rows.Err()
}

func (s *PipelineStore) UpsertCandles(ctx context.Context, candles []models.MarketCandle) (int, error) {
	if len(candles) == 0 {
		return 0, nil
	}
	batch := &pgx.Batch{}
	for _, c := range candles {
		batch.Queue(`
			INSERT INTO market_candles (symbol, timeframe, ts, open, high, low, close, volume, source)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (symbol, timeframe, ts, source) DO UPDATE SET
				open = EXCLUDED.open,
				high = EXCLUDED.high,
				low = EXCLUDED.low,
				close = EXCLUDED.close,
				volume = EXCLUDED.volume`,
			c.Symbol, c.Timeframe, c.Timestamp, c.Open, c.High, c.Low, c.Close, c.Volume, c.Source)
	}
	br := s.pool.SendBatch(ctx, batch)
	defer br.Close()
	inserted := 0
	for range candles {
		tag, err := br.Exec()
		if err != nil {
			return inserted, err
		}
		inserted += int(tag.RowsAffected())
	}
	return inserted, nil
}

func (s *PipelineStore) ListSymbolsWithMarketStatusForSymbols(ctx context.Context, symbols []string) ([]map[string]any, error) {
	if len(symbols) == 0 {
		return []map[string]any{}, nil
	}
	rows, err := s.pool.Query(ctx, `
		SELECT s.symbol, s.name, s.is_active,
			(SELECT max(ts) FROM market_candles c WHERE c.symbol = s.symbol AND c.timeframe = '1Day') AS latest_candle,
			(SELECT max(created_at) FROM market_candles c WHERE c.symbol = s.symbol AND c.timeframe = '1Day') AS data_fetched_at,
			(SELECT close FROM market_candles c WHERE c.symbol = s.symbol AND c.timeframe = '1Day' ORDER BY ts DESC LIMIT 1) AS last_close
		FROM symbols s WHERE s.symbol = ANY($1) AND s.is_active ORDER BY s.symbol`, symbols)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSymbolMarketStatus(rows)
}

func (s *PipelineStore) ListSymbolsWithMarketStatus(ctx context.Context) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT s.symbol, s.name, s.is_active,
			(SELECT max(ts) FROM market_candles c WHERE c.symbol = s.symbol AND c.timeframe = '1Day') AS latest_candle,
			(SELECT max(created_at) FROM market_candles c WHERE c.symbol = s.symbol AND c.timeframe = '1Day') AS data_fetched_at,
			(SELECT close FROM market_candles c WHERE c.symbol = s.symbol AND c.timeframe = '1Day' ORDER BY ts DESC LIMIT 1) AS last_close
		FROM symbols s WHERE s.is_active ORDER BY s.symbol`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSymbolMarketStatus(rows)
}

func scanSymbolMarketStatus(rows pgx.Rows) ([]map[string]any, error) {
	var list []map[string]any
	for rows.Next() {
		var sym, name string
		var active bool
		var latest, fetchedAt *time.Time
		var lastClose *float64
		if err := rows.Scan(&sym, &name, &active, &latest, &fetchedAt, &lastClose); err != nil {
			return nil, err
		}
		row := map[string]any{"symbol": sym, "name": name, "isActive": active}
		if latest != nil {
			row["latestCandleAt"] = latest
		}
		if fetchedAt != nil {
			row["dataFetchedAt"] = fetchedAt
		}
		if lastClose != nil {
			row["lastClose"] = *lastClose
		}
		list = append(list, row)
	}
	return list, rows.Err()
}

func (s *PipelineStore) UpsertMarketFeatures(ctx context.Context, f models.MarketFeatures) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO market_features (symbol, ts, timeframe, price_change_1h, price_change_24h, price_change_5d,
			volume_ratio, volatility, rsi, sma_20, sma_50, distance_sma_20, distance_sma_50)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (symbol, timeframe, ts) DO UPDATE SET
			price_change_1h = EXCLUDED.price_change_1h,
			price_change_24h = EXCLUDED.price_change_24h,
			price_change_5d = EXCLUDED.price_change_5d,
			volume_ratio = EXCLUDED.volume_ratio,
			volatility = EXCLUDED.volatility,
			rsi = EXCLUDED.rsi,
			sma_20 = EXCLUDED.sma_20,
			sma_50 = EXCLUDED.sma_50,
			distance_sma_20 = EXCLUDED.distance_sma_20,
			distance_sma_50 = EXCLUDED.distance_sma_50`,
		f.Symbol, f.Timestamp, f.Timeframe, f.PriceChange1h, f.PriceChange24h, f.PriceChange5d,
		f.VolumeRatio, f.Volatility, f.RSI, f.SMA20, f.SMA50, f.DistanceSMA20, f.DistanceSMA50)
	return err
}

func (s *PipelineStore) UpsertNewsFeatures(ctx context.Context, f models.NewsFeatures) error {
	finbertJSON, err := json.Marshal(f.Finbert)
	if err != nil {
		finbertJSON = []byte("{}")
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO news_features (symbol, ts, news_count_1h, news_count_4h, news_count_24h,
			avg_sentiment_1h, avg_sentiment_4h, avg_sentiment_24h, sentiment_momentum,
			negative_news_spike, positive_news_spike, max_relevance_score_24h, finbert_metrics)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
		ON CONFLICT (symbol, ts) DO UPDATE SET
			news_count_1h = EXCLUDED.news_count_1h,
			news_count_4h = EXCLUDED.news_count_4h,
			news_count_24h = EXCLUDED.news_count_24h,
			avg_sentiment_1h = EXCLUDED.avg_sentiment_1h,
			avg_sentiment_4h = EXCLUDED.avg_sentiment_4h,
			avg_sentiment_24h = EXCLUDED.avg_sentiment_24h,
			sentiment_momentum = EXCLUDED.sentiment_momentum,
			negative_news_spike = EXCLUDED.negative_news_spike,
			positive_news_spike = EXCLUDED.positive_news_spike,
			max_relevance_score_24h = EXCLUDED.max_relevance_score_24h,
			finbert_metrics = EXCLUDED.finbert_metrics`,
		f.Symbol, f.Timestamp, f.NewsCount1h, f.NewsCount4h, f.NewsCount24h,
		f.AvgSentiment1h, f.AvgSentiment4h, f.AvgSentiment24h, f.SentimentMomentum,
		f.NegativeNewsSpike, f.PositiveNewsSpike, f.MaxRelevanceScore24h, finbertJSON)
	return err
}

func (s *PipelineStore) UpsertSnapshot(ctx context.Context, snap models.SymbolFeatureSnapshot) error {
	mf, _ := json.Marshal(snap.MarketFeatures)
	nf, _ := json.Marshal(snap.NewsFeatures)
	missing, _ := json.Marshal(snap.MissingFields)
	_, err := s.pool.Exec(ctx, `
		INSERT INTO symbol_feature_snapshots (symbol, ts, market_features, news_features, combined_score, data_quality_score, missing_fields)
		VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7::jsonb)
		ON CONFLICT (symbol, ts) DO UPDATE SET
			market_features = EXCLUDED.market_features,
			news_features = EXCLUDED.news_features,
			combined_score = EXCLUDED.combined_score,
			data_quality_score = EXCLUDED.data_quality_score,
			missing_fields = EXCLUDED.missing_fields`,
		snap.Symbol, snap.Timestamp, mf, nf, snap.CombinedScore, snap.DataQualityScore, missing)
	return err
}

func (s *PipelineStore) LatestSnapshots(ctx context.Context) ([]models.SymbolFeatureSnapshot, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT ON (symbol) symbol, ts, market_features, news_features, combined_score, data_quality_score, missing_fields, created_at
		FROM symbol_feature_snapshots ORDER BY symbol, ts DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSnapshots(rows)
}

func (s *PipelineStore) LatestSnapshotsForSymbols(ctx context.Context, symbols []string) ([]models.SymbolFeatureSnapshot, error) {
	if len(symbols) == 0 {
		return []models.SymbolFeatureSnapshot{}, nil
	}
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT ON (symbol) symbol, ts, market_features, news_features, combined_score, data_quality_score, missing_fields, created_at
		FROM symbol_feature_snapshots
		WHERE symbol = ANY($1)
		ORDER BY symbol, ts DESC`, symbols)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSnapshots(rows)
}

func scanSnapshots(rows pgx.Rows) ([]models.SymbolFeatureSnapshot, error) {
	var list []models.SymbolFeatureSnapshot
	for rows.Next() {
		var snap models.SymbolFeatureSnapshot
		var mf, nf, missing []byte
		if err := rows.Scan(&snap.Symbol, &snap.Timestamp, &mf, &nf, &snap.CombinedScore, &snap.DataQualityScore, &missing, &snap.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(mf, &snap.MarketFeatures)
		_ = json.Unmarshal(nf, &snap.NewsFeatures)
		_ = json.Unmarshal(missing, &snap.MissingFields)
		list = append(list, snap)
	}
	return list, rows.Err()
}

func (s *PipelineStore) LatestMarketFeatures(ctx context.Context, symbol string) (*models.MarketFeatures, error) {
	var f models.MarketFeatures
	err := s.pool.QueryRow(ctx, `
		SELECT symbol, ts, timeframe, price_change_1h, price_change_24h, price_change_5d,
			volume_ratio, volatility, rsi, sma_20, sma_50, distance_sma_20, distance_sma_50, created_at
		FROM market_features WHERE symbol = $1 ORDER BY ts DESC LIMIT 1`, symbol).Scan(
		&f.Symbol, &f.Timestamp, &f.Timeframe, &f.PriceChange1h, &f.PriceChange24h, &f.PriceChange5d,
		&f.VolumeRatio, &f.Volatility, &f.RSI, &f.SMA20, &f.SMA50, &f.DistanceSMA20, &f.DistanceSMA50, &f.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (s *PipelineStore) LatestNewsFeatures(ctx context.Context, symbol string) (*models.NewsFeatures, error) {
	var f models.NewsFeatures
	var finbertJSON []byte
	err := s.pool.QueryRow(ctx, `
		SELECT symbol, ts, news_count_1h, news_count_4h, news_count_24h,
			avg_sentiment_1h, avg_sentiment_4h, avg_sentiment_24h, sentiment_momentum,
			negative_news_spike, positive_news_spike, max_relevance_score_24h, finbert_metrics, created_at
		FROM news_features WHERE symbol = $1 ORDER BY ts DESC LIMIT 1`, symbol).Scan(
		&f.Symbol, &f.Timestamp, &f.NewsCount1h, &f.NewsCount4h, &f.NewsCount24h,
		&f.AvgSentiment1h, &f.AvgSentiment4h, &f.AvgSentiment24h, &f.SentimentMomentum,
		&f.NegativeNewsSpike, &f.PositiveNewsSpike, &f.MaxRelevanceScore24h, &finbertJSON, &f.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if len(finbertJSON) > 0 {
		_ = json.Unmarshal(finbertJSON, &f.Finbert)
	}
	return &f, nil
}

func (s *PipelineStore) StartWorkflowRun(ctx context.Context, name string, runID *string, meta map[string]any) (string, error) {
	mb, _ := json.Marshal(meta)
	if meta == nil {
		mb = []byte("{}")
	}
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO workflow_runs (workflow_name, run_id, status, metadata)
		VALUES ($1, $2, 'running', $3::jsonb) RETURNING id`, name, runID, mb).Scan(&id)
	return id, err
}

func (s *PipelineStore) EndWorkflowRun(ctx context.Context, id string, status models.WorkflowRunStatus, items int, errMsg *string, durationMs int) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE workflow_runs SET status = $2, ended_at = NOW(), duration_ms = $3,
			items_processed = $4, error_message = $5 WHERE id = $1`,
		id, status, durationMs, items, errMsg)
	return err
}

func (s *PipelineStore) ListWorkflowRuns(ctx context.Context, limit int) ([]models.WorkflowRun, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, workflow_name, run_id, status, started_at, ended_at, duration_ms, items_processed, error_message, metadata
		FROM workflow_runs ORDER BY started_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.WorkflowRun
	for rows.Next() {
		var r models.WorkflowRun
		var meta []byte
		if err := rows.Scan(&r.ID, &r.WorkflowName, &r.RunID, &r.Status, &r.StartedAt, &r.EndedAt,
			&r.DurationMs, &r.ItemsProcessed, &r.ErrorMessage, &meta); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(meta, &r.Metadata)
		list = append(list, r)
	}
	return list, rows.Err()
}

func (s *PipelineStore) Watchlist(ctx context.Context, workspaceID string) ([]models.WorkspaceWatchlistEntry, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT workspace_id, symbol, is_active, created_at FROM workspace_watchlists
		WHERE workspace_id = $1 ORDER BY symbol`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.WorkspaceWatchlistEntry
	for rows.Next() {
		var e models.WorkspaceWatchlistEntry
		if err := rows.Scan(&e.WorkspaceID, &e.Symbol, &e.IsActive, &e.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, rows.Err()
}

func (s *PipelineStore) SetWatchlist(ctx context.Context, workspaceID string, symbols []string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM workspace_watchlists WHERE workspace_id = $1`, workspaceID); err != nil {
		return err
	}
	for _, sym := range symbols {
		if _, err := tx.Exec(ctx, `
			INSERT INTO workspace_watchlists (workspace_id, symbol, is_active) VALUES ($1, $2, TRUE)`,
			workspaceID, sym); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *PipelineStore) InsertSignals(ctx context.Context, signals []models.WorkspaceSignal) error {
	for _, sig := range signals {
		reasons, _ := json.Marshal(sig.Reasons)
		if sig.Reasons == nil {
			reasons = []byte("[]")
		}
		_, err := s.pool.Exec(ctx, `
			INSERT INTO workspace_signals (workspace_id, symbol, ts, action, direction, score, confidence, reasons, source_snapshot_timestamp, expires_at, status)
			VALUES ($1, $2, COALESCE($3, NOW()), $4, $5, $6, $7, $8::jsonb, $9, $10, 'new')`,
			sig.WorkspaceID, sig.Symbol, sig.Timestamp, sig.Action, sig.Direction, sig.Score, sig.Confidence,
			reasons, sig.SourceSnapshotTimestamp, sig.ExpiresAt)
		if err != nil {
			return fmt.Errorf("insert signal %s: %w", sig.Symbol, err)
		}
	}
	return nil
}

func (s *PipelineStore) ListWorkspaceIDs(ctx context.Context) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT id FROM workspaces`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (s *PipelineStore) ListSignals(ctx context.Context, workspaceID string, limit int) ([]models.WorkspaceSignal, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := s.pool.Query(ctx, `
		SELECT ws.id, ws.workspace_id, ws.symbol, ws.ts, ws.action, ws.direction, ws.score, ws.confidence, ws.reasons,
			ws.source_snapshot_timestamp, ws.expires_at, ws.status, ws.created_at
		FROM workspace_signals ws
		WHERE ws.workspace_id = $1
		  AND EXISTS (
		    SELECT 1 FROM workspace_watchlists w
		    WHERE w.workspace_id = $1 AND w.symbol = ws.symbol AND w.is_active
		  )
		ORDER BY ws.ts DESC LIMIT $2`, workspaceID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.WorkspaceSignal
	for rows.Next() {
		var sig models.WorkspaceSignal
		var reasons []byte
		if err := rows.Scan(&sig.ID, &sig.WorkspaceID, &sig.Symbol, &sig.Timestamp, &sig.Action, &sig.Direction,
			&sig.Score, &sig.Confidence, &reasons, &sig.SourceSnapshotTimestamp, &sig.ExpiresAt, &sig.Status, &sig.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(reasons, &sig.Reasons)
		list = append(list, sig)
	}
	return list, rows.Err()
}

func (s *PipelineStore) CandlesForSymbol(ctx context.Context, symbol, timeframe string, limit int) ([]models.MarketCandle, error) {
	if limit <= 0 {
		limit = 120
	}
	rows, err := s.pool.Query(ctx, `
		SELECT symbol, timeframe, ts, open, high, low, close, volume, source, created_at
		FROM market_candles WHERE symbol = $1 AND timeframe = $2 ORDER BY ts DESC LIMIT $3`,
		symbol, timeframe, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.MarketCandle
	for rows.Next() {
		var c models.MarketCandle
		if err := rows.Scan(&c.Symbol, &c.Timeframe, &c.Timestamp, &c.Open, &c.High, &c.Low, &c.Close, &c.Volume, &c.Source, &c.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

// CandlesForSymbolAsc returns daily bars oldest-first. limit 0 means all rows (capped at 5000).
func (s *PipelineStore) CandlesForSymbolAsc(ctx context.Context, symbol, timeframe string, limit int) ([]models.MarketCandle, error) {
	q := `
		SELECT symbol, timeframe, ts, open, high, low, close, volume, source, created_at
		FROM market_candles WHERE symbol = $1 AND timeframe = $2 AND source = 'alpaca'
		ORDER BY ts ASC`
	args := []any{symbol, timeframe}
	if limit > 0 {
		q += ` LIMIT $3`
		args = append(args, limit)
	} else {
		q += ` LIMIT 5000`
	}
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.MarketCandle
	for rows.Next() {
		var c models.MarketCandle
		if err := rows.Scan(&c.Symbol, &c.Timeframe, &c.Timestamp, &c.Open, &c.High, &c.Low, &c.Close, &c.Volume, &c.Source, &c.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

type PredictedPriceUpdate struct {
	Timestamp       time.Time
	PredictedPrice1 float64
}

func (s *PipelineStore) UpdatePredictedPrices(ctx context.Context, symbol, timeframe, source string, updates []PredictedPriceUpdate) (int, error) {
	if len(updates) == 0 {
		return 0, nil
	}
	batch := &pgx.Batch{}
	for _, u := range updates {
		batch.Queue(`
			UPDATE market_candles
			SET predicted_price1 = $4
			WHERE symbol = $1 AND timeframe = $2 AND ts = $3 AND source = $5`,
			symbol, timeframe, u.Timestamp, u.PredictedPrice1, source)
	}
	br := s.pool.SendBatch(ctx, batch)
	defer br.Close()
	n := 0
	for range updates {
		tag, err := br.Exec()
		if err != nil {
			return n, err
		}
		n += int(tag.RowsAffected())
	}
	return n, nil
}

func (s *PipelineStore) ListPriceChartPoints(ctx context.Context, symbol, timeframe string) ([]models.PriceChartPoint, error) {
	// Return every Alpaca bar for the chart window (no downsampling).
	rows, err := s.pool.Query(ctx, `
		SELECT ts, close, predicted_price1
		FROM market_candles
		WHERE symbol = $1 AND timeframe = $2 AND source = 'alpaca'
		ORDER BY ts ASC`, symbol, timeframe)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.PriceChartPoint
	for rows.Next() {
		var p models.PriceChartPoint
		var pred *float64
		if err := rows.Scan(&p.Timestamp, &p.Close, &pred); err != nil {
			return nil, err
		}
		p.PredictedPrice1 = pred
		list = append(list, p)
	}
	return list, rows.Err()
}

type SentimentDetailRow struct {
	Symbol       string
	Label        string
	Score        float64
	Confidence   float64
	ProbPositive *float64
	ProbNegative *float64
	ProbNeutral  *float64
	Relevance    float64
	At           time.Time
}

func (s *PipelineStore) SentimentRowsSince(ctx context.Context, since time.Time) ([]SentimentDetailRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT s.symbol, s.sentiment_label, s.sentiment_score, s.confidence,
			s.prob_positive, s.prob_negative, s.prob_neutral,
			sym.relevance_score, COALESCE(a.published_at, s.created_at)
		FROM article_sentiment s
		JOIN article_symbols sym ON sym.article_id = s.article_id AND sym.symbol = s.symbol
		JOIN news_articles a ON a.id = s.article_id
		WHERE COALESCE(a.published_at, s.created_at) >= $1`, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []SentimentDetailRow
	for rows.Next() {
		var r SentimentDetailRow
		if err := rows.Scan(&r.Symbol, &r.Label, &r.Score, &r.Confidence,
			&r.ProbPositive, &r.ProbNegative, &r.ProbNeutral,
			&r.Relevance, &r.At); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, rows.Err()
}

func (s *PipelineStore) EnsureSymbols(ctx context.Context, symbols []string) error {
	for _, sym := range symbols {
		sym = strings.ToUpper(strings.TrimSpace(sym))
		if sym == "" {
			continue
		}
		_, err := s.pool.Exec(ctx, `
			INSERT INTO symbols (symbol, name, is_active, updated_at)
			VALUES ($1, '', TRUE, NOW())
			ON CONFLICT (symbol) DO UPDATE SET is_active = TRUE, updated_at = NOW()`,
			sym)
		if err != nil {
			return fmt.Errorf("ensure symbol %s: %w", sym, err)
		}
	}
	return nil
}

func (s *PipelineStore) SymbolName(ctx context.Context, symbol string) (string, error) {
	name, _, _, err := s.SymbolMeta(ctx, symbol)
	if err != nil || name == "" {
		return symbol, err
	}
	return name, nil
}

// SymbolMeta returns catalog name, exchange, and asset class for a ticker.
func (s *PipelineStore) SymbolMeta(ctx context.Context, symbol string) (name string, exchange *string, assetClass string, err error) {
	var ex *string
	var class string
	err = s.pool.QueryRow(ctx, `SELECT name, exchange, asset_class FROM symbols WHERE symbol = $1`, symbol).Scan(&name, &ex, &class)
	if err != nil {
		return symbol, nil, "equity", err
	}
	if catalog.IsPlaceholderSymbolName(symbol, name) {
		name = ""
	}
	if class == "" {
		class = "equity"
	}
	return name, ex, class, nil
}

// SymbolsNeedingCatalogEnrichment returns tickers missing a real company name or exchange.
func (s *PipelineStore) SymbolsNeedingCatalogEnrichment(ctx context.Context, symbols []string) ([]string, error) {
	if len(symbols) == 0 {
		return nil, nil
	}
	rows, err := s.pool.Query(ctx, `
		SELECT symbol FROM symbols
		WHERE symbol = ANY($1)
		  AND is_active
		  AND (
		    exchange IS NULL OR TRIM(exchange) = ''
		    OR TRIM(name) = ''
		    OR UPPER(TRIM(name)) = UPPER(symbol)
		  )`, symbols)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var sym string
		if err := rows.Scan(&sym); err != nil {
			return nil, err
		}
		out = append(out, sym)
	}
	return out, rows.Err()
}

// UpsertSymbolCatalog updates symbol metadata from Alpaca asset lookup.
func (s *PipelineStore) UpsertSymbolCatalog(ctx context.Context, symbol, name string, exchange *string, assetClass string) error {
	if assetClass == "" {
		assetClass = "equity"
	}
	name = catalog.SanitizeName(symbol, name)
	_, err := s.pool.Exec(ctx, `
		INSERT INTO symbols (symbol, name, exchange, asset_class, is_active, updated_at)
		VALUES ($1, $2, $3, $4, TRUE, NOW())
		ON CONFLICT (symbol) DO UPDATE SET
			name = CASE
				WHEN EXCLUDED.name <> '' AND UPPER(TRIM(EXCLUDED.name)) <> UPPER(symbols.symbol)
				THEN EXCLUDED.name
				WHEN UPPER(TRIM(symbols.name)) = UPPER(symbols.symbol) THEN ''
				ELSE symbols.name
			END,
			exchange = COALESCE(EXCLUDED.exchange, symbols.exchange),
			asset_class = EXCLUDED.asset_class,
			updated_at = NOW()`,
		symbol, name, exchange, assetClass)
	return err
}

func (s *PipelineStore) ListSymbolMarketDetailForSymbols(ctx context.Context, symbols []string) ([]models.SymbolMarketDetail, error) {
	if len(symbols) == 0 {
		return []models.SymbolMarketDetail{}, nil
	}
	rows, err := s.pool.Query(ctx, `
		SELECT
			s.symbol,
			s.name,
			s.exchange,
			COALESCE(NULLIF(s.asset_class, ''), 'equity'),
			s.is_active,
			c.close,
			prev.close,
			c.open,
			c.high,
			c.low,
			c.volume,
			r52.high_52w,
			r52.low_52w,
			mf.price_change_24h,
			mf.price_change_5d,
			mf.rsi,
			mf.volatility,
			mf.volume_ratio,
			mf.distance_sma_20,
			mf.sma_20,
			mf.sma_50,
			c.ts,
			c.created_at
		FROM symbols s
		LEFT JOIN LATERAL (
			SELECT ts, open, high, low, close, volume, created_at
			FROM market_candles
			WHERE symbol = s.symbol AND timeframe = '1Day'
			ORDER BY ts DESC
			LIMIT 1
		) c ON TRUE
		LEFT JOIN LATERAL (
			SELECT close
			FROM market_candles
			WHERE symbol = s.symbol AND timeframe = '1Day'
			ORDER BY ts DESC
			OFFSET 1 LIMIT 1
		) prev ON TRUE
		LEFT JOIN LATERAL (
			SELECT max(high) AS high_52w, min(low) AS low_52w
			FROM market_candles
			WHERE symbol = s.symbol AND timeframe = '1Day' AND ts > NOW() - INTERVAL '365 days'
		) r52 ON TRUE
		LEFT JOIN LATERAL (
			SELECT price_change_24h, price_change_5d, rsi, volatility, volume_ratio,
				distance_sma_20, sma_20, sma_50
			FROM market_features
			WHERE symbol = s.symbol AND timeframe = '1Day'
			ORDER BY ts DESC
			LIMIT 1
		) mf ON TRUE
		WHERE s.symbol = ANY($1) AND s.is_active
		ORDER BY s.asset_class, s.symbol`, symbols)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.SymbolMarketDetail
	for rows.Next() {
		var d models.SymbolMarketDetail
		var ex *string
		if err := rows.Scan(
			&d.Symbol, &d.Name, &ex, &d.AssetClass, &d.IsActive,
			&d.LastClose, &d.PrevClose, &d.Open, &d.High, &d.Low, &d.Volume,
			&d.High52w, &d.Low52w,
			&d.PriceChange24h, &d.PriceChange5d, &d.RSI, &d.Volatility, &d.VolumeRatio,
			&d.DistanceSma20, &d.SMA20, &d.SMA50,
			&d.LatestCandleAt, &d.DataFetchedAt,
		); err != nil {
			return nil, err
		}
		d.Exchange = ex
		d.Name = catalog.SanitizeName(d.Symbol, d.Name)
		list = append(list, d)
	}
	return list, rows.Err()
}

func (s *PipelineStore) LatestSignalsBySymbol(ctx context.Context, workspaceID string) (map[string]models.WorkspaceSignal, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT ON (symbol)
			id, workspace_id, symbol, ts, action, direction, score, confidence, reasons,
			source_snapshot_timestamp, expires_at, status, created_at
		FROM workspace_signals
		WHERE workspace_id = $1
		ORDER BY symbol, ts DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[string]models.WorkspaceSignal)
	for rows.Next() {
		var sig models.WorkspaceSignal
		var reasons []byte
		if err := rows.Scan(&sig.ID, &sig.WorkspaceID, &sig.Symbol, &sig.Timestamp, &sig.Action, &sig.Direction,
			&sig.Score, &sig.Confidence, &reasons, &sig.SourceSnapshotTimestamp, &sig.ExpiresAt, &sig.Status, &sig.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(reasons, &sig.Reasons)
		out[sig.Symbol] = sig
	}
	return out, rows.Err()
}

func (s *PipelineStore) RecentHeadlines(ctx context.Context, symbol string, limit int) ([]models.ResearchHeadline, error) {
	if limit <= 0 {
		limit = 5
	}
	rows, err := s.pool.Query(ctx, `
		SELECT a.title, a.url, a.published_at,
			COALESCE(s.sentiment_label, ''), COALESCE(s.sentiment_score, 0)
		FROM news_articles a
		INNER JOIN article_symbols sym ON sym.article_id = a.id AND sym.symbol = $1
		LEFT JOIN article_sentiment s ON s.article_id = a.id AND s.symbol = $1
		ORDER BY COALESCE(a.published_at, a.created_at) DESC
		LIMIT $2`, symbol, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.ResearchHeadline
	for rows.Next() {
		var h models.ResearchHeadline
		if err := rows.Scan(&h.Title, &h.URL, &h.PublishedAt, &h.SentimentLabel, &h.SentimentScore); err != nil {
			return nil, err
		}
		list = append(list, h)
	}
	return list, rows.Err()
}
