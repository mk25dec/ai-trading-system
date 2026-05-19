import { useCallback, useEffect, useRef, useState } from "react"
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
  const upperData = outlook.points.map((p, i) => {
    if (i < histCount) return null
    const u = outlook.bandUpper.find((b) => b.index === p.index)
    return u?.close ?? null
  })
  const lowerData = outlook.points.map((p, i) => {
    if (i < histCount) return null
    const l = outlook.bandLower.find((b) => b.index === p.index)
    return l?.close ?? null
  })
  const bandFillData = outlook.points.map((p, i) => {
    if (i < histCount) return null
    const u = outlook.bandUpper.find((b) => b.index === p.index)
    const l = outlook.bandLower.find((b) => b.index === p.index)
    if (u == null || l == null) return null
    return u.close - l.close
  })

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
      data: ["Historical", "±1σ band", "Projected"],
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
        const upper = outlook.bandUpper.find((b) => b.index === idx)
        const lower = outlook.bandLower.find((b) => b.index === idx)
        return [
          `<div style="font-weight:600;margin-bottom:4px">${symbol} · ${kind}</div>`,
          `Price: <b>$${pt.close.toFixed(2)}</b>`,
          upper && lower
            ? `Band: $${lower.close.toFixed(2)} – $${upper.close.toFixed(2)}`
            : "",
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
        name: "±1σ band",
        type: "line",
        data: lowerData,
        lineStyle: { opacity: 0 },
        stack: "confidence",
        symbol: "none",
        connectNulls: false,
        silent: true,
        z: 1,
      },
      {
        name: "BandFill",
        type: "line",
        data: bandFillData,
        lineStyle: { opacity: 0 },
        stack: "confidence",
        areaStyle: {
          color: bullish ? "rgba(16, 185, 129, 0.14)" : "rgba(239, 68, 68, 0.14)",
        },
        symbol: "none",
        connectNulls: false,
        silent: true,
        z: 1,
      },
      {
        name: "BandUpper",
        type: "line",
        data: upperData,
        lineStyle: { width: 1, type: "dotted", color: "rgba(148, 163, 184, 0.55)" },
        symbol: "none",
        connectNulls: false,
        silent: true,
        z: 1,
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
            xAxis: a.index,
            yAxis: a.price,
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
  const chartRef = useRef<HTMLDivElement | null>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const resizeObserver = useRef<ResizeObserver | null>(null)
  const [chartReady, setChartReady] = useState(false)
  const [chartError, setChartError] = useState<string | null>(null)

  const bullish = outlook.pBull3M >= 0.5

  const disposeChart = useCallback(() => {
    resizeObserver.current?.disconnect()
    resizeObserver.current = null
    chartInstance.current?.dispose()
    chartInstance.current = null
    setChartReady(false)
  }, [])

  const mountChart = useCallback(() => {
    const el = chartRef.current
    if (!el) return false

    const { clientWidth, clientHeight } = el
    if (clientWidth < 10 || clientHeight < 10) return false

    try {
      chartInstance.current?.dispose()
      const chart = echarts.init(el, undefined, { renderer: "canvas" })
      chartInstance.current = chart
      chart.setOption(buildChartOption(outlook, symbol, bullish), { notMerge: true })
      chart.resize()
      setChartError(null)
      setChartReady(true)
      return true
    } catch (err) {
      disposeChart()
      setChartError(err instanceof Error ? err.message : "Chart failed to render")
      return false
    }
  }, [bullish, disposeChart, outlook, symbol])

  const scheduleMount = useCallback(() => {
    let cancelled = false
    let attempts = 0
    const maxAttempts = 60

    const tryMount = () => {
      if (cancelled) return
      attempts += 1
      if (mountChart()) return
      if (attempts < maxAttempts) {
        requestAnimationFrame(tryMount)
      } else {
        setChartError("Chart container has no size — try resizing the window.")
      }
    }

    requestAnimationFrame(tryMount)
    return () => {
      cancelled = true
    }
  }, [mountChart])

  const chartContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      chartRef.current = node
      if (!node) {
        disposeChart()
        return
      }
      if (!open) return

      resizeObserver.current?.disconnect()
      resizeObserver.current = new ResizeObserver(() => {
        if (!chartInstance.current) {
          mountChart()
          return
        }
        chartInstance.current.resize()
      })
      resizeObserver.current.observe(node)
    },
    [disposeChart, mountChart, open],
  )

  useEffect(() => {
    if (!open) {
      setChartError(null)
      disposeChart()
      return
    }

    const cancelRaf = scheduleMount()
    const t = window.setTimeout(() => {
      mountChart()
    }, 120)

    return () => {
      cancelRaf()
      window.clearTimeout(t)
      disposeChart()
    }
  }, [disposeChart, mountChart, open, scheduleMount])

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
            Historical close, projected path (dashed), and ±1σ uncertainty band. Model projection —
            not a price guarantee. Hover for crosshair · drag slider to zoom.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "relative h-[400px] w-full overflow-hidden rounded-lg border border-border/70 bg-card",
            open && !chartReady && !chartError && "animate-pulse bg-muted/30",
          )}
        >
          <div
            ref={chartContainerRef}
            className="absolute inset-0 h-full w-full min-h-[320px]"
          />
          {chartError ? (
            <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-destructive">
              {chartError}
            </p>
          ) : null}
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
