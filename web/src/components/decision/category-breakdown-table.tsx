import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  RESEARCH_CATEGORIES,
  buildStockCategoryBreakdown,
  sumImplementedContributions,
  type StockCategoryBreakdown,
} from "@/lib/research-categories"
import { scoreSpectrum } from "@/lib/decision-visuals"
import type { ResearchStockRow } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

export function CategoryBreakdownTable({
  rows,
  emptyMessage,
}: {
  rows: ResearchStockRow[]
  emptyMessage?: string
}) {
  const breakdowns = rows.map(buildStockCategoryBreakdown)

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
            <TableHead className="sticky left-0 z-10 min-w-[88px] bg-muted/30">Symbol</TableHead>
            {RESEARCH_CATEGORIES.map((cat) => (
              <TableHead key={cat.id} className="min-w-[72px] text-center text-[11px]">
                <div className="font-medium leading-tight">{shortLabel(cat.label)}</div>
                <div className="mt-0.5 font-normal text-muted-foreground">
                  {(cat.researchWeight * 100).toFixed(0)}%
                </div>
              </TableHead>
            ))}
            <TableHead className="min-w-[64px] text-center text-[11px]">
              <div className="font-medium">Σ contrib</div>
              <div className="mt-0.5 font-normal text-muted-foreground">impl.</div>
            </TableHead>
            <TableHead className="min-w-[64px] text-right text-[11px]">
              <div className="font-medium">Composite</div>
              <div className="mt-0.5 font-normal text-muted-foreground">0–100</div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {breakdowns.map((b) => (
            <CategoryBreakdownRow key={b.symbol} breakdown={b} />
          ))}
          {breakdowns.length === 0 && emptyMessage && (
            <TableRow>
              <TableCell
                colSpan={RESEARCH_CATEGORIES.length + 3}
                className="py-10 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function CategoryBreakdownRow({ breakdown }: { breakdown: StockCategoryBreakdown }) {
  const compositeSpectrum = scoreSpectrum(breakdown.compositeScore)
  const contribSum = sumImplementedContributions(breakdown)

  return (
    <TableRow className="hover:bg-muted/20">
      <TableCell className="sticky left-0 z-10 bg-card">
        <div className="font-mono text-sm font-semibold">{breakdown.symbol}</div>
        <div className="max-w-[88px] truncate text-[10px] text-muted-foreground">{breakdown.name}</div>
      </TableCell>
      {RESEARCH_CATEGORIES.map((def) => (
        <TableCell key={def.id} className="p-1 text-center">
          <CategoryScoreCell cell={breakdown.cells[def.id]} implemented={def.implemented} />
        </TableCell>
      ))}
      <TableCell className="text-center font-mono text-xs tabular-nums text-muted-foreground">
        {contribSum > 0 ? contribSum.toFixed(1) : "—"}
      </TableCell>
      <TableCell className="text-right">
        <span
          className={cn(
            "inline-block rounded-md px-2 py-1 font-mono text-sm font-semibold tabular-nums",
            compositeSpectrum.bg,
            compositeSpectrum.text,
          )}
        >
          {breakdown.compositeScore.toFixed(0)}
        </span>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {(breakdown.compositeConfidence * 100).toFixed(0)}% conf
        </p>
      </TableCell>
    </TableRow>
  )
}

function CategoryScoreCell({
  cell,
  implemented,
}: {
  cell: { score: number | null; confidence: number | null; displayScore: number | null }
  implemented: boolean
}) {
  if (!implemented) {
    return (
      <span
        className="inline-block rounded px-1.5 py-2 text-[10px] text-muted-foreground/60"
        title="Not in engine v2 yet"
      >
        —
      </span>
    )
  }

  if (cell.displayScore == null) {
    return <span className="text-[10px] text-muted-foreground">—</span>
  }

  const spectrum = scoreSpectrum(cell.displayScore)
  const signed =
    cell.score != null ? (cell.score >= 0 ? "+" : "") + (cell.score * 100).toFixed(0) : ""

  return (
    <div
      className={cn(
        "mx-auto max-w-[64px] rounded-md border px-1 py-1.5",
        spectrum.bg,
        spectrum.border,
      )}
      title={
        cell.confidence != null
          ? `Signed factor ${signed}% · confidence ${(cell.confidence * 100).toFixed(0)}%`
          : undefined
      }
    >
      <div className={cn("font-mono text-sm font-semibold tabular-nums", spectrum.text)}>
        {cell.displayScore.toFixed(0)}
      </div>
      {cell.confidence != null && (
        <div className="mt-0.5 font-mono text-[9px] tabular-nums text-muted-foreground">
          {(cell.confidence * 100).toFixed(0)}%
        </div>
      )}
    </div>
  )
}

function shortLabel(label: string): string {
  const map: Record<string, string> = {
    "Technical momentum": "Technical",
    "Trend strength": "Trend",
    Fundamentals: "Fund.",
    Valuation: "Value",
    Sentiment: "Sent.",
    "Earnings quality": "Earn.",
    "Market regime": "Regime",
    "Sector strength": "Sector",
    "Risk analysis": "Risk",
    "Liquidity & flow": "Liq.",
    "Multi-timeframe alignment": "Align",
  }
  return map[label] ?? label.split(" ")[0]
}
