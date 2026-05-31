import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react"
import { useMemo, useState } from "react"
import { AssetClassSection } from "@/components/asset-class-section"
import { WorkspaceToolbar } from "@/components/workspace-toolbar"
import { CategoryBreakdownTable } from "@/components/decision/category-breakdown-table"
import { TraderKpiCards } from "@/components/decision/trader-kpi-cards"
import { TraderOutlookTable } from "@/components/trader-outlook-table"
import { RecommendationBadge } from "@/components/recommendation-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useDataRefresh } from "@/hooks/use-data-refresh"
import { formatDateTime, useWorkspace } from "@/hooks/use-workspace"
import {
  formatLabelPct,
  formatNum,
  formatPct,
  formatProb,
  formatSentiment,
  pctClass,
  probClass,
  rsiLabel,
  sentimentClass,
  snapshotBySymbol,
  sortResearchRows,
  summarizeRows,
  type FeatureRow,
} from "@/lib/feature-metrics"
import { buildTraderKpis, finbertForRow, hasNewsCoverage } from "@/lib/decision-engine"
import {
  pipelineApi,
  type FinbertMetrics,
  type RecommendationAction,
} from "@/lib/pipeline-api"
import { ASSET_CLASS_LABELS, groupByAssetClass } from "@/lib/asset-class"
import { cn } from "@/lib/utils"

export function FeaturesPage() {
  const { workspaceId, selectWorkspace, workspaces, activeWorkspace } = useWorkspace()
  const { refresh, lastRefreshedAt } = useDataRefresh(workspaceId)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAnalyst, setShowAnalyst] = useState(false)

  const board = useQuery({
    queryKey: ["research-board", workspaceId],
    queryFn: () => pipelineApi.researchBoard(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: 120_000,
  })

  const snapshots = useQuery({
    queryKey: ["snapshots", workspaceId],
    queryFn: () => pipelineApi.snapshots(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: 120_000,
  })

  const rows = useMemo(() => {
    const snaps = snapshotBySymbol(snapshots.data ?? [])
    const merged: FeatureRow[] = (board.data?.rows ?? []).map((row) => ({
      ...row,
      snapshot: snaps.get(row.symbol),
    }))
    return sortResearchRows(merged)
  }, [board.data?.rows, snapshots.data])

  const summary = useMemo(() => summarizeRows(rows), [rows])
  const kpis = useMemo(
    () =>
      buildTraderKpis(rows, {
        buy: summary.buy,
        sell: summary.sell,
        avoid: summary.avoid,
        watchlist: summary.total,
        quality:
          summary.avgQuality != null ? `${(summary.avgQuality * 100).toFixed(0)}%` : undefined,
      }),
    [rows, summary],
  )

  const outlookSections = useMemo(() => groupByAssetClass(rows), [rows])

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Features</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Market, news, and combined signals for{" "}
            {activeWorkspace ? (
              <span className="font-medium text-foreground">{activeWorkspace.name}</span>
            ) : (
              "your workspace"
            )}{" "}
            watchlist — trader outlook first; expand for evidence or open analyst metrics.
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

      {summary.negSpike > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-950 dark:text-amber-100">
                {summary.negSpike} symbol{summary.negSpike === 1 ? "" : "s"} with negative news spike (1h)
              </p>
              <p className="mt-1 text-muted-foreground">
                Heavy bearish FinBERT tone in the last hour — review before adding risk.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && <TraderKpiCards items={kpis} />}


      {outlookSections.length === 0 && workspaceId && !board.isLoading && (
        <p className="rounded-lg border border-dashed py-8 text-center text-muted-foreground">
          No feature data yet — add watchlist symbols on Research, then Get latest data.
        </p>
      )}

      {outlookSections.map((section) => (
        <AssetClassSection
          key={`outlook-${section.key}`}
          title={`Trader outlook — ${section.label}`}
          assetClass={section.key}
          count={section.items.length}
          description={`${ASSET_CLASS_LABELS[section.key]} — composite score, horizons, price projection, news stance, and risk.`}
        >
          <TraderOutlookTable
            rows={section.items}
            expanded={expanded}
            onToggle={(sym) => setExpanded((s) => (s === sym ? null : sym))}
            renderDetail={(row) => <FeaturesAnalystDetail row={row as FeatureRow} />}
          />
        </AssetClassSection>
      ))}

      {outlookSections.map((section) => (
        <AssetClassSection
          key={`category-${section.key}`}
          title={`Score basis — ${section.label}`}
          assetClass={section.key}
          count={section.items.length}
          description="Per-symbol category scores — expand Calculation rules below each grid for formulas and weights."
        >
          <CategoryBreakdownTable rows={section.items} />
        </AssetClassSection>
      ))}

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <div>
            <CardTitle className="text-base">Analyst metrics</CardTitle>
            <CardDescription>
              Full FinBERT softmax and market rollups for verification.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAnalyst((v) => !v)}
          >
            {showAnalyst ? "Hide" : "Show"} detailed table
          </Button>
        </CardHeader>
        {showAnalyst && (
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-0 hover:bg-transparent">
                  <TableHead rowSpan={2} className="sticky left-0 z-10 bg-card align-bottom">
                    Symbol
                  </TableHead>
                  <TableHead rowSpan={2} className="align-bottom">
                    Signal
                  </TableHead>
                  <TableHead rowSpan={2} className="text-right align-bottom">
                    Score
                  </TableHead>
                  <TableHead rowSpan={2} className="text-right align-bottom">
                    Conf.
                  </TableHead>
                  <TableHead colSpan={6} className="border-b text-center text-xs">
                    Market
                  </TableHead>
                  <TableHead colSpan={6} className="border-b text-center text-xs">
                    News summary
                  </TableHead>
                  <TableHead colSpan={5} className="border-b text-center text-xs">
                    FinBERT avg prob (24h)
                  </TableHead>
                  <TableHead colSpan={3} className="border-b text-center text-xs">
                    FinBERT labels (24h)
                  </TableHead>
                  <TableHead colSpan={5} className="border-b text-center text-xs">
                    FinBERT risk (24h)
                  </TableHead>
                  <TableHead colSpan={4} className="border-b text-center text-xs">
                    FinBERT (1h)
                  </TableHead>
                  <TableHead rowSpan={2} className="text-right align-bottom">
                    Combined
                  </TableHead>
                  <TableHead rowSpan={2} className="text-right align-bottom">
                    Quality
                  </TableHead>
                  <TableHead rowSpan={2} className="text-right align-bottom">
                    Updated
                  </TableHead>
                </TableRow>
                <TableRow className="text-[11px] hover:bg-transparent">
                  <TableHead className="text-right">Last</TableHead>
                  <TableHead className="text-right">24h</TableHead>
                  <TableHead className="text-right">5d</TableHead>
                  <TableHead className="text-right">RSI</TableHead>
                  <TableHead className="text-right">Vol</TableHead>
                  <TableHead className="text-right">SMA20</TableHead>
                  <TableHead className="text-right">N 1h</TableHead>
                  <TableHead className="text-right">N 24h</TableHead>
                  <TableHead className="text-right">S 1h</TableHead>
                  <TableHead className="text-right">S 24h</TableHead>
                  <TableHead className="text-right">Mom</TableHead>
                  <TableHead>Spike</TableHead>
                  <TableHead className="text-right">P+</TableHead>
                  <TableHead className="text-right">P−</TableHead>
                  <TableHead className="text-right">P0</TableHead>
                  <TableHead className="text-right">Conf</TableHead>
                  <TableHead className="text-right">Wtd</TableHead>
                  <TableHead className="text-right">%+</TableHead>
                  <TableHead className="text-right">%−</TableHead>
                  <TableHead className="text-right">%0</TableHead>
                  <TableHead className="text-right">maxP−</TableHead>
                  <TableHead className="text-right">maxP+</TableHead>
                  <TableHead className="text-right">HC−</TableHead>
                  <TableHead className="text-right">HC+</TableHead>
                  <TableHead className="text-right">Ent</TableHead>
                  <TableHead className="text-right">P−</TableHead>
                  <TableHead className="text-right">P+</TableHead>
                  <TableHead className="text-right">Conf</TableHead>
                  <TableHead className="text-right">HC−</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <FeatureTableRow key={row.symbol} row={row} />
                ))}
                {rows.length === 0 && workspaceId && !board.isLoading && (
                  <TableRow>
                    <TableCell colSpan={36} className="text-center text-muted-foreground">
                      No feature data yet — add watchlist symbols on Research, then Get latest data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        )}
      </Card>

      <Card className="border-border/70 bg-muted/20 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">How to read this</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
          <p>
            <span className="font-medium text-foreground">Trader outlook</span> — Composite 0–100
            from technicals, FinBERT, risk, and 3D/1W/1M alignment; not an order.
          </p>
          <p>
            <span className="font-medium text-foreground">RSI</span> — &gt;70 overbought, &lt;30
            oversold (daily).
          </p>
          <p>
            <span className="font-medium text-foreground">Sentiment</span> — FinBERT avg −1…+1;
            spikes need ≥3 articles in 1h.
          </p>
          <p>
            <span className="font-medium text-foreground">Mom.</span> — 4h minus 24h sentiment
            (improving vs fading).
          </p>
          <p>
            <span className="font-medium text-foreground">Combined</span> — Snapshot ranking score
            (price + sentiment blend).
          </p>
          <p>
            <span className="font-medium text-foreground">Quality</span> — Share of market/news
            fields present; low % → treat signal cautiously.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function FeaturesAnalystDetail({ row }: { row: FeatureRow }) {
  return (
    <div className="border-t pt-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Analyst evidence — FinBERT & market rollups
      </p>
      <FeatureDetailMetrics row={row} />
    </div>
  )
}

function FeatureDetailMetrics({ row }: { row: FeatureRow }) {
  const m = row.market
  const n = row.news
  const fb = finbertForFeatureRow(row)
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricBlock title="Market">
        <Metric label="24h change" value={formatPct(m?.priceChange24h)} />
        <Metric label="5d change" value={formatPct(m?.priceChange5d)} />
        <Metric label="RSI (14)" value={formatNum(m?.rsi, 1)} />
        <Metric label="Volume ratio" value={m?.volumeRatio != null ? `${m.volumeRatio.toFixed(2)}x` : "—"} />
        <Metric
          label="Distance SMA20"
          value={formatPct(m?.distanceSma20 != null ? m.distanceSma20 * 100 : null)}
        />
        <Metric label="Volatility (10d)" value={formatNum(m?.volatility, 3)} />
      </MetricBlock>
      <MetricBlock title="News rollups">
        <Metric
          label="Articles 1h / 4h / 24h"
          value={
            hasNewsCoverage(n)
              ? `${n?.newsCount1h ?? 0} / ${n?.newsCount4h ?? 0} / ${n?.newsCount24h ?? 0}`
              : "—"
          }
        />
        <Metric
          label="Signed sentiment 1h / 24h"
          value={
            hasNewsCoverage(n)
              ? `${formatSentiment(n?.avgSentiment1h)} / ${formatSentiment(n?.avgSentiment24h)}`
              : "—"
          }
        />
        <Metric
          label="Momentum (4h−24h)"
          value={hasNewsCoverage(n) ? formatSentiment(n?.sentimentMomentum) : "—"}
        />
        <Metric
          label="Max relevance 24h"
          value={n?.maxRelevanceScore24h != null ? n.maxRelevanceScore24h.toFixed(2) : "—"}
        />
      </MetricBlock>
      <FinbertDetailBlocks fb={fb} />
    </div>
  )
}

function finbertForFeatureRow(row: FeatureRow) {
  return finbertForRow(row) ?? (row.snapshot?.newsFeatures?.finbert as FinbertMetrics | undefined)
}

function FeatureTableRow({ row }: { row: FeatureRow }) {
  const m = row.market
  const n = row.news
  const fb = finbertForFeatureRow(row)
  const rsi = m?.rsi
  const rsiHint = rsiLabel(rsi)

  return (
      <TableRow className="hover:bg-muted/20">
        <TableCell className="sticky left-0 z-10 bg-card">
          <div className="font-mono font-semibold">{row.symbol}</div>
          <div className="text-xs text-muted-foreground">{row.name}</div>
        </TableCell>
        <TableCell>
          <RecommendationBadge action={row.recommendation as RecommendationAction} />
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">{row.score.toFixed(2)}</TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {(row.confidence * 100).toFixed(0)}%
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {row.lastClose != null ? row.lastClose.toFixed(2) : "—"}
        </TableCell>
        <TableCell className={cn("text-right font-mono tabular-nums", pctClass(m?.priceChange24h))}>
          {formatPct(m?.priceChange24h)}
        </TableCell>
        <TableCell className={cn("text-right font-mono tabular-nums", pctClass(m?.priceChange5d))}>
          {formatPct(m?.priceChange5d)}
        </TableCell>
        <TableCell className="text-right">
          <span className="font-mono tabular-nums">{formatNum(rsi, 1)}</span>
          {rsiHint && (
            <span className="ml-1 text-[10px] text-muted-foreground">{rsiHint}</span>
          )}
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {m?.volumeRatio != null ? `${m.volumeRatio.toFixed(2)}x` : "—"}
        </TableCell>
        <TableCell className={cn("text-right font-mono tabular-nums", pctClass(m?.distanceSma20))}>
          {formatPct(m?.distanceSma20 != null ? m.distanceSma20 * 100 : null)}
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {hasNewsCoverage(n) ? n?.newsCount1h : "—"}
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {hasNewsCoverage(n) ? n?.newsCount24h : "—"}
        </TableCell>
        <TableCell className={cn("text-right font-mono tabular-nums", sentimentClass(n?.avgSentiment1h))}>
          {hasNewsCoverage(n) ? formatSentiment(n?.avgSentiment1h) : "—"}
        </TableCell>
        <TableCell className={cn("text-right font-mono tabular-nums", sentimentClass(n?.avgSentiment24h))}>
          {hasNewsCoverage(n) ? formatSentiment(n?.avgSentiment24h) : "—"}
        </TableCell>
        <TableCell className={cn("text-right font-mono tabular-nums", sentimentClass(n?.sentimentMomentum))}>
          {hasNewsCoverage(n) ? formatSentiment(n?.sentimentMomentum) : "—"}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {n?.positiveNewsSpike && (
              <Badge variant="default" className="gap-0.5 text-[10px]">
                <TrendingUp className="size-3" />
                Pos
              </Badge>
            )}
            {n?.negativeNewsSpike && (
              <Badge variant="destructive" className="gap-0.5 text-[10px]">
                <TrendingDown className="size-3" />
                Neg
              </Badge>
            )}
            {!n?.positiveNewsSpike && !n?.negativeNewsSpike && (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </TableCell>
        <FinbertCells fb={fb} />
        <TableCell className="text-right font-mono tabular-nums">
          {row.snapshot?.combinedScore != null
            ? row.snapshot.combinedScore.toFixed(2)
            : "—"}
        </TableCell>
        <TableCell className="text-right">
          {row.snapshot ? (
            <Badge variant={row.snapshot.dataQualityScore >= 0.7 ? "default" : "secondary"}>
              {(row.snapshot.dataQualityScore * 100).toFixed(0)}%
            </Badge>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell className="text-right text-xs text-muted-foreground">
          {formatDateTime(row.updatedAt ?? row.snapshot?.timestamp)}
        </TableCell>
      </TableRow>
  )
}

function MetricBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function FinbertCells({ fb }: { fb?: FinbertMetrics }) {
  return (
    <>
      <TableCell className={cn("text-right font-mono tabular-nums", probClass(fb?.avgProbPositive24h))}>
        {formatProb(fb?.avgProbPositive24h)}
      </TableCell>
      <TableCell className={cn("text-right font-mono tabular-nums", probClass(fb?.avgProbNegative24h, true))}>
        {formatProb(fb?.avgProbNegative24h)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
        {formatProb(fb?.avgProbNeutral24h)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">{formatProb(fb?.avgConfidence24h)}</TableCell>
      <TableCell className={cn("text-right font-mono tabular-nums", sentimentClass(fb?.weightedSentiment24h))}>
        {formatSentiment(fb?.weightedSentiment24h)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
        {formatLabelPct(fb?.positiveLabelPct24h)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-red-600 dark:text-red-400">
        {formatLabelPct(fb?.negativeLabelPct24h)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
        {formatLabelPct(fb?.neutralLabelPct24h)}
      </TableCell>
      <TableCell className={cn("text-right font-mono tabular-nums", probClass(fb?.maxProbNegative24h, true))}>
        {formatProb(fb?.maxProbNegative24h)}
      </TableCell>
      <TableCell className={cn("text-right font-mono tabular-nums", probClass(fb?.maxProbPositive24h))}>
        {formatProb(fb?.maxProbPositive24h)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">{fb?.highConfNegative24h ?? "—"}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">{fb?.highConfPositive24h ?? "—"}</TableCell>
      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
        {fb?.labelEntropy24h != null ? fb.labelEntropy24h.toFixed(2) : "—"}
      </TableCell>
      <TableCell className={cn("text-right font-mono tabular-nums", probClass(fb?.avgProbNegative1h, true))}>
        {formatProb(fb?.avgProbNegative1h)}
      </TableCell>
      <TableCell className={cn("text-right font-mono tabular-nums", probClass(fb?.avgProbPositive1h))}>
        {formatProb(fb?.avgProbPositive1h)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">{formatProb(fb?.avgConfidence1h)}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">{fb?.highConfNegative1h ?? "—"}</TableCell>
    </>
  )
}

function FinbertDetailBlocks({ fb }: { fb?: FinbertMetrics }) {
  return (
    <>
      <MetricBlock title="FinBERT softmax (24h)">
        <Metric label="Avg P(positive)" value={formatProb(fb?.avgProbPositive24h)} />
        <Metric label="Avg P(negative)" value={formatProb(fb?.avgProbNegative24h)} />
        <Metric label="Avg P(neutral)" value={formatProb(fb?.avgProbNeutral24h)} />
        <Metric label="Avg confidence" value={formatProb(fb?.avgConfidence24h)} />
        <Metric label="Max confidence" value={formatProb(fb?.maxConfidence24h)} />
        <Metric label="Weighted sentiment" value={formatSentiment(fb?.weightedSentiment24h)} />
      </MetricBlock>
      <MetricBlock title="FinBERT labels (24h)">
        <Metric label="Positive articles" value={formatLabelPct(fb?.positiveLabelPct24h)} />
        <Metric label="Negative articles" value={formatLabelPct(fb?.negativeLabelPct24h)} />
        <Metric label="Neutral articles" value={formatLabelPct(fb?.neutralLabelPct24h)} />
        <Metric label="High-conf negative" value={String(fb?.highConfNegative24h ?? "—")} />
        <Metric label="High-conf positive" value={String(fb?.highConfPositive24h ?? "—")} />
        <Metric label="Label entropy" value={fb?.labelEntropy24h != null ? fb.labelEntropy24h.toFixed(2) : "—"} />
      </MetricBlock>
      <MetricBlock title="FinBERT (4h)">
        <Metric label="Avg P(positive)" value={formatProb(fb?.avgProbPositive4h)} />
        <Metric label="Avg P(negative)" value={formatProb(fb?.avgProbNegative4h)} />
        <Metric label="Avg P(neutral)" value={formatProb(fb?.avgProbNeutral4h)} />
        <Metric label="Avg confidence" value={formatProb(fb?.avgConfidence4h)} />
      </MetricBlock>
      <MetricBlock title="FinBERT (1h)">
        <Metric label="Avg P(positive)" value={formatProb(fb?.avgProbPositive1h)} />
        <Metric label="Avg P(negative)" value={formatProb(fb?.avgProbNegative1h)} />
        <Metric label="Avg P(neutral)" value={formatProb(fb?.avgProbNeutral1h)} />
        <Metric label="Avg confidence" value={formatProb(fb?.avgConfidence1h)} />
        <Metric label="Max P(negative)" value={formatProb(fb?.maxProbNegative1h)} />
        <Metric label="Max P(positive)" value={formatProb(fb?.maxProbPositive1h)} />
      </MetricBlock>
    </>
  )
}
