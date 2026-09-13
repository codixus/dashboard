import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"

import { GrowthBars } from "@/components/page"

it("gives percentage-height bars a full-height containing block", () => {
  render(
    <GrowthBars
      label="Users / 14d"
      daily={[
        { day: "2026-09-12", count: 0 },
        { day: "2026-09-13", count: 2 },
      ]}
    />
  )

  const visibleBar = screen.getByTitle("2026-09-13: 2")
  expect(visibleBar).toHaveStyle({ height: "100%" })
  expect(visibleBar.parentElement).toHaveClass("h-full")
})
