type PublicEnv = Record<string, string | boolean | undefined>

export type DashboardBrandColors = {
  background: string
  surface: string
  foreground: string
  primary: string
  primaryForeground: string
  secondary: string
  muted: string
  mutedForeground: string
  border: string
  sidebar: string
  sidebarAccent: string
  chart3: string
  chart4: string
  chart5: string
}

export type DashboardBrand = {
  name: string
  shortName: string
  title: string
  description: string
  faviconUrl: string
  colors: DashboardBrandColors
}

export const DEFAULT_DASHBOARD_BRAND: DashboardBrand = {
  name: "Dashboard",
  shortName: "DB",
  title: "Operator Dashboard",
  description: "Users, devices, journeys, and push delivery for one API.",
  faviconUrl: "",
  colors: {
    background: "oklch(0.972 0.006 78)",
    surface: "oklch(0.988 0.004 78)",
    foreground: "oklch(0.205 0.018 38)",
    primary: "oklch(0.44 0.14 28)",
    primaryForeground: "oklch(0.985 0.004 78)",
    secondary: "oklch(0.52 0.08 200)",
    muted: "oklch(0.94 0.01 78)",
    mutedForeground: "oklch(0.48 0.02 40)",
    border: "oklch(0.89 0.012 75)",
    sidebar: "oklch(0.955 0.008 78)",
    sidebarAccent: "oklch(0.925 0.012 50)",
    chart3: "oklch(0.58 0.1 70)",
    chart4: "oklch(0.4 0.04 260)",
    chart5: "oklch(0.35 0.02 40)",
  },
}

function textValue(
  value: string | boolean | undefined,
  fallback: string,
  maxLength: number
): string {
  if (typeof value !== "string") {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed && trimmed.length <= maxLength ? trimmed : fallback
}

function shortNameValue(
  value: string | boolean | undefined,
  fallback: string
): string {
  const candidate = textValue(value, fallback, 4)
  return /^[\p{L}\p{N}?&+.-]{1,4}$/u.test(candidate) ? candidate : fallback
}

function colorValue(
  value: string | boolean | undefined,
  fallback: string
): string {
  if (typeof value !== "string") {
    return fallback
  }

  const candidate = value.trim()
  if (!candidate || candidate.length > 80 || /[;{}]/.test(candidate)) {
    return fallback
  }

  const isHex = /^#[\da-f]{3,8}$/i.test(candidate)
  const isFunction =
    /^(?:oklch|oklab|hsl|hsla|rgb|rgba)\([\d\s.,%/+*-]+\)$/i.test(candidate)
  return isHex || isFunction ? candidate : fallback
}

function faviconValue(
  value: string | boolean | undefined,
  fallback: string
): string {
  if (typeof value !== "string") {
    return fallback
  }

  const candidate = value.trim()
  if (!candidate || candidate.length > 2_048) {
    return fallback
  }
  if (candidate.startsWith("/")) {
    return candidate
  }

  try {
    const parsed = new URL(candidate)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? candidate
      : fallback
  } catch {
    return fallback
  }
}

export function resolveDashboardBrand(env: PublicEnv): DashboardBrand {
  const defaults = DEFAULT_DASHBOARD_BRAND
  return {
    name: textValue(env.VITE_DASHBOARD_NAME, defaults.name, 80),
    shortName: shortNameValue(
      env.VITE_DASHBOARD_SHORT_NAME,
      defaults.shortName
    ),
    title: textValue(env.VITE_DASHBOARD_TITLE, defaults.title, 120),
    description: textValue(
      env.VITE_DASHBOARD_DESCRIPTION,
      defaults.description,
      240
    ),
    faviconUrl: faviconValue(
      env.VITE_DASHBOARD_FAVICON_URL,
      defaults.faviconUrl
    ),
    colors: {
      background: colorValue(
        env.VITE_DASHBOARD_BACKGROUND_COLOR,
        defaults.colors.background
      ),
      surface: colorValue(
        env.VITE_DASHBOARD_SURFACE_COLOR,
        defaults.colors.surface
      ),
      foreground: colorValue(
        env.VITE_DASHBOARD_FOREGROUND_COLOR,
        defaults.colors.foreground
      ),
      primary: colorValue(
        env.VITE_DASHBOARD_PRIMARY_COLOR,
        defaults.colors.primary
      ),
      primaryForeground: colorValue(
        env.VITE_DASHBOARD_PRIMARY_FOREGROUND_COLOR,
        defaults.colors.primaryForeground
      ),
      secondary: colorValue(
        env.VITE_DASHBOARD_SECONDARY_COLOR,
        defaults.colors.secondary
      ),
      muted: colorValue(env.VITE_DASHBOARD_MUTED_COLOR, defaults.colors.muted),
      mutedForeground: colorValue(
        env.VITE_DASHBOARD_MUTED_FOREGROUND_COLOR,
        defaults.colors.mutedForeground
      ),
      border: colorValue(
        env.VITE_DASHBOARD_BORDER_COLOR,
        defaults.colors.border
      ),
      sidebar: colorValue(
        env.VITE_DASHBOARD_SIDEBAR_COLOR,
        defaults.colors.sidebar
      ),
      sidebarAccent: colorValue(
        env.VITE_DASHBOARD_SIDEBAR_ACCENT_COLOR,
        defaults.colors.sidebarAccent
      ),
      chart3: colorValue(
        env.VITE_DASHBOARD_CHART_3_COLOR,
        defaults.colors.chart3
      ),
      chart4: colorValue(
        env.VITE_DASHBOARD_CHART_4_COLOR,
        defaults.colors.chart4
      ),
      chart5: colorValue(
        env.VITE_DASHBOARD_CHART_5_COLOR,
        defaults.colors.chart5
      ),
    },
  }
}

export const dashboardBrand = resolveDashboardBrand(import.meta.env)

const CSS_VARIABLES: ReadonlyArray<
  readonly [string, keyof DashboardBrandColors]
> = [
  ["--background", "background"],
  ["--foreground", "foreground"],
  ["--card", "surface"],
  ["--card-foreground", "foreground"],
  ["--popover", "surface"],
  ["--popover-foreground", "foreground"],
  ["--primary", "primary"],
  ["--primary-foreground", "primaryForeground"],
  ["--secondary", "muted"],
  ["--secondary-foreground", "foreground"],
  ["--muted", "muted"],
  ["--muted-foreground", "mutedForeground"],
  ["--accent", "sidebarAccent"],
  ["--accent-foreground", "foreground"],
  ["--border", "border"],
  ["--input", "border"],
  ["--ring", "primary"],
  ["--chart-1", "primary"],
  ["--chart-2", "secondary"],
  ["--chart-3", "chart3"],
  ["--chart-4", "chart4"],
  ["--chart-5", "chart5"],
  ["--sidebar", "sidebar"],
  ["--sidebar-foreground", "foreground"],
  ["--sidebar-primary", "primary"],
  ["--sidebar-primary-foreground", "primaryForeground"],
  ["--sidebar-accent", "sidebarAccent"],
  ["--sidebar-accent-foreground", "foreground"],
  ["--sidebar-border", "border"],
  ["--sidebar-ring", "primary"],
]

export function applyDashboardBrand(
  brand: DashboardBrand,
  targetDocument: Document
): void {
  targetDocument.title = brand.title

  for (const [property, color] of CSS_VARIABLES) {
    targetDocument.documentElement.style.setProperty(
      property,
      brand.colors[color]
    )
  }

  const existingDescription =
    targetDocument.head.querySelector<HTMLMetaElement>(
      'meta[name="description"]'
    )
  const description =
    existingDescription ?? targetDocument.createElement("meta")
  description.name = "description"
  description.content = brand.description
  description.dataset.dashboardBrand = "true"
  if (!existingDescription) {
    targetDocument.head.append(description)
  }

  const existingFavicon =
    targetDocument.head.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (brand.faviconUrl) {
    const favicon = existingFavicon ?? targetDocument.createElement("link")
    favicon.rel = "icon"
    favicon.href = brand.faviconUrl
    favicon.dataset.dashboardBrand = "true"
    if (!existingFavicon) {
      targetDocument.head.append(favicon)
    }
  } else {
    existingFavicon?.remove()
  }
}
