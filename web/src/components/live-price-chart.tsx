import { useCallback, useEffect, useRef } from "react"
import type { EChartsOption } from "echarts"
import * as echarts from "echarts"
import type { PriceChartPoint } from "@/lib/pipeline-api"
import { formatChartAxisTime, parseChartTimestamp } from "@/lib/chart-time"
import { cn } from "@/lib/utils"

function parseTs(timestamp: string): number {
  return parseChartTimestamp(timestamp)
}

function formatAxisLabel(ms: number): string {
  return formatChartAxisTime(ms)
}

function buildOption(symbol: string, data: [number, number][]): EChartsOption {
  return {
    backgroundColor: "transparent",
    animationDuration: 0,
    animationDurationUpdate: 0,
    grid: { left: 56, right: 24, top: 40, bottom: 72 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.92)",
      borderColor: "rgba(148, 163, 184, 0.35)",
      textStyle: { color: "#f8fafc", fontSize: 12 },
      axisPointer: {
        type: "line",
        lineStyle: { type: "dashed", color: "#94a3b8" },
      },
      formatter: (params: unknown) => {
        const items = Array.isArray(params) ? params : [params]
        const first = items[0] as { value?: [number, number] }
        const row = first?.value
        if (!row) return ""
        return [
          `<div style="font-weight:600">${symbol}</div>`,
          formatAxisLabel(row[0]),
          `Price: <b>$${row[1].toFixed(2)}</b>`,
        ].join("<br/>")
      },
    },
    dataZoom: [
      { type: "inside", xAxisIndex: 0 },
      {
        type: "slider",
        xAxisIndex: 0,
        height: 22,
        bottom: 12,
        borderColor: "transparent",
        backgroundColor: "rgba(148,163,184,0.12)",
        fillerColor: "rgba(59,130,246,0.15)",
        handleStyle: { color: "#64748b" },
        textStyle: { color: "#64748b", fontSize: 10 },
      },
    ],
    xAxis: {
      type: "time",
      axisLabel: {
        color: "#64748b",
        fontSize: 10,
        formatter: (value: number) => formatAxisLabel(value),
      },
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.35)" } },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: {
        color: "#64748b",
        fontSize: 10,
        formatter: (v: number) => `$${v.toFixed(2)}`,
      },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.12)" } },
    },
    series: [
      {
        name: "Live price",
        type: "line",
        data,
        showSymbol: data.length <= 1,
        symbolSize: 6,
        smooth: 0.12,
        lineStyle: { width: 2, color: "#3b82f6" },
        itemStyle: { color: "#3b82f6" },
      },
    ],
    title: {
      text: symbol,
      left: 8,
      top: 4,
      textStyle: { color: "#94a3b8", fontSize: 12, fontWeight: 500 },
    },
  }
}

/** Live price only — incremental ECharts updates to avoid flicker on poll. */
export function LivePriceChart({
  points,
  symbol,
  className,
  height = 280,
}: {
  points: PriceChartPoint[]
  symbol: string
  className?: string
  height?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const symbolRef = useRef(symbol)

  const applyData = useCallback((nextPoints: PriceChartPoint[], sym: string) => {
    if (!containerRef.current || nextPoints.length < 1) return

    const data = nextPoints.map(
      (p) => [parseTs(p.timestamp), p.close] as [number, number],
    )

    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current, undefined, { renderer: "canvas" })
      chartRef.current.setOption(buildOption(sym, data), { notMerge: true })
      return
    }

    chartRef.current.setOption(
      {
        title: { text: sym },
        series: [{ data }],
      },
      {
        lazyUpdate: true,
        silent: true,
        replaceMerge: ["series"],
      },
    )
    chartRef.current.resize()
  }, [])

  useEffect(() => {
    if (symbol !== symbolRef.current) {
      chartRef.current?.dispose()
      chartRef.current = null
      symbolRef.current = symbol
    }
    applyData(points, symbol)
  }, [applyData, points, symbol])

  useEffect(() => {
    const onResize = () => chartRef.current?.resize()
    window.addEventListener("resize", onResize)
    const ro = new ResizeObserver(onResize)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => {
      window.removeEventListener("resize", onResize)
      ro.disconnect()
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  if (points.length < 1) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        No live price data — run Sync history on the analysis chart below.
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={containerRef}
        className="w-full rounded-xl border bg-card/50"
        style={{ height }}
        role="img"
        aria-label={`Live price for ${symbol}`}
      />
      <p className="text-xs text-muted-foreground">
        Updates every 2 minutes from Alpaca. Axis labels are UTC, same as the source feed.
      </p>
    </div>
  )
}
