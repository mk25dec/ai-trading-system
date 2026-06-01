import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { History, RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ActualPredictedChart } from "@/components/actual-predicted-chart"
import { ChartProjectionReplayPanel } from "@/components/chart-projection-replay-panel"
import { ChartSelectionAnalysisPanel } from "@/components/chart-selection-analysis-panel"
import { WorkspaceToolbar } from "@/components/workspace-toolbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWorkspace } from "@/hooks/use-workspace"
import type { ChartSelectionAnalysis } from "@/lib/chart-selection-analysis"
import { pipelineApi, type PriceChartPoint, type PriceChartProjectionReplay } from "@/lib/pipeline-api"

/** Poll Alpaca snapshots + 1Min bars for near real-time prices. */
const LIVE_POLL_MS = 5_000

function formatRefreshedAt(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export function ChartPage() {
  const queryClient = useQueryClient()
  const { workspaceId, selectWorkspace, workspaces } = useWorkspace()
  const [symbol, setSymbol] = useState("")
  const [selection, setSelection] = useState<ChartSelectionAnalysis | null>(null)
  const [clearSelectionSignal, setClearSelectionSignal] = useState(0)
  const [replayMode, setReplayMode] = useState(false)
  const [replayProjection, setReplayProjection] = useState<PriceChartProjectionReplay | null>(null)

  const watchlist = useQuery({
    queryKey: ["watchlist", workspaceId],
    queryFn: () => pipelineApi.watchlist(workspaceId),
    enabled: !!workspaceId,
  })

  const symbols = useMemo(
    () => (watchlist.data ?? []).map((w) => w.symbol).filter(Boolean),
    [watchlist.data],
  )

  useEffect(() => {
    if (!symbol && symbols.length > 0) {
      setSymbol(symbols[0])
    }
    if (symbol && !symbols.includes(symbol) && symbols.length > 0) {
      setSymbol(symbols[0])
    }
  }, [symbol, symbols])

  useEffect(() => {
    setSelection(null)
    setClearSelectionSignal((n) => n + 1)
    setReplayProjection(null)
  }, [symbol])

  const projectionReplay = useMutation({
    mutationFn: (anchor: PriceChartPoint) =>
      pipelineApi.priceChartProjectionReplay(workspaceId, symbol, anchor.timestamp),
    onSuccess: (data) => setReplayProjection(data),
    onError: (e: Error) => toast.error(e.message),
  })

  const series = useQuery({
    queryKey: ["price-chart-live", workspaceId, symbol],
    queryFn: () => pipelineApi.priceChartLive(workspaceId, symbol),
    enabled: !!workspaceId && !!symbol,
    refetchInterval: LIVE_POLL_MS,
    refetchIntervalInBackground: true,
    placeholderData: (prev) => prev,
  })

  const sync = useMutation({
    mutationFn: () => pipelineApi.syncPriceChart(workspaceId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["price-chart-live", workspaceId] })
      toast.success(
        `Synced ${data.symbolsProcessed} symbols — ${data.candlesFetched} bars, ${data.predictionsUpdated} predictions`,
      )
      if (data.errors?.length) {
        toast.error(data.errors.join("; "))
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const withPred = series.data?.points.filter((p) => p.predictedPrice1 != null).length ?? 0
  const refreshedLabel = formatRefreshedAt(series.data?.refreshedAt)
  const latest = series.data?.latestPrice

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Price chart</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Watchlist symbols only. Real-time Alpaca{" "}
            <span className="font-medium text-foreground">1-minute</span> bars plus latest trade,
            refreshed every 5 seconds. Run{" "}
            <span className="font-medium text-foreground">Sync history</span> once for ~5 days of
            backfill and walk-forward <span className="font-medium text-foreground">predicted_price1</span>.
            Use <span className="font-medium text-foreground">Replay projection</span> to click a past
            time and see what the +3D formula predicted vs what actually happened.
          </p>
        </div>
        <WorkspaceToolbar
          workspaceId={workspaceId}
          workspaces={workspaces}
          onWorkspaceChange={selectWorkspace}
          onRefresh={() => sync.mutate()}
          isRefreshing={sync.isPending}
          refreshDisabled={!workspaceId}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Actual vs predicted</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                {series.data?.points.length ?? 0} minute bars
                {latest != null ? ` · last $${latest.toFixed(2)}` : ""}
                {withPred > 0 ? ` · ${withPred} with prediction` : " · run Sync to backfill predictions"}
              </span>
              {refreshedLabel ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  Live · updated {refreshedLabel}
                </span>
              ) : null}
              {series.isFetching && !series.isLoading ? (
                <span className="text-muted-foreground">Refreshing…</span>
              ) : null}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={symbol}
              onValueChange={(v) => setSymbol(v ?? "")}
              disabled={symbols.length === 0}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Symbol" />
              </SelectTrigger>
              <SelectContent>
                {symbols.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={replayMode ? "default" : "outline"}
              size="sm"
              disabled={symbols.length === 0}
              onClick={() => {
                setReplayMode((v) => !v)
                if (replayMode) setReplayProjection(null)
              }}
            >
              <History className="size-4" />
              Replay projection
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!workspaceId || sync.isPending}
              onClick={() => sync.mutate()}
            >
              <RefreshCw className={sync.isPending ? "size-4 animate-spin" : "size-4"} />
              Sync history
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {symbols.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add symbols to your workspace watchlist on the Research page, then sync.
            </p>
          ) : series.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading chart data…</p>
          ) : series.isError ? (
            <p className="text-sm text-destructive">{series.error.message}</p>
          ) : (
            <div className="space-y-4">
              <ActualPredictedChart
                points={series.data?.points ?? []}
                forwardPoints={series.data?.forwardPoints ?? []}
                symbol={symbol}
                height={440}
                onSelectionChange={setSelection}
                clearSelectionSignal={clearSelectionSignal}
                replayMode={replayMode}
                replayProjection={replayProjection}
                onAnchorPick={(point) => projectionReplay.mutate(point)}
              />
              {(replayMode || replayProjection || projectionReplay.isPending) && (
                <ChartProjectionReplayPanel
                  replay={replayProjection}
                  isLoading={projectionReplay.isPending}
                  onClear={() => {
                    setReplayProjection(null)
                    setReplayMode(false)
                  }}
                />
              )}
              {selection ? (
                <ChartSelectionAnalysisPanel
                  analysis={selection}
                  onClear={() => {
                    setSelection(null)
                    setClearSelectionSignal((n) => n + 1)
                  }}
                />
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
