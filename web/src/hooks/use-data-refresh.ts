import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { pipelineApi } from "@/lib/pipeline-api"

export function useDataRefresh(workspaceId: string) {
  const queryClient = useQueryClient()
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)

  const refresh = useMutation({
    mutationFn: () => pipelineApi.refreshResearch(workspaceId),
    onSuccess: (result) => {
      const now = new Date().toISOString()
      setLastRefreshedAt(now)

      void queryClient.invalidateQueries({ queryKey: ["research-board", workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ["news-raw-feed", workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ["news-backlog", workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ["news-articles", workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ["symbols", workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ["snapshots", workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ["workspace-signals", workspaceId] })

      const parts = [
        `${result.symbolsProcessed} symbols`,
        `${result.candlesFetched} fetched`,
        `${result.candlesInserted} candles stored`,
        `${result.sentimentProcessed} FinBERT runs`,
        `${result.signalsGenerated} signals`,
      ]
      if (result.errors?.length) {
        toast.error(result.errors.join("; "))
      } else if (result.symbolsProcessed === 0) {
        toast.error("Watchlist is empty — add symbols on Research first")
      } else if (result.candlesFetched === 0) {
        toast.error("No market bars returned from Alpaca — check API keys and ALPACA_DATA_FEED=iex")
      } else {
        toast.success(`Refresh complete: ${parts.join(" · ")}`)
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return { refresh, lastRefreshedAt }
}
