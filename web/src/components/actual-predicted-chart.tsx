import { useCallback, useEffect, useRef } from "react"
import type { EChartsOption } from "echarts"
import * as echarts from "echarts"
import type { PriceChartPoint } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

function buildOption(points: PriceChartPoint[], symbol: string): EChartsOption {
  const labels = points.map((p) => {
    const d = new Date(p.timestamp)
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })
  })
  const actual = points.map((p) => p.close)
  const predicted = points.map((p) => p.predictedPrice1 ?? null)

  return {
    backgroundColor: "transparent",
    animationDuration: 280,
    grid: { left: 56, right: 24, top: 48, bottom: 56 },
    legend: {
      top: 8,
      data: ["Actual close", "Predicted (formula)"],
      textStyle: { color: "#64748b", fontSize: 11 },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.92)",
      borderColor: "rgba(148, 163, 184, 0.35)",
      textStyle: { color: "#f8fafc", fontSize: 12 },
    },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { color: "#64748b", fontSize: 10, hideOverlap: true },
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.35)" } },
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
        name: "Actual close",
        type: "line",
        data: actual,
        showSymbol: false,
        smooth: 0.2,
        lineStyle: { width: 2, color: "#3b82f6" },
        itemStyle: { color: "#3b82f6" },
      },
      {
        name: "Predicted (formula)",
        type: "line",
        data: predicted,
        showSymbol: false,
        smooth: 0.2,
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
    if (!containerRef.current || points.length < 2) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current, undefined, { renderer: "canvas" })
    }
    chartRef.current.setOption(buildOption(points, symbol), { notMerge: true })
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

  if (points.length < 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        No price history — sync Alpaca data for this symbol
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn("w-full rounded-xl border bg-card/50", className)}
      style={{ height }}
      role="img"
      aria-label={`Actual vs predicted price chart for ${symbol}`}
    />
  )
}
