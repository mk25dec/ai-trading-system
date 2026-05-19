package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

// ListFeatureSnapshots returns snapshots at or after since, optionally filtered by symbols.
func (s *PipelineStore) ListFeatureSnapshots(ctx context.Context, since time.Time, symbols []string) ([]models.SymbolFeatureSnapshot, error) {
	var rows pgx.Rows
	var err error
	if len(symbols) == 0 {
		rows, err = s.pool.Query(ctx, `
			SELECT symbol, ts, market_features, news_features, combined_score, data_quality_score, missing_fields, created_at
			FROM symbol_feature_snapshots
			WHERE ts >= $1
			ORDER BY symbol, ts ASC`, since)
	} else {
		rows, err = s.pool.Query(ctx, `
			SELECT symbol, ts, market_features, news_features, combined_score, data_quality_score, missing_fields, created_at
			FROM symbol_feature_snapshots
			WHERE ts >= $1 AND symbol = ANY($2)
			ORDER BY symbol, ts ASC`, since, symbols)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSnapshots(rows)
}

// DailyClosesAsc returns 1Day closes for symbol between from and to inclusive, ascending by ts.
func (s *PipelineStore) DailyClosesAsc(ctx context.Context, symbol string, from, to time.Time) ([]models.DailyClose, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT ts, close FROM market_candles
		WHERE symbol = $1 AND timeframe = '1Day' AND ts >= $2 AND ts <= $3
		ORDER BY ts ASC`, symbol, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.DailyClose
	for rows.Next() {
		var c models.DailyClose
		if err := rows.Scan(&c.Timestamp, &c.Close); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
