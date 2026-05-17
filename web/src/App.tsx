import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppLayout } from "@/components/app-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { AuthProvider } from "@/lib/auth"
import { LoginPage } from "@/pages/login-page"
import { OverviewPage } from "@/pages/overview-page"
import { DataHealthPage } from "@/pages/data-health-page"
import { NewsPage } from "@/pages/news-page"
import { SymbolsPage } from "@/pages/symbols-page"
import { FeaturesPage } from "@/pages/features-page"
import { ResearchPage } from "@/pages/research-page"
import { WorkspaceSignalsPage } from "@/pages/workspace-signals-page"
import { UsersPage } from "@/pages/users-page"
import { WorkspacesPage } from "@/pages/workspaces-page"
import { WorkspaceMembersPage } from "@/pages/workspace-members-page"
import { useAuth } from "@/lib/auth"

const queryClient = new QueryClient()

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.platformRole !== "admin") {
    return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route index element={<OverviewPage />} />
                  <Route path="research" element={<ResearchPage />} />
                  <Route path="data-health" element={<DataHealthPage />} />
                  <Route path="news" element={<NewsPage />} />
                  <Route path="symbols" element={<SymbolsPage />} />
                  <Route path="features" element={<FeaturesPage />} />
                  <Route path="workspaces" element={<WorkspacesPage />} />
                  <Route path="workspaces/:id/members" element={<WorkspaceMembersPage />} />
                  <Route path="workspaces/:id/signals" element={<WorkspaceSignalsPage />} />
                  <Route
                    path="users"
                    element={
                      <AdminRoute>
                        <UsersPage />
                      </AdminRoute>
                    }
                  />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
