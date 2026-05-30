package services

import (
	"context"
	"fmt"
	"math"

	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

// AlpacaWatchlistHistoryDays is max daily history fetched for chart backfill.
const AlpacaWatchlistHistoryDays = 1095

// AlpacaIntradayHistoryDays is lookback for 30Min bars on the price chart.
const AlpacaIntradayHistoryDays = 60

// SyncWatchlistPriceHistory fetches Alpaca daily + 30Min bars and backfills predicted_price1.
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

	daily, err := alpaca.FetchBars(ctx, symbols, "1Day", AlpacaWatchlistHistoryDays)
	if err != nil {
		return 0, 0, err
	}
	candlesFetched = len(daily)
	if _, err := st.UpsertCandles(ctx, daily); err != nil {
		return candlesFetched, 0, err
	}

	intraday, err := alpaca.FetchBars(ctx, symbols, ChartIntradayTimeframe, AlpacaIntradayHistoryDays)
	if err != nil {
		return candlesFetched, predictionsUpdated, fmt.Errorf("intraday: %w", err)
	}
	candlesFetched += len(intraday)
	if _, err := st.UpsertCandles(ctx, intraday); err != nil {
		return candlesFetched, predictionsUpdated, err
	}

	for _, sym := range symbols {
		n, err := BackfillSymbolPredictions(ctx, st, sym, "1Day")
		if err != nil {
			return candlesFetched, predictionsUpdated, fmt.Errorf("%s daily: %w", sym, err)
		}
		predictionsUpdated += n
		n, err = BackfillSymbolPredictions(ctx, st, sym, ChartIntradayTimeframe)
		if err != nil {
			return candlesFetched, predictionsUpdated, fmt.Errorf("%s %s: %w", sym, ChartIntradayTimeframe, err)
		}
		predictionsUpdated += n
	}
	return candlesFetched, predictionsUpdated, nil
}

// BackfillSymbolPredictions recomputes predicted_price1 for alpaca rows of a symbol/timeframe.
func BackfillSymbolPredictions(ctx context.Context, st *store.PipelineStore, symbol, timeframe string) (int, error) {
	asc, err := st.CandlesForSymbolAsc(ctx, symbol, timeframe, 0)
	if err != nil {
		return 0, err
	}
	if len(asc) == 0 {
		return 0, nil
	}
	nf, _ := st.LatestNewsFeatures(ctx, symbol)
	preds := BackfillPredictedPrices(asc, nf, timeframe)
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
	return st.UpdatePredictedPrices(ctx, symbol, timeframe, "alpaca", updates)
}
