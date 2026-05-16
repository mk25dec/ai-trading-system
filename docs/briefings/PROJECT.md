# Trading AI System Briefing

We are building a lean AI-assisted trading and investing system.

Current infrastructure:
- VPS: 8GB RAM, 4vCPU
- n8n installed
- Caddy installed
- FinBERT service installed
- Repo already created

Goal:
Build a Go API + Vue dashboard that coordinates AI research, signal scoring, risk rules, and Alpaca paper/live trading. The system should support objective buy/sell decisions, hypothesis tracking, audit logs, and automated deployment through Docker Compose/Coolify.

Important principle:
AI can reason and summarize, but deterministic rules must control execution and risk. Claude may generate hypotheses and structured reasoning, but the Go API is the final authority for whether an order can be placed or closed.

Core components:
1. Go API
2. React dashboard
3. DuckDB analytical storage
4. FinBERT sentiment service
5. Embeddings service
6. Simple vector storage
7. LightGBM/XGBoost model service
8. n8n workflows
9. Alpaca integration
10. Coolify/Docker Compose deployment

Go API responsibilities:
- Expose REST API for dashboard
- Manage watchlists
- Store hypotheses
- Store signals
- Store positions
- Store orders
- Store decision logs
- Apply risk rules
- Integrate with Alpaca API
- Trigger or receive n8n workflow results
- Call ML service for signal scores
- Call embeddings/vector storage when needed

React dashboard pages:
- Overview
- Watchlist
- Hypotheses
- Signals
- Open Positions
- Orders
- Decision Log
- Backtests
- Settings

React Technical requirements:
- Shadcn UI

MVP API endpoints:
- GET /health
- GET /symbols
- POST /symbols
- GET /hypotheses
- POST /hypotheses
- GET /signals
- POST /signals/score
- GET /positions
- POST /orders/paper-buy
- POST /orders/paper-sell
- GET /decisions
- POST /decisions/evaluate
- POST /workflows/research-result
- POST /workflows/sentiment-result

Initial data models:
- Symbol
- NewsItem
- SentimentScore
- Hypothesis
- Signal
- Position
- Order
- DecisionLog
- RiskRule
- BacktestResult

Decision model:
A buy decision requires:
- symbol enabled
- no active trading pause
- model score above threshold
- sentiment not strongly negative
- risk limits passed
- market regime acceptable
- Claude hypothesis confidence above threshold
- no recent failed thesis for same symbol

A sell decision can be triggered by:
- stop loss
- trailing stop
- take profit
- max holding period
- negative thesis invalidation
- model score deterioration
- negative news shock
- market regime deterioration

Deployment:
Use Docker Compose as the source of truth. The compose stack should include:
- api
- dashboard
- ml-service
- embeddings-service
- qdrant or sqlite vector storage
- persistent volume for DuckDB
- optional caddy/coolify routing

Do not overbuild.
Do not add Kubernetes.
Do not add Redis yet.
Do not add Grafana yet.
Prioritize a working paper-trading MVP with excellent audit logs.

First milestone:
Create a working Go API, Vue dashboard, Docker Compose deployment, and DuckDB persistence. Dashboard should show symbols, hypotheses, signal scores, positions, orders, and decisions.

Second milestone:
Connect n8n workflow outputs into the Go API.

Third milestone:
Add Alpaca paper trading.

Fourth milestone:
Add sell automation.

Fifth milestone:
Add model training/backtesting.