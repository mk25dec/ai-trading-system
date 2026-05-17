Context
-------
We are building an AI-assisted trading/investing system.
Current stack:
- Frontend dashboard app
- Backend API
- PostgreSQL database
- DuckDB access available through API/web interface
- n8n for scheduled/configurable workflows
- Alpaca API access
- News/RSS/API ingestion planned
- FinBERT or sentiment service available/expected

Main architectural rule
-----------------------
Use n8n for workflows that are scheduled, configurable, experimental, or likely to change over time.
Use the backend API + database as the central source of truth.
Use the frontend dashboard for evaluation, testing, monitoring, and workspace-specific decisions.

Important product rule
----------------------
Data ingestion is centralized.
Portfolio decisions, signals, paper/live trades, watchlists, and strategy settings are per workspace.

Example:
- One shared article can be stored once centrally.
- Workspace A may use it for a tech momentum strategy.
- Workspace B may ignore it.
- Workspace A and B can have different watchlists, thresholds, risk rules, portfolio state, and trade decisions.


OBJECTIVES
==========
Build the first version of the data and feature-generation workflows.
The goal is not yet fully automated trading.
The goal is to create a reliable pipeline that:
1. Pulls in market/news data.
2. Stores raw and processed data.
3. Runs sentiment and feature generation.
4. Exposes everything in the dashboard.
5. Prepares workspace-level signal generation later.


WORKFLOW OWNERSHIP
==================

n8n should own:
---------------
- Scheduled jobs
- API polling
- RSS polling
- Retry logic
- Experimental workflow variants
- Dispatching work to backend endpoints
- Triggering batch jobs
- Notifications later

Backend API should own:
-----------------------
- Database writes/reads
- Validation
- Deduplication logic where possible
- Workspace permissions
- Data normalization
- Business rules that should not live only in n8n
- Endpoints used by the dashboard and n8n

Frontend dashboard should own:
------------------------------
- Monitoring views
- Evaluation views
- Workflow status visibility
- News + sentiment overviews
- Market features overview
- Workspace watchlists
- Workspace strategy settings
- Workspace signals and portfolio views

PostgreSQL should own:
----------------------
- Live/operational data
- Workflow state
- Dashboard data
- News backlog
- Processed articles
- Symbols/watchlists
- Market candles/features
- Workspace-specific signals/decisions

DuckDB should own, later:
------------------------
- Backtesting datasets
- Heavy analytical queries
- Parquet snapshots
- Offline model-training datasets
- Large historical feature recalculations

Do not make DuckDB mandatory for MVP live workflows yet. Postgres is enough for the first live version.


MVP WORKFLOWS
=============

WORKFLOW 1: NEWS INGESTION
--------------------------
Owner: n8n
Schedule: every 15-60 minutes, configurable
Purpose: collect raw news items into a backlog.

Inputs:
- RSS feeds
- Finnhub/company-news endpoint if available
- Other low-cost/free sources later

n8n responsibilities:
- Run on schedule.
- Fetch new items from configured sources.
- Normalize minimal fields.
- Call backend API endpoint to upsert into news backlog.
- Log source status and errors.

Backend endpoint suggestion:
POST /internal/news/backlog/upsert

Payload example:
{
  "source": "yahoo_finance_rss",
  "url": "...",
  "title": "...",
  "published_at": "...",
  "discovered_at": "...",
  "raw_symbol_guess": ["NVDA", "AMD"],
  "metadata": {}
}

Postgres table: news_backlog
Required fields:
- id
- source
- url
- canonical_url
- title
- published_at
- discovered_at
- raw_symbol_guess jsonb
- status: new | fetched | duplicate | failed | processed
- error_message nullable
- metadata jsonb
- created_at
- updated_at

Deduplication:
- Unique on canonical_url if available.
- Fallback hash from normalized title + source + published_at date.

Dashboard view:
- News backlog list
- Source
- Title
- Published time
- Status
- Symbol guesses
- Error message if failed
- Filter by status/source/date


WORKFLOW 2: NEWS ARTICLE FETCHING + CLEANING
--------------------------------------------
Owner: n8n orchestrates; backend does storage
Schedule: every 15-30 minutes or queue-style batch
Purpose: convert backlog URLs into clean article records.

n8n responsibilities:
- Request a batch of backlog items with status=new.
- Fetch article text directly or call backend worker endpoint.
- Update backlog status.
- Store cleaned article through backend API.

Backend endpoint suggestions:
GET /internal/news/backlog/next?limit=25
POST /internal/news/articles/upsert
POST /internal/news/backlog/{id}/status

Processing steps:
- Fetch article HTML/text.
- Extract clean text.
- Normalize title/source/url.
- Remove boilerplate.
- Detect language.
- Skip if too short or unsupported.
- Store article.

Postgres table: news_articles
Required fields:
- id
- backlog_id nullable
- source
- url
- canonical_url
- title
- published_at
- discovered_at
- fetched_at
- raw_text nullable
- cleaned_text
- language
- text_hash
- metadata jsonb
- created_at
- updated_at

Dashboard view:
- Article list
- Title
- Source
- Published time
- Extracted text length
- Linked backlog status
- Open article detail page


WORKFLOW 3: NEWS SYMBOL DETECTION + RELEVANCE
---------------------------------------------
Owner: n8n orchestrates; backend stores result
Schedule: after article fetching or every 15-30 minutes
Purpose: map articles to tradable symbols and score relevance.

Inputs:
- news_articles without symbol mapping
- central symbols universe
- workspace watchlists later for filtering

Processing steps:
- Detect ticker mentions.
- Detect company name mentions.
- Map company names to symbols.
- Avoid false positives, e.g. ARM as a word vs ticker ARM.
- Score relevance per symbol.

Postgres table: article_symbols
Required fields:
- article_id
- symbol
- relevance_score numeric
- detection_method: ticker | company_name | source_metadata | llm | manual
- confidence numeric
- created_at

Backend endpoint suggestions:
GET /internal/news/articles/unmapped?limit=50
POST /internal/news/articles/{id}/symbols

Dashboard view:
- Article detail with detected symbols
- Relevance score per symbol
- Detection method
- Ability to flag wrong mappings later


WORKFLOW 4: NEWS SENTIMENT ANALYSIS
-----------------------------------
Owner: n8n triggers; sentiment service/backend processes
Schedule: after article processing or every 15-30 minutes
Purpose: run FinBERT/sentiment on each article and symbol pair.

Important:
Sentiment should be stored per article-symbol pair, not only per article.
One article can be positive for one symbol and negative for another.

Processing steps:
- Get article-symbol pairs without sentiment.
- Send title + cleaned text to sentiment model.
- Prefer shorter input first: title + first relevant paragraphs.
- Store sentiment label, score, confidence.

Postgres table: article_sentiment
Required fields:
- article_id
- symbol
- sentiment_label: positive | neutral | negative
- sentiment_score numeric
- confidence numeric
- model_name
- model_version nullable
- input_mode: title_only | excerpt | full_text
- created_at

Backend endpoint suggestions:
GET /internal/news/sentiment/pending?limit=50
POST /internal/news/sentiment/upsert

Dashboard view:
- News article table with sentiment next to it
- Columns:
  - published_at
  - source
  - title
  - symbols
  - relevance_score
  - sentiment_label
  - sentiment_score
  - confidence
- Filters:
  - symbol
  - source
  - sentiment
  - date range
  - confidence threshold


WORKFLOW 5: MARKET DATA INGESTION
---------------------------------
Owner: n8n
Schedule:
- Intraday: every 5-15 minutes for active testing
- Daily: after market close
Purpose: pull Alpaca market data for the active universe.

Inputs:
- Central symbol universe
- Workspace watchlists may determine which symbols are active

Start universe recommendation:
US large-cap AI/tech equities:
NVDA, MSFT, AAPL, AMZN, META, GOOGL, AMD, TSM, AVGO, ASML, PLTR, SNOW, CRWD, ARM, SMCI

n8n responsibilities:
- Pull bars/candles from Alpaca.
- Call backend endpoint to upsert market candles.
- Track API errors/rate limits.
- Avoid duplicate candle writes.

Backend endpoint suggestion:
POST /internal/market/candles/upsert

Postgres table: symbols
Required fields:
- symbol primary key
- name
- exchange nullable
- sector nullable
- industry nullable
- is_active boolean
- metadata jsonb
- created_at
- updated_at

Postgres table: market_candles
Required fields:
- symbol
- timeframe: 1Min | 5Min | 15Min | 1Hour | 1Day
- timestamp
- open
- high
- low
- close
- volume
- source: alpaca
- created_at

Unique key:
- symbol + timeframe + timestamp + source

Dashboard view:
- Symbol market data status
- Latest candle timestamp
- Last close
- Daily change
- Volume
- Ingestion freshness
- API errors


WORKFLOW 6: MARKET FEATURE GENERATION
-------------------------------------
Owner: n8n triggers; backend/worker calculates
Schedule: after market data ingestion
Purpose: generate technical/market features per symbol/timeframe.

Features for MVP:
- price_change_1h
- price_change_24h
- price_change_5d
- volume_ratio vs average
- volatility rolling window
- RSI
- moving averages: SMA20, SMA50
- distance from SMA20/SMA50

Postgres table: market_features
Required fields:
- symbol
- timestamp
- timeframe
- price_change_1h nullable
- price_change_24h nullable
- price_change_5d nullable
- volume_ratio nullable
- volatility nullable
- rsi nullable
- sma_20 nullable
- sma_50 nullable
- distance_sma_20 nullable
- distance_sma_50 nullable
- created_at

Backend endpoint suggestions:
POST /internal/features/market/generate
GET /internal/features/market/latest?symbol=NVDA

Dashboard view:
- Symbol features table
- Feature history chart later
- Stale/missing feature indicators


WORKFLOW 7: NEWS FEATURE GENERATION
-----------------------------------
Owner: n8n triggers; backend/worker calculates
Schedule: after sentiment workflow
Purpose: aggregate article/sentiment data into symbol-level features.

Features for MVP:
- news_count_1h
- news_count_4h
- news_count_24h
- avg_sentiment_1h
- avg_sentiment_4h
- avg_sentiment_24h
- sentiment_momentum
- negative_news_spike
- positive_news_spike
- max_relevance_score_24h

Postgres table: news_features
Required fields:
- symbol
- timestamp
- news_count_1h
- news_count_4h
- news_count_24h
- avg_sentiment_1h
- avg_sentiment_4h
- avg_sentiment_24h
- sentiment_momentum
- negative_news_spike boolean
- positive_news_spike boolean
- max_relevance_score_24h
- created_at

Backend endpoint suggestions:
POST /internal/features/news/generate
GET /internal/features/news/latest?symbol=NVDA

Dashboard view:
- Symbol sentiment overview
- Top positive/negative symbols
- News volume spikes
- Sentiment momentum table


WORKFLOW 8: COMBINED SYMBOL FEATURE SNAPSHOT
--------------------------------------------
Owner: n8n triggers; backend/worker calculates
Schedule: after market + news features
Purpose: create one latest feature row per symbol for signal generation and dashboard ranking.

Postgres table: symbol_feature_snapshots
Required fields:
- symbol
- timestamp
- market_features jsonb
- news_features jsonb
- combined_score nullable
- data_quality_score numeric
- missing_fields jsonb
- created_at

Backend endpoint suggestions:
POST /internal/features/snapshots/generate
GET /api/symbols/snapshots/latest

Dashboard view:
- Ranked symbol table
- Symbol
- Price movement
- Volume ratio
- News count
- Sentiment score
- Data quality
- Last updated


WORKFLOW 9: WORKSPACE SIGNAL GENERATION
---------------------------------------
Owner: n8n triggers; backend applies workspace strategy config
Schedule: every 15-60 minutes, configurable per workspace later
Purpose: generate workspace-specific signals from central features.

Important:
This is where centralized data becomes workspace-specific.

Inputs:
- symbol_feature_snapshots
- workspace watchlist
- workspace strategy settings
- workspace risk settings
- workspace portfolio state

Postgres table: workspaces
Required fields:
- id
- name
- created_at
- updated_at

Postgres table: workspace_watchlists
Required fields:
- workspace_id
- symbol
- is_active
- created_at

Postgres table: workspace_strategy_settings
Required fields:
- workspace_id
- strategy_name
- settings jsonb
- is_active
- created_at
- updated_at

Postgres table: workspace_signals
Required fields:
- id
- workspace_id
- symbol
- timestamp
- action: watch | buy_candidate | avoid | sell_candidate
- direction: long | none
- score numeric
- confidence numeric
- reasons jsonb
- source_snapshot_timestamp
- expires_at
- status: new | reviewed | ignored | executed | expired
- created_at

Backend endpoint suggestions:
POST /internal/workspaces/{workspace_id}/signals/generate
GET /api/workspaces/{workspace_id}/signals

Dashboard view:
- Workspace-specific signal list
- Reasoning/reasons
- Confidence
- Related articles
- Related features
- Signal status
- Filters by action/status/symbol


WORKFLOW 10: WORKFLOW MONITORING + RUN LOGS
-------------------------------------------
Owner: n8n + backend
Purpose: make workflow health visible in dashboard.

Every n8n workflow should report start/end/error to backend.

Postgres table: workflow_runs
Required fields:
- id
- workflow_name
- run_id nullable
- status: running | success | failed | partial
- started_at
- ended_at nullable
- duration_ms nullable
- items_processed integer
- error_message nullable
- metadata jsonb

Backend endpoint suggestions:
POST /internal/workflows/runs/start
POST /internal/workflows/runs/end
POST /internal/workflows/runs/error
GET /api/workflows/runs

Dashboard view:
- Workflow run history
- Last run status
- Items processed
- Errors
- Duration
- Freshness by data type


FRONTEND DASHBOARD PAGES
========================

Build/prepare these dashboard sections:

1. Data Health
- Workflow runs
- Latest successful ingestion
- API errors
- Stale data warnings

2. News Backlog
- Raw news items
- Status
- Source
- Symbol guesses
- Errors

3. News Articles + Sentiment
- Article list
- Source
- Published time
- Symbol mappings
- Relevance score
- Sentiment label/score/confidence
- Link to detail page

4. Symbols / Market Data
- Active universe
- Latest candle timestamp
- Price/volume overview
- Missing data warnings

5. Feature Overview
- Market features
- News features
- Combined symbol snapshots
- Ranking table

6. Workspace Signals
- Workspace-specific list of opportunities
- Reasons
- Confidence
- Related articles/features
- Status controls: reviewed/ignored/etc.

7. Workspace Settings
- Watchlist
- Strategy thresholds
- Risk settings
- Paper/live mode later


API PRINCIPLES
==============

- n8n should call internal backend endpoints, not write directly to DB unless absolutely necessary.
- Backend should enforce validation and deduplication.
- Frontend should only use public/authenticated API endpoints, not internal ingestion endpoints.
- All workflow writes should be idempotent where possible.
- Use unique constraints for deduplication.
- Store raw data where useful, but keep normalized tables for dashboard/querying.
- Every scheduled workflow should log a workflow run.


MVP PRIORITY ORDER
==================

Phase 1:
1. news_backlog table + API
2. n8n RSS/news ingestion workflow
3. news_articles table + article processing workflow
4. article_symbols + article_sentiment tables
5. dashboard: article list with sentiment

Phase 2:
6. symbols table
7. Alpaca market_candles ingestion workflow
8. market_features table + generation
9. dashboard: market data + feature overview

Phase 3:
10. news_features
11. symbol_feature_snapshots
12. dashboard: ranked symbol overview

Phase 4:
13. workspaces/watchlists/settings
14. workspace_signals
15. dashboard: workspace-specific signals

Phase 5:
16. DuckDB/Parquet export for backtesting
17. Backtesting views
18. Model evaluation metrics


NOTES ON DUCKDB
===============

Do not use DuckDB as the main live operational store yet.
Use PostgreSQL for live workflows and dashboard state.

Add DuckDB later for:
- exporting candles/articles/features to Parquet
- fast analytical scans
- backtests
- model training datasets
- comparing strategy versions

Potential later workflow:
Postgres live tables -> nightly export -> Parquet/DuckDB -> backtesting/model evaluation


DEFINITION OF DONE FOR THIS BRIEF
=================================

The first useful version is done when:
- n8n can ingest news into Postgres.
- articles are processed and visible in dashboard.
- sentiment is shown next to articles.
- Alpaca candles are stored for the active tech/AI universe.
- market/news features are generated per symbol.
- dashboard shows latest feature snapshot per symbol.
- workspace separation exists for watchlists/signals, even if signal logic is simple.
