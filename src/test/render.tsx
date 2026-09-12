import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router"

import { AppProviders } from "@/App"
import { AppRoutes } from "@/routes"

export function renderApp(route = "/") {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>
  )
}
