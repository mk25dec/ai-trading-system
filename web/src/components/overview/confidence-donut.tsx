import { useEffect, useRef } from "react"
import { Link } from "react-router-dom"
import type { EChartsOption } from "echarts"
import * as echarts from "echarts"
import { ArrowUpRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const SEGMENTS = [
  { key: "high", label: "High (70–100%)", color: "#10b981" },
  { key: "medium", label: "Medium (40–70%)", color: "#f59e0b" },
  { key: "low", label: "Low (0–40%)", color: "#ef4444" },
] as const

function buildOption(high: number, medium: number, low: number, total: number): EChartsOption {
  return {
    backgroundColor: "transparent",
    animationDuration: 300,
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)",
    },
    series: [
      {
        type: "pie",
        radius: ["58%", "78%"],
        center: ["50%", "46%"],
        avoidLabelOverlap: true,
        label: { show: false },
        data: [
          { value: high, name: SEGMENTS[0].label, itemStyle: { color: SEGMENTS[0].color } },
          { value: medium, name: SEGMENTS[1].label, itemStyle: { color: SEGMENTS[1].color } },
          { value: low, name: SEGMENTS[2].label, itemStyle: { color: SEGMENTS[2].color } },
        ],
      },
    ],
    graphic: [
      {
        type: "text",
        left: "center",
        top: "38%",
        style: {
          text: String(total),
          fill: "#0f172a",
          fontSize: 28,
          fontWeight: 700,
        },
      },
      {
        type: "text",
        left: "center",
        top: "50%",
        style: {
          text: "Total signals",
          fill: "#64748b",
          fontSize: 11,
        },
      },
    ],
  }
}

export function ConfidenceDonut({
  high,
  medium,
  low,
  total,
  signalsHref,
}: {
  high: number
  medium: number
  low: number
  total: number
  signalsHref: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(el, undefined, { renderer: "canvas" })
    }
    chartRef.current.setOption(buildOption(high, medium, low, total), true)
    const ro = new ResizeObserver(() => chartRef.current?.resize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [high, medium, low, total])

  useEffect(() => {
    return () => {
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  const pct = (n: number) => (total > 0 ? ((n / total) * 100).toFixed(1) : "0.0")

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">AI confidence distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No signals yet — refresh data to generate signals
          </p>
        ) : (
          <>
            <div ref={containerRef} className="mx-auto h-[160px] w-full max-w-[220px]" />
            <ul className="space-y-2 text-sm">
              {SEGMENTS.map((seg, i) => {
                const count = [high, medium, low][i]
                return (
                  <li key={seg.key} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: seg.color }}
                      />
                      {seg.label}
                    </span>
                    <span className="font-medium tabular-nums">
                      {count}{" "}
                      <span className="text-muted-foreground">({pct(count)}%)</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        <Link
          to={signalsHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View all signals
          <ArrowUpRight className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  )
}
