import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RESEARCH_CATEGORIES } from "@/lib/research-categories"
import { FORMULA_INPUT_SOURCES, SCORING_FORMULAS } from "@/lib/scoring-methodology"
import { cn } from "@/lib/utils"

function StatusBadge({ status }: { status: "implemented" | "planned" | "research_target" }) {
  const label =
    status === "implemented" ? "Live" : status === "planned" ? "Planned" : "Target"
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        status === "implemented" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        status === "planned" && "bg-amber-500/15 text-amber-800 dark:text-amber-200",
        status === "research_target" && "bg-primary/10 text-primary",
      )}
    >
      {label}
    </span>
  )
}

export function ScoringMethodologyPanel() {
  return (
    <section className="border-b bg-muted/10" aria-labelledby="calculation-rules-heading">
      <div className="border-b border-border/50 bg-muted/20 px-4 py-4">
        <h2
          id="calculation-rules-heading"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          Calculation rules
        </h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          How overall and category scores are derived: equations, where each input comes from, and
          baseline category weights (my-research.md).
        </p>
      </div>

      <div className="space-y-8 px-4 py-6">
        <section aria-labelledby="calc-rules-formulas">
          <h3
            id="calc-rules-formulas"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            Mathematical formulas
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Score over a given time period — research target and formulas implemented in the
            decision engine.
          </p>
          <div className="mt-4 space-y-3">
            {SCORING_FORMULAS.map((f) => (
              <div
                key={f.id}
                className="rounded-lg border border-border/60 bg-card/50 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium text-foreground">{f.name}</p>
                  <StatusBadge status={f.status} />
                  <span className="text-[10px] text-muted-foreground">· {f.period}</span>
                </div>
                <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-foreground">
                  {f.expression}
                </p>
                {f.notes && (
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    {f.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="calc-rules-inputs">
          <h3
            id="calc-rules-inputs"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            Formula inputs — information sources
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Symbols and fields fed into the equations above; where each value originates in this
            system.
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[100px] font-mono text-xs">Symbol</TableHead>
                  <TableHead className="min-w-[140px]">Input</TableHead>
                  <TableHead className="min-w-[120px]">Used in</TableHead>
                  <TableHead className="min-w-[180px]">Data source</TableHead>
                  <TableHead className="min-w-[100px]">Refresh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {FORMULA_INPUT_SOURCES.map((row) => (
                  <TableRow key={row.symbol} className="text-xs">
                    <TableCell className="font-mono font-semibold text-foreground">
                      {row.symbol}
                    </TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.usedIn}</TableCell>
                    <TableCell>{row.source}</TableCell>
                    <TableCell className="text-muted-foreground">{row.refresh}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section aria-labelledby="calc-rules-weights">
          <h3
            id="calc-rules-weights"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            Category weights (v2 baseline)
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Baseline weights total 100%. Per-symbol grid below uses implemented categories only;
            others show em dash until wired.
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="min-w-[160px]">Category</TableHead>
                  <TableHead className="w-[72px] text-right">Weight</TableHead>
                  <TableHead className="w-[88px]">Time sens.</TableHead>
                  <TableHead className="min-w-[160px]">Key inputs (research)</TableHead>
                  <TableHead className="min-w-[140px]">Models (planned)</TableHead>
                  <TableHead className="min-w-[200px]">Live data source</TableHead>
                  <TableHead className="w-[72px] text-center">Engine</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RESEARCH_CATEGORIES.map((cat) => (
                  <TableRow key={cat.id} className="text-xs">
                    <TableCell className="font-medium text-foreground">{cat.label}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {(cat.researchWeight * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell>{cat.timeSensitivity}</TableCell>
                    <TableCell className="text-muted-foreground">{cat.keyInputs}</TableCell>
                    <TableCell className="text-muted-foreground">{cat.modelsPlanned}</TableCell>
                    <TableCell>{cat.dataSource}</TableCell>
                    <TableCell className="text-center">
                      {cat.implemented ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Yes</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Tune weights per timeframe using the time-sensitivity column (technical ↑ on 3D,
            fundamentals ↑ on 1Y when added).
          </p>
        </section>
      </div>
    </section>
  )
}
