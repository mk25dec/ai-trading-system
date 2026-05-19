import { useLayoutEffect, useRef, useState } from "react"
import type { EChartsOption } from "echarts"
import * as echarts from "echarts"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PriceOutlookProjection } from "@/lib/price-outlook"
import { cn } from "@/lib/utils"

function buildChartOption(
  outlook: PriceOutlookProjection,
  symbol: string,
  bullish: boolean,
): EChartsOption {
  const histCount = outlook.historicalCount
  const labels = outlook.points.map((p, i) => {
    if (p.kind === "projected") {
      const anchor = outlook.anchors.find((a) => a.index === i)
      if (anchor) return anchor.label
      return `+${i - histCount + 1}d`
    }
    if (p.date) {
      const d = new Date(p.date)
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      }
    }
    return ""
  })

  const histData = outlook.points.map((p) => (p.kind === "history" ? p.close : null))
  const projData = outlook.points.map((p, i) =>
    i >= histCount - 1 ? p.close : null,
  )

  const projColor = bullish ? "#10b981" : "#ef4444"
  const lastHistIndex = histCount - 1

  const horizonLines = outlook.anchors.map((a) => ({
    xAxis: a.index,
    label: {
      show: true,
      formatter: a.label,
      position: "insideEndTop" as const,
      color: "#64748b",
      fontSize: 11,
      fontWeight: 600,
    },
    lineStyle: { type: "dashed" as const, color: "rgba(148,163,184,0.45)", width: 1 },
  }))

  return {
    backgroundColor: "transparent",
    animationDuration: 280,
    grid: { left: 64, right: 28, top: 48, bottom: 56 },
    legend: {
      top: 8,
      left: "center",
      textStyle: { color: "#64748b", fontSize: 11 },
      data: ["Historical", "Projected"],
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.92)",
      borderColor: "rgba(148, 163, 184, 0.35)",
      textStyle: { color: "#f8fafc", fontSize: 12 },
      axisPointer: {
        type: "cross",
        crossStyle: { color: "#94a3b8" },
        lineStyle: { type: "dashed", color: "#94a3b8" },
        label: { backgroundColor: "#334155" },
      },
      formatter: (params: unknown) => {
        const items = Array.isArray(params) ? params : [params]
        const idx = (items[0] as { dataIndex?: number })?.dataIndex ?? 0
        const pt = outlook.points[idx]
        if (!pt) return ""
        const kind = pt.kind === "history" ? "Historical" : "Projected"
        const anchor = outlook.anchors.find((a) => a.index === idx)
        return [
          `<div style="font-weight:600;margin-bottom:4px">${symbol} · ${kind}</div>`,
          `Price: <b>$${pt.close.toFixed(2)}</b>`,
          anchor ? `Horizon: <b>${anchor.label}</b>` : "",
          pt.date && pt.kind === "history"
            ? new Date(pt.date).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })
            : "",
        ]
          .filter(Boolean)
          .join("<br/>")
      },
    },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisLabel: {
        color: "#64748b",
        fontSize: 10,
        interval: (index: number) => {
          if (index >= histCount) {
            return outlook.anchors.some((a) => a.index === index)
          }
          return index % Math.max(Math.floor(histCount / 8), 1) === 0
        },
      },
      axisPointer: { label: { show: true } },
    },
    yAxis: {
      type: "value",
      scale: true,
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.18)" } },
      axisLabel: {
        color: "#64748b",
        fontSize: 10,
        formatter: (v: number) => `$${v.toFixed(2)}`,
      },
    },
    dataZoom: [
      {
        type: "inside",
        start: Math.max(0, 100 - (42 / outlook.points.length) * 100),
        end: 100,
      },
      {
        type: "slider",
        height: 22,
        bottom: 8,
        borderColor: "transparent",
        backgroundColor: "rgba(148,163,184,0.12)",
        fillerColor: "rgba(148,163,184,0.25)",
        handleStyle: { color: "#64748b" },
        textStyle: { color: "#64748b", fontSize: 10 },
      },
    ],
    series: [
      {
        name: "Historical",
        type: "line",
        data: histData,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 2.5, color: "#475569" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(71, 85, 105, 0.18)" },
            { offset: 1, color: "rgba(71, 85, 105, 0.02)" },
          ]),
        },
        markLine: {
          silent: true,
          symbol: "none",
          data: [
            {
              xAxis: lastHistIndex,
              label: { formatter: "Now", position: "insideEndTop", fontSize: 10, color: "#64748b" },
              lineStyle: { color: "#94a3b8", type: "solid", width: 1.5 },
            },
            ...horizonLines,
          ],
        },
        markArea: {
          silent: true,
          itemStyle: { color: "rgba(148, 163, 184, 0.14)" },
          data: [
            [
              { xAxis: lastHistIndex, name: "Projection" },
              { xAxis: outlook.points.length - 1 },
            ],
          ],
        },
      },
      {
        name: "Projected",
        type: "line",
        data: projData,
        showSymbol: true,
        symbolSize: 5,
        connectNulls: true,
        lineStyle: { width: 2.5, type: "dashed", color: projColor },
        itemStyle: { color: projColor },
        markPoint: {
          symbol: "circle",
          symbolSize: 8,
          data: outlook.anchors.map((a) => ({
            name: a.label,
            coord: [a.index, a.price],
            value: `$${a.price.toFixed(2)}`,
            itemStyle: { color: projColor },
          })),
        },
      },
    ],
  }
}

export function PriceOutlookChartDialog({
  open,
  onOpenChange,
  symbol,
  name,
  outlook,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  symbol: string
  name?: string
  outlook: PriceOutlookProjection
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const [chartReady, setChartReady] = useState(false)

  const bullish = outlook.pBull3M >= 0.5

  useLayoutEffect(() => {
    if (!open) {
      setChartReady(false)
      chartInstance.current?.dispose()
      chartInstance.current = null
      return
    }

    const el = chartRef.current
    if (!el) return

    let cancelled = false
    const init = () => {
      if (cancelled || !chartRef.current) return
      const { clientWidth, clientHeight } = chartRef.current
      if (clientWidth < 10 || clientHeight < 10) {
        requestAnimationFrame(init)
        return
      }

      chartInstance.current?.dispose()
      const chart = echarts.init(chartRef.current, undefined, { renderer: "canvas" })
      chartInstance.current = chart
      chart.setOption(buildChartOption(outlook, symbol, bullish), { notMerge: true })
      chart.resize()
      setChartReady(true)
    }

    requestAnimationFrame(init)

    const ro = new ResizeObserver(() => {
      chartInstance.current?.resize()
    })
    ro.observe(el)

    return () => {
      cancelled = true
      ro.disconnect()
      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [open, outlook, symbol, bullish])

  const pct =
    ((outlook.projectedPrice1M - outlook.lastPrice) / outlook.lastPrice) * 100

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-3 p-5 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-lg">
            {symbol}
            {name ? <span className="font-sans font-normal text-muted-foreground"> · {name}</span> : null}
          </DialogTitle>
          <DialogDescription>
            Historical close (left) and projected path (grey zone). Hover for crosshair · drag slider
            to zoom.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "relative h-[400px] w-full overflow-hidden rounded-lg border border-border/70 bg-card",
            !chartReady && "animate-pulse bg-muted/30",
          )}
        >
          {open ? <div ref={chartRef} className="absolute inset-0 h-full w-full min-h-[320px]" /> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs">
          <div className="flex flex-wrap gap-2">
            {outlook.anchors.map((a) => (
              <span
                key={a.label}
                className="rounded-md bg-muted/60 px-2 py-1 font-mono tabular-nums text-foreground"
              >
                <span className="font-semibold text-muted-foreground">{a.label}</span>{" "}
                ${a.price.toFixed(2)}
              </span>
            ))}
          </div>
          <p className="font-mono tabular-nums text-muted-foreground">
            <span className={bullish ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
              {(outlook.pBull3M * 100).toFixed(0)}% P↑
            </span>
            {" · "}
            ${outlook.lastPrice.toFixed(2)} → ${outlook.projectedPrice1M.toFixed(2)} (
            {pct >= 0 ? "+" : ""}
            {pct.toFixed(1)}%)
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
