# Feature: Price chart (actual vs predicted)

## Summary

Workspace watchlist symbols store Alpaca bars in `market_candles` with walk-forward **`predicted_price1`**. The **Price chart** page (`/chart`) defaults to **30Min** intraday closes (~every 30 minutes in RTH) plus the formula prediction on the same timestamps. Daily (`1Day`) is available via the timeframe selector.

## Data

| Column / API | Purpose |
|--------------|---------|
| `market_candles.close` | Actual Alpaca bar close (`30Min` or `1Day`) |
| `market_candles.predicted_price1` | Walk-forward formula at that timestamp |
| `POST .../price-chart/sync` | Fetch ~60d `30Min` + ~3y `1Day`, backfill both |
| `GET .../price-chart?symbol=&timeframe=30Min` | Chart series (default intraday) |

## UI

- `web/src/pages/chart-page.tsx`
- `web/src/components/actual-predicted-chart.tsx` (ECharts)

## Related

- `docs/features/006-price-projection-bands.md` (live research projection)
- Migration `005_market_candles_predicted_price.sql`
