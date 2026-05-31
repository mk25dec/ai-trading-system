import { useCallback, useEffect, useRef } from "react"
import type { EChartsOption } from "echarts"
import * as echarts from "echarts"
import type { PriceChartPoint } from "@/lib/pipeline-api"
import {
  analyzeChartSelection,
  type ChartSelectionAnalysis,
} from "@/lib/chart-selection-analysis"
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

function buildOption(
  points: PriceChartPoint[],
  forwardPoints: PriceChartPoint[],
  symbol: string,
): EChartsOption {
  const actual = points.map((p) => [parseTs(p.timestamp), p.close] as [number, number])
  const predicted = points.map(
    (p) => [parseTs(p.timestamp), p.predictedPrice1 ?? null] as [number, number | null],
  )
  const anchorMs =
    points.length > 0 ? parseTs(points[points.length - 1]!.timestamp) : 0
  const forward: [number, number][] = []
  if (points.length > 0 && forwardPoints.length > 0) {
    const last = points[points.length - 1]!
    forward.push([parseTs(last.timestamp), last.close])
    for (const p of forwardPoints) {
      forward.push([parseTs(p.timestamp), p.close])
    }
  }
  const singlePoint = points.length === 1
  const legendItems = ["Live price", "Predicted (formula)"]
  if (forward.length > 0) {
    legendItems.push("Projected (+3D)")
  }

  return {
    backgroundColor: "transparent",
    animationDuration: 280,
    grid: { left: 56, right: 24, top: 48, bottom: 88 },
    toolbox: {
      right: 12,
      top: 4,
      feature: {
        brush: {
          type: ["lineX", "clear"],
          title: { lineX: "Select range", clear: "Clear selection" },
        },
        dataZoom: {
          yAxisIndex: "none",
          title: { zoom: "Zoom", back: "Reset zoom" },
        },
      },
      iconStyle: { borderColor: "#64748b" },
    },
    brush: {
      toolbox: ["lineX", "clear"],
      xAxisIndex: 0,
      brushMode: "single",
      transformable: true,
      brushStyle: {
        borderWidth: 1,
        color: "rgba(59, 130, 246, 0.12)",
        borderColor: "rgba(59, 130, 246, 0.55)",
      },
      outOfBrush: { colorAlpha: 0.25 },
    },
    legend: {
      top: 8,
      data: legendItems,
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
        const first = items[0] as { dataIndex?: number; seriesName?: string; value?: unknown }
        if (first?.seriesName === "Projected (+3D)") {
          const row = first.value as [number, number] | undefined
          if (!row) return ""
          const when = formatAxisLabel(row[0])
          return [
            `<div style="font-weight:600;margin-bottom:4px">${symbol} · ${when}</div>`,
            `Projected: <b>$${row[1].toFixed(2)}</b>`,
          ].join("<br/>")
        }
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
      ...(forward.length > 0
        ? [
            {
              name: "Projected (+3D)",
              type: "line" as const,
              data: forward,
              showSymbol: false,
              smooth: 0.2,
              lineStyle: { width: 2, type: "dashed" as const, color: "#8b5cf6" },
              itemStyle: { color: "#8b5cf6" },
              markLine: anchorMs
                ? {
                    symbol: ["none", "none"],
                    silent: true,
                    data: [
                      {
                        xAxis: anchorMs,
                        label: {
                          formatter: "Now",
                          color: "#64748b",
                          fontSize: 10,
                        },
                      },
                    ],
                    lineStyle: { color: "rgba(100,116,139,0.45)", type: "dotted" as const },
                  }
                : undefined,
            },
          ]
        : []),
    ],
    title: {
      text: symbol,
      left: 8,
      top: 4,
      textStyle: { color: "#94a3b8", fontSize: 12, fontWeight: 500 },
    },
  }
}

type BrushEndEvent = {
  areas?: Array<{ coordRange?: [number, number] }>
}

export function ActualPredictedChart({
  points,
  forwardPoints = [],
  symbol,
  className,
  height = 420,
  onSelectionChange,
  clearSelectionSignal = 0,
}: {
  points: PriceChartPoint[]
  forwardPoints?: PriceChartPoint[]
  symbol: string
  className?: string
  height?: number
  onSelectionChange?: (analysis: ChartSelectionAnalysis | null) => void
  /** Increment to clear the brush selection from the parent. */
  clearSelectionSignal?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const selectionRangeRef = useRef<[number, number] | null>(null)
  const pointsRef = useRef(points)
  pointsRef.current = points

  const emitSelection = useCallback(
    (range: [number, number] | null) => {
      selectionRangeRef.current = range
      if (!onSelectionChange) return
      if (!range) {
        onSelectionChange(null)
        return
      }
      onSelectionChange(analyzeChartSelection(pointsRef.current, range[0], range[1]))
    },
    [onSelectionChange],
  )

  const restoreBrush = useCallback((chart: echarts.ECharts) => {
    const range = selectionRangeRef.current
    if (!range) return
    chart.dispatchAction({
      type: "brush",
      areas: [
        {
          brushType: "lineX",
          coordRange: range,
          xAxisIndex: 0,
        },
      ],
    })
  }, [])

  const bindBrush = useCallback(
    (chart: echarts.ECharts) => {
      chart.off("brushEnd")
      chart.on("brushEnd", (params: unknown) => {
        const event = params as BrushEndEvent
        const areas = event.areas
        if (!areas?.length) {
          emitSelection(null)
          return
        }
        const range = areas[0]?.coordRange
        if (!range || range.length < 2) {
          emitSelection(null)
          return
        }
        emitSelection([range[0], range[1]])
      })
    },
    [emitSelection],
  )

  const render = useCallback(() => {
    if (!containerRef.current || points.length < 1) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current, undefined, { renderer: "canvas" })
      bindBrush(chartRef.current)
    }
    chartRef.current.setOption(buildOption(points, forwardPoints, symbol), {
      notMerge: false,
      lazyUpdate: true,
    })
    restoreBrush(chartRef.current)
    chartRef.current.resize()
    if (selectionRangeRef.current) {
      emitSelection(selectionRangeRef.current)
    }
  }, [bindBrush, emitSelection, forwardPoints, points, restoreBrush, symbol])

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

  useEffect(() => {
    if (clearSelectionSignal === 0) return
    selectionRangeRef.current = null
    chartRef.current?.dispatchAction({ type: "brush", command: "clear", areas: [] })
    onSelectionChange?.(null)
  }, [clearSelectionSignal, onSelectionChange])

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
    <div className={cn("space-y-2", className)}>
      <div
        ref={containerRef}
        className="w-full rounded-xl border bg-card/50"
        style={{ height }}
        role="img"
        aria-label={`Live price chart for ${symbol}. Drag horizontally to select a range for analysis.`}
      />
      <p className="text-xs text-muted-foreground">
        Drag on the chart (line-X brush in the toolbar) to select a time range — stats appear below.
        Purple dashed line is the formula projection for the next 3 days. Scroll or use the slider to
        zoom; double-click chart to reset zoom.
      </p>
    </div>
  )
}
