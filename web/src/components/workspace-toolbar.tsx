import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDateTime } from "@/hooks/use-workspace"
import { cn } from "@/lib/utils"
import type { WorkspaceWithRole } from "@/lib/api"

type WorkspaceToolbarProps = {
  workspaceId: string
  workspaces: WorkspaceWithRole[]
  onWorkspaceChange: (id: string) => void
  onRefresh: () => void
  isRefreshing?: boolean
  lastRefreshedAt?: string | null
  refreshDisabled?: boolean
}

export function WorkspaceToolbar({
  workspaceId,
  workspaces,
  onWorkspaceChange,
  onRefresh,
  isRefreshing = false,
  lastRefreshedAt,
  refreshDisabled = false,
}: WorkspaceToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {workspaces.length > 1 && (
        <Select
          value={workspaceId}
          onValueChange={(v) => {
            if (v) onWorkspaceChange(v)
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Workspace" />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={ws.id}>
                {ws.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button
        variant="outline"
        disabled={!workspaceId || refreshDisabled || isRefreshing}
        onClick={onRefresh}
      >
        <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
        Get latest data
      </Button>
      {lastRefreshedAt && (
        <p className="text-xs text-muted-foreground">
          Last refreshed {formatDateTime(lastRefreshedAt)}
        </p>
      )}
    </div>
  )
}

