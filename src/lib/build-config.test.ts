import { describe, expect, it, vi } from "vitest"

import {
  buildDashboardConfigUrl,
  loadDashboardBuildEnv,
  parseDashboardConfig,
  requireAppSlug,
  toViteEnv,
} from "@/lib/build-config"

const validConfig = () => ({
  schemaVersion: 1,
  appSlug: "sample-app",
  apiUrl: "https://api.example.com/sample-app",
  brand: {
    name: "Sample Console",
    shortName: "SC",
    title: "Sample Console | Growth",
    description: "Users, journeys, and delivery for the sample app.",
    faviconUrl: "https://sample.example.com/icon.png",
    colors: {
      background: "#F7F8FA",
      surface: "#FFFFFF",
      foreground: "#172033",
      primary: "#3157D5",
      primaryForeground: "#FFFFFF",
      secondary: "#6B4EFF",
      muted: "#EEF1F7",
      mutedForeground: "#657089",
      border: "#D8DEEA",
      sidebar: "#F1F4F9",
      sidebarAccent: "#E4EAF5",
      chart3: "#0D9488",
      chart4: "#D97706",
      chart5: "#DB2777",
    },
  },
})

const successPayload = () => ({ success: true, data: validConfig() })

describe("dashboard build config", () => {
  it("R7: maps a complete semantic config to the explicit Vite env contract", () => {
    expect(
      toViteEnv(parseDashboardConfig(successPayload(), "sample-app"))
    ).toEqual({
      VITE_API_URL: "https://api.example.com/sample-app",
      VITE_DASHBOARD_NAME: "Sample Console",
      VITE_DASHBOARD_SHORT_NAME: "SC",
      VITE_DASHBOARD_TITLE: "Sample Console | Growth",
      VITE_DASHBOARD_DESCRIPTION:
        "Users, journeys, and delivery for the sample app.",
      VITE_DASHBOARD_FAVICON_URL: "https://sample.example.com/icon.png",
      VITE_DASHBOARD_BACKGROUND_COLOR: "#F7F8FA",
      VITE_DASHBOARD_SURFACE_COLOR: "#FFFFFF",
      VITE_DASHBOARD_FOREGROUND_COLOR: "#172033",
      VITE_DASHBOARD_PRIMARY_COLOR: "#3157D5",
      VITE_DASHBOARD_PRIMARY_FOREGROUND_COLOR: "#FFFFFF",
      VITE_DASHBOARD_SECONDARY_COLOR: "#6B4EFF",
      VITE_DASHBOARD_MUTED_COLOR: "#EEF1F7",
      VITE_DASHBOARD_MUTED_FOREGROUND_COLOR: "#657089",
      VITE_DASHBOARD_BORDER_COLOR: "#D8DEEA",
      VITE_DASHBOARD_SIDEBAR_COLOR: "#F1F4F9",
      VITE_DASHBOARD_SIDEBAR_ACCENT_COLOR: "#E4EAF5",
      VITE_DASHBOARD_CHART_3_COLOR: "#0D9488",
      VITE_DASHBOARD_CHART_4_COLOR: "#D97706",
      VITE_DASHBOARD_CHART_5_COLOR: "#DB2777",
    })
  })

  it("R7/R8: requires the lowercase appslug build variable", () => {
    expect(() => requireAppSlug(undefined)).toThrow(/appslug is required/)
    expect(() => requireAppSlug("   ")).toThrow(/appslug is required/)
  })

  it.each(["Sample-App", "sample_app", "-sample", "sample-", "a".repeat(65)])(
    "R8: rejects malformed appslug %s",
    (slug) => {
      expect(() => requireAppSlug(slug)).toThrow(/invalid appslug/)
    }
  )

  it("R9: builds a normalized URL for the optional local base override", () => {
    expect(
      buildDashboardConfigUrl(
        "sample-app",
        "http://127.0.0.1:43123/api/v1/dashboard-configs/"
      )
    ).toBe("http://127.0.0.1:43123/api/v1/dashboard-configs/sample-app")
  })

  it("R8: rejects a response with the wrong schema version", () => {
    const payload = successPayload()
    payload.data.schemaVersion = 2

    expect(() => parseDashboardConfig(payload, "sample-app")).toThrow(
      /schemaVersion/
    )
  })

  it("R8: rejects a response for a different app slug", () => {
    const payload = successPayload()
    payload.data.appSlug = "another-app"

    expect(() => parseDashboardConfig(payload, "sample-app")).toThrow(
      /appSlug mismatch/
    )
  })

  it("R8: rejects incomplete branding instead of falling back", () => {
    const payload = successPayload()
    delete (
      payload.data.brand.colors as Partial<typeof payload.data.brand.colors>
    ).chart5

    expect(() => parseDashboardConfig(payload, "sample-app")).toThrow(
      /brand.colors.chart5/
    )
  })

  it("R8: rejects unsafe API, favicon, and color values", () => {
    const unsafeApi = successPayload()
    unsafeApi.data.apiUrl = "javascript:alert(1)"
    expect(() => parseDashboardConfig(unsafeApi, "sample-app")).toThrow(
      /apiUrl/
    )

    const unsafeFavicon = successPayload()
    unsafeFavicon.data.brand.faviconUrl = "data:text/html,bad"
    expect(() => parseDashboardConfig(unsafeFavicon, "sample-app")).toThrow(
      /brand.faviconUrl/
    )

    const unsafeColor = successPayload()
    unsafeColor.data.brand.colors.primary = "red;display:none"
    expect(() => parseDashboardConfig(unsafeColor, "sample-app")).toThrow(
      /brand.colors.primary/
    )
  })

  it("R7: fetches the requested app and returns its Vite env", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(successPayload(), { status: 200 })
    )

    const env = await loadDashboardBuildEnv({
      appSlug: "sample-app",
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.codixus.com/api/v1/dashboard-configs/sample-app",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(env.VITE_DASHBOARD_NAME).toBe("Sample Console")
  })

  it("R8: reports non-success HTTP responses without parsing them", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { success: false, error: "DASHBOARD_CONFIG_NOT_FOUND" },
        { status: 404 }
      )
    )

    await expect(
      loadDashboardBuildEnv({ appSlug: "sample-app", fetchImpl })
    ).rejects.toThrow(/HTTP 404/)
  })

  it("R8: reports malformed JSON and transport failures clearly", async () => {
    const malformed = vi.fn(
      async () =>
        new Response("not-json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    )
    await expect(
      loadDashboardBuildEnv({ appSlug: "sample-app", fetchImpl: malformed })
    ).rejects.toThrow(/valid JSON/)

    const offline = vi.fn(async () => {
      throw new Error("network offline")
    })
    await expect(
      loadDashboardBuildEnv({ appSlug: "sample-app", fetchImpl: offline })
    ).rejects.toThrow(/network offline/)
  })

  it("R8: aborts a config request that exceeds the timeout", async () => {
    const hanging = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("timed out", "AbortError"))
          })
        })
    )

    await expect(
      loadDashboardBuildEnv({
        appSlug: "sample-app",
        fetchImpl: hanging,
        timeoutMs: 5,
      })
    ).rejects.toThrow(/timed out/)
  })
})
