# Calibration backtest runbook

Sprint A: tune decision-engine parameters against realized forward returns using historical `symbol_feature_snapshots` and `market_candles`.

## Prerequisites

- Repo root `.env` with `DATABASE_URL` (loaded automatically by `cmd/calibrate`)
- Postgres with pipeline data populated
- `symbol_feature_snapshots` rows across the lookback window (run **Refresh data** / snapshot workflow)
- Daily `market_candles` for symbols in the watchlist

## Config

Parameters live in `config/calibration.json`. The API loads this file on startup (`CALIBRATION_CONFIG` overrides path).

## Run backtest (report only)

From repository root:

```bash
cd api
go run ./cmd/calibrate/ -since 720h -config ../config/calibration.json
```

Optional flags:

- `-symbols AAPL,NVDA` — limit universe
- `-out reports/calibration.json` — write full report JSON
- `-holdout AAPL,MSFT` — symbols reserved for optimization validation

## Optimize and write config

```bash
go run ./cmd/calibrate/ -since 720h -config ../config/calibration.json -optimize
```

This grid-searches `sigmoid_scale` and `horizon_finbert_blend`, writes the best params to `config/calibration.json`, and prints IC / Brier per horizon.

After optimization, sync `web/src/lib/calibration.ts` logistic fields if `logistic_center` or `logistic_scale` changed.

## Interpret metrics

| Metric | Meaning |
|--------|---------|
| **IC_comp** | Pearson correlation between composite score and forward return % |
| **IC_finbert** | Same for FinBERT category score (articles with FinBERT only) |
| **hit%** | Directional agreement (score vs return sign) |
| **brier** | Calibration of P(up) proxy vs realized up/down |

IC near 0 is typical for daily horizons; improvement vs baseline is the goal. Low sample size (`n`) makes metrics noisy.

## Re-run cadence

Re-run monthly or after major FinBERT / news pipeline changes (Sprint C).
