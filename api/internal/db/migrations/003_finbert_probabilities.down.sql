DROP INDEX IF EXISTS idx_article_sentiment_symbol_created;

ALTER TABLE news_features DROP COLUMN IF EXISTS finbert_metrics;

ALTER TABLE article_sentiment
    DROP COLUMN IF EXISTS prob_positive,
    DROP COLUMN IF EXISTS prob_negative,
    DROP COLUMN IF EXISTS prob_neutral;
