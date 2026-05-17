import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ChevronRight, Plus, RefreshCw, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { PriceChart } from "@/components/price-chart"
import { RecommendationBadge } from "@/components/recommendation-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api, type WorkspaceWithRole } from "@/lib/api"
import {
  pipelineApi,
  type RecommendationAction,
  type ResearchStockRow,
} from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

const WORKSPACE_KEY = "research-workspace-id"

function formatPct(v?: number) {
  if (v == null || Number.isNaN(v)) return "—"
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`
}

function formatNum(v?: number, digits = 2) {
  if (v == null || Number.isNaN(v)) return "—"
  return v.toFixed(digits)
}

function MarketMetrics({ row }: { row: ResearchStockRow }) {
  const m = row.market
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
      <Metric label="Last" value={row.lastClose != null ? `$${row.lastClose.toFixed(2)}` : "—"} />
      <Metric label="24h" value={formatPct(m?.priceChange24h)} />
      <Metric label="5d" value={formatPct(m?.priceChange5d)} />
      <Metric label="RSI" value={formatNum(m?.rsi, 1)} />
      <Metric label="Vol ratio" value={m?.volumeRatio != null ? `${m.volumeRatio.toFixed(2)}x` : "—"} />
      <Metric label="vs SMA20" value={formatPct(m?.distanceSma20)} />
    </dl>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function StockDetailPanel({ row }: { row: ResearchStockRow }) {
  return (
    <div className="grid gap-6 border-t bg-muted/20 p-4 lg:grid-cols-[minmax(0,1fr)_280px_minmax(0,1.2fr)]">
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Analysis
        </p>
        <ul className="space-y-2 text-sm leading-relaxed">
          {row.bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        {row.headlines.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Recent news
            </p>
            <ul className="space-y-2">
              {row.headlines.map((h) => (
                <li key={h.url} className="text-sm">
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {h.title}
                  </a>
                  {h.sentimentLabel && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      FinBERT: {h.sentimentLabel}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Price (90d)
        </p>
        <PriceChart candles={row.candles} />
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Trading parameters
        </p>
        <MarketMetrics row={row} />
        {row.news && (
          <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <Metric
              label="News 24h"
              value={String(row.news.newsCount24h)}
            />
            <Metric
              label="Sentiment 24h"
              value={
                row.news.avgSentiment24h != null
                  ? row.news.avgSentiment24h.toFixed(2)
                  : "—"
              }
            />
          </dl>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Score {row.score.toFixed(2)} · confidence {(row.confidence * 100).toFixed(0)}%.
          Research signal only — not an order.
        </p>
      </div>
    </div>
  )
}

export function ResearchPage() {
  const queryClient = useQueryClient()
  const [workspaceId, setWorkspaceId] = useState<string>(() =>
    localStorage.getItem(WORKSPACE_KEY) ?? "",
  )
  const [expanded, setExpanded] = useState<string | null>(null)
  const [symbolInput, setSymbolInput] = useState("")
  const [draftSymbols, setDraftSymbols] = useState<string[]>([])

  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.get<WorkspaceWithRole[]>("/api/v1/workspaces"),
  })

  useEffect(() => {
    if (!workspaceId && workspaces.data?.length) {
      const id = workspaces.data[0].id
      setWorkspaceId(id)
      localStorage.setItem(WORKSPACE_KEY, id)
    }
  }, [workspaceId, workspaces.data])

  const board = useQuery({
    queryKey: ["research-board", workspaceId],
    queryFn: () => pipelineApi.researchBoard(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: 120_000,
  })

  useEffect(() => {
    if (board.data?.symbols) {
      setDraftSymbols(board.data.symbols)
    }
  }, [board.data?.symbols])

  const saveWatchlist = useMutation({
    mutationFn: (symbols: string[]) =>
      pipelineApi.setWatchlist(workspaceId, symbols),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-board", workspaceId] })
      toast.success("Watchlist updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const refresh = useMutation({
    mutationFn: () => pipelineApi.refreshResearch(workspaceId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["research-board", workspaceId] })
      const parts = [
        `${result.symbolsProcessed} symbols`,
        `${result.candlesInserted} candles`,
        `${result.sentimentProcessed} FinBERT runs`,
        `${result.signalsGenerated} signals`,
      ]
      toast.success(`Refresh complete: ${parts.join(" · ")}`)
      if (result.errors?.length) {
        toast.warning(result.errors.join("; "))
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const sortedRows = useMemo(() => {
    const rows = board.data?.rows ?? []
    const order: Record<string, number> = {
      buy_candidate: 0,
      sell_candidate: 1,
      watch: 2,
      avoid: 3,
    }
    return [...rows].sort(
      (a, b) =>
        (order[a.recommendation] ?? 9) - (order[b.recommendation] ?? 9) ||
        b.confidence - a.confidence,
    )
  }, [board.data?.rows])

  function addSymbol() {
    const sym = symbolInput.trim().toUpperCase()
    if (!sym) return
    if (draftSymbols.includes(sym)) {
      toast.error(`${sym} is already on your list`)
      return
    }
    const next = [...draftSymbols, sym]
    setDraftSymbols(next)
    setSymbolInput("")
    saveWatchlist.mutate(next)
  }

  function removeSymbol(sym: string) {
    const next = draftSymbols.filter((s) => s !== sym)
    setDraftSymbols(next)
    saveWatchlist.mutate(next)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Stock research</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Manage your watchlist, pull market data for those symbols only, run FinBERT on
            related news, and view buy / sell / watch / avoid recommendations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {workspaces.data && workspaces.data.length > 1 && (
            <Select
              value={workspaceId}
              onValueChange={(v) => {
                if (!v) return
                setWorkspaceId(v)
                localStorage.setItem(WORKSPACE_KEY, v)
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.data.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            disabled={!workspaceId || refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            <RefreshCw
              className={cn("size-4", refresh.isPending && "animate-spin")}
            />
            Refresh data
          </Button>
        </div>
      </header>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your watchlist</CardTitle>
          <CardDescription>
            Market ingestion and FinBERT analysis run only for symbols you add here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 gap-2">
            <Input
              placeholder="e.g. IBM"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && addSymbol()}
              className="max-w-xs font-mono uppercase"
            />
            <Button onClick={addSymbol} disabled={saveWatchlist.isPending}>
              <Plus className="size-4" />
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {draftSymbols.map((sym) => (
              <Badge key={sym} variant="secondary" className="gap-1 font-mono">
                {sym}
                <button
                  type="button"
                  className="rounded-sm hover:bg-muted"
                  onClick={() => removeSymbol(sym)}
                  aria-label={`Remove ${sym}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            {draftSymbols.length === 0 && (
              <span className="text-sm text-muted-foreground">No symbols yet</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b bg-muted/30 pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Recommendations</CardTitle>
              <CardDescription>
                {board.data?.workspaceName
                  ? `${board.data.workspaceName} · `
                  : ""}
                Sorted by signal strength. Expand a row for chart and analysis.
              </CardDescription>
            </div>
            {board.isFetching && (
              <span className="text-xs text-muted-foreground">Updating…</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {board.isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : sortedRows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Add symbols and click Refresh data to load market prices and FinBERT news
              sentiment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Symbol</TableHead>
                  <TableHead>Signal</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">24h</TableHead>
                  <TableHead className="text-right">RSI</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">News 24h</TableHead>
                  <TableHead className="text-right">Sentiment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((row) => {
                  const open = expanded === row.symbol
                  return (
                    <ResearchTableRow
                      key={row.symbol}
                      row={row}
                      open={open}
                      onToggle={() =>
                        setExpanded(open ? null : row.symbol)
                      }
                    />
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ResearchTableRow({
  row,
  open,
  onToggle,
}: {
  row: ResearchStockRow
  open: boolean
  onToggle: () => void
}) {
  const rec = row.recommendation as RecommendationAction
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/40"
        onClick={onToggle}
      >
        <TableCell>
          {open ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell>
          <div className="font-mono font-semibold">{row.symbol}</div>
          <div className="text-xs text-muted-foreground">{row.name}</div>
        </TableCell>
        <TableCell>
          <RecommendationBadge action={rec} />
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {row.lastClose != null ? row.lastClose.toFixed(2) : "—"}
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {formatPct(row.market?.priceChange24h)}
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {formatNum(row.market?.rsi, 1)}
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {row.market?.volumeRatio != null
            ? `${row.market.volumeRatio.toFixed(2)}x`
            : "—"}
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {row.news?.newsCount24h ?? "—"}
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {row.news?.avgSentiment24h != null
            ? row.news.avgSentiment24h.toFixed(2)
            : "—"}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={9} className="p-0">
            <StockDetailPanel row={row} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
