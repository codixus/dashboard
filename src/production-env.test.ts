import { describe, expect, it } from "vitest"
import { loadEnv } from "vite"

import { resolveDashboardBrand } from "@/lib/brand"

describe("OK or NOK? production profile", () => {
  const env = loadEnv("production", process.cwd(), "")

  it("targets the production OKNOK API and identity", () => {
    const brand = resolveDashboardBrand(env)

    expect(env.VITE_API_URL).toBe("https://api.codixus.com/oknok")
    expect(brand).toMatchObject({
      name: "OK or NOK?",
      shortName: "OK",
      title: "OK or NOK? · Growth Console",
      faviconUrl: "https://oknok.app/icon.png",
      colors: {
        background: "#F8F7FF",
        primary: "#9333EA",
        secondary: "#EC4899",
      },
    })
  })
})
