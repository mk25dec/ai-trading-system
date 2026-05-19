import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { AssetClassSection } from "@/components/asset-class-section"
import { MarketDataTable } from "@/components/market-data-table"
import { WorkspaceToolbar } from "@/components/workspace-toolbar"
import { useDataRefresh } from "@/hooks/use-data-refresh"
import { useWorkspace } from "@/hooks/use-workspace"
import { ASSET_CLASS_LABELS, groupByAssetClass } from "@/lib/asset-class"
import { pipelineApi } from "@/lib/pipeline-api"

export function SymbolsPage() {
  const { workspaceId, selectWorkspace, workspaces, activeWorkspace } = useWorkspace()
  const { refresh, lastRefreshedAt } = useDataRefresh(workspaceId)

  const symbols = useQuery({
    queryKey: ["symbols", workspaceId],
    queryFn: () => pipelineApi.symbols(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: 120_000,
  })

  const sections = useMemo(
    () => groupByAssetClass(symbols.data ?? []),
    [symbols.data],
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Market data</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Watchlist quotes and technical fields for{" "}
            {activeWorkspace ? (
              <span className="font-medium text-foreground">{activeWorkspace.name}</span>
            ) : (
              "your workspace"
            )}
            . Data from Alpaca daily bars and computed features — grouped by asset class.
          </p>
        </div>
        <WorkspaceToolbar
          workspaceId={workspaceId}
          workspaces={workspaces}
          onWorkspaceChange={selectWorkspace}
          onRefresh={() => refresh.mutate()}
          isRefreshing={refresh.isPending}
          lastRefreshedAt={lastRefreshedAt}
        />
      </header>

      {sections.length === 0 && workspaceId && !symbols.isLoading && (
        <p className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          No watchlist symbols — add symbols on Research, then click Get latest data.
        </p>
      )}

      {sections.map((section) => (
        <AssetClassSection
          key={section.key}
          title={section.label}
          assetClass={section.key}
          count={section.items.length}
          description={`${ASSET_CLASS_LABELS[section.key]} — OHLC, returns, RSI, 52-week range, and bar freshness.`}
        >
          <MarketDataTable rows={section.items} />
        </AssetClassSection>
      ))}
    </div>
  )
}
