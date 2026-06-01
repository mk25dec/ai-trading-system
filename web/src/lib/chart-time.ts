/** Alpaca / API bar timestamps are UTC — parse and label consistently on all price charts. */
export const CHART_TIME_ZONE = "UTC"

const AXIS_FMT: Intl.DateTimeFormatOptions = {
  timeZone: CHART_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}

const DETAIL_FMT: Intl.DateTimeFormatOptions = {
  ...AXIS_FMT,
  second: "2-digit",
}

/** Parse API/Alpaca timestamp as UTC (naive ISO strings without offset are treated as UTC). */
export function parseChartTimestamp(timestamp: string): number {
  const s = timestamp.trim()
  if (!s) return 0
  const hasOffset = /[zZ]$|[+-]\d{2}:\d{2}$/.test(s)
  const normalized = hasOffset ? s : `${s.replace(/\.\d+$/, "")}Z`
  const ms = Date.parse(normalized)
  return Number.isNaN(ms) ? 0 : ms
}

export function formatChartAxisTime(ms: number): string {
  if (!ms) return ""
  return new Date(ms).toLocaleString("en-US", AXIS_FMT)
}

export function formatChartDateTime(iso: string): string {
  const ms = parseChartTimestamp(iso)
  if (!ms) return iso
  return `${new Date(ms).toLocaleString("en-US", DETAIL_FMT)} UTC`
}

export function formatChartTimeShort(iso?: string): string | null {
  if (!iso) return null
  const ms = parseChartTimestamp(iso)
  if (!ms) return null
  return `${new Date(ms).toLocaleString("en-US", AXIS_FMT)} UTC`
}

export function chartPointsTimeRange(points: { timestamp: string }[]): string | null {
  if (points.length === 0) return null
  const first = parseChartTimestamp(points[0]!.timestamp)
  const last = parseChartTimestamp(points[points.length - 1]!.timestamp)
  if (!first || !last) return null
  return `${formatChartAxisTime(first)} – ${formatChartAxisTime(last)} UTC`
}
