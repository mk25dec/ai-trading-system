package services

import (
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

func SentimentRowFromDetail(r store.SentimentDetailRow) SentimentRow {
	pos, neg, neu := InferFinbertProbs(r.Label, r.Confidence, r.ProbPositive, r.ProbNegative, r.ProbNeutral)
	return SentimentRow{
		Symbol:       r.Symbol,
		Label:        r.Label,
		Score:        r.Score,
		Confidence:   r.Confidence,
		ProbPositive: pos,
		ProbNegative: neg,
		ProbNeutral:  neu,
		Relevance:    r.Relevance,
		At:           r.At,
	}
}

func SentimentRowsFromDetails(rows []store.SentimentDetailRow) []SentimentRow {
	out := make([]SentimentRow, 0, len(rows))
	for _, r := range rows {
		out = append(out, SentimentRowFromDetail(r))
	}
	return out
}

func ArticleSentimentFromFinbert(articleID, symbol string, res FinbertResult) models.ArticleSentiment {
	pp, pn, pneu := res.ProbPositive, res.ProbNegative, res.ProbNeutral
	return models.ArticleSentiment{
		ArticleID:      articleID,
		Symbol:         symbol,
		SentimentLabel: res.Label,
		SentimentScore: res.Score,
		Confidence:     res.Confidence,
		ProbPositive:   &pp,
		ProbNegative:   &pn,
		ProbNeutral:    &pneu,
		ModelName:      "finbert",
		InputMode:      "excerpt",
	}
}
