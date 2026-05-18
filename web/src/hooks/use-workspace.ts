import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { api, type WorkspaceWithRole } from "@/lib/api"

export const WORKSPACE_STORAGE_KEY = "active-workspace-id"
const LEGACY_WORKSPACE_KEY = "research-workspace-id"

export function useWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<string>(() => {
    const stored =
      localStorage.getItem(WORKSPACE_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_WORKSPACE_KEY)
    return stored ?? ""
  })

  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.get<WorkspaceWithRole[]>("/api/v1/workspaces"),
  })

  useEffect(() => {
    if (!workspaceId && workspaces.data?.length) {
      const id = workspaces.data[0].id
      setWorkspaceId(id)
      localStorage.setItem(WORKSPACE_STORAGE_KEY, id)
    }
  }, [workspaceId, workspaces.data])

  function selectWorkspace(id: string) {
    setWorkspaceId(id)
    localStorage.setItem(WORKSPACE_STORAGE_KEY, id)
  }

  const activeWorkspace = workspaces.data?.find((ws) => ws.id === workspaceId)

  return {
    workspaceId,
    selectWorkspace,
    workspaces: workspaces.data ?? [],
    activeWorkspace,
    isLoading: workspaces.isLoading,
  }
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}
