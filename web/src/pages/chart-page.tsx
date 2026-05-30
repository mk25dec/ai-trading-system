import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ActualPredictedChart } from "@/components/actual-predicted-chart"
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
import { pipelineApi } from "@/lib/pipeline-api"

export function ChartPage() {
  const queryClient = useQueryClient()
  const { workspaceId, selectWorkspace, workspaces } = useWorkspace()
  const [symbol, setSymbol] = useState("")

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

  const series = useQuery({
    queryKey: ["price-chart", workspaceId, symbol],
    queryFn: () => pipelineApi.priceChart(workspaceId, symbol),
    enabled: !!workspaceId && !!symbol,
  })

  const sync = useMutation({
    mutationFn: () => pipelineApi.syncPriceChart(workspaceId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["price-chart", workspaceId] })
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Price chart</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Actual daily close from Alpaca vs walk-forward{" "}
            <span className="font-medium text-foreground">predicted_price1</span> (same formula as
            research projection bands, 21-day horizon). Sync loads up to ~3 years of history for
            your watchlist.
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
            <CardDescription>
              {series.data?.points.length ?? 0} bars
              {withPred > 0 ? ` · ${withPred} with prediction` : " · run Sync to backfill"}
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
            <ActualPredictedChart
              points={series.data?.points ?? []}
              symbol={symbol}
              height={440}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
