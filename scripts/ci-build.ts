import { spawn } from "node:child_process"
import { createServer } from "node:http"
import process from "node:process"

const appSlug = "sample-app"
const payload = {
  success: true,
  data: {
    schemaVersion: 1,
    appSlug,
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
  },
}

const server = createServer((request, response) => {
  if (request.url !== `/api/v1/dashboard-configs/${appSlug}`) {
    response.writeHead(404, { "Content-Type": "application/json" })
    response.end(JSON.stringify({ success: false, error: "NOT_FOUND" }))
    return
  }

  response.writeHead(200, { "Content-Type": "application/json" })
  response.end(JSON.stringify(payload))
})

await new Promise<void>((resolve, reject) => {
  server.once("error", reject)
  server.listen(0, "127.0.0.1", resolve)
})

const address = server.address()
if (!address || typeof address === "string") {
  server.close()
  throw new Error("CI dashboard config fixture did not bind to a TCP port")
}

try {
  const child = spawn(process.execPath, ["run", "build"], {
    env: {
      ...process.env,
      appslug: appSlug,
      DASHBOARD_CONFIG_BASE_URL: `http://127.0.0.1:${address.port}/api/v1/dashboard-configs`,
    },
    stdio: "inherit",
  })
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code) => resolve(code ?? 1))
  })
  if (exitCode !== 0) {
    throw new Error(`Configured dashboard build exited with code ${exitCode}`)
  }
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}
