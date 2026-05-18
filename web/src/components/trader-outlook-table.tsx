import type { ReactNode } from "react"
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import { HorizonOutlookBadge } from "@/components/horizon-outlook-badge"
import { RecommendationBadge } from "@/components/recommendation-badge"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  alignmentLabel,
  priceTrendLabel,
  resolveDecision,
  riskTone,
  stanceLabel,
} from "@/lib/decision-engine"
import { formatPct, pctClass, sentimentClass } from "@/lib/feature-metrics"
import type { RecommendationAction, ResearchStockRow } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

export function TraderOutlookTable({
  rows,
  expanded,
  onToggle,
  emptyMessage,
  renderDetail,
}: {
  rows: ResearchStockRow[]
  expanded: string | null
  onToggle: (symbol: string) => void
  emptyMessage?: string
  renderDetail?: (row: ResearchStockRow) => ReactNode
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-8" />
          <TableHead>Symbol</TableHead>
          <TableHead>Signal</TableHead>
          <TableHead className="text-right">Score</TableHead>
          <TableHead className="text-right">Conf.</TableHead>
          <TableHead className="text-center">3D · 1W · 1M</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>News AI</TableHead>
          <TableHead>Risk</TableHead>
          <TableHead>Alignment</TableHead>
          <TableHead className="min-w-[140px]">Key driver</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TraderOutlookRow
            key={row.symbol}
            row={row}
            open={expanded === row.symbol}
            onToggle={() => onToggle(row.symbol)}
            renderDetail={renderDetail}
          />
        ))}
        {rows.length === 0 && emptyMessage && (
          <TableRow>
            <TableCell colSpan={11} className="text-center text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

function TraderOutlookRow({
  row,
  open,
  onToggle,
  renderDetail,
}: {
  row: ResearchStockRow
  open: boolean
  onToggle: () => void
  renderDetail?: (row: ResearchStockRow) => ReactNode
}) {
  const d = resolveDecision(row)
  const action = (d.primaryAction || row.recommendation) as RecommendationAction

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/40" onClick={onToggle}>
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
          <div className="flex flex-col gap-1">
            <RecommendationBadge action={action} />
            <span className="text-[10px] text-muted-foreground">{d.primaryOutlook}</span>
          </div>
        </TableCell>
        <TableCell className="text-right">
          <span className="font-mono text-lg font-semibold tabular-nums">
            {d.compositeScore.toFixed(0)}
          </span>
          <span className="text-xs text-muted-foreground">/100</span>
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">
          {(d.confidence * 100).toFixed(0)}%
        </TableCell>
        <TableCell>
          <div className="flex justify-center gap-2">
            {d.horizons.map((h) => (
              <HorizonOutlookBadge key={h.id} horizon={h} />
            ))}
          </div>
        </TableCell>
        <TableCell>
          <div className="text-sm font-medium">{priceTrendLabel(d.priceTrend)}</div>
          <div
            className={cn(
              "font-mono text-xs tabular-nums",
              pctClass(row.market?.priceChange24h),
            )}
          >
            {formatPct(row.market?.priceChange24h)}
          </div>
        </TableCell>
        <TableCell>
          <div
            className={cn(
              "text-sm font-medium capitalize",
              sentimentClass(
                row.news?.avgSentiment24h ??
                  (d.newsStance === "bullish" ? 0.3 : d.newsStance === "bearish" ? -0.3 : 0),
              ),
            )}
          >
            {stanceLabel(d.newsStance)}
          </div>
          {d.newsConfidence != null && (
            <div className="text-[10px] text-muted-foreground">
              {(d.newsConfidence * 100).toFixed(0)}% model conf.
            </div>
          )}
        </TableCell>
        <TableCell>
          <Badge
            variant={
              riskTone(d.riskLevel) === "negative"
                ? "destructive"
                : riskTone(d.riskLevel) === "positive"
                  ? "default"
                  : "secondary"
            }
            className="capitalize"
          >
            {d.riskLevel}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <span className="text-xs">{alignmentLabel(d.alignment)}</span>
            {d.conflict && (
              <AlertTriangle className="size-3.5 text-amber-600" aria-label="Conflicting signals" />
            )}
          </div>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground leading-snug">
          {d.drivers[0] ?? "—"}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={11} className="bg-muted/20 p-4">
            {renderDetail ? (
              renderDetail(row)
            ) : (
              <DecisionDetailPanel row={row} decision={d} />
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function DecisionDetailPanel({
  row,
  decision,
  children,
}: {
  row: ResearchStockRow
  decision: ReturnType<typeof resolveDecision>
  children?: React.ReactNode
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Decision summary
          </p>
          <p className="text-sm leading-relaxed">
            Composite <span className="font-mono font-semibold">{decision.compositeScore.toFixed(0)}/100</span>{" "}
            with {(decision.confidence * 100).toFixed(0)}% confidence. Primary outlook:{" "}
            <span className="font-medium">{decision.primaryOutlook}</span>.
            {decision.conflict && decision.conflictNote && (
              <span className="mt-2 block text-amber-700 dark:text-amber-300">
                Conflict: {decision.conflictNote}
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Drivers
          </p>
          <ul className="space-y-1.5 text-sm">
            {decision.drivers.map((driver, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{driver}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Analysis
          </p>
          <ul className="space-y-2 text-sm leading-relaxed">
            {row.bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="space-y-4">
        {decision.categories && decision.categories.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Category scores
            </p>
            <dl className="space-y-2">
              {decision.categories.map((c) => (
                <div key={c.id} className="flex justify-between gap-4 text-xs">
                  <dt className="text-muted-foreground">{c.label}</dt>
                  <dd className="font-mono tabular-nums">
                    {(c.score >= 0 ? "+" : "") + (c.score * 100).toFixed(0)}% ·{" "}
                    {(c.confidence * 100).toFixed(0)}% conf.
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
