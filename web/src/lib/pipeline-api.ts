import { api } from "@/lib/api"

export type BacklogStatus = "new" | "fetched" | "duplicate" | "failed" | "processed"
export type WorkflowRunStatus = "running" | "success" | "failed" | "partial"

export interface NewsBacklogItem {
  id: string
  source: string
  url: string
  canonicalUrl: string
  title: string
  publishedAt?: string
  discoveredAt: string
  rawSymbolGuess: string[]
  status: BacklogStatus
  errorMessage?: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ArticleSymbol {
  articleId: string
  symbol: string
  relevanceScore: number
  detectionMethod: string
  confidence: number
}

export interface ArticleSentiment {
  articleId: string
  symbol: string
  sentimentLabel: "positive" | "neutral" | "negative"
  sentimentScore: number
  confidence: number
  modelName: string
  inputMode: string
}

export interface ArticleWithDetails {
  id: string
  source: string
  url: string
  title: string
  publishedAt?: string
  discoveredAt?: string
  fetchedAt?: string
  cleanedText: string
  symbols?: ArticleSymbol[]
  sentiment?: ArticleSentiment[]
}

export interface WorkflowRun {
  id: string
  workflowName: string
  status: WorkflowRunStatus
  startedAt: string
  endedAt?: string
  durationMs?: number
  itemsProcessed: number
  errorMessage?: string
}

export interface SymbolMarketStatus {
  symbol: string
  name: string
  isActive: boolean
  latestCandleAt?: string
  dataFetchedAt?: string
  lastClose?: number
}

export interface SymbolFeatureSnapshot {
  symbol: string
  timestamp: string
  marketFeatures: Record<string, unknown>
  newsFeatures: Record<string, unknown>
  combinedScore?: number
  dataQualityScore: number
  missingFields: string[]
}

export interface WorkspaceSignal {
  id: string
  workspaceId: string
  symbol: string
  timestamp: string
  action: string
  direction: string
  score: number
  confidence: number
  reasons: unknown[]
  status: string
}

export interface MarketFeatures {
  symbol: string
  timestamp: string
  priceChange1h?: number
  priceChange24h?: number
  priceChange5d?: number
  volumeRatio?: number
  volatility?: number
  rsi?: number
  sma20?: number
  sma50?: number
  distanceSma20?: number
  distanceSma50?: number
}

export interface FinbertMetrics {
  avgProbPositive1h?: number
  avgProbNegative1h?: number
  avgProbNeutral1h?: number
  avgConfidence1h?: number
  positiveLabelPct1h?: number
  negativeLabelPct1h?: number
  neutralLabelPct1h?: number
  maxProbPositive1h?: number
  maxProbNegative1h?: number
  highConfPositive1h?: number
  highConfNegative1h?: number
  weightedSentiment1h?: number

  avgProbPositive4h?: number
  avgProbNegative4h?: number
  avgProbNeutral4h?: number
  avgConfidence4h?: number

  avgProbPositive24h?: number
  avgProbNegative24h?: number
  avgProbNeutral24h?: number
  avgConfidence24h?: number
  positiveLabelPct24h?: number
  negativeLabelPct24h?: number
  neutralLabelPct24h?: number
  maxProbPositive24h?: number
  maxProbNegative24h?: number
  maxConfidence24h?: number
  highConfPositive24h?: number
  highConfNegative24h?: number
  weightedSentiment24h?: number
  labelEntropy24h?: number
}

export interface NewsFeatures {
  symbol: string
  timestamp: string
  newsCount1h: number
  newsCount4h: number
  newsCount24h: number
  avgSentiment1h?: number
  avgSentiment4h?: number
  avgSentiment24h?: number
  sentimentMomentum?: number
  positiveNewsSpike: boolean
  negativeNewsSpike: boolean
  maxRelevanceScore24h?: number
  finbert?: FinbertMetrics
}

export interface MarketCandle {
  symbol: string
  timeframe: string
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ResearchHeadline {
  title: string
  url: string
  publishedAt?: string
  sentimentLabel?: string
  sentimentScore?: number
}

export type RecommendationAction =
  | "buy_candidate"
  | "sell_candidate"
  | "avoid"
  | "watch"

export type OutlookLabel =
  | "strong_buy"
  | "buy"
  | "watch"
  | "sell"
  | "avoid"

export interface HorizonOutlook {
  id: string
  label: string
  score: number
  outlook: OutlookLabel
  confidence: number
}

export interface CategoryScore {
  id: string
  label: string
  score: number
  confidence: number
  weight: number
}

export interface DecisionView {
  primaryAction: RecommendationAction
  primaryOutlook: string
  compositeScore: number
  confidence: number
  riskLevel: "low" | "medium" | "high" | string
  alignment: string
  conflict: boolean
  conflictNote?: string
  newsStance: string
  newsConfidence?: number
  priceTrend: string
  drivers: string[]
  horizons: HorizonOutlook[]
  categories?: CategoryScore[]
}

export interface ResearchStockRow {
  symbol: string
  name: string
  recommendation: RecommendationAction
  confidence: number
  score: number
  decision?: DecisionView
  bullets: string[]
  lastClose?: number
  market?: MarketFeatures
  news?: NewsFeatures
  candles: MarketCandle[]
  headlines: ResearchHeadline[]
  updatedAt?: string
}

export interface ResearchDiagnostics {
  alpacaConfigured: boolean
  alpacaFeed?: string
  symbolsWithCandles: number
  symbolsWithMarketFeatures: number
  hint?: string
}

export interface ResearchBoard {
  workspaceId: string
  workspaceName: string
  symbols: string[]
  rows: ResearchStockRow[]
  refreshedAt?: string
  diagnostics: ResearchDiagnostics
}

export interface ResearchRefreshResult {
  symbolsProcessed: number
  candlesFetched: number
  candlesInserted: number
  sentimentProcessed: number
  signalsGenerated: number
  errors?: string[]
}

export const pipelineApi = {
  workflowRuns: () => api.get<WorkflowRun[]>("/api/v1/workflows/runs"),
  newsBacklog: (workspaceId: string, status?: string) =>
    api.get<NewsBacklogItem[]>(
      `/api/v1/workspaces/${workspaceId}/news/backlog${status ? `?status=${status}` : ""}`,
    ),
  newsArticles: (workspaceId: string) =>
    api.get<ArticleWithDetails[]>(`/api/v1/workspaces/${workspaceId}/news/articles`),
  symbols: (workspaceId: string) =>
    api.get<SymbolMarketStatus[]>(`/api/v1/workspaces/${workspaceId}/symbols`),
  snapshots: (workspaceId: string) =>
    api.get<SymbolFeatureSnapshot[]>(
      `/api/v1/workspaces/${workspaceId}/symbols/snapshots/latest`,
    ),
  workspaceSignals: (workspaceId: string) =>
    api.get<WorkspaceSignal[]>(`/api/v1/workspaces/${workspaceId}/signals`),
  watchlist: (workspaceId: string) =>
    api.get<{ symbol: string; isActive: boolean }[]>(
      `/api/v1/workspaces/${workspaceId}/watchlist`,
    ),
  setWatchlist: (workspaceId: string, symbols: string[]) =>
    api.put(`/api/v1/workspaces/${workspaceId}/watchlist`, { symbols }),
  researchBoard: (workspaceId: string) =>
    api.get<ResearchBoard>(`/api/v1/workspaces/${workspaceId}/research`),
  refreshResearch: (workspaceId: string) =>
    api.post<ResearchRefreshResult>(
      `/api/v1/workspaces/${workspaceId}/research/refresh`,
    ),
}
