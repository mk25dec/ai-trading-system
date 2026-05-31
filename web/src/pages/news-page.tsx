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
import {
  pipelineApi,
  type ArticleSentiment,
  type ArticleWithDetails,
  type NewsBacklogItem,
} from "@/lib/pipeline-api"

function articleDisplaySymbols(article: ArticleWithDetails): string[] {
  return article.titleSymbols ?? []
}

function articleDisplaySentiment(article: ArticleWithDetails): ArticleSentiment[] {
  const symbols = articleDisplaySymbols(article)
  if (symbols.length === 0) return []
  return (article.sentiment ?? []).filter((s) => symbols.includes(s.symbol))
}

function sourceTickers(item: NewsBacklogItem): string {
  const fromGuess = (item.rawSymbolGuess ?? []).join(", ")
  if (fromGuess) return fromGuess
  const meta = item.metadata ?? {}
  const fromMeta = meta.symbols ?? meta.tickers ?? meta.relatedTickers
  if (Array.isArray(fromMeta)) {
    return fromMeta.map(String).join(", ")
  }
  return "—"
}

function BacklogFeedTable({
  items,
  emptyMessage,
  showWorkspaceNote,
}: {
  items: NewsBacklogItem[]
  emptyMessage: string
  showWorkspaceNote?: boolean
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source</TableHead>
          <TableHead>Published</TableHead>
          <TableHead>Ingested</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Source tickers</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-mono text-xs">{item.source}</TableCell>
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
            <TableCell className="font-mono text-xs">{sourceTickers(item)}</TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              {emptyMessage}
              {showWorkspaceNote ? " Select a workspace to load the feed." : ""}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

export function NewsPage() {
  const { workspaceId, selectWorkspace, workspaces, activeWorkspace } = useWorkspace()
  const { refresh, lastRefreshedAt } = useDataRefresh(workspaceId)

  const rawFeed = useQuery({
    queryKey: ["news-raw-feed", workspaceId],
    queryFn: () => pipelineApi.newsRawFeed(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: 60_000,
  })
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

  const rawItems = (rawFeed.data ?? []).slice(0, 50)
  const backlogItems = (backlog.data ?? []).slice(0, 40)
  const feedError =
    rawFeed.isError || backlog.isError || articles.isError
      ? [rawFeed.error, backlog.error, articles.error].find(Boolean)
      : null

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">News</h1>
          <p className="mt-2 text-muted-foreground">
            Ingest feed, watchlist backlog, and processed articles for{" "}
            {activeWorkspace ? (
              <span className="font-medium text-foreground">{activeWorkspace.name}</span>
            ) : (
              "your workspace"
            )}
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
        <p className="text-sm text-muted-foreground">Select a workspace to load news.</p>
      )}

      {feedError instanceof Error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Failed to load news: {feedError.message}. Restart the API if you just deployed new routes.
        </p>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Raw feed</h2>
          <p className="text-sm text-muted-foreground">
            Latest items from news sources (RSS and ingest), exactly as stored at pull time — not
            filtered by your watchlist.
          </p>
        </div>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Source ingest</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-4">
            <BacklogFeedTable
              items={rawItems}
              emptyMessage="No items in the raw feed yet."
              showWorkspaceNote={!workspaceId}
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Watchlist backlog</h2>
          <p className="text-sm text-muted-foreground">
            Backlog rows whose source-provided tickers match your active watchlist.
          </p>
        </div>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-0">
            <BacklogFeedTable
              items={backlogItems}
              emptyMessage="No backlog items for your watchlist symbols."
              showWorkspaceNote={!workspaceId}
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Articles + sentiment</h2>
          <p className="text-sm text-muted-foreground">
            Latest fetched articles; tickers and sentiment use source-provided symbols only.
          </p>
        </div>
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
                  <TableHead>Source tickers</TableHead>
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
                      {articleDisplaySymbols(article).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      {articleDisplaySentiment(article).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {articleDisplaySentiment(article).map((s) => (
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
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(articles.data ?? []).length === 0 && workspaceId && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No processed articles yet.
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
