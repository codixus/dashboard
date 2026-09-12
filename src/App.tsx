import type { ReactNode } from "react"
import { BrowserRouter } from "react-router"

import { ThemeProvider } from "@/components/theme-provider"
import { AppRoutes } from "@/routes"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        {children}
      </TooltipProvider>
    </ThemeProvider>
  )
}

export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  )
}

export default App
