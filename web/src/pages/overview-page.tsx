import { useQuery } from "@tanstack/react-query"
import { Building2, Users } from "lucide-react"
import { api, type WorkspaceWithRole } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function OverviewPage() {
  const { user } = useAuth()
  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.get<WorkspaceWithRole[]>("/api/v1/workspaces"),
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Hello{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Foundation for your trading control plane — workspaces and access first.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Workspaces"
          value={workspaces.data?.length ?? "—"}
          icon={Building2}
          hint="Teams and environments you can access"
        />
        {user?.platformRole === "admin" && (
          <StatCard
            title="Your role"
            value="Platform admin"
            icon={Users}
            hint="Manage users and all workspaces"
          />
        )}
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string
  value: string | number
  icon: typeof Building2
  hint: string
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-primary" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}
