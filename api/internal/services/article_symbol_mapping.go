package services

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

// NormalizeDetectionMethod maps detector output to DB-allowed article_symbols.detection_method values.
func NormalizeDetectionMethod(method string) string {
	switch method {
	case "source_metadata":
		return "source_metadata"
	case "company_name":
		return "company_name"
	case "llm", "manual":
		return method
	default:
		return "ticker"
	}
}

// ArticleSymbolRows converts detected symbols into persisted rows with valid detection_method.
func ArticleSymbolRows(articleID string, detected []DetectedSymbol) []models.ArticleSymbol {
	rows := make([]models.ArticleSymbol, 0, len(detected))
	for _, d := range detected {
		rows = append(rows, models.ArticleSymbol{
			ArticleID:       articleID,
			Symbol:          d.Symbol,
			RelevanceScore:  d.RelevanceScore,
			DetectionMethod: NormalizeDetectionMethod(d.DetectionMethod),
			Confidence:      d.Confidence,
		})
	}
	return rows
}

// SourceTickersForArticle returns tickers from backlog/metadata only (no title/body inference).
func SourceTickersForArticle(ctx context.Context, st *store.PipelineStore, a models.NewsArticle) ([]string, error) {
	var raw []string
	if a.BacklogID != nil {
		backlog, err := st.GetBacklogByID(ctx, *a.BacklogID)
		if err == nil {
			raw = append(raw, backlog.RawSymbolGuess...)
			raw = append(raw, SourceTickersFromMetadata(backlog.Metadata)...)
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}
	raw = append(raw, SourceTickersFromMetadata(a.Metadata)...)
	return NormalizeSourceTickers(raw), nil
}

// RemapArticleSymbols persists source-provided tickers onto articles (clears guessed mappings).
func RemapArticleSymbols(ctx context.Context, st *store.PipelineStore, limit int, remap bool) (mapped int, err error) {
	unmapped, err := st.UnmappedArticles(ctx, limit)
	if err != nil {
		return 0, err
	}
	articles := unmapped
	if remap {
		misMapped, err := st.ArticlesForSymbolRemap(ctx, limit)
		if err != nil {
			return 0, err
		}
		articles = mergeArticlesByIDForMapping(unmapped, misMapped)
	}

	for _, a := range articles {
		source, err := SourceTickersForArticle(ctx, st, a)
		if err != nil {
			return mapped, err
		}
		rows := ArticleSymbolRows(a.ID, SymbolsFromSource(source))
		if err := st.ReplaceArticleSymbols(ctx, a.ID, rows); err != nil {
			return mapped, err
		}
		if len(rows) == 0 || remap {
			_ = st.DeleteSentimentForArticle(ctx, a.ID)
		}
		mapped++
	}
	return mapped, nil
}

func mergeArticlesByIDForMapping(primary, extra []models.NewsArticle) []models.NewsArticle {
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
