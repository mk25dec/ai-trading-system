package services

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

// AlpacaIntradayHistoryDays is lookback for 1Min bars on full chart sync.
const AlpacaIntradayHistoryDays = 5

// ChartLiveRefreshDays is lookback when polling Alpaca for live 1Min updates.
const ChartLiveRefreshDays = 1

// SyncWatchlistPriceHistory fetches Alpaca 1Min bars and backfills predicted_price1.
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

	bars, err := alpaca.FetchBars(ctx, symbols, ChartIntradayTimeframe, AlpacaIntradayHistoryDays)
	if err != nil {
		return 0, 0, err
	}
	candlesFetched = len(bars)
	if _, err := st.UpsertCandles(ctx, bars); err != nil {
		return candlesFetched, 0, err
	}

	for _, sym := range symbols {
		n, err := BackfillSymbolPredictions(ctx, st, sym, ChartIntradayTimeframe)
		if err != nil {
			return candlesFetched, predictionsUpdated, fmt.Errorf("%s %s: %w", sym, ChartIntradayTimeframe, err)
		}
		predictionsUpdated += n
	}
	return candlesFetched, predictionsUpdated, nil
}

// RefreshSymbolLiveChart pulls recent 1Min bars plus Alpaca snapshot trade for real-time charting.
func RefreshSymbolLiveChart(
	ctx context.Context,
	st *store.PipelineStore,
	alpaca *AlpacaClient,
	symbol string,
) (*LivePriceTick, error) {
	if alpaca == nil || alpaca.Key == "" {
		return nil, fmt.Errorf("alpaca credentials not configured")
	}
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	if symbol == "" {
		return nil, fmt.Errorf("symbol required")
	}

	bars, err := alpaca.FetchBars(ctx, []string{symbol}, ChartIntradayTimeframe, ChartLiveRefreshDays)
	if err == nil && len(bars) > 0 {
		_, _ = st.UpsertCandles(ctx, bars)
	}

	ticks, minuteBars, snapErr := alpaca.FetchSnapshots(ctx, []string{symbol})
	if snapErr != nil {
		if err != nil {
			return nil, fmt.Errorf("bars: %v; snapshots: %w", err, snapErr)
		}
		return nil, snapErr
	}
	if len(minuteBars) > 0 {
		_, _ = st.UpsertCandles(ctx, minuteBars)
	}

	tick := ticks[symbol]
	if tick.Price <= 0 {
		return nil, nil
	}
	cp := tick
	return &cp, nil
}

// MergeLiveChartPoint appends or updates the series with the latest trade price.
func MergeLiveChartPoint(points []models.PriceChartPoint, tick *LivePriceTick) []models.PriceChartPoint {
	if tick == nil || tick.Price <= 0 || tick.Timestamp.IsZero() {
		return points
	}
	if len(points) == 0 {
		return []models.PriceChartPoint{{
			Timestamp: tick.Timestamp,
			Close:     tick.Price,
		}}
	}
	out := append([]models.PriceChartPoint(nil), points...)
	last := out[len(out)-1]
	lastMinute := last.Timestamp.UTC().Truncate(time.Minute)
	tickMinute := tick.Timestamp.UTC().Truncate(time.Minute)
	if tickMinute.Equal(lastMinute) {
		out[len(out)-1].Close = tick.Price
		out[len(out)-1].Timestamp = tick.Timestamp
		return out
	}
	if tick.Timestamp.After(last.Timestamp) {
		out = append(out, models.PriceChartPoint{
			Timestamp: tick.Timestamp,
			Close:     tick.Price,
		})
	}
	return out
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
