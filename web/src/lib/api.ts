const baseURL = import.meta.env.VITE_API_URL ?? ""

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseURL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  if (res.status === 204) {
    return undefined as T
  }

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = typeof body?.error === "string" ? body.error : res.statusText
    throw new ApiError(msg, res.status)
  }
  return body as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
}

export type PlatformRole = "admin" | "user"
export type WorkspaceRole = "owner" | "admin" | "member"

export interface User {
  id: string
  email: string
  name: string
  platformRole: PlatformRole
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
}

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole
}

export interface WorkspaceMember {
  workspaceId: string
  userId: string
  role: WorkspaceRole
  createdAt: string
  user?: User
}
