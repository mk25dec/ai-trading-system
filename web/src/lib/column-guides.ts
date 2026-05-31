/** Column glossary for table headers — meaning and how to read values. */
export type ColumnGuide = {
  title: string
  meaning: string
  positive: string
  negative: string
  neutral: string
}

export const marketDataColumnGuides: Record<string, ColumnGuide> = {
  symbol: {
    title: "Symbol",
    meaning: "US ticker on your workspace watchlist.",
    positive: "Recognized ticker with fresh bars after refresh.",
    negative: "Invalid or delisted symbol — no bars from Alpaca.",
    neutral: "—",
  },
  company: {
    title: "Company",
    meaning: "Legal name from Alpaca asset metadata (enriched on refresh).",
    positive: "Full company name shown.",
    negative: "N/A — asset lookup failed or not yet refreshed.",
    neutral: "—",
  },
  exchange: {
    title: "Exchange",
    meaning: "Listing venue (e.g. NASDAQ, NYSE).",
    positive: "Known US listing.",
    negative: "N/A — metadata missing.",
    neutral: "—",
  },
  last: {
    title: "Last",
    meaning: "Most recent daily close from stored Alpaca bars.",
    positive: "Higher vs your entry if you are long (context-dependent).",
    negative: "Lower vs your entry if you are long.",
    neutral: "Flat day-over-day.",
  },
  open: {
    title: "Open",
    meaning: "Session open for the latest daily bar.",
    positive: "Open below last close can hint intraday recovery (weak signal alone).",
    negative: "Open above last close with weak close — selling pressure.",
    neutral: "Near prior close.",
  },
  high: {
    title: "High",
    meaning: "High of the latest daily bar.",
    positive: "New highs vs recent range — strength.",
    negative: "Failed rally if close is far below high.",
    neutral: "Mid-range high.",
  },
  low: {
    title: "Low",
    meaning: "Low of the latest daily bar.",
    positive: "Held above recent lows — support.",
    negative: "Breakdown below prior lows.",
    neutral: "Inside recent range.",
  },
  prev: {
    title: "Prev",
    meaning: "Previous session close (baseline for 24h change).",
    positive: "—",
    negative: "—",
    neutral: "Reference price only.",
  },
  change24h: {
    title: "24h",
    meaning: "Percent change vs previous close (~1 trading day).",
    positive: "Green / +% — price up vs prior close (bullish short-term).",
    negative: "Red / −% — price down (bearish short-term).",
    neutral: "Near 0% — little net move.",
  },
  change5d: {
    title: "5d",
    meaning: "Percent change over ~5 trading days.",
    positive: "+% — short swing trend up.",
    negative: "−% — short swing trend down.",
    neutral: "~0% — range-bound week.",
  },
  vol: {
    title: "Vol",
    meaning: "Share volume on the latest bar vs recent average (when computed).",
    positive: "Elevated volume on up days confirms moves.",
    negative: "High volume on down days — distribution.",
    neutral: "Average volume — no unusual participation.",
  },
  rsi: {
    title: "RSI",
    meaning: "14-period RSI from daily closes (0–100).",
    positive: "30–55 rising from oversold — constructive momentum.",
    negative: "Above 70 overbought (pullback risk); below 30 oversold (bounce or trend).",
    neutral: "45–55 — no extreme.",
  },
  high52w: {
    title: "52w H",
    meaning: "Highest close in the last year of stored bars.",
    positive: "Last price near 52w high — relative strength.",
    negative: "Far below 52w high — deep drawdown from peak.",
    neutral: "Mid-range vs 52w band.",
  },
  low52w: {
    title: "52w L",
    meaning: "Lowest close in the last year of stored bars.",
    positive: "Price well above 52w low — recovery from trough.",
    negative: "At or near 52w low — weak long-term tape.",
    neutral: "Between 52w high and low.",
  },
  sma20: {
    title: "SMA20",
    meaning: "20-day simple moving average of close.",
    positive: "Last > SMA20 — short-term uptrend.",
    negative: "Last < SMA20 — short-term downtrend.",
    neutral: "Price hugging SMA20 — equilibrium.",
  },
  bar: {
    title: "Bar",
    meaning: "Timestamp of the newest stored daily candle.",
    positive: "Recent (within ~1–2 sessions after refresh).",
    negative: "Older than 3 days — stale; run Refresh data.",
    neutral: "—",
  },
  status: {
    title: "Status",
    meaning: "Freshness of market data for this symbol.",
    positive: "ok — bars updated recently.",
    negative: "stale — refresh or check Alpaca keys.",
    neutral: "—",
  },
}

export const traderOutlookColumnGuides: Record<string, ColumnGuide> = {
  security: {
    title: "Security · quote",
    meaning: "Ticker, company name, last price, and day change.",
    positive: "Liquid name with live quote and data.",
    negative: "Missing quote or invalid ticker.",
    neutral: "—",
  },
  chart: {
    title: "Chart",
    meaning: "Mini sparkline of recent daily closes.",
    positive: "Upward slope — recent strength.",
    negative: "Downward slope — recent weakness.",
    neutral: "Flat — consolidation.",
  },
  signal: {
    title: "Signal",
    meaning: "Primary action from the decision engine (buy / sell / watch / avoid).",
    positive: "Buy candidate — rules lean bullish.",
    negative: "Sell or avoid — rules lean bearish or blocked.",
    neutral: "Watch — wait for confirmation.",
  },
  score: {
    title: "Score",
    meaning: "Composite score 0–100 from technical, trend, news, and risk categories.",
    positive: "Higher score (e.g. 65+) — stronger bullish composite.",
    negative: "Lower score (e.g. under 40) — weak or bearish composite.",
    neutral: "Mid 40–60 — mixed signals.",
  },
  horizons: {
    title: "Horizons",
    meaning: "Outlook at 3D, 1W, and 1M (bullish / bearish / neutral badges).",
    positive: "Green badges — bullish at that horizon.",
    negative: "Red badges — bearish.",
    neutral: "Gray — neutral or low confidence.",
  },
  news: {
    title: "News",
    meaning: "FinBERT-weighted news stance and confidence.",
    positive: "Bullish stance with high confidence.",
    negative: "Bearish stance with high confidence.",
    neutral: "Neutral or no recent articles.",
  },
  risk: {
    title: "Risk",
    meaning: "Volatility / drawdown risk bucket from market features.",
    positive: "Low risk — calmer tape.",
    negative: "High risk — elevated volatility or stress.",
    neutral: "Medium — typical conditions.",
  },
  alignment: {
    title: "Alignment",
    meaning: "Whether price trend, news, and composite score agree.",
    positive: "Aligned — factors point same direction.",
    negative: "Conflict (⚠) — news vs price disagree.",
    neutral: "Partial — mixed agreement.",
  },
  driver: {
    title: "Driver",
    meaning: "Top reason behind the current signal (human-readable).",
    positive: "Drivers citing momentum, positive news, or trend.",
    negative: "Drivers citing risk, negative news, or weakness.",
    neutral: "Data gaps or neutral mix.",
  },
}
