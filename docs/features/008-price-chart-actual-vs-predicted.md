# Feature: Price chart (actual vs predicted)

## Summary

Workspace watchlist symbols store Alpaca **1Min** bars in `market_candles` with walk-forward **`predicted_price1`**. The **Price chart** page (`/chart`) polls Alpaca every **5 seconds** for 1-minute bars plus the **latest trade** (real-time price). Full backfill: `POST .../price-chart/sync` (~5 days of 1Min bars).

## Data

| Column / API | Purpose |
|--------------|---------|
| `market_candles.close` | Alpaca 1Min bar close + latest trade |
| `market_candles.predicted_price1` | Walk-forward formula at that timestamp |
| `POST .../price-chart/sync` | Fetch ~5d `1Min`, backfill predictions |
| `GET .../price-chart/live?symbol=` | Poll Alpaca bars + snapshot, return series |
| `GET .../price-chart?symbol=` | Chart series from DB only |

## UI

- `web/src/pages/chart-page.tsx`
- `web/src/components/actual-predicted-chart.tsx` (ECharts, continuous time axis)

## Related

- `docs/features/006-price-projection-bands.md` (live research projection)
- Migration `005_market_candles_predicted_price.sql`
