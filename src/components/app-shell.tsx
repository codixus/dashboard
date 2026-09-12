import { Link, Outlet, useLocation, useNavigate } from "react-router"
import { DatabaseIcon, LogOutIcon, SendIcon } from "lucide-react"

import { getApiOrigin } from "@/lib/api"
import { clearAdminToken } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const apiOrigin = getApiOrigin()
  const collectionsActive =
    location.pathname === "/" || location.pathname.startsWith("/collections/")
  const pushActive = location.pathname === "/push"

  function signOut() {
    clearAdminToken()
    navigate("/login", { replace: true })
  }

  return (
    <SidebarProvider className="w-full min-w-0">
      <Sidebar>
        <SidebarHeader>
          <div className="flex flex-col gap-0.5 px-2 py-1.5">
            <span className="text-sm font-medium">Codixus</span>
            <span className="text-xs text-muted-foreground">Operator</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={collectionsActive}>
                    <Link to="/">
                      <DatabaseIcon />
                      <span>Collections</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pushActive}>
                    <Link to="/push">
                      <SendIcon />
                      <span>Push</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="truncate font-mono text-xs text-muted-foreground">
            {apiOrigin}
          </span>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOutIcon data-icon="inline-start" />
              Sign out
            </Button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
