# Feature: Price chart (actual vs predicted)

## Summary

Workspace watchlist symbols store Alpaca bars in `market_candles` with walk-forward **`predicted_price1`**. The **Price chart** page (`/chart`) is watchlist-only: default **30Min** intraday source prices on a **continuous time** axis, auto-refreshed from Alpaca every 30s (daily every 5 min) via `GET .../price-chart/live`. Full backfill: `POST .../price-chart/sync` (~60d `30Min` + ~3y `1Day`).

## Data

| Column / API | Purpose |
|--------------|---------|
| `market_candles.close` | Actual Alpaca bar close (`30Min` or `1Day`) |
| `market_candles.predicted_price1` | Walk-forward formula at that timestamp |
| `POST .../price-chart/sync` | Fetch ~60d `30Min` + ~3y `1Day`, backfill both |
| `GET .../price-chart/live?symbol=&timeframe=30Min` | Poll Alpaca for recent bars, upsert, return series |
| `GET .../price-chart?symbol=&timeframe=30Min` | Chart series from DB only (no Alpaca fetch) |

## UI

- `web/src/pages/chart-page.tsx`
- `web/src/components/actual-predicted-chart.tsx` (ECharts)

## Related

- `docs/features/006-price-projection-bands.md` (live research projection)
- Migration `005_market_candles_predicted_price.sql`
