/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

type ThemeProviderState = {
  theme: "light"
  setTheme: () => void
}

const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

const LIGHT_THEME: ThemeProviderState = {
  theme: "light",
  setTheme: () => {},
}

/** The operator console intentionally has one fixed, predictable light theme. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  React.useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.remove("dark")
    root.classList.add("light")
    localStorage.setItem("theme", "light")
  }, [])

  return (
    <ThemeProviderContext.Provider value={LIGHT_THEME}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
