import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  api,
  type User,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@/lib/api"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function WorkspaceMembersPage() {
  const { id = "" } = useParams()
  const workspace = useQuery({
    queryKey: ["workspace", id],
    queryFn: () => api.get<Workspace>(`/api/v1/workspaces/${id}`),
    enabled: Boolean(id),
  })
  const members = useQuery({
    queryKey: ["workspace-members", id],
    queryFn: () => api.get<WorkspaceMember[]>(`/api/v1/workspaces/${id}/members`),
    enabled: Boolean(id),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link to="/workspaces" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            {workspace.data?.name ?? "Workspace"} members
          </h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            {workspace.data?.slug}
          </p>
        </div>
        <AddMemberDialog workspaceId={id} />
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.data?.map((m) => (
              <MemberRow key={m.userId} workspaceId={id} member={m} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function MemberRow({
  workspaceId,
  member,
}: {
  workspaceId: string
  member: WorkspaceMember
}) {
  const qc = useQueryClient()
  const remove = useMutation({
    mutationFn: () =>
      api.delete(`/api/v1/workspaces/${workspaceId}/members/${member.userId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workspace-members", workspaceId] })
      toast.success("Member removed")
    },
    onError: () => toast.error("Could not remove member"),
  })

  return (
    <TableRow>
      <TableCell className="font-medium">{member.user?.name || "—"}</TableCell>
      <TableCell>{member.user?.email}</TableCell>
      <TableCell>
        <Badge variant="secondary">{member.role}</Badge>
      </TableCell>
      <TableCell>
        {member.role !== "owner" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

function AddMemberDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState("")
  const [role, setRole] = useState<WorkspaceRole>("member")
  const qc = useQueryClient()

  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/api/v1/users/lookup"),
    enabled: open,
  })

  const add = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/workspaces/${workspaceId}/members`, { userId, role }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workspace-members", workspaceId] })
      toast.success("Member added")
      setOpen(false)
      setUserId("")
      setRole("member")
    },
    onError: () => toast.error("Could not add member"),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        Add member
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add workspace member</DialogTitle>
        </DialogHeader>
        <AddMemberForm
          userId={userId}
          setUserId={setUserId}
          role={role}
          setRole={setRole}
          users={users.data}
        />
        <DialogFooter>
          <Button onClick={() => add.mutate()} disabled={add.isPending || !userId}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddMemberForm({
  userId,
  setUserId,
  role,
  setRole,
  users,
}: {
  userId: string
  setUserId: (v: string) => void
  role: WorkspaceRole
  setRole: (r: WorkspaceRole) => void
  users: User[] | undefined
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>User</Label>
        <Select value={userId} onValueChange={(v) => setUserId(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="Select user" />
          </SelectTrigger>
          <SelectContent>
            {users?.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Workspace role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as WorkspaceRole)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
