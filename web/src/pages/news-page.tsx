import { useQuery } from "@tanstack/react-query"
import { WorkspaceToolbar } from "@/components/workspace-toolbar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useDataRefresh } from "@/hooks/use-data-refresh"
import { formatDateTime, useWorkspace } from "@/hooks/use-workspace"
import { pipelineApi } from "@/lib/pipeline-api"

export function NewsPage() {
  const { workspaceId, selectWorkspace, workspaces, activeWorkspace } = useWorkspace()
  const { refresh, lastRefreshedAt } = useDataRefresh(workspaceId)

  const backlog = useQuery({
    queryKey: ["news-backlog", workspaceId],
    queryFn: () => pipelineApi.newsBacklog(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: 60_000,
  })
  const articles = useQuery({
    queryKey: ["news-articles", workspaceId],
    queryFn: () => pipelineApi.newsArticles(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: 60_000,
  })

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">News</h1>
          <p className="mt-2 text-muted-foreground">
            Backlog and processed articles for{" "}
            {activeWorkspace ? (
              <span className="font-medium text-foreground">{activeWorkspace.name}</span>
            ) : (
              "your workspace"
            )}{" "}
            watchlist only
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

      {!workspaceId && (
        <p className="text-sm text-muted-foreground">Select a workspace to load watchlist news.</p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Backlog</h2>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Pulled</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Guesses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(backlog.data ?? []).slice(0, 40).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.source}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(item.publishedAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(item.discoveredAt)}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="line-clamp-2 hover:underline"
                      >
                        {item.title}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.status}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {(item.rawSymbolGuess ?? []).join(", ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {(backlog.data ?? []).length === 0 && workspaceId && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No backlog items for your watchlist symbols.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Articles + sentiment</h2>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Latest processed articles</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Published</TableHead>
                  <TableHead>Pulled</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Symbols</TableHead>
                  <TableHead>Sentiment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(articles.data ?? []).map((article) => (
                  <TableRow key={article.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(article.publishedAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(article.fetchedAt ?? article.discoveredAt)}
                    </TableCell>
                    <TableCell>{article.source}</TableCell>
                    <TableCell className="max-w-sm">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noreferrer"
                        className="line-clamp-2 hover:underline"
                      >
                        {article.title}
                      </a>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {(article.symbols ?? []).map((s) => s.symbol).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(article.sentiment ?? []).map((s) => (
                          <Badge
                            key={`${article.id}-${s.symbol}`}
                            variant={
                              s.sentimentLabel === "positive"
                                ? "default"
                                : s.sentimentLabel === "negative"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {s.symbol}: {s.sentimentLabel}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(articles.data ?? []).length === 0 && workspaceId && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No articles mapped to your watchlist yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
