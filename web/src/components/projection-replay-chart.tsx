import { useCallback, useEffect, useMemo, useRef } from "react"
import type { EChartsOption } from "echarts"
import * as echarts from "echarts"
import type { PriceChartPoint, PriceChartProjectionReplay } from "@/lib/pipeline-api"
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

const PAD_MS = 6 * 60 * 60 * 1000

function buildReplayOption(
  symbol: string,
  actualWindow: [number, number][],
  projection: [number, number][],
  anchorMs: number,
  horizonEndMs: number,
  actualAtHorizonMs?: number,
  projectedEnd?: number,
  actualEnd?: number,
): EChartsOption {
  const markPoints: Array<{ name: string; coord: [number, number]; color: string }> = []
  if (projection.length > 0) {
    const anchor = projection[0]
    markPoints.push({ name: "Anchor", coord: anchor, color: "#7c3aed" })
  }
  if (projectedEnd != null && projection.length > 0) {
    const last = projection[projection.length - 1]
    markPoints.push({ name: "Projected +3D", coord: [last[0], projectedEnd], color: "#a855f7" })
  }
  if (actualEnd != null && actualAtHorizonMs) {
    markPoints.push({
      name: "Actual +3D",
      coord: [actualAtHorizonMs, actualEnd],
      color: "#10b981",
    })
  }

  return {
    backgroundColor: "transparent",
    animationDuration: 280,
    grid: { left: 56, right: 24, top: 48, bottom: 72 },
    legend: {
      top: 8,
      data: ["Actual price (real)", "Formula projection (+3D)"],
      textStyle: { color: "#64748b", fontSize: 11 },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.92)",
      borderColor: "rgba(148, 163, 184, 0.35)",
      textStyle: { color: "#f8fafc", fontSize: 12 },
      axisPointer: {
        type: "cross",
        lineStyle: { type: "dashed", color: "#94a3b8" },
        label: {
          backgroundColor: "#334155",
          formatter: (params: { value?: unknown; axisDimension?: string }) => {
            const v = typeof params.value === "number" ? params.value : Number(params.value)
            if (!Number.isFinite(v)) return String(params.value ?? "")
            if (params.axisDimension === "y") return `$${v.toFixed(2)}`
            return formatAxisLabel(v)
          },
        },
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
        fillerColor: "rgba(168,85,247,0.15)",
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
        name: "Actual price (real)",
        type: "line",
        data: actualWindow,
        showSymbol: false,
        smooth: 0.12,
        lineStyle: { width: 2.5, color: "#3b82f6" },
        itemStyle: { color: "#3b82f6" },
        z: 2,
        markLine: {
          symbol: ["none", "none"],
          silent: true,
          data: [
            {
              xAxis: anchorMs,
              label: { formatter: "Anchor", color: "#7c3aed", fontSize: 10 },
              lineStyle: { color: "rgba(124,58,237,0.7)", type: "solid", width: 1.5 },
            },
            {
              xAxis: horizonEndMs,
              label: { formatter: "+3D target", color: "#64748b", fontSize: 10 },
              lineStyle: { color: "rgba(100,116,139,0.4)", type: "dotted" as const },
            },
            ...(actualAtHorizonMs
              ? [
                  {
                    xAxis: actualAtHorizonMs,
                    label: { formatter: "Actual +3D", color: "#10b981", fontSize: 10 },
                    lineStyle: { color: "rgba(16,185,129,0.55)", type: "dotted" as const },
                  },
                ]
              : []),
          ],
        },
      },
      {
        name: "Formula projection (+3D)",
        type: "line",
        data: projection,
        showSymbol: false,
        smooth: 0.2,
        lineStyle: { width: 2, type: "dashed", color: "#a855f7" },
        itemStyle: { color: "#a855f7" },
        z: 3,
        markPoint: {
          symbol: "circle",
          symbolSize: 10,
          data: markPoints.map((mp) => ({
            name: mp.name,
            coord: mp.coord,
            itemStyle: { color: mp.color, borderColor: "#fff", borderWidth: 1 },
            label: {
              show: true,
              formatter: mp.name,
              color: mp.color,
              fontSize: 10,
              position: "top",
            },
          })),
        },
      },
    ],
    title: {
      text: `${symbol} · replay window`,
      left: 8,
      top: 4,
      textStyle: { color: "#94a3b8", fontSize: 12, fontWeight: 500 },
    },
  }
}

export function ProjectionReplayChart({
  symbol,
  allPoints,
  replay,
  className,
  height = 360,
}: {
  symbol: string
  allPoints: PriceChartPoint[]
  replay: PriceChartProjectionReplay
  className?: string
  height?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  const chartData = useMemo(() => {
    const anchorMs = parseTs(replay.anchor.timestamp)
    const horizonEndMs = parseTs(replay.horizonEnd)
    const actualAtHorizonMs = replay.actualAtHorizon
      ? parseTs(replay.actualAtHorizon.timestamp)
      : undefined

    const windowEndMs = Math.max(
      horizonEndMs,
      actualAtHorizonMs ?? 0,
      anchorMs,
    ) + PAD_MS
    const windowStartMs = anchorMs - PAD_MS

    const actualWindow = allPoints
      .filter((p) => {
        const t = parseTs(p.timestamp)
        return t >= windowStartMs && t <= windowEndMs
      })
      .map((p) => [parseTs(p.timestamp), p.close] as [number, number])

    const projection: [number, number][] = [
      [anchorMs, replay.anchor.close],
      ...replay.forwardPoints.map((p) => [parseTs(p.timestamp), p.close] as [number, number]),
    ]

    return {
      actualWindow,
      projection,
      anchorMs,
      horizonEndMs,
      actualAtHorizonMs,
      projectedEnd: replay.projectedAtHorizon,
      actualEnd: replay.actualAtHorizon?.close,
    }
  }, [allPoints, replay])

  const render = useCallback(() => {
    if (!containerRef.current) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current, undefined, { renderer: "canvas" })
    }
    chartRef.current.setOption(
      buildReplayOption(
        symbol,
        chartData.actualWindow,
        chartData.projection,
        chartData.anchorMs,
        chartData.horizonEndMs,
        chartData.actualAtHorizonMs,
        chartData.projectedEnd,
        chartData.actualEnd,
      ),
      { notMerge: true },
    )
    chartRef.current.resize()
  }, [chartData, symbol])

  useEffect(() => {
    render()
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
  }, [render])

  if (chartData.actualWindow.length < 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        Not enough price bars around the selected anchor.
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={containerRef}
        className="w-full rounded-xl border border-violet-500/25 bg-card/50"
        style={{ height }}
        role="img"
        aria-label={`Projection replay chart for ${symbol}`}
      />
      <p className="text-xs text-muted-foreground">
        Blue is what actually happened. Purple dashed is what the formula predicted from the anchor.
        Compare the purple end point to the green <span className="font-medium">Actual +3D</span> marker.
      </p>
    </div>
  )
}
