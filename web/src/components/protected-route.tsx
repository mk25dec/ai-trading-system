import { Navigate, Outlet } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth"

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <LoadingScreen />
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function LoadingScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )
}
