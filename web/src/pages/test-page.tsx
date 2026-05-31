import { useMutation, useQuery } from "@tanstack/react-query"
import { CheckCircle2, FlaskConical, Loader2, XCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiError } from "@/lib/api"
import { formatProb, formatSentiment, probClass, sentimentClass } from "@/lib/feature-metrics"
import { pipelineApi, type FinbertAnalyzeResult } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

const SAMPLE_TEXT =
  "IBM shares rose after the company beat quarterly earnings expectations and raised full-year guidance."

export function TestPage() {
  const [text, setText] = useState(SAMPLE_TEXT)
  const [result, setResult] = useState<FinbertAnalyzeResult | null>(null)

  const health = useQuery({
    queryKey: ["finbert-health"],
    queryFn: () => pipelineApi.finbertHealth(),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const analyze = useMutation({
    mutationFn: () => pipelineApi.analyzeFinbert(text),
    onSuccess: (data) => {
      setResult(data)
      toast.success("FinBERT analysis complete")
    },
    onError: (e: Error) => {
      if (e instanceof ApiError && e.status === 503) {
        toast.error(e.message || "FinBERT model still loading — retry in a minute")
        return
      }
      toast.error(e.message)
    },
  })

  const healthOk = health.data?.status === "ok"
  const healthLabel = health.isLoading
    ? "Checking…"
    : health.isError
      ? "Unavailable"
      : healthOk
        ? "ok"
        : (health.data?.status ?? "unknown")

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <FlaskConical className="size-7 text-primary" />
          <h1 className="text-3xl font-semibold tracking-tight">TEST</h1>
          <HealthBadge ok={healthOk} loading={health.isLoading} label={healthLabel} />
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Same flow as the notebook: <code className="text-xs">GET /health</code> then{" "}
          <code className="text-xs">POST /analyze</code> with{" "}
          <code className="text-xs">{`{"text": "..."}`}</code>. The API proxies to{" "}
          <code className="text-xs">FINBERT_URL</code> or{" "}
          <code className="text-xs">FINBERT_API_URL</code> using{" "}
          <code className="text-xs">FINBERT_API_KEY</code>.
        </p>
        {health.isError && (
          <p className="mt-2 text-sm text-destructive">
            {health.error instanceof Error ? health.error.message : "FinBERT health check failed"}
          </p>
        )}
      </header>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>FinBERT analysis</CardTitle>
          <CardDescription>
            Enter financial news or headline text. Returns label, signed score (−1…+1), and softmax
            probabilities — matching the notebook <code className="text-xs">finbert_analyze()</code>{" "}
            response shape.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Input text</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              placeholder="Paste a headline or article excerpt…"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => void health.refetch()}
              variant="outline"
              disabled={health.isFetching}
            >
              {health.isFetching ? "Checking health…" : "Check health"}
            </Button>
            <Button
              type="button"
              onClick={() => analyze.mutate()}
              disabled={analyze.isPending || text.trim().length === 0 || health.isLoading}
            >
              {analyze.isPending ? "Analyzing…" : "Run FinBERT"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setText(SAMPLE_TEXT)}>
              Load sample
            </Button>
            <span className="text-xs text-muted-foreground">{text.trim().length} chars</span>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Result
              <SentimentBadge label={result.label} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard label="Label" value={result.label} />
              <MetricCard
                label="Signed score"
                value={formatSentiment(result.score)}
                className={sentimentClass(result.score)}
              />
              <MetricCard label="Confidence" value={formatProb(result.confidence)} />
            </div>

            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Softmax probabilities
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <ProbBar label="Positive" value={result.probPositive} tone="positive" />
                <ProbBar label="Negative" value={result.probNegative} tone="negative" />
                <ProbBar label="Neutral" value={result.probNeutral} tone="neutral" />
              </div>
            </div>

            {result.scores && Object.keys(result.scores).length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Raw scores (API response)
                </p>
                <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs">
                  {JSON.stringify(result.scores, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function HealthBadge({
  ok,
  loading,
  label,
}: {
  ok: boolean
  loading: boolean
  label: string
}) {
  if (loading) {
    return (
      <Badge variant="secondary" className="gap-1 capitalize">
        <Loader2 className="size-3 animate-spin" />
        {label}
      </Badge>
    )
  }
  return (
    <Badge variant={ok ? "default" : "destructive"} className="gap-1 capitalize">
      {ok ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
      health: {label}
    </Badge>
  )
}

function SentimentBadge({ label }: { label: string }) {
  const variant =
    label === "positive" ? "default" : label === "negative" ? "destructive" : "secondary"
  return (
    <Badge variant={variant} className="capitalize">
      {label}
    </Badge>
  )
}

function MetricCard({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-mono text-lg font-semibold tabular-nums capitalize", className)}>
        {value}
      </p>
    </div>
  )
}

function ProbBar({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "positive" | "negative" | "neutral"
}) {
  const pct = Math.round(value * 1000) / 10
  const barClass =
    tone === "positive"
      ? "bg-emerald-500"
      : tone === "negative"
        ? "bg-red-500"
        : "bg-muted-foreground/50"

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={cn("font-mono tabular-nums", probClass(value, tone === "negative"))}>
          {formatProb(value)}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", barClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
