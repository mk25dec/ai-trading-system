package services

import (
	"context"
	"fmt"
	"math"

	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

// AlpacaWatchlistHistoryDays is max daily history fetched for chart backfill.
const AlpacaWatchlistHistoryDays = 1095

// SyncWatchlistPriceHistory fetches Alpaca daily bars and backfills predicted_price1.
func SyncWatchlistPriceHistory(
	ctx context.Context,
	st *store.PipelineStore,
	alpaca *AlpacaClient,
	symbols []string,
) (candlesFetched, predictionsUpdated int, err error) {
	if len(symbols) == 0 {
		return 0, 0, nil
	}
	if alpaca == nil || alpaca.Key == "" {
		return 0, 0, fmt.Errorf("alpaca credentials not configured")
	}
	if err := st.EnsureSymbols(ctx, symbols); err != nil {
		return 0, 0, err
	}
	candles, err := alpaca.FetchDailyBars(ctx, symbols, AlpacaWatchlistHistoryDays)
	if err != nil {
		return 0, 0, err
	}
	candlesFetched = len(candles)
	if _, err := st.UpsertCandles(ctx, candles); err != nil {
		return candlesFetched, 0, err
	}
	for _, sym := range symbols {
		n, err := BackfillSymbolPredictions(ctx, st, sym)
		if err != nil {
			return candlesFetched, predictionsUpdated, fmt.Errorf("%s: %w", sym, err)
		}
		predictionsUpdated += n
	}
	return candlesFetched, predictionsUpdated, nil
}

// BackfillSymbolPredictions recomputes predicted_price1 for all 1Day alpaca rows of a symbol.
func BackfillSymbolPredictions(ctx context.Context, st *store.PipelineStore, symbol string) (int, error) {
	asc, err := st.CandlesForSymbolAsc(ctx, symbol, "1Day", 0)
	if err != nil {
		return 0, err
	}
	if len(asc) == 0 {
		return 0, nil
	}
	nf, _ := st.LatestNewsFeatures(ctx, symbol)
	preds := BackfillPredictedPrices(asc, nf)
	updates := make([]store.PredictedPriceUpdate, 0, len(asc))
	for i, c := range asc {
		if math.IsNaN(preds[i]) {
			continue
		}
		updates = append(updates, store.PredictedPriceUpdate{
			Timestamp:       c.Timestamp,
			PredictedPrice1: preds[i],
		})
	}
	return st.UpdatePredictedPrices(ctx, symbol, "1Day", "alpaca", updates)
}
