import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatPct, pctClass, rsiLabel } from "@/lib/feature-metrics"
import type { SymbolMarketDetail } from "@/lib/pipeline-api"
import { formatCompanyName, formatExchange, formatUsd, formatVolume } from "@/lib/stock-quote"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/hooks/use-workspace"

export function MarketDataTable({ rows }: { rows: SymbolMarketDetail[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="min-w-[88px]">Symbol</TableHead>
            <TableHead className="min-w-[140px]">Company</TableHead>
            <TableHead className="w-[72px]">Exchange</TableHead>
            <TableHead className="text-right">Last</TableHead>
            <TableHead className="text-right">Open</TableHead>
            <TableHead className="text-right">High</TableHead>
            <TableHead className="text-right">Low</TableHead>
            <TableHead className="text-right">Prev</TableHead>
            <TableHead className="text-right">24h</TableHead>
            <TableHead className="text-right">5d</TableHead>
            <TableHead className="text-right">Vol</TableHead>
            <TableHead className="text-right">RSI</TableHead>
            <TableHead className="text-right">52w H</TableHead>
            <TableHead className="text-right">52w L</TableHead>
            <TableHead className="text-right">SMA20</TableHead>
            <TableHead>Bar</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <MarketDataRow key={row.symbol} row={row} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function MarketDataRow({ row }: { row: SymbolMarketDetail }) {
  const stale =
    !row.latestCandleAt ||
    Date.now() - new Date(row.latestCandleAt).getTime() > 3 * 24 * 3600 * 1000
  const rsi = row.rsi
  const rsiHint = rsiLabel(rsi)
  const company = formatCompanyName(row.symbol, row.name)
  const exchange = formatExchange(row.exchange)

  return (
    <TableRow className="hover:bg-muted/20">
      <TableCell className="font-mono font-semibold">{row.symbol}</TableCell>
      <TableCell
        className={cn(
          "max-w-[180px] truncate text-sm",
          company === "N/A" && "italic text-muted-foreground",
        )}
        title={company === "N/A" ? undefined : company}
      >
        {company}
      </TableCell>
      <TableCell
        className={cn(
          "text-xs font-semibold uppercase",
          exchange === "N/A" ? "text-muted-foreground" : "text-primary",
        )}
      >
        {exchange}
      </TableCell>
      <TableCell className="text-right font-mono font-semibold tabular-nums">
        {formatUsd(row.lastClose)}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
        {formatUsd(row.open)}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {formatUsd(row.high)}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {formatUsd(row.low)}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
        {formatUsd(row.prevClose)}
      </TableCell>
      <TableCell className={cn("text-right font-mono text-xs tabular-nums", pctClass(row.priceChange24h))}>
        {formatPct(row.priceChange24h)}
      </TableCell>
      <TableCell className={cn("text-right font-mono text-xs tabular-nums", pctClass(row.priceChange5d))}>
        {formatPct(row.priceChange5d)}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {formatVolume(row.volume)}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {rsi != null ? rsi.toFixed(0) : "—"}
        {rsiHint && (
          <span className="ml-1 text-[10px] text-muted-foreground">{rsiHint}</span>
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
        {formatUsd(row.high52w)}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
        {formatUsd(row.low52w)}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
        {row.sma20 != null ? formatUsd(row.sma20) : "—"}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDateTime(row.latestCandleAt)}
      </TableCell>
      <TableCell>
        <Badge variant={stale ? "destructive" : "default"}>{stale ? "stale" : "ok"}</Badge>
      </TableCell>
    </TableRow>
  )
}
