import { Badge } from "@/components/ui/badge"
import {
  formatCompanyName,
  formatExchange,
  formatPct,
  formatUsd,
  formatVolume,
  pctClass,
  quoteChangeTone,
  resolveStockQuote,
  rsiLabel,
  rsiTone,
} from "@/lib/stock-quote"
import type { ResearchStockRow } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

const changeCardStyles = {
  up: "border-emerald-500/35 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent",
  down: "border-red-500/35 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent",
  flat: "border-border/60 bg-gradient-to-br from-muted/40 to-muted/10",
  none: "border-border/50 bg-muted/15",
} as const

const rsiValueStyles = {
  high: "text-amber-600 dark:text-amber-400",
  low: "text-sky-600 dark:text-sky-400",
  neutral: "text-foreground",
  none: "text-muted-foreground",
} as const

/** Symbol, company, exchange, and key quote fields for trader outlook rows. */
export function TraderStockQuoteCell({ row }: { row: ResearchStockRow }) {
  const q = resolveStockQuote(row)
  const hasPrice = q.price != null
  const changeTone = quoteChangeTone(q.change24h)
  const company = formatCompanyName(q.symbol, q.companyName ?? undefined)
  const exchange = formatExchange(q.exchange)
  const rsiHint = rsiLabel(q.rsi)
  const rsiColor = rsiValueStyles[rsiTone(q.rsi)]

  return (
    <div className="min-w-[210px] max-w-[250px] space-y-2">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-base font-bold tracking-tight text-foreground">
            {q.symbol}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "h-5 border px-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide",
              exchange === "N/A"
                ? "border-dashed text-muted-foreground"
                : "border-primary/25 bg-primary/5 text-primary",
            )}
          >
            {exchange}
          </Badge>
        </div>
        <p
          className={cn(
            "truncate text-xs leading-snug",
            company === "N/A" ? "italic text-muted-foreground" : "text-foreground/80",
          )}
          title={company === "N/A" ? undefined : company}
        >
          {company}
        </p>
      </div>

      {hasPrice ? (
        <div
          className={cn(
            "rounded-lg border px-2.5 py-2 shadow-sm",
            changeCardStyles[changeTone],
          )}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-sm font-bold tabular-nums text-foreground">
              {formatUsd(q.price)}
            </span>
            <span
              className={cn(
                "font-mono text-xs font-bold tabular-nums",
                pctClass(q.change24h),
              )}
            >
              {formatPct(q.change24h)}
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[10px] tabular-nums">
            <span className="text-muted-foreground">
              H{" "}
              <span className="font-semibold text-foreground">{formatUsd(q.dayHigh)}</span>
            </span>
            <span className="text-muted-foreground">
              L <span className="font-semibold text-foreground">{formatUsd(q.dayLow)}</span>
            </span>
            <span className="text-muted-foreground">
              Vol{" "}
              <span className="font-semibold text-foreground">{formatVolume(q.volume)}</span>
            </span>
            <span className="text-muted-foreground">
              RSI{" "}
              <span className={cn("font-semibold", rsiColor)}>
                {q.rsi != null ? q.rsi.toFixed(0) : "N/A"}
              </span>
              {rsiHint && (
                <span className="ml-0.5 text-[9px] font-normal normal-case text-muted-foreground">
                  {rsiHint}
                </span>
              )}
            </span>
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border/60 px-2 py-1.5 text-[10px] text-muted-foreground">
          No market quote
        </p>
      )}
    </div>
  )
}
