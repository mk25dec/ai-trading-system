import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Activity,
  Briefcase,
  Lightbulb,
  Radio,
  TrendingUp,
} from "lucide-react"
import { ConfidenceDonut } from "@/components/overview/confidence-donut"
import { NewsReviewList } from "@/components/overview/news-review-list"
import { OverviewKpiCard } from "@/components/overview/overview-kpi-card"
import { PerformanceOverviewChart } from "@/components/overview/performance-overview-chart"
import { PipelineHealthCard } from "@/components/overview/pipeline-health-card"
import { RecentSignalsList } from "@/components/overview/recent-signals-list"
import { TopOpportunitiesTable } from "@/components/overview/top-opportunities-table"
import { WorkspaceToolbar } from "@/components/workspace-toolbar"
import { useDataRefresh } from "@/hooks/use-data-refresh"
import { useWorkspace } from "@/hooks/use-workspace"
import { useAuth } from "@/lib/auth"
import { sortResearchRows } from "@/lib/feature-metrics"
import {
  buildPerformanceSeries,
  buildPipelineHealth,
  confidenceBuckets,
  dateRangeLabel,
  formatCurrency,
  formatPctChange,
  getTimeGreeting,
  summarizeOverviewKpis,
  type PerformanceRange,
} from "@/lib/overview-metrics"
import { pipelineApi } from "@/lib/pipeline-api"

export function OverviewPage() {
  const { user } = useAuth()
  const { workspaceId, selectWorkspace, workspaces, activeWorkspace } = useWorkspace()
  const { refresh, lastRefreshedAt } = useDataRefresh(workspaceId)
  const [perfRange, setPerfRange] = useState<PerformanceRange>("7D")

  const board = useQuery({
    queryKey: ["research-board", workspaceId],
    queryFn: () => pipelineApi.researchBoard(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: 120_000,
  })

  const signals = useQuery({
    queryKey: ["workspace-signals", workspaceId],
    queryFn: () => pipelineApi.workspaceSignals(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: 120_000,
  })

  const runs = useQuery({
    queryKey: ["workflow-runs"],
    queryFn: pipelineApi.workflowRuns,
    refetchInterval: 60_000,
  })

  const backlog = useQuery({
    queryKey: ["news-backlog", workspaceId],
    queryFn: () => pipelineApi.newsBacklog(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: 60_000,
  })

  const sortedRows = useMemo(
    () => sortResearchRows(board.data?.rows ?? []),
    [board.data?.rows],
  )

  const kpis = useMemo(
    () => summarizeOverviewKpis(sortedRows, signals.data ?? []),
    [sortedRows, signals.data],
  )

  const performance = useMemo(
    () => buildPerformanceSeries(sortedRows, perfRange),
    [sortedRows, perfRange],
  )

  const pipeline = useMemo(() => buildPipelineHealth(runs.data ?? []), [runs.data])
  const buckets = useMemo(() => confidenceBuckets(signals.data ?? []), [signals.data])

  const displayName = user?.name?.split(" ")[0] ?? user?.email ?? "there"
  const signalsHref = workspaceId ? `/workspaces/${workspaceId}/signals` : "/research"
  const returnTone =
    kpis.avgReturn != null ? (kpis.avgReturn >= 0 ? "positive" : "negative") : undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {workspaces.length <= 1 && activeWorkspace && (
            <p className="mb-1 text-sm font-medium text-muted-foreground">
              {activeWorkspace.name}
            </p>
          )}
        </div>
        <WorkspaceToolbar
          workspaceId={workspaceId}
          workspaces={workspaces}
          onWorkspaceChange={selectWorkspace}
          onRefresh={() => refresh.mutate()}
          isRefreshing={refresh.isPending}
          lastRefreshedAt={lastRefreshedAt}
          dateRangeLabel={dateRangeLabel(7)}
          refreshLabel="Refresh data"
        />
      </div>

      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {getTimeGreeting()}, {displayName}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Here&apos;s what&apos;s happening with your trading system today.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <OverviewKpiCard
          label="Watchlist notional"
          value={kpis.notional > 0 ? formatCurrency(kpis.notional) : "—"}
          change={kpis.avgReturn != null ? formatPctChange(kpis.avgReturn) : undefined}
          changeTone={returnTone}
          hint="Sum of last closes · not a portfolio balance"
        />
        <OverviewKpiCard
          label="Avg return (7D)"
          value={kpis.avgReturn != null ? formatPctChange(kpis.avgReturn) : "—"}
          change={
            kpis.notional > 0 && kpis.avgReturn != null
              ? `${kpis.returnUsd >= 0 ? "+" : "-"}${formatCurrency(Math.abs(kpis.returnUsd))}`
              : undefined
          }
          changeTone={returnTone}
          hint="Mean 5d change across watchlist"
          icon={TrendingUp}
          iconClassName="bg-emerald-500/15 text-emerald-600"
        />
        <OverviewKpiCard
          label="Buy bias share"
          value={kpis.winRate != null ? `${kpis.winRate.toFixed(1)}%` : "—"}
          hint={
            kpis.buyCount + kpis.sellCount > 0
              ? `${kpis.buyCount} buy · ${kpis.sellCount} sell signals`
              : "No actionable signals"
          }
          icon={Activity}
          iconClassName="bg-blue-500/15 text-blue-600"
        />
        <OverviewKpiCard
          label="Actionable signals"
          value={String(kpis.buyCount + kpis.sellCount)}
          hint={`${kpis.buyCount} buy · ${kpis.sellCount} sell`}
          icon={Briefcase}
          iconClassName="bg-violet-500/15 text-violet-600"
        />
        <OverviewKpiCard
          label="Watch / conflicts"
          value={String(kpis.watchCount + kpis.conflictCount)}
          hint={
            kpis.conflictCount > 0
              ? `${kpis.conflictCount} need review`
              : `${kpis.watchCount} on watch`
          }
          icon={Lightbulb}
          iconClassName="bg-amber-500/15 text-amber-600"
        />
        <OverviewKpiCard
          label="New signals today"
          value={String(kpis.signalsToday)}
          hint={
            kpis.highConvictionToday > 0
              ? `${kpis.highConvictionToday} high conviction`
              : "Generated today"
          }
          icon={Radio}
          iconClassName="bg-emerald-500/15 text-emerald-600"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PerformanceOverviewChart
          labels={performance.labels}
          strategy={performance.strategy}
          benchmark={performance.benchmark}
          range={perfRange}
          onRangeChange={setPerfRange}
        />
        <PipelineHealthCard pipelines={pipeline.pipelines} operational={pipeline.operational} />
        <ConfidenceDonut
          high={buckets.high}
          medium={buckets.medium}
          low={buckets.low}
          total={buckets.total}
          signalsHref={signalsHref}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TopOpportunitiesTable rows={sortedRows} />
        <RecentSignalsList signals={signals.data ?? []} signalsHref={signalsHref} />
        <NewsReviewList items={backlog.data ?? []} />
      </div>
    </div>
  )
}
