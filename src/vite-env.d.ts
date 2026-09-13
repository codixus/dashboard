/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_DASHBOARD_NAME?: string
  readonly VITE_DASHBOARD_SHORT_NAME?: string
  readonly VITE_DASHBOARD_TITLE?: string
  readonly VITE_DASHBOARD_DESCRIPTION?: string
  readonly VITE_DASHBOARD_FAVICON_URL?: string
  readonly VITE_DASHBOARD_BACKGROUND_COLOR?: string
  readonly VITE_DASHBOARD_SURFACE_COLOR?: string
  readonly VITE_DASHBOARD_FOREGROUND_COLOR?: string
  readonly VITE_DASHBOARD_PRIMARY_COLOR?: string
  readonly VITE_DASHBOARD_PRIMARY_FOREGROUND_COLOR?: string
  readonly VITE_DASHBOARD_SECONDARY_COLOR?: string
  readonly VITE_DASHBOARD_MUTED_COLOR?: string
  readonly VITE_DASHBOARD_MUTED_FOREGROUND_COLOR?: string
  readonly VITE_DASHBOARD_BORDER_COLOR?: string
  readonly VITE_DASHBOARD_SIDEBAR_COLOR?: string
  readonly VITE_DASHBOARD_SIDEBAR_ACCENT_COLOR?: string
  readonly VITE_DASHBOARD_CHART_3_COLOR?: string
  readonly VITE_DASHBOARD_CHART_4_COLOR?: string
  readonly VITE_DASHBOARD_CHART_5_COLOR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
