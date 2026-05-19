import { useEffect, useRef } from "react"
import * as echarts from "echarts"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PriceOutlookProjection } from "@/lib/price-outlook"
import type { MarketCandle } from "@/lib/pipeline-api"

export function PriceOutlookChartDialog({
  open,
  onOpenChange,
  symbol,
  name,
  outlook,
  candles,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  symbol: string
  name?: string
  outlook: PriceOutlookProjection
  candles: MarketCandle[]
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!open || !chartRef.current) return

    const chart = echarts.init(chartRef.current, undefined, { renderer: "canvas" })
    instanceRef.current = chart

    const histCount = outlook.historicalCount
    const labels = outlook.points.map((p, i) => {
      if (p.date) {
        const d = new Date(p.date)
        if (!Number.isNaN(d.getTime())) {
          return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
        }
      }
      return p.kind === "projected" ? `+${i - histCount + 1}d` : `${i + 1}`
    })

    const histData = outlook.points.map((p) =>
      p.kind === "history" ? p.close : null,
    )
    const projData = outlook.points.map((p) =>
      p.index >= histCount - 1 ? p.close : null,
    )

    const markAreas = outlook.zones.map((z) => [
      {
        name: z.label,
        xAxis: z.startIndex,
        itemStyle: { color: "rgba(148, 163, 184, 0.18)" },
        label: {
          show: true,
          position: "insideTop",
          color: "#64748b",
          fontSize: 10,
          formatter: z.label,
        },
      },
      { xAxis: z.endIndex },
    ])

    chart.setOption({
      backgroundColor: "transparent",
      animation: false,
      grid: { left: 56, right: 24, top: 36, bottom: 48 },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          crossStyle: { color: "#94a3b8" },
          lineStyle: { type: "dashed" },
        },
        formatter: (params: unknown) => {
          const items = Array.isArray(params) ? params : [params]
          const idx = (items[0] as { dataIndex?: number })?.dataIndex ?? 0
          const pt = outlook.points[idx]
          if (!pt) return ""
          const kind = pt.kind === "history" ? "Historical" : "Projected"
          return [
            `<strong>${symbol}</strong> · ${kind}`,
            `Price: <strong>$${pt.close.toFixed(2)}</strong>`,
            pt.date ? new Date(pt.date).toLocaleString() : `Session ${idx + 1}`,
          ].join("<br/>")
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { color: "#64748b", fontSize: 10, interval: "auto" },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.2)" } },
        axisLabel: {
          color: "#64748b",
          fontSize: 10,
          formatter: (v: number) => `$${v.toFixed(0)}`,
        },
      },
      series: [
        {
          name: "Historical",
          type: "line",
          data: histData,
          showSymbol: false,
          lineStyle: { width: 2, color: "#64748b" },
          itemStyle: { color: "#64748b" },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { type: "dashed", color: "#94a3b8", width: 1 },
            data: [{ xAxis: histCount - 1, label: { formatter: "Now", fontSize: 9 } }],
          },
          markArea: { silent: true, data: markAreas },
        },
        {
          name: "Projected",
          type: "line",
          data: projData,
          showSymbol: false,
          lineStyle: { width: 2, type: "dashed", color: "#10b981" },
          itemStyle: { color: "#10b981" },
        },
      ],
    })

    const onResize = () => chart.resize()
    window.addEventListener("resize", onResize)

    return () => {
      window.removeEventListener("resize", onResize)
      chart.dispose()
      instanceRef.current = null
    }
  }, [open, outlook, symbol, candles])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-4">
        <DialogHeader>
          <DialogTitle className="font-mono">
            {symbol}
            {name ? ` · ${name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Historical close and projected path with horizon bands (3D · 1W · 2W · 3W · 1M). Use
            crosshair to inspect price.
          </DialogDescription>
        </DialogHeader>
        <div ref={chartRef} className="h-[360px] w-full rounded-md border border-border/60" />
        <p className="text-center font-mono text-xs text-muted-foreground">
          P(bullish 1M): {(outlook.pBull3M * 100).toFixed(0)}% · Last ${outlook.lastPrice.toFixed(2)}{" "}
          → ${outlook.projectedPrice1M.toFixed(2)}
        </p>
      </DialogContent>
    </Dialog>
  )
}
