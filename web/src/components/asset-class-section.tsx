import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AssetClassKey } from "@/lib/asset-class"

export function AssetClassSection({
  title,
  description,
  assetClass,
  count,
  children,
}: {
  title: string
  description?: string
  assetClass: AssetClassKey
  count: number
  children: ReactNode
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wide">
            {assetClass}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {count} symbol{count === 1 ? "" : "s"}
          </span>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  )
}
