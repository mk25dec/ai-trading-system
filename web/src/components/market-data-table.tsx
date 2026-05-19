import { Badge } from "@/components/ui/badge"
import { TableColumnHeader } from "@/components/table-column-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { marketDataColumnGuides } from "@/lib/column-guides"
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
            <TableColumnHeader guide={marketDataColumnGuides.symbol} className="min-w-[88px]" />
            <TableColumnHeader guide={marketDataColumnGuides.company} className="min-w-[140px]" />
            <TableColumnHeader guide={marketDataColumnGuides.exchange} className="w-[72px]" />
            <TableColumnHeader guide={marketDataColumnGuides.last} align="right" />
            <TableColumnHeader guide={marketDataColumnGuides.open} align="right" />
            <TableColumnHeader guide={marketDataColumnGuides.high} align="right" />
            <TableColumnHeader guide={marketDataColumnGuides.low} align="right" />
            <TableColumnHeader guide={marketDataColumnGuides.prev} align="right" />
            <TableColumnHeader guide={marketDataColumnGuides.change24h} align="right" />
            <TableColumnHeader guide={marketDataColumnGuides.change5d} align="right" />
            <TableColumnHeader guide={marketDataColumnGuides.vol} align="right" />
            <TableColumnHeader guide={marketDataColumnGuides.rsi} align="right" />
            <TableColumnHeader guide={marketDataColumnGuides.high52w} align="right" />
            <TableColumnHeader guide={marketDataColumnGuides.low52w} align="right" />
            <TableColumnHeader guide={marketDataColumnGuides.sma20} align="right" />
            <TableColumnHeader guide={marketDataColumnGuides.bar} />
            <TableColumnHeader guide={marketDataColumnGuides.status} />
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
