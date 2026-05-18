-- FinBERT full softmax outputs per article-symbol + aggregated metrics per symbol

ALTER TABLE article_sentiment
    ADD COLUMN IF NOT EXISTS prob_positive NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS prob_negative NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS prob_neutral NUMERIC(8, 6);

ALTER TABLE news_features
    ADD COLUMN IF NOT EXISTS finbert_metrics JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_article_sentiment_symbol_created
    ON article_sentiment(symbol, created_at DESC);
