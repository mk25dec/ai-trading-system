import { useEffect, useRef, useState } from "react"
import type { EChartsOption } from "echarts"
import * as echarts from "echarts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { PerformanceRange } from "@/lib/overview-metrics"

const RANGES: PerformanceRange[] = ["7D", "1M", "3M", "1Y", "All"]

type PerformanceOverviewChartProps = {
  labels: string[]
  strategy: number[]
  benchmark: number[]
  range: PerformanceRange
  onRangeChange: (range: PerformanceRange) => void
}

function buildOption(labels: string[], strategy: number[], benchmark: number[]): EChartsOption {
  const hasBenchmark = benchmark.some((v) => v !== 0)
  return {
    backgroundColor: "transparent",
    animationDuration: 300,
    grid: { left: 48, right: 16, top: 40, bottom: 32 },
    legend: {
      top: 0,
      left: 0,
      textStyle: { color: "#64748b", fontSize: 11 },
      data: hasBenchmark ? ["Strategy return", "SPY (Benchmark)"] : ["Strategy return"],
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.92)",
      borderColor: "rgba(148, 163, 184, 0.35)",
      textStyle: { color: "#f8fafc", fontSize: 12 },
      valueFormatter: (v) => `${Number(v).toFixed(2)}%`,
    },
    xAxis: {
      type: "category",
      data: labels.map((d) => {
        const dt = new Date(d)
        return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      }),
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisLabel: { color: "#64748b", fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#64748b",
        fontSize: 10,
        formatter: (v: number) => `${v.toFixed(1)}%`,
      },
      splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
    },
    series: [
      {
        name: "Strategy return",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        showSymbol: labels.length <= 12,
        lineStyle: { width: 2.5, color: "#2563eb" },
        itemStyle: { color: "#2563eb" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(37, 99, 235, 0.18)" },
            { offset: 1, color: "rgba(37, 99, 235, 0)" },
          ]),
        },
        data: strategy,
      },
      ...(hasBenchmark
        ? [
            {
              name: "SPY (Benchmark)",
              type: "line" as const,
              smooth: true,
              symbol: "none",
              lineStyle: { width: 2, color: "#94a3b8", type: "dashed" as const },
              data: benchmark,
            },
          ]
        : []),
    ],
  }
}

export function PerformanceOverviewChart({
  labels,
  strategy,
  benchmark,
  range,
  onRangeChange,
}: PerformanceOverviewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    if (labels.length < 2) {
      setEmpty(true)
      chartRef.current?.dispose()
      chartRef.current = null
      return
    }
    setEmpty(false)

    if (!chartRef.current) {
      chartRef.current = echarts.init(el, undefined, { renderer: "canvas" })
    }
    chartRef.current.setOption(buildOption(labels, strategy, benchmark), true)

    const ro = new ResizeObserver(() => chartRef.current?.resize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [labels, strategy, benchmark])

  useEffect(() => {
    return () => {
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  return (
    <Card className="border-border/70 shadow-sm lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Performance overview</CardTitle>
        <div className="flex rounded-lg border bg-muted/40 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                range === r
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed bg-muted/20 text-sm text-muted-foreground">
            Refresh watchlist data to populate performance history
          </div>
        ) : (
          <div ref={containerRef} className="h-[240px] w-full" role="img" aria-label="Performance chart" />
        )}
      </CardContent>
    </Card>
  )
}
