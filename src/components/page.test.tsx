import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it } from "vitest"

import { GrowthLineChart } from "@/components/page"

it("shows the exact date and value when a line-chart point is hovered", async () => {
  const user = userEvent.setup()
  render(
    <GrowthLineChart
      label="Users / 14d"
      daily={[
        { day: "2026-09-12", count: 0 },
        { day: "2026-09-13", count: 2 },
      ]}
    />
  )

  expect(screen.getByTestId("growth-line")).toBeInTheDocument()
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

  await user.hover(screen.getByRole("button", { name: "2026-09-13: 2" }))

  expect(screen.getByRole("tooltip")).toHaveTextContent("2026-09-13 · 2")
})

it("exposes line-chart values on keyboard focus", async () => {
  const user = userEvent.setup()
  render(
    <GrowthLineChart
      label="Devices / 14d"
      daily={[
        { day: "2026-09-12", count: 0 },
        { day: "2026-09-13", count: 0 },
      ]}
    />
  )

  await user.tab()

  expect(screen.getByRole("button", { name: "2026-09-12: 0" })).toHaveFocus()
  expect(screen.getByRole("tooltip")).toHaveTextContent("2026-09-12 · 0")
})
