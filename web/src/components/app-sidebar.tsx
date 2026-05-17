import { Link, useLocation } from "react-router-dom"
import {
  Activity,
  BarChart3,
  Building2,
  LayoutDashboard,
  LineChart,
  LogOut,
  Newspaper,
  TrendingUp,
  Users,
} from "lucide-react"
import { useAuth } from "@/lib/auth"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

const nav = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Research", href: "/research", icon: LineChart },
  { title: "Data health", href: "/data-health", icon: Activity },
  { title: "News", href: "/news", icon: Newspaper },
  { title: "Market data", href: "/symbols", icon: TrendingUp },
  { title: "Features", href: "/features", icon: BarChart3 },
  { title: "Workspaces", href: "/workspaces", icon: Building2 },
]

const adminNav = [{ title: "Users", href: "/users", icon: Users }]

export function AppSidebar() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (user?.email?.slice(0, 2).toUpperCase() ?? "?")

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        <BrandHeader />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link to={item.href} />}
                    isActive={pathname === item.href}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {user?.platformRole === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link to={item.href} />}
                      isActive={pathname.startsWith(item.href)}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <UserMeta user={user} />
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto shrink-0"
            onClick={() => void logout()}
          >
            <LogOut className="size-4" />
            <span className="sr-only">Log out</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

function BrandHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <span className="text-sm font-bold tracking-tight">TA</span>
      </div>
      <div>
        <p className="text-sm font-semibold leading-none">Trading AI</p>
        <p className="mt-1 text-xs text-muted-foreground">Control plane</p>
      </div>
    </div>
  )
}

function UserMeta({
  user,
}: {
  user: ReturnType<typeof useAuth>["user"]
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{user?.name || user?.email}</p>
      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
    </div>
  )
}
