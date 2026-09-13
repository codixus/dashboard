import { spawn } from "node:child_process"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { loadDashboardBuildEnv, requireAppSlug } from "../src/lib/build-config"

async function main(): Promise<void> {
  const command = process.argv[2]
  if (command !== "build" && command !== "dev") {
    throw new Error("Usage: bun scripts/vite-with-config.ts <build|dev>")
  }

  const appSlug = requireAppSlug(process.env.appslug)
  const viteEnv = await loadDashboardBuildEnv({
    appSlug,
    baseUrl: process.env.DASHBOARD_CONFIG_BASE_URL,
  })

  for (const [key, value] of Object.entries(viteEnv)) {
    process.env[key] = value
  }

  console.info(`[dashboard-config] loaded public config for ${appSlug}`)

  const viteBin = fileURLToPath(
    new URL("../node_modules/vite/bin/vite.js", import.meta.url)
  )
  const viteArgs =
    command === "build"
      ? ["build", ...process.argv.slice(3)]
      : process.argv.slice(3)
  const child = spawn(process.execPath, [viteBin, ...viteArgs], {
    env: { ...process.env, ...viteEnv },
    stdio: "inherit",
  })

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code) => resolve(code ?? 1))
  })
  if (exitCode !== 0) {
    throw new Error(`Vite ${command} exited with code ${exitCode}`)
  }
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[dashboard-config] ${message}`)
  process.exitCode = 1
})
