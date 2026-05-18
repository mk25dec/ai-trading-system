import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { WorkspaceToolbar } from "@/components/workspace-toolbar"
import { useDataRefresh } from "@/hooks/use-data-refresh"
import { formatDateTime, useWorkspace } from "@/hooks/use-workspace"
import { PriceChart } from "@/components/price-chart"
import { DecisionDetailPanel, TraderOutlookTable } from "@/components/trader-outlook-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { resolveDecision, summarizeDecisions } from "@/lib/decision-engine"
import { sortResearchRows } from "@/lib/feature-metrics"
import { pipelineApi, type ResearchStockRow } from "@/lib/pipeline-api"

export function ResearchPage() {
  const queryClient = useQueryClient()
  const { workspaceId, selectWorkspace, workspaces } = useWorkspace()
  const { refresh, lastRefreshedAt } = useDataRefresh(workspaceId)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [symbolInput, setSymbolInput] = useState("")
  const [draftSymbols, setDraftSymbols] = useState<string[]>([])

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

  const sortedRows = useMemo(
    () => sortResearchRows(board.data?.rows ?? []),
    [board.data?.rows],
  )

  const decisionSummary = useMemo(
    () => summarizeDecisions(sortedRows),
    [sortedRows],
  )

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
            Multi-horizon decision engine: composite score, 3D / 1W / 1M outlook, news stance,
            and risk — expand any row for chart and evidence.
          </p>
        </div>
        <WorkspaceToolbar
          workspaceId={workspaceId}
          workspaces={workspaces}
          onWorkspaceChange={selectWorkspace}
          onRefresh={() => refresh.mutate()}
          isRefreshing={refresh.isPending}
          lastRefreshedAt={lastRefreshedAt ?? board.data?.refreshedAt ?? null}
        />
      </header>

      {board.data?.refreshedAt && (
        <p className="text-xs text-muted-foreground">
          Board data as of {formatDateTime(board.data.refreshedAt)}
        </p>
      )}

      {board.data?.diagnostics?.hint && (
        <Card className="border-amber-500/40 bg-amber-500/5 shadow-sm">
          <CardContent className="py-4 text-sm text-amber-950 dark:text-amber-100">
            <p className="font-medium">Market data not loaded</p>
            <p className="mt-1 text-muted-foreground">{board.data.diagnostics.hint}</p>
          </CardContent>
        </Card>
      )}

      {sortedRows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryChip label="Aligned bullish" value={String(decisionSummary.alignedBull)} />
          <SummaryChip label="Aligned bearish" value={String(decisionSummary.alignedBear)} />
          <SummaryChip label="Conflicts" value={String(decisionSummary.conflict)} />
          <SummaryChip label="High risk" value={String(decisionSummary.highRisk)} />
        </div>
      )}

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your watchlist</CardTitle>
          <CardDescription>
            Market ingestion and FinBERT run only for symbols you add here.
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
          <CardTitle className="text-base">Trader outlook</CardTitle>
          <CardDescription>
            Statistics-driven signal from technicals, FinBERT news, risk, and horizon alignment.
            Research only — not an order.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {board.isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ResearchOutlookWithDetail
              rows={sortedRows}
              expanded={expanded}
              onToggle={(sym) => setExpanded((s) => (s === sym ? null : sym))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function ResearchOutlookWithDetail({
  rows,
  expanded,
  onToggle,
}: {
  rows: ResearchStockRow[]
  expanded: string | null
  onToggle: (symbol: string) => void
}) {
  if (rows.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        Add symbols and click Get latest data to load prices and FinBERT sentiment.
      </p>
    )
  }

  return (
    <TraderOutlookTable
      rows={rows}
      expanded={expanded}
      onToggle={onToggle}
      renderDetail={(row) => <ResearchRowDetail row={row} />}
    />
  )
}

export function ResearchRowDetail({ row }: { row: ResearchStockRow }) {
  const decision = resolveDecision(row)
  return (
    <DecisionDetailPanel row={row} decision={decision}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Price (90d)
          </p>
          <PriceChart candles={row.candles} />
        </div>
        {row.headlines.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Recent news
            </p>
            <ul className="space-y-2 text-sm">
              {row.headlines.map((h) => (
                <li key={h.url}>
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
    </DecisionDetailPanel>
  )
}
