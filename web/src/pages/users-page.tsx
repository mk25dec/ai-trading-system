import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { api, type PlatformRole, type User } from "@/lib/api"
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

export function UsersPage() {
  const qc = useQueryClient()
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/api/v1/users"),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/users/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] })
      toast.success("User removed")
    },
    onError: () => toast.error("Could not remove user"),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
          <p className="mt-2 text-muted-foreground">Platform accounts and roles</p>
        </div>
        <CreateUserDialog />
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data?.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name || "—"}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant={u.platformRole === "admin" ? "default" : "secondary"}>
                    {u.platformRole}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={u.active ? "outline" : "destructive"}>
                    {u.active ? "Active" : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove.mutate(u.id)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<PlatformRole>("user")
  const qc = useQueryClient()

  const create = useMutation({
    mutationFn: () =>
      api.post<User>("/api/v1/users", {
        email,
        name,
        password,
        platformRole: role,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] })
      toast.success("User created")
      setOpen(false)
      setEmail("")
      setName("")
      setPassword("")
      setRole("user")
    },
    onError: () => toast.error("Could not create user"),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        Add user
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New user</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
            />
          </div>
          <div className="space-y-2">
            <Label>Platform role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as PlatformRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !email || !password}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
