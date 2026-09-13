export const DEFAULT_DASHBOARD_CONFIG_BASE_URL =
  "https://api.codixus.com/api/v1/dashboard-configs"

const APP_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/
const COLOR_PATTERN =
  /^(?:#[\da-f]{3,8}|(?:oklch|oklab|hsl|hsla|rgb|rgba)\([\d\s.,%/+*-]+\))$/i

const COLOR_KEYS = [
  "background",
  "surface",
  "foreground",
  "primary",
  "primaryForeground",
  "secondary",
  "muted",
  "mutedForeground",
  "border",
  "sidebar",
  "sidebarAccent",
  "chart3",
  "chart4",
  "chart5",
] as const

type DashboardColorKey = (typeof COLOR_KEYS)[number]

export type DashboardBuildConfig = {
  schemaVersion: 1
  appSlug: string
  apiUrl: string
  brand: {
    name: string
    shortName: string
    title: string
    description: string
    faviconUrl: string
    colors: Record<DashboardColorKey, string>
  }
}

export type DashboardViteEnv = {
  VITE_API_URL: string
  VITE_DASHBOARD_NAME: string
  VITE_DASHBOARD_SHORT_NAME: string
  VITE_DASHBOARD_TITLE: string
  VITE_DASHBOARD_DESCRIPTION: string
  VITE_DASHBOARD_FAVICON_URL: string
  VITE_DASHBOARD_BACKGROUND_COLOR: string
  VITE_DASHBOARD_SURFACE_COLOR: string
  VITE_DASHBOARD_FOREGROUND_COLOR: string
  VITE_DASHBOARD_PRIMARY_COLOR: string
  VITE_DASHBOARD_PRIMARY_FOREGROUND_COLOR: string
  VITE_DASHBOARD_SECONDARY_COLOR: string
  VITE_DASHBOARD_MUTED_COLOR: string
  VITE_DASHBOARD_MUTED_FOREGROUND_COLOR: string
  VITE_DASHBOARD_BORDER_COLOR: string
  VITE_DASHBOARD_SIDEBAR_COLOR: string
  VITE_DASHBOARD_SIDEBAR_ACCENT_COLOR: string
  VITE_DASHBOARD_CHART_3_COLOR: string
  VITE_DASHBOARD_CHART_4_COLOR: string
  VITE_DASHBOARD_CHART_5_COLOR: string
}

export type DashboardConfigFetch = (
  input: string,
  init: RequestInit
) => Promise<Response>

type LoadDashboardBuildEnvOptions = {
  appSlug: string | undefined
  baseUrl?: string
  fetchImpl?: DashboardConfigFetch
  timeoutMs?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function recordValue(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Dashboard config ${path} must be an object`)
  }
  return value
}

function stringValue(value: unknown, path: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new Error(`Dashboard config ${path} must be a string`)
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) {
    throw new Error(`Dashboard config ${path} is invalid`)
  }
  return trimmed
}

function httpUrlValue(value: unknown, path: string): string {
  const candidate = stringValue(value, path, 2_048)
  try {
    const url = new URL(candidate)
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    ) {
      throw new Error("unsafe URL")
    }
    return candidate
  } catch {
    throw new Error(`Dashboard config ${path} must be a safe HTTP URL`)
  }
}

function faviconValue(value: unknown): string {
  if (value === "") {
    return ""
  }
  if (typeof value === "string" && value.startsWith("/")) {
    return stringValue(value, "brand.faviconUrl", 2_048)
  }
  return httpUrlValue(value, "brand.faviconUrl")
}

function colorValue(value: unknown, path: string): string {
  const candidate = stringValue(value, path, 80)
  if (!COLOR_PATTERN.test(candidate)) {
    throw new Error(`Dashboard config ${path} is not a supported color`)
  }
  return candidate
}

export function requireAppSlug(value: string | undefined): string {
  if (value === undefined || !value.trim()) {
    throw new Error(
      "Dashboard build variable appslug is required (example: appslug=sample-app)"
    )
  }

  const appSlug = value.trim()
  if (!APP_SLUG_PATTERN.test(appSlug)) {
    throw new Error(`Dashboard build has invalid appslug: ${appSlug}`)
  }
  return appSlug
}

export function buildDashboardConfigUrl(
  appSlug: string,
  baseUrl = DEFAULT_DASHBOARD_CONFIG_BASE_URL
): string {
  const validatedBaseUrl = httpUrlValue(baseUrl, "base URL").replace(/\/+$/, "")
  return `${validatedBaseUrl}/${encodeURIComponent(appSlug)}`
}

export function parseDashboardConfig(
  payload: unknown,
  expectedAppSlug: string
): DashboardBuildConfig {
  const response = recordValue(payload, "response")
  if (response.success !== true) {
    throw new Error("Dashboard config response was not successful")
  }

  const data = recordValue(response.data, "data")
  if (data.schemaVersion !== 1) {
    throw new Error("Dashboard config schemaVersion must be 1")
  }

  const appSlug = stringValue(data.appSlug, "appSlug", 64)
  if (appSlug !== expectedAppSlug) {
    throw new Error(
      `Dashboard config appSlug mismatch: expected ${expectedAppSlug}, received ${appSlug}`
    )
  }

  const brand = recordValue(data.brand, "brand")
  const shortName = stringValue(brand.shortName, "brand.shortName", 4)
  if (!/^[\p{L}\p{N}?&+.-]{1,4}$/u.test(shortName)) {
    throw new Error("Dashboard config brand.shortName is invalid")
  }

  const rawColors = recordValue(brand.colors, "brand.colors")
  const colors = Object.fromEntries(
    COLOR_KEYS.map((key) => [
      key,
      colorValue(rawColors[key], `brand.colors.${key}`),
    ])
  ) as Record<DashboardColorKey, string>

  return {
    schemaVersion: 1,
    appSlug,
    apiUrl: httpUrlValue(data.apiUrl, "apiUrl"),
    brand: {
      name: stringValue(brand.name, "brand.name", 80),
      shortName,
      title: stringValue(brand.title, "brand.title", 120),
      description: stringValue(brand.description, "brand.description", 240),
      faviconUrl: faviconValue(brand.faviconUrl),
      colors,
    },
  }
}

export function toViteEnv(config: DashboardBuildConfig): DashboardViteEnv {
  return {
    VITE_API_URL: config.apiUrl,
    VITE_DASHBOARD_NAME: config.brand.name,
    VITE_DASHBOARD_SHORT_NAME: config.brand.shortName,
    VITE_DASHBOARD_TITLE: config.brand.title,
    VITE_DASHBOARD_DESCRIPTION: config.brand.description,
    VITE_DASHBOARD_FAVICON_URL: config.brand.faviconUrl,
    VITE_DASHBOARD_BACKGROUND_COLOR: config.brand.colors.background,
    VITE_DASHBOARD_SURFACE_COLOR: config.brand.colors.surface,
    VITE_DASHBOARD_FOREGROUND_COLOR: config.brand.colors.foreground,
    VITE_DASHBOARD_PRIMARY_COLOR: config.brand.colors.primary,
    VITE_DASHBOARD_PRIMARY_FOREGROUND_COLOR:
      config.brand.colors.primaryForeground,
    VITE_DASHBOARD_SECONDARY_COLOR: config.brand.colors.secondary,
    VITE_DASHBOARD_MUTED_COLOR: config.brand.colors.muted,
    VITE_DASHBOARD_MUTED_FOREGROUND_COLOR: config.brand.colors.mutedForeground,
    VITE_DASHBOARD_BORDER_COLOR: config.brand.colors.border,
    VITE_DASHBOARD_SIDEBAR_COLOR: config.brand.colors.sidebar,
    VITE_DASHBOARD_SIDEBAR_ACCENT_COLOR: config.brand.colors.sidebarAccent,
    VITE_DASHBOARD_CHART_3_COLOR: config.brand.colors.chart3,
    VITE_DASHBOARD_CHART_4_COLOR: config.brand.colors.chart4,
    VITE_DASHBOARD_CHART_5_COLOR: config.brand.colors.chart5,
  }
}

export async function loadDashboardBuildEnv({
  appSlug: rawAppSlug,
  baseUrl = DEFAULT_DASHBOARD_CONFIG_BASE_URL,
  fetchImpl = fetch,
  timeoutMs = 10_000,
}: LoadDashboardBuildEnvOptions): Promise<DashboardViteEnv> {
  const appSlug = requireAppSlug(rawAppSlug)
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Dashboard config timeoutMs must be a positive integer")
  }

  const url = buildDashboardConfigUrl(appSlug, baseUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new Error(
        `Dashboard config request timed out after ${timeoutMs}ms`,
        { cause }
      )
    }
    const detail = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Dashboard config request failed: ${detail}`, { cause })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new Error(
      `Dashboard config request failed with HTTP ${response.status}`
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch (cause) {
    throw new Error("Dashboard config response was not valid JSON", { cause })
  }

  return toViteEnv(parseDashboardConfig(payload, appSlug))
}
