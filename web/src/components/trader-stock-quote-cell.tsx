import {
  formatExchange,
  formatPct,
  formatUsd,
  formatVolume,
  pctClass,
  resolveStockQuote,
} from "@/lib/stock-quote"
import type { ResearchStockRow } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

/** Symbol, company, exchange, and key quote fields for trader outlook rows. */
export function TraderStockQuoteCell({ row }: { row: ResearchStockRow }) {
  const q = resolveStockQuote(row)
  const hasPrice = q.price != null

  return (
    <div className="min-w-[200px] max-w-[240px] space-y-1.5">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-base font-bold tracking-tight text-foreground">
            {q.symbol}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {formatExchange(q.exchange)}
          </span>
        </div>
        <p className="truncate text-xs leading-snug text-muted-foreground" title={q.name}>
          {q.name}
        </p>
      </div>

      {hasPrice ? (
        <div className="rounded-md border border-border/50 bg-muted/20 px-2 py-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-sm font-bold tabular-nums text-foreground">
              {formatUsd(q.price)}
            </span>
            <span
              className={cn(
                "font-mono text-xs font-semibold tabular-nums",
                pctClass(q.change24h),
              )}
            >
              {formatPct(q.change24h)}
            </span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            <span>
              H <span className="font-semibold text-foreground">{formatUsd(q.dayHigh)}</span>
            </span>
            <span>
              L <span className="font-semibold text-foreground">{formatUsd(q.dayLow)}</span>
            </span>
            <span>
              Vol <span className="font-semibold text-foreground">{formatVolume(q.volume)}</span>
            </span>
            <span>
              RSI{" "}
              <span className="font-semibold text-foreground">
                {q.rsi != null ? q.rsi.toFixed(0) : "—"}
              </span>
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">No market quote</p>
      )}
    </div>
  )
}
