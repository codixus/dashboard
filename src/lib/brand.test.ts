import { afterEach, describe, expect, it } from "vitest"

import {
  applyDashboardBrand,
  DEFAULT_DASHBOARD_BRAND,
  resolveDashboardBrand,
} from "@/lib/brand"

describe("dashboard brand", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style")
    document.head
      .querySelectorAll('[data-dashboard-brand="true"]')
      .forEach((node) => node.remove())
  })

  it("falls back to a complete neutral dashboard identity", () => {
    expect(resolveDashboardBrand({})).toEqual(DEFAULT_DASHBOARD_BRAND)
  })

  it("resolves the complete OKNOK identity and palette from env", () => {
    const brand = resolveDashboardBrand({
      VITE_DASHBOARD_NAME: " OK or NOK? ",
      VITE_DASHBOARD_SHORT_NAME: "OK",
      VITE_DASHBOARD_TITLE: "OK or NOK? · Growth Console",
      VITE_DASHBOARD_DESCRIPTION: "Players and push delivery.",
      VITE_DASHBOARD_FAVICON_URL: "https://oknok.app/icon.png",
      VITE_DASHBOARD_BACKGROUND_COLOR: "#F8F7FF",
      VITE_DASHBOARD_SURFACE_COLOR: "#FFFFFF",
      VITE_DASHBOARD_FOREGROUND_COLOR: "#1F2937",
      VITE_DASHBOARD_PRIMARY_COLOR: "#9333EA",
      VITE_DASHBOARD_PRIMARY_FOREGROUND_COLOR: "#FFFFFF",
      VITE_DASHBOARD_SECONDARY_COLOR: "#EC4899",
      VITE_DASHBOARD_MUTED_COLOR: "#FAF5FF",
      VITE_DASHBOARD_MUTED_FOREGROUND_COLOR: "#6B7280",
      VITE_DASHBOARD_BORDER_COLOR: "#E5E7EB",
      VITE_DASHBOARD_SIDEBAR_COLOR: "#F9F7FE",
      VITE_DASHBOARD_SIDEBAR_ACCENT_COLOR: "#F3E8FF",
      VITE_DASHBOARD_CHART_3_COLOR: "#06B6D4",
      VITE_DASHBOARD_CHART_4_COLOR: "#10B981",
      VITE_DASHBOARD_CHART_5_COLOR: "#F59E0B",
    })

    expect(brand.name).toBe("OK or NOK?")
    expect(brand.shortName).toBe("OK")
    expect(brand.colors).toMatchObject({
      background: "#F8F7FF",
      primary: "#9333EA",
      secondary: "#EC4899",
      chart3: "#06B6D4",
    })
  })

  it("applies metadata, favicon, and CSS variables to the document", () => {
    const brand = resolveDashboardBrand({
      VITE_DASHBOARD_NAME: "OK or NOK?",
      VITE_DASHBOARD_TITLE: "OK or NOK? · Growth Console",
      VITE_DASHBOARD_DESCRIPTION: "Players and push delivery.",
      VITE_DASHBOARD_FAVICON_URL: "https://oknok.app/icon.png",
      VITE_DASHBOARD_PRIMARY_COLOR: "#9333EA",
    })

    applyDashboardBrand(brand, document)

    expect(document.title).toBe("OK or NOK? · Growth Console")
    expect(
      document.head.querySelector<HTMLMetaElement>(
        'meta[name="description"][data-dashboard-brand="true"]'
      )?.content
    ).toBe("Players and push delivery.")
    expect(
      document.head.querySelector<HTMLLinkElement>(
        'link[rel="icon"][data-dashboard-brand="true"]'
      )?.href
    ).toBe("https://oknok.app/icon.png")
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(
      "#9333EA"
    )
    expect(document.documentElement.style.getPropertyValue("--ring")).toBe(
      "#9333EA"
    )
  })

  it("rejects unsafe or invalid public values", () => {
    const brand = resolveDashboardBrand({
      VITE_DASHBOARD_NAME: " ",
      VITE_DASHBOARD_SHORT_NAME: "TOO-LONG",
      VITE_DASHBOARD_FAVICON_URL: "javascript:alert(1)",
      VITE_DASHBOARD_PRIMARY_COLOR: "red; color: transparent",
    })

    expect(brand.name).toBe(DEFAULT_DASHBOARD_BRAND.name)
    expect(brand.shortName).toBe(DEFAULT_DASHBOARD_BRAND.shortName)
    expect(brand.faviconUrl).toBe(DEFAULT_DASHBOARD_BRAND.faviconUrl)
    expect(brand.colors.primary).toBe(DEFAULT_DASHBOARD_BRAND.colors.primary)
  })
})
