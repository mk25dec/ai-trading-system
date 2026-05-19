# FinBERT ingest runbook

## Text selection (Sprint C)

`TextForFinBERT` in `api/internal/services/article_text.go` chooses input per article:

| Mode | When |
|------|------|
| `title_only` | No cleaned body |
| `full_text` | Body ≤ ~2048 chars (512-token budget) |
| `excerpt` | Longer body → title + first 1500 chars |

Stored on `article_sentiment.input_mode`.

## Relevance weighting

`AggregateFinbertMetrics` weights each article by `article_symbols.relevance_score × confidence` when rolling up 1h/4h/24h FinBERT metrics.

## Batch API

FinBERT service: `POST /analyze/batch` (max 32 items).

```json
{ "items": [{ "id": "uuid:SYM", "text": "headline\n\nbody..." }] }
```

Go API `RunSentimentBatch` uses batch when more than one pending row; falls back to single `/analyze` on batch failure.

## Model swap

Set `FINBERT_MODEL_ID` on the FinBERT container (default `ProsusAI/finbert`). After changing models, re-run calibration (`docs/runbooks/calibration-backtest.md`).

## Diagnostics

```bash
curl -s "$API/internal/pipeline/finbert/diagnostics" -H "X-Internal-Key: $INTERNAL_API_KEY"
```
