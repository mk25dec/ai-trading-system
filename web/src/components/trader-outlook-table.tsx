import type { ReactNode } from "react"
import { AlertTriangle, ChevronDown, ChevronRight, Newspaper } from "lucide-react"
import { DecisionHeroPanel } from "@/components/decision/decision-hero-panel"
import { MiniSparkline } from "@/components/decision/mini-sparkline"
import { ScoreGauge } from "@/components/decision/score-gauge"
import { HorizonOutlookBadge } from "@/components/horizon-outlook-badge"
import { RecommendationBadge } from "@/components/recommendation-badge"
import { TableColumnHeader } from "@/components/table-column-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { traderOutlookColumnGuides } from "@/lib/column-guides"
import { alignmentLabel, resolveDecision, signalSubline, stanceLabel } from "@/lib/decision-engine"
import {
  actionAccent,
  alignmentSpectrum,
  riskSpectrum,
  stanceSpectrum,
} from "@/lib/decision-visuals"
import { TraderStockQuoteCell } from "@/components/trader-stock-quote-cell"
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
        <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
          <TableHead className="w-8" />
          <TableColumnHeader
            guide={traderOutlookColumnGuides.security}
            className="min-w-[220px]"
          />
          <TableColumnHeader guide={traderOutlookColumnGuides.chart} className="w-[72px]" />
          <TableColumnHeader guide={traderOutlookColumnGuides.signal} />
          <TableColumnHeader guide={traderOutlookColumnGuides.score} align="right" />
          <TableColumnHeader guide={traderOutlookColumnGuides.horizons} align="center" />
          <TableColumnHeader guide={traderOutlookColumnGuides.news} />
          <TableColumnHeader guide={traderOutlookColumnGuides.risk} />
          <TableColumnHeader guide={traderOutlookColumnGuides.alignment} />
          <TableColumnHeader
            guide={traderOutlookColumnGuides.driver}
            className="min-w-[120px]"
          />
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
            <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
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
  const stance = stanceSpectrum(d.newsStance)
  const risk = riskSpectrum(d.riskLevel)
  const align = alignmentSpectrum(d.alignment)

  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer border-l-4 transition-colors hover:bg-muted/50",
          actionAccent(action),
          open && "bg-muted/30",
        )}
        onClick={onToggle}
      >
        <TableCell className="w-8">
          {open ? (
            <ChevronDown className="size-4 text-primary" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="align-top py-3">
          <TraderStockQuoteCell row={row} />
        </TableCell>
        <TableCell>
          <MiniSparkline candles={row.candles ?? []} />
        </TableCell>
        <TableCell>
          <RecommendationBadge action={action} />
          <p className="mt-1 text-[10px] font-medium text-muted-foreground">{signalSubline(d)}</p>
        </TableCell>
        <TableCell className="text-right">
          <ScoreGauge
            score={d.compositeScore}
            size="sm"
            noData={d.compositeScore <= 0 && d.confidence <= 0.2}
          />
        </TableCell>
        <TableCell>
          <div className="flex justify-center gap-1.5">
            {d.horizons.map((h) => (
              <HorizonOutlookBadge key={h.id} horizon={h} />
            ))}
          </div>
        </TableCell>
        <TableCell>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold",
              stance.bg,
              stance.text,
            )}
          >
            <Newspaper className="size-3.5 shrink-0 opacity-70" />
            {stanceLabel(d.newsStance)}
          </div>
          {d.newsConfidence != null && (
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              {(d.newsConfidence * 100).toFixed(0)}% conf.
            </p>
          )}
        </TableCell>
        <TableCell>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold capitalize",
              risk.bg,
              risk.text,
            )}
          >
            {risk.label}
          </span>
        </TableCell>
        <TableCell>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
              align.bg,
              align.text,
            )}
          >
            {alignmentLabel(d.alignment)}
            {d.conflict && <AlertTriangle className="size-3.5 text-amber-600" />}
          </span>
        </TableCell>
        <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
          {d.drivers[0] ?? "—"}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={11} className={cn("border-l-4 bg-muted/15 p-0", actionAccent(action))}>
            <div className="space-y-4 p-5">
              <DecisionHeroPanel decision={d} />
              {renderDetail ? (
                renderDetail(row)
              ) : (
                <DecisionDetailPanel row={row} decision={d} />
              )}
            </div>
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
    <div className="grid gap-6 border-t pt-4 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Analysis notes
          </p>
          <ul className="space-y-2 text-sm leading-relaxed">
            {row.bullets.map((b, i) => (
              <li key={i} className="flex gap-2 rounded-lg bg-card/80 px-3 py-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Key drivers
          </p>
          <ul className="space-y-1.5">
            {decision.drivers.map((driver, i) => (
              <li
                key={i}
                className="flex gap-2 rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground">{i + 1}.</span>
                <span>{driver}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div>{children}</div>
    </div>
  )
}
