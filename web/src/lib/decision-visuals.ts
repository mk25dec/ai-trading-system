import type { HorizonOutlook, OutlookLabel, RecommendationAction } from "@/lib/pipeline-api"

/** 0–100 composite → semantic color classes */
export function scoreSpectrum(score: number) {
  if (score >= 75) {
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/15",
      border: "border-emerald-500/40",
      fill: "#10b981",
      track: "bg-emerald-500/20",
    }
  }
  if (score >= 62) {
    return {
      text: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/25",
      fill: "#34d399",
      track: "bg-emerald-500/15",
    }
  }
  if (score >= 45) {
    return {
      text: "text-amber-700 dark:text-amber-300",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      fill: "#f59e0b",
      track: "bg-amber-500/15",
    }
  }
  if (score >= 32) {
    return {
      text: "text-orange-700 dark:text-orange-300",
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      fill: "#f97316",
      track: "bg-orange-500/15",
    }
  }
  return {
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/35",
    fill: "#ef4444",
    track: "bg-red-500/15",
  }
}

export function outlookSpectrum(outlook: OutlookLabel | string) {
  const tone =
    outlook === "strong_buy" || outlook === "buy"
      ? "bull"
      : outlook === "sell" || outlook === "avoid"
        ? "bear"
        : "neutral"
  if (tone === "bull") {
    return { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/15", ring: "ring-emerald-500/30" }
  }
  if (tone === "bear") {
    return { text: "text-red-600 dark:text-red-400", bg: "bg-red-500/15", ring: "ring-red-500/30" }
  }
  return { text: "text-muted-foreground", bg: "bg-muted/60", ring: "ring-border" }
}

export function actionAccent(action: RecommendationAction | string) {
  switch (action) {
    case "buy_candidate":
      return "border-l-emerald-500"
    case "sell_candidate":
      return "border-l-orange-500"
    case "avoid":
      return "border-l-red-500"
    default:
      return "border-l-muted-foreground/40"
  }
}

export type HorizonTrajectory = "improving" | "fading" | "stable"

/** Score path across 3D → 1W → 1M for projection narrative */
export function horizonTrajectory(horizons: HorizonOutlook[]): HorizonTrajectory {
  if (horizons.length < 2) return "stable"
  const scores = horizons.map((h) => h.score)
  const delta = scores[scores.length - 1] - scores[0]
  if (delta >= 8) return "improving"
  if (delta <= -8) return "fading"
  return "stable"
}

export function trajectoryLabel(t: HorizonTrajectory): string {
  switch (t) {
    case "improving":
      return "Improving into longer horizons"
    case "fading":
      return "Fading on longer horizons"
    default:
      return "Stable across horizons"
  }
}

export function stanceSpectrum(stance: string) {
  switch (stance) {
    case "bullish":
      return { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/12", icon: "bull" as const }
    case "bearish":
      return { text: "text-red-600 dark:text-red-400", bg: "bg-red-500/12", icon: "bear" as const }
    default:
      return { text: "text-muted-foreground", bg: "bg-muted/50", icon: "neutral" as const }
  }
}

export function riskSpectrum(level: string) {
  switch (level) {
    case "low":
      return { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/12", label: "Low risk" }
    case "high":
      return { text: "text-red-600 dark:text-red-400", bg: "bg-red-500/12", label: "High risk" }
    default:
      return { text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/12", label: "Medium risk" }
  }
}

export function alignmentSpectrum(alignment: string) {
  switch (alignment) {
    case "aligned_bullish":
      return { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/12" }
    case "aligned_bearish":
      return { text: "text-red-600 dark:text-red-400", bg: "bg-red-500/12" }
    case "divergent":
      return { text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/12" }
    default:
      return { text: "text-muted-foreground", bg: "bg-muted/40" }
  }
}
