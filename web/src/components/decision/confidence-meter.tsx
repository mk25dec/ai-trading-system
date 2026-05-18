import { Shield, ShieldAlert, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

export function ConfidenceMeter({ confidence, riskLevel }: { confidence: number; riskLevel: string }) {
  const pct = Math.round(confidence * 100)
  const RiskIcon =
    riskLevel === "high" ? ShieldAlert : riskLevel === "low" ? ShieldCheck : Shield

  return (
    <div className="rounded-xl border bg-card/60 p-4 shadow-sm">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Signal quality
      </p>
      <div className="flex items-center gap-4">
        <RiskIcon
          className={cn(
            "size-10 shrink-0",
            riskLevel === "high" && "text-red-500",
            riskLevel === "low" && "text-emerald-500",
            riskLevel === "medium" && "text-amber-500",
          )}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Model confidence</span>
            <span className="font-mono font-semibold tabular-nums">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted/60">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                pct >= 70 ? "bg-emerald-500" : pct >= 45 ? "bg-amber-500" : "bg-red-500",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs capitalize text-muted-foreground">Risk profile: {riskLevel}</p>
        </div>
      </div>
    </div>
  )
}
