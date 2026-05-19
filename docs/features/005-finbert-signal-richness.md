# Feature: FinBERT signal richness (Sprint B)

## Summary

Horizon scoring now uses the research **FinalScore(T)** sum formula with horizon-specific FinBERT blending across 1h / 4h / 24h windows. Sentiment and FinBERT are deduplicated: FinBERT leads when present; legacy `avg_sentiment_*` is fallback only.

## Changes

| Item | Detail |
|------|--------|
| Formula | `finalHorizonRaw` in `api/internal/services/decision_finbert.go` |
| Weights | Technical 35%, trend 12%, news/FinBERT 48%, risk 5% |
| FinBERT windows | Per-horizon `sentimentWindow` weights on 1h/4h/24h edges |
| Extra signals | Label entropy dampening, max prob tails, high-conf article counts, spikes |
| Dedup | `scoreCategories` emits `finbert` OR `sentiment`, not both |

## Not included

- Regime adjustment term (still planned)
- Sprint C pipeline (full text, relevance weighting)
- Sprint D projection bands

## Related

- `docs/plans/2026-05-19-finbert-decision-engine-roadmap.md`
- `my-research.md` § Calculation rules
