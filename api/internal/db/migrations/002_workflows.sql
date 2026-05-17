-- Workflow pipeline tables (news, market, features, workspace signals)

-- Workflow 10: run logs
CREATE TABLE workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_name TEXT NOT NULL,
    run_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'partial')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_ms INTEGER,
    items_processed INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_runs_name_started ON workflow_runs(workflow_name, started_at DESC);

-- Workflow 1: news backlog
CREATE TABLE news_backlog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    url TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    title TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_symbol_guess JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'fetched', 'duplicate', 'failed', 'processed')),
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (canonical_url)
);

CREATE INDEX idx_news_backlog_status ON news_backlog(status);
CREATE INDEX idx_news_backlog_source ON news_backlog(source);

-- Workflow 2: articles
CREATE TABLE news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backlog_id UUID REFERENCES news_backlog(id) ON DELETE SET NULL,
    source TEXT NOT NULL,
    url TEXT NOT NULL,
    canonical_url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_text TEXT,
    cleaned_text TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'en',
    text_hash TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_news_articles_published ON news_articles(published_at DESC);

-- Workflow 3: symbol mapping
CREATE TABLE article_symbols (
    article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    relevance_score NUMERIC(8, 4) NOT NULL DEFAULT 0,
    detection_method TEXT NOT NULL CHECK (detection_method IN ('ticker', 'company_name', 'source_metadata', 'llm', 'manual')),
    confidence NUMERIC(8, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (article_id, symbol)
);

CREATE INDEX idx_article_symbols_symbol ON article_symbols(symbol);

-- Workflow 4: sentiment
CREATE TABLE article_sentiment (
    article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    sentiment_label TEXT NOT NULL CHECK (sentiment_label IN ('positive', 'neutral', 'negative')),
    sentiment_score NUMERIC(8, 4) NOT NULL,
    confidence NUMERIC(8, 4) NOT NULL,
    model_name TEXT NOT NULL,
    model_version TEXT,
    input_mode TEXT NOT NULL DEFAULT 'excerpt' CHECK (input_mode IN ('title_only', 'excerpt', 'full_text')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (article_id, symbol)
);

-- Workflow 5: symbols + candles
CREATE TABLE symbols (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    exchange TEXT,
    sector TEXT,
    industry TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE market_candles (
    symbol TEXT NOT NULL REFERENCES symbols(symbol) ON DELETE CASCADE,
    timeframe TEXT NOT NULL CHECK (timeframe IN ('1Min', '5Min', '15Min', '1Hour', '1Day')),
    ts TIMESTAMPTZ NOT NULL,
    open NUMERIC(18, 6) NOT NULL,
    high NUMERIC(18, 6) NOT NULL,
    low NUMERIC(18, 6) NOT NULL,
    close NUMERIC(18, 6) NOT NULL,
    volume BIGINT NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'alpaca',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (symbol, timeframe, ts, source)
);

CREATE INDEX idx_market_candles_symbol_tf ON market_candles(symbol, timeframe, ts DESC);

-- Workflow 6: market features
CREATE TABLE market_features (
    symbol TEXT NOT NULL REFERENCES symbols(symbol) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL,
    timeframe TEXT NOT NULL,
    price_change_1h NUMERIC(12, 6),
    price_change_24h NUMERIC(12, 6),
    price_change_5d NUMERIC(12, 6),
    volume_ratio NUMERIC(12, 6),
    volatility NUMERIC(12, 6),
    rsi NUMERIC(12, 6),
    sma_20 NUMERIC(18, 6),
    sma_50 NUMERIC(18, 6),
    distance_sma_20 NUMERIC(12, 6),
    distance_sma_50 NUMERIC(12, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (symbol, timeframe, ts)
);

-- Workflow 7: news features
CREATE TABLE news_features (
    symbol TEXT NOT NULL REFERENCES symbols(symbol) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL,
    news_count_1h INTEGER NOT NULL DEFAULT 0,
    news_count_4h INTEGER NOT NULL DEFAULT 0,
    news_count_24h INTEGER NOT NULL DEFAULT 0,
    avg_sentiment_1h NUMERIC(8, 4),
    avg_sentiment_4h NUMERIC(8, 4),
    avg_sentiment_24h NUMERIC(8, 4),
    sentiment_momentum NUMERIC(8, 4),
    negative_news_spike BOOLEAN NOT NULL DEFAULT FALSE,
    positive_news_spike BOOLEAN NOT NULL DEFAULT FALSE,
    max_relevance_score_24h NUMERIC(8, 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (symbol, ts)
);

-- Workflow 8: combined snapshots
CREATE TABLE symbol_feature_snapshots (
    symbol TEXT NOT NULL REFERENCES symbols(symbol) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL,
    market_features JSONB NOT NULL DEFAULT '{}',
    news_features JSONB NOT NULL DEFAULT '{}',
    combined_score NUMERIC(12, 6),
    data_quality_score NUMERIC(8, 4) NOT NULL DEFAULT 0,
    missing_fields JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (symbol, ts)
);

CREATE INDEX idx_symbol_snapshots_ts ON symbol_feature_snapshots(ts DESC);

-- Workflow 9: workspace extensions
CREATE TABLE workspace_watchlists (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, symbol)
);

CREATE TABLE workspace_strategy_settings (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    strategy_name TEXT NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, strategy_name)
);

CREATE TABLE workspace_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action TEXT NOT NULL CHECK (action IN ('watch', 'buy_candidate', 'avoid', 'sell_candidate')),
    direction TEXT NOT NULL DEFAULT 'long' CHECK (direction IN ('long', 'none')),
    score NUMERIC(12, 6) NOT NULL DEFAULT 0,
    confidence NUMERIC(8, 4) NOT NULL DEFAULT 0,
    reasons JSONB NOT NULL DEFAULT '[]',
    source_snapshot_timestamp TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'ignored', 'executed', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workspace_signals_ws ON workspace_signals(workspace_id, ts DESC);

-- Seed default symbol universe
INSERT INTO symbols (symbol, name, is_active) VALUES
    ('NVDA', 'NVIDIA Corporation', TRUE),
    ('MSFT', 'Microsoft Corporation', TRUE),
    ('AAPL', 'Apple Inc.', TRUE),
    ('AMZN', 'Amazon.com Inc.', TRUE),
    ('META', 'Meta Platforms Inc.', TRUE),
    ('GOOGL', 'Alphabet Inc.', TRUE),
    ('AMD', 'Advanced Micro Devices', TRUE),
    ('TSM', 'Taiwan Semiconductor', TRUE),
    ('AVGO', 'Broadcom Inc.', TRUE),
    ('ASML', 'ASML Holding', TRUE),
    ('PLTR', 'Palantir Technologies', TRUE),
    ('SNOW', 'Snowflake Inc.', TRUE),
    ('CRWD', 'CrowdStrike Holdings', TRUE),
    ('ARM', 'Arm Holdings', TRUE),
    ('SMCI', 'Super Micro Computer', TRUE)
ON CONFLICT (symbol) DO NOTHING;
