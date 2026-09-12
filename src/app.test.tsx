import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ADMIN_HEADER, DEFAULT_API_URL } from "@/lib/api"
import { ADMIN_TOKEN_KEY } from "@/lib/auth"
import { renderApp } from "@/test/render"

const TOKEN = "codixus-admin-test-token"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("operator dashboard", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("stores the admin token and redirects after a 204 session", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith("/admin/session")) {
        return new Response(null, { status: 204 })
      }
      if (url.endsWith("/admin/collections")) {
        return json({ success: true, data: [] })
      }
      return json({ success: false, error: "NOT_FOUND" }, 404)
    })

    renderApp("/login")

    await user.type(screen.getByLabelText("Admin token"), TOKEN)
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(sessionStorage.getItem(ADMIN_TOKEN_KEY)).toBe(TOKEN)
    })
    expect(await screen.findByRole("heading", { name: "Collections" })).toBeInTheDocument()
  })

  it("toasts on login 401 and does not write storage", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue(
      json({ success: false, error: "UNAUTHORIZED" }, 401)
    )

    renderApp("/login")

    await user.type(screen.getByLabelText("Admin token"), TOKEN)
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(await screen.findByText("UNAUTHORIZED")).toBeInTheDocument()
    expect(sessionStorage.getItem(ADMIN_TOKEN_KEY)).toBeNull()
    expect(screen.getByLabelText("Admin token")).toBeInTheDocument()
  })

  it("redirects unauthenticated visits to /login", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [] }))

    renderApp("/")

    expect(await screen.findByLabelText("Admin token")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("fetches collections with X-Codixus-Admin against the API URL", async () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, TOKEN)
    fetchMock.mockResolvedValue(
      json({
        success: true,
        data: [
          {
            name: "users",
            fields: ["_id", "deviceId", "locale", "createdAt"],
            kind: "users",
          },
        ],
      })
    )

    renderApp("/")

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${DEFAULT_API_URL}/admin/collections`)
    expect(new Headers(init.headers).get(ADMIN_HEADER)).toBe(TOKEN)
  })

  it("toasts NO_DEVICE on push send 404 and does not crash", async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(ADMIN_TOKEN_KEY, TOKEN)

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"

      if (url.includes("/admin/collections") && !url.includes("/admin/collections/")) {
        return json({ success: true, data: [] })
      }
      if (url.includes("/admin/push/devices")) {
        return json({
          success: true,
          data: [
            {
              _id: "devdoc_1",
              deviceId: "dev_abc123",
              token: "ExponentPushToken[test]",
              provider: "expo",
              platform: "ios",
              enabled: true,
              lastSeenAt: "2026-09-12T00:00:00.000Z",
            },
          ],
        })
      }
      if (url.includes("/admin/push/deliveries")) {
        return json({ success: true, data: [] })
      }
      if (method === "POST" && url.endsWith("/admin/push/send")) {
        return json({ success: false, error: "NO_DEVICE" }, 404)
      }
      return json({ success: false, error: "NOT_FOUND" }, 404)
    })

    renderApp("/push")

    await user.type(screen.getByLabelText("Device query"), "dev_abc")
    await user.click(screen.getByRole("button", { name: "Search" }))
    await user.click(await screen.findByText("dev_abc123"))
    await user.type(screen.getByLabelText("Title"), "Hello")
    await user.type(screen.getByLabelText("Body"), "World")
    await user.click(screen.getByRole("button", { name: "Send" }))

    expect(await screen.findByText("NO_DEVICE")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Push" })).toBeInTheDocument()
  })
})
