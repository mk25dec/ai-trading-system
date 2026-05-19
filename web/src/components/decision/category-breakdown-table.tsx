import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CalculationRulesCollapsible } from "@/components/decision/calculation-rules-collapsible"
import {
  RESEARCH_CATEGORIES,
  buildStockCategoryBreakdown,
  formatCompositeFormulaTooltip,
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
    <div>
      <TooltipProvider>
        <div className="overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                <TableHead
                  rowSpan={2}
                  className="sticky left-0 z-20 min-w-[96px] align-bottom bg-muted/30"
                >
                  Symbol
                </TableHead>
                <TableHead
                  rowSpan={2}
                  className="sticky left-[96px] z-20 min-w-[76px] align-bottom border-r bg-muted/30 text-center"
                >
                  <div className="font-semibold">Overall</div>
                  <div className="mt-1 font-normal text-muted-foreground">score</div>
                </TableHead>
                {RESEARCH_CATEGORIES.map((cat) => (
                  <TableHead
                    key={cat.id}
                    className="min-w-[108px] border-l border-border/50 px-2 text-center align-bottom"
                  >
                    <div className="whitespace-normal text-xs font-semibold leading-snug text-foreground">
                      {cat.label}
                    </div>
                  </TableHead>
                ))}
                <TableHead
                  rowSpan={2}
                  className="min-w-[72px] border-l align-bottom text-center text-xs"
                >
                  <div className="font-semibold">Σ contrib</div>
                  <div className="mt-1 font-normal text-muted-foreground">impl.</div>
                </TableHead>
              </TableRow>
              <TableRow className="border-b bg-muted/20 text-[10px] hover:bg-muted/20">
                {RESEARCH_CATEGORIES.map((cat) => (
                  <TableHead
                    key={`${cat.id}-meta`}
                    className="border-l border-border/50 py-1.5 text-center font-normal"
                  >
                    <div
                      className="whitespace-normal leading-tight text-muted-foreground"
                      title="Weight · time sensitivity"
                    >
                      <span className="font-mono font-semibold text-foreground">
                        {(cat.researchWeight * 100).toFixed(0)}%
                      </span>
                      <span className="mx-1">·</span>
                      <span>{cat.timeSensitivity}</span>
                    </div>
                  </TableHead>
                ))}
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
      </TooltipProvider>

      <CalculationRulesCollapsible />
    </div>
  )
}

function CategoryBreakdownRow({ breakdown }: { breakdown: StockCategoryBreakdown }) {
  const compositeSpectrum = scoreSpectrum(breakdown.compositeScore, { noData: breakdown.unscored })
  const contribSum = sumImplementedContributions(breakdown)
  const formulaTip = formatCompositeFormulaTooltip(breakdown.formula)

  return (
    <TableRow className="hover:bg-muted/20">
      <TableCell className="sticky left-0 z-10 bg-card">
        <div className="font-mono text-sm font-semibold">{breakdown.symbol}</div>
        <div className="whitespace-normal text-[10px] leading-tight text-muted-foreground">
          {breakdown.name}
        </div>
      </TableCell>
      <TableCell className="sticky left-[96px] z-10 border-r bg-card text-center">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className={cn(
                  "mx-auto inline-block rounded-md px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums underline decoration-dotted decoration-muted-foreground/50 underline-offset-2",
                  compositeSpectrum.bg,
                  compositeSpectrum.text,
                )}
              >
                {breakdown.unscored ? "—" : breakdown.compositeScore.toFixed(0)}
              </button>
            }
          />
          <TooltipContent
            side="right"
            className="max-w-md whitespace-pre-wrap font-mono text-[11px]"
          >
            {formulaTip}
          </TooltipContent>
        </Tooltip>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          {(breakdown.compositeConfidence * 100).toFixed(0)}% conf
        </p>
      </TableCell>
      {RESEARCH_CATEGORIES.map((def) => (
        <TableCell key={def.id} className="border-l border-border/40 p-1.5 text-center">
          <CategoryScoreCell cell={breakdown.cells[def.id]} implemented={def.implemented} />
        </TableCell>
      ))}
      <TableCell className="border-l text-center font-mono text-xs tabular-nums text-muted-foreground">
        {contribSum > 0 ? contribSum.toFixed(1) : "—"}
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
        "mx-auto min-w-[56px] rounded-md border px-1.5 py-1.5",
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
