import { CircleHelp } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { TableHead } from "@/components/ui/table"
import type { ColumnGuide } from "@/lib/column-guides"
import { cn } from "@/lib/utils"

export function TableColumnHeader({
  guide,
  className,
  align = "left",
}: {
  guide: ColumnGuide
  className?: string
  align?: "left" | "right" | "center"
}) {
  return (
    <TableHead
      className={cn(
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-sm border-b border-dotted border-muted-foreground/50 text-left font-medium outline-none hover:border-foreground/60 focus-visible:ring-2 focus-visible:ring-ring",
                align === "right" && "ml-auto flex-row-reverse text-right",
                align === "center" && "mx-auto",
              )}
              aria-label={`${guide.title}: what this column means`}
            >
              <span className="truncate">{guide.title}</span>
              <CircleHelp className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          }
        />
        <TooltipContent
          side="top"
          className="max-w-xs space-y-2 text-xs leading-relaxed"
        >
          <p className="font-semibold text-background">{guide.title}</p>
          <p>{guide.meaning}</p>
          <div className="space-y-1 border-t border-background/20 pt-2">
            <p>
              <span className="font-semibold text-emerald-300">Good / positive: </span>
              {guide.positive}
            </p>
            <p>
              <span className="font-semibold text-red-300">Bearish / negative: </span>
              {guide.negative}
            </p>
            <p>
              <span className="font-semibold text-slate-300">Neutral / zero: </span>
              {guide.neutral}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TableHead>
  )
}
