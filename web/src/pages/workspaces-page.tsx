import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { api, type WorkspaceWithRole } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function WorkspacesPage() {
  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.get<WorkspaceWithRole[]>("/api/v1/workspaces"),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Workspaces</h1>
          <p className="mt-2 text-muted-foreground">
            Isolated environments for trading data and automation
          </p>
        </div>
        <CreateWorkspaceDialog />
      </div>

      <WorkspaceTable workspaces={workspaces.data} />
    </div>
  )
}

function WorkspaceTable({
  workspaces,
}: {
  workspaces: WorkspaceWithRole[] | undefined
}) {
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Your role</TableHead>
            <TableHead className="w-[100px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {workspaces?.map((ws) => (
            <TableRow key={ws.id}>
              <TableCell className="font-medium">{ws.name}</TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">{ws.slug}</TableCell>
              <TableCell>
                <Badge variant="secondary">{ws.role || "—"}</Badge>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link to={`/workspaces/${ws.id}/members`} />}
                >
                  <Settings2 className="size-4" />
                  Members
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CreateWorkspaceDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const qc = useQueryClient()

  const create = useMutation({
    mutationFn: () => api.post("/api/v1/workspaces", { name, slug }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workspaces"] })
      toast.success("Workspace created")
      setOpen(false)
      setName("")
      setSlug("")
    },
    onError: () => toast.error("Could not create workspace"),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        New workspace
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!slug) {
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, "-")
                      .replace(/[^a-z0-9-]/g, ""),
                  )
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !name || !slug}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
