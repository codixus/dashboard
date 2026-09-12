import { fireEvent, waitFor } from "@testing-library/react"
import { expect, it } from "vitest"

import { renderApp } from "@/test/render"

it("always stays light despite stored preference, system preference, and D shortcut", async () => {
  localStorage.setItem("theme", "dark")
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })

  renderApp("/login")

  await waitFor(() => {
    expect(document.documentElement).toHaveClass("light")
  })
  expect(document.documentElement).not.toHaveClass("dark")

  fireEvent.keyDown(window, { key: "d" })
  expect(document.documentElement).toHaveClass("light")
  expect(document.documentElement).not.toHaveClass("dark")
})
