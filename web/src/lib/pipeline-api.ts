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

export const pipelineApi = {
  workflowRuns: () => api.get<WorkflowRun[]>("/api/v1/workflows/runs"),
  newsBacklog: (status?: string) =>
    api.get<NewsBacklogItem[]>(`/api/v1/news/backlog${status ? `?status=${status}` : ""}`),
  newsArticles: () => api.get<ArticleWithDetails[]>("/api/v1/news/articles"),
  symbols: () => api.get<SymbolMarketStatus[]>("/api/v1/symbols"),
  snapshots: () => api.get<SymbolFeatureSnapshot[]>("/api/v1/symbols/snapshots/latest"),
  workspaceSignals: (workspaceId: string) =>
    api.get<WorkspaceSignal[]>(`/api/v1/workspaces/${workspaceId}/signals`),
}
