# Feature: Price projection bands (Sprint D)

## Summary

Multi-horizon price outlook now includes FinBERT-calibrated expected return, P(up) with FinBERT prior, and ±1σ uncertainty bands on the chart.

## Components

| Piece | Location |
|-------|----------|
| FinBERT edge (TS) | `web/src/lib/finbert-edge.ts` |
| Projection + bands | `web/src/lib/price-outlook.ts` |
| Mini chart band lines | `web/src/components/decision/price-outlook-projection.tsx` |
| ECharts shaded band | `web/src/components/decision/price-outlook-chart-dialog.tsx` |
| Calibration weight | `config/calibration.json` → `p_up_finbert_weight: 0.12` |

## UX

Tooltip and dialog state that bands are model projections, not guarantees.

## Related

Sprint C: `docs/features/007-finbert-pipeline-depth.md`
