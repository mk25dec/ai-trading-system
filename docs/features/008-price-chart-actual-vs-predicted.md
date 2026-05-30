# Feature: Price chart (actual vs predicted)

## Summary

Workspace watchlist symbols store Alpaca daily closes in `market_candles` with walk-forward **`predicted_price1`** (Sprint D formula, 21-day horizon). The **Price chart** page (`/chart`) plots both series.

## Data

| Column / API | Purpose |
|--------------|---------|
| `market_candles.close` | Actual Alpaca daily close |
| `market_candles.predicted_price1` | Formula projection at that bar (see `api/internal/services/price_projection.go`) |
| `POST .../price-chart/sync` | Fetch up to ~3y bars + backfill predictions |
| `GET .../price-chart?symbol=` | Chart series for one watchlist symbol |

## UI

- `web/src/pages/chart-page.tsx`
- `web/src/components/actual-predicted-chart.tsx` (ECharts)

## Related

- `docs/features/006-price-projection-bands.md` (live research projection)
- Migration `005_market_candles_predicted_price.sql`
