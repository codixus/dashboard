import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router"
import {
  DatabaseIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  SendIcon,
} from "lucide-react"
import { useState } from "react"

import { getApiOrigin } from "@/lib/api"
import { clearAdminToken } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboardIcon, end: true },
  { to: "/collections", label: "Collections", icon: DatabaseIcon, end: false },
  { to: "/push", label: "Push", icon: SendIcon, end: true },
] as const

function crumbLabel(pathname: string, collectionName?: string): string {
  if (pathname === "/") {
    return "Overview"
  }
  if (pathname === "/push") {
    return "Push"
  }
  if (pathname === "/collections") {
    return "Collections"
  }
  if (pathname.startsWith("/collections/") && collectionName) {
    return collectionName
  }
  return "Overview"
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { name: collectionName } = useParams()
  const apiOrigin = getApiOrigin()
  const [openByDefault] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 1024
  )
  const pageLabel = crumbLabel(location.pathname, collectionName)
  const collectionCrumb = Boolean(
    collectionName && location.pathname.startsWith("/collections/")
  )

  function signOut() {
    clearAdminToken()
    navigate("/login", { replace: true })
  }

  return (
    <SidebarProvider defaultOpen={openByDefault} className="w-full min-w-0">
      <Sidebar collapsible="icon">
        <nav aria-label="Console" className="flex min-h-0 w-full flex-1 flex-col">
          <SidebarHeader>
            <Link
              to="/"
              className="flex h-9 items-center gap-2 px-2 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-colors hover:bg-sidebar-accent focus-visible:ring-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
            >
              <span className="flex size-6 shrink-0 items-center justify-center bg-primary font-mono text-[10px] font-medium text-primary-foreground">
                Cx
              </span>
              <span className="truncate text-sm font-medium group-data-[collapsible=icon]:sr-only">
                Codixus
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV.map((item) => {
                    const isActive = item.end
                      ? location.pathname === item.to
                      : location.pathname === item.to ||
                        location.pathname.startsWith(`${item.to}/`)
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.label}
                          className="data-active:border-l-2 data-active:border-l-primary"
                        >
                          <Link to={item.to} aria-current={isActive ? "page" : undefined}>
                            <item.icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="truncate px-2 py-1 font-mono text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
              {apiOrigin}
            </div>
          </SidebarFooter>
        </nav>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger />
          <div aria-hidden className="mr-1 h-4 w-px bg-border" />
          <Breadcrumb className="min-w-0">
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:inline-flex">
                <Link
                  to="/"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Console
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:inline-flex" />
              {collectionCrumb ? (
                <>
                  <BreadcrumbItem className="hidden sm:inline-flex">
                    <Link
                      to="/collections"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Collections
                    </Link>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:inline-flex" />
                </>
              ) : null}
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage>{pageLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <span className="hidden max-w-48 truncate font-mono text-[10px] text-muted-foreground md:inline">
              {apiOrigin}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOutIcon data-icon="inline-start" />
              Sign out
            </Button>
          </div>
        </header>
        <div className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
