import { Navigate } from "react-router"

import { useAdminToken } from "@/lib/auth"
import { AppShell } from "@/components/app-shell"

export function RequireAuth() {
  const token = useAdminToken()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <AppShell />
}
