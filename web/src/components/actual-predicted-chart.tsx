import { useCallback, useEffect, useRef } from "react"
import type { EChartsOption } from "echarts"
import * as echarts from "echarts"
import type { PriceChartPoint } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

function parseTs(timestamp: string): number {
  const ms = new Date(timestamp).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

function formatAxisLabel(ms: number): string {
  if (!ms) return ""
  const d = new Date(ms)
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function buildOption(points: PriceChartPoint[], symbol: string): EChartsOption {
  const actual = points.map((p) => [parseTs(p.timestamp), p.close] as [number, number])
  const predicted = points.map(
    (p) => [parseTs(p.timestamp), p.predictedPrice1 ?? null] as [number, number | null],
  )
  const singlePoint = points.length === 1

  return {
    backgroundColor: "transparent",
    animationDuration: 280,
    grid: { left: 56, right: 24, top: 48, bottom: 56 },
    legend: {
      top: 8,
      data: ["Live price", "Predicted (formula)"],
      textStyle: { color: "#64748b", fontSize: 11 },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.92)",
      borderColor: "rgba(148, 163, 184, 0.35)",
      textStyle: { color: "#f8fafc", fontSize: 12 },
      axisPointer: {
        type: "cross",
        crossStyle: { color: "#94a3b8", width: 1 },
        lineStyle: { type: "dashed", color: "#94a3b8", width: 1 },
        label: {
          backgroundColor: "#334155",
          color: "#f8fafc",
          fontSize: 11,
          padding: [4, 6],
          formatter: (params) => {
            const raw = params.value
            const v = typeof raw === "number" ? raw : Number(raw)
            if (!Number.isFinite(v)) return String(raw ?? "")
            if (params.axisDimension === "y") return `$${v.toFixed(2)}`
            return formatAxisLabel(v)
          },
        },
      },
      formatter: (params: unknown) => {
        const items = Array.isArray(params) ? params : [params]
        const first = items[0] as { dataIndex?: number }
        const idx = first?.dataIndex ?? 0
        const pt = points[idx]
        if (!pt) return ""
        const when = formatAxisLabel(parseTs(pt.timestamp))
        const lines = [
          `<div style="font-weight:600;margin-bottom:4px">${symbol} · ${when}</div>`,
          `Price: <b>$${pt.close.toFixed(2)}</b>`,
        ]
        if (pt.predictedPrice1 != null) {
          const diff = pt.predictedPrice1 - pt.close
          const sign = diff >= 0 ? "+" : ""
          lines.push(
            `Predicted: <b>$${pt.predictedPrice1.toFixed(2)}</b>`,
            `Δ ${sign}$${diff.toFixed(2)}`,
          )
        }
        return lines.join("<br/>")
      },
    },
    xAxis: {
      type: "time",
      axisLabel: {
        color: "#64748b",
        fontSize: 10,
        hideOverlap: true,
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
        formatter: (v: number) => `$${v.toFixed(0)}`,
      },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.12)" } },
    },
    series: [
      {
        name: "Live price",
        type: "line",
        data: actual,
        showSymbol: singlePoint,
        symbolSize: singlePoint ? 10 : 4,
        smooth: 0.15,
        lineStyle: { width: 2, color: "#3b82f6" },
        itemStyle: { color: "#3b82f6" },
      },
      {
        name: "Predicted (formula)",
        type: "line",
        data: predicted,
        showSymbol: false,
        smooth: 0.15,
        lineStyle: { width: 2, type: "dashed", color: "#f59e0b" },
        itemStyle: { color: "#f59e0b" },
        connectNulls: false,
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

export function ActualPredictedChart({
  points,
  symbol,
  className,
  height = 420,
}: {
  points: PriceChartPoint[]
  symbol: string
  className?: string
  height?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  const render = useCallback(() => {
    if (!containerRef.current || points.length < 1) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current, undefined, { renderer: "canvas" })
    }
    chartRef.current.setOption(buildOption(points, symbol), {
      notMerge: false,
      lazyUpdate: true,
    })
    chartRef.current.resize()
  }, [points, symbol])

  useEffect(() => {
    render()
    const onResize = () => chartRef.current?.resize()
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [render])

  if (points.length < 1) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        No live price data — click Sync history, then wait for the next refresh (Alpaca must be
        configured on the API).
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn("w-full rounded-xl border bg-card/50", className)}
      style={{ height }}
      role="img"
      aria-label={`Live price chart for ${symbol}`}
    />
  )
}
