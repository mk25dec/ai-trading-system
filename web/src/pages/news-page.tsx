import { useQuery } from "@tanstack/react-query"
import { pipelineApi } from "@/lib/pipeline-api"
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

export function NewsPage() {
  const backlog = useQuery({
    queryKey: ["news-backlog"],
    queryFn: () => pipelineApi.newsBacklog(),
    refetchInterval: 60_000,
  })
  const articles = useQuery({
    queryKey: ["news-articles"],
    queryFn: pipelineApi.newsArticles,
    refetchInterval: 60_000,
  })

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">News</h1>
        <p className="mt-2 text-muted-foreground">
          Backlog ingestion, processed articles, symbol mapping, and sentiment
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Backlog</h2>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Guesses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(backlog.data ?? []).slice(0, 40).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.source}</TableCell>
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
                    <TableCell className="text-muted-foreground">
                      {item.publishedAt ? new Date(item.publishedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {(item.rawSymbolGuess ?? []).join(", ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
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
                  <TableHead>Source</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Symbols</TableHead>
                  <TableHead>Sentiment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(articles.data ?? []).map((article) => (
                  <TableRow key={article.id}>
                    <TableCell className="text-muted-foreground">
                      {article.publishedAt
                        ? new Date(article.publishedAt).toLocaleDateString()
                        : "—"}
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
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
