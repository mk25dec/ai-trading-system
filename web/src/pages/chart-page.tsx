import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { History, RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ActualPredictedChart } from "@/components/actual-predicted-chart"
import { ChartProjectionReplayPanel } from "@/components/chart-projection-replay-panel"
import { ChartSelectionAnalysisPanel } from "@/components/chart-selection-analysis-panel"
import { LivePriceChart } from "@/components/live-price-chart"
import { ProjectionReplayChart } from "@/components/projection-replay-chart"
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

/** Live price ticker — Alpaca refresh, no chart flicker. */
const LIVE_PRICE_POLL_MS = 120_000

function formatRefreshedAt(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function parseAnchorMs(iso?: string): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime()
  return Number.isNaN(ms) ? null : ms
}

export function ChartPage() {
  const queryClient = useQueryClient()
  const { workspaceId, selectWorkspace, workspaces } = useWorkspace()
  const [symbol, setSymbol] = useState("")
  const [selection, setSelection] = useState<ChartSelectionAnalysis | null>(null)
  const [clearSelectionSignal, setClearSelectionSignal] = useState(0)
  const [pickMode, setPickMode] = useState(false)
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
    setPickMode(false)
  }, [symbol])

  const liveSeries = useQuery({
    queryKey: ["price-chart-live-ticker", workspaceId, symbol],
    queryFn: () => pipelineApi.priceChartLive(workspaceId, symbol),
    enabled: !!workspaceId && !!symbol,
    refetchInterval: LIVE_PRICE_POLL_MS,
    refetchIntervalInBackground: true,
    placeholderData: (prev) => prev,
    staleTime: LIVE_PRICE_POLL_MS - 5_000,
  })

  const analysisSeries = useQuery({
    queryKey: ["price-chart-analysis", workspaceId, symbol],
    queryFn: () => pipelineApi.priceChart(workspaceId, symbol),
    enabled: !!workspaceId && !!symbol,
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  })

  const refreshAnalysis = useMutation({
    mutationFn: () => pipelineApi.priceChartLive(workspaceId, symbol),
    onSuccess: (data) => {
      queryClient.setQueryData(["price-chart-analysis", workspaceId, symbol], data)
      toast.success("Analysis chart updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const projectionReplay = useMutation({
    mutationFn: (anchor: PriceChartPoint) =>
      pipelineApi.priceChartProjectionReplay(workspaceId, symbol, anchor.timestamp),
    onSuccess: (data) => {
      setReplayProjection(data)
      setPickMode(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const sync = useMutation({
    mutationFn: () => pipelineApi.syncPriceChart(workspaceId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["price-chart-live-ticker", workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ["price-chart-analysis", workspaceId] })
      toast.success(
        `Synced ${data.symbolsProcessed} symbols — ${data.candlesFetched} bars, ${data.predictionsUpdated} predictions`,
      )
      if (data.errors?.length) {
        toast.error(data.errors.join("; "))
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const refreshAnalysisChart = () => {
    refreshAnalysis.mutate()
  }

  const liveRefreshedLabel = formatRefreshedAt(liveSeries.data?.refreshedAt)
  const liveLatest = liveSeries.data?.latestPrice
  const analysisRefreshedLabel = formatRefreshedAt(analysisSeries.data?.refreshedAt)
  const withPred =
    analysisSeries.data?.points.filter((p) => p.predictedPrice1 != null).length ?? 0
  const highlightAnchorMs = parseAnchorMs(replayProjection?.anchor.timestamp)
  const analysisPoints = analysisSeries.data?.points ?? []

  const clearReplay = () => {
    setReplayProjection(null)
    setPickMode(false)
  }

  const chartBusy = symbols.length === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Price chart</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Live price updates every 2 minutes in its own chart. Analysis and replay charts refresh
            only when you click Refresh — they won&apos;t jump while you inspect projections.
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

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={symbol}
          onValueChange={(v) => setSymbol(v ?? "")}
          disabled={chartBusy}
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
          variant="outline"
          size="sm"
          disabled={!workspaceId || sync.isPending}
          onClick={() => sync.mutate()}
        >
          <RefreshCw className={sync.isPending ? "size-4 animate-spin" : "size-4"} />
          Sync history
        </Button>
      </div>

      <Card className="border-emerald-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Live price</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Real-time 1-minute bars — auto-refresh every 2 minutes</span>
            {liveLatest != null ? (
              <span className="font-mono font-medium text-foreground">
                · ${liveLatest.toFixed(2)}
              </span>
            ) : null}
            {liveRefreshedLabel ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                · updated {liveRefreshedLabel}
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartBusy ? (
            <p className="text-sm text-muted-foreground">
              Add symbols to your workspace watchlist on the Research page, then sync.
            </p>
          ) : liveSeries.isLoading && !liveSeries.data ? (
            <p className="text-sm text-muted-foreground">Loading live price…</p>
          ) : liveSeries.isError ? (
            <p className="text-sm text-destructive">{liveSeries.error.message}</p>
          ) : (
            <LivePriceChart
              points={liveSeries.data?.points ?? []}
              symbol={symbol}
              height={280}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Actual vs predicted</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                {analysisPoints.length} minute bars
                {withPred > 0 ? ` · ${withPred} with prediction` : " · run Sync to backfill predictions"}
              </span>
              {analysisRefreshedLabel ? (
                <span className="text-muted-foreground">
                  · snapshot {analysisRefreshedLabel}
                </span>
              ) : null}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={chartBusy || refreshAnalysis.isPending}
            onClick={refreshAnalysisChart}
          >
            <RefreshCw
              className={refreshAnalysis.isPending ? "size-4 animate-spin" : "size-4"}
            />
            Refresh chart
          </Button>
        </CardHeader>
        <CardContent>
          {chartBusy ? (
            <p className="text-sm text-muted-foreground">Select a symbol to load the analysis chart.</p>
          ) : analysisSeries.isLoading && !analysisSeries.data ? (
            <p className="text-sm text-muted-foreground">Loading chart data…</p>
          ) : analysisSeries.isError ? (
            <p className="text-sm text-destructive">{analysisSeries.error.message}</p>
          ) : (
            <div className="space-y-4">
              <ActualPredictedChart
                points={analysisPoints}
                forwardPoints={analysisSeries.data?.forwardPoints ?? []}
                symbol={symbol}
                height={440}
                onSelectionChange={setSelection}
                clearSelectionSignal={clearSelectionSignal}
                replayMode={pickMode}
                highlightAnchorMs={highlightAnchorMs}
                onAnchorPick={(point) => projectionReplay.mutate(point)}
              />
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

      <Card className="border-violet-500/25">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Projection replay (+3D backtest)</CardTitle>
            <CardDescription className="max-w-2xl">
              Pick a past time on the analysis chart, then review projected vs actual in the replay
              view. Refresh the analysis chart first if you need newer history.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={pickMode ? "default" : "outline"}
              size="sm"
              disabled={chartBusy || analysisSeries.isLoading || analysisPoints.length === 0}
              onClick={() => setPickMode((v) => !v)}
            >
              <History className="size-4" />
              {pickMode ? "Click analysis chart…" : "Pick anchor time"}
            </Button>
            {(replayProjection || pickMode) && (
              <Button variant="ghost" size="sm" onClick={clearReplay}>
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!replayProjection && !projectionReplay.isPending && !pickMode && (
            <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              Click <span className="font-medium text-foreground">Pick anchor time</span>, then
              click a point on the blue line in the <span className="font-medium">Actual vs predicted</span>{" "}
              chart.
            </p>
          )}
          {pickMode && !projectionReplay.isPending && !replayProjection && (
            <p className="rounded-lg border border-violet-500/30 bg-violet-500/5 py-4 text-center text-sm text-violet-900 dark:text-violet-200">
              Pick mode active — click any point on the <span className="font-medium">Live price</span>{" "}
              line in the analysis chart above.
            </p>
          )}
          {(projectionReplay.isPending || replayProjection) && (
            <>
              <ChartProjectionReplayPanel
                replay={replayProjection}
                isLoading={projectionReplay.isPending}
                onClear={clearReplay}
              />
              {replayProjection && analysisPoints.length > 0 ? (
                <ProjectionReplayChart
                  symbol={symbol}
                  allPoints={analysisPoints}
                  replay={replayProjection}
                  height={380}
                />
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
