import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ADMIN_HEADER, getApiUrl } from "@/lib/api"
import { ADMIN_TOKEN_KEY } from "@/lib/auth"
import { renderApp } from "@/test/render"

const TOKEN = "codixus-admin-test-token"

const USER_DOC = {
  _id: "u1",
  deviceId: "dev1",
  locale: "en",
  createdAt: "2026-09-12T00:00:00.000Z",
}

const DEVICE = {
  _id: "devdoc_1",
  deviceId: "dev_abc123",
  token: "ExponentPushToken[test]",
  provider: "expo",
  platform: "ios",
  enabled: true,
  lastSeenAt: "2026-09-12T00:00:00.000Z",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function requestUrl(input: RequestInfo | URL) {
  return new URL(String(input))
}

describe("operator dashboard", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    sessionStorage.clear()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it("stores the admin token and redirects after a 204 session", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input)
      if (url.pathname.endsWith("/admin/session")) {
        expect(url.href).toBe(`${getApiUrl()}/admin/session`)
        expect(new Headers(init?.headers).get(ADMIN_HEADER)).toBe(TOKEN)
        return new Response(null, { status: 204 })
      }
      if (url.pathname.endsWith("/admin/collections")) {
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
    expect(url).toBe(`${getApiUrl()}/admin/collections`)
    expect(new Headers(init.headers).get(ADMIN_HEADER)).toBe(TOKEN)
  })

  function mockUsersCollection(listed: Array<Record<string, unknown>>) {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input)
      const method = init?.method ?? "GET"
      const path = url.pathname

      if (path.endsWith("/admin/collections") && method === "GET") {
        return json({
          success: true,
          data: [
            {
              name: "users",
              fields: ["_id", "deviceId", "locale", "createdAt"],
              kind: "users",
            },
          ],
        })
      }

      if (path.endsWith("/admin/collections/users") && method === "GET") {
        const filter = url.searchParams.get("filter") ?? "{}"
        let data = listed
        try {
          const parsed = JSON.parse(filter) as Record<string, unknown>
          data = listed.filter((doc) =>
            Object.entries(parsed).every(([key, value]) => doc[key] === value)
          )
        } catch {
          data = listed
        }
        return json({ success: true, data })
      }

      if (path.endsWith("/admin/collections/users") && method === "POST") {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        const created = {
          _id: "u2",
          deviceId: body.deviceId,
          locale: body.locale,
          createdAt: USER_DOC.createdAt,
        }
        listed.unshift(created)
        return json({ success: true, data: created })
      }

      if (path.endsWith("/admin/collections/users/u1") && method === "PATCH") {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        Object.assign(listed[0], body, { _id: "u1" })
        return json({ success: true, data: listed[0] })
      }

      if (path.endsWith("/admin/collections/users/u1") && method === "DELETE") {
        const index = listed.findIndex((doc) => doc._id === "u1")
        if (index >= 0) {
          listed.splice(index, 1)
        }
        return new Response(null, { status: 204 })
      }

      return json({ success: false, error: "NOT_FOUND" }, 404)
    })
  }

  it("creates a document via POST and reloads skip 0", async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(ADMIN_TOKEN_KEY, TOKEN)
    mockUsersCollection([{ ...USER_DOC }])

    renderApp("/collections/users")
    expect(await screen.findByText("dev1")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "New" }))
    const createBox = await screen.findByLabelText("Document JSON")
    fireEvent.change(createBox, {
      target: { value: '{"deviceId":"dev2","locale":"tr"}' },
    })
    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(await screen.findByText("Document created")).toBeInTheDocument()
    expect(await screen.findByText("dev2")).toBeInTheDocument()

    const post = fetchMock.mock.calls.find((call) => {
      const init = call[1] as RequestInit | undefined
      return init?.method === "POST"
    }) as [string, RequestInit]
    expect(JSON.parse(String(post[1].body))).toEqual({
      deviceId: "dev2",
      locale: "tr",
    })

    const listGets = fetchMock.mock.calls.filter((call) => {
      const url = requestUrl(call[0] as RequestInfo)
      const init = call[1] as RequestInit | undefined
      return (
        url.pathname.endsWith("/admin/collections/users") &&
        (init?.method ?? "GET") === "GET"
      )
    })
    const lastList = listGets.at(-1) as [string, RequestInit]
    expect(requestUrl(lastList[0]).searchParams.get("skip")).toBe("0")
  })

  it("saves a PATCH body without _id", async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(ADMIN_TOKEN_KEY, TOKEN)
    mockUsersCollection([{ ...USER_DOC }])

    renderApp("/collections/users")
    await user.click(await screen.findByText("dev1"))

    expect(
      await screen.findByText(/Updates keys in this JSON; omitted keys are kept/)
    ).toBeInTheDocument()
    const editor = await screen.findByLabelText("Document JSON")
    expect((editor as HTMLTextAreaElement).value).toContain('"_id": "u1"')

    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("Document saved")).toBeInTheDocument()

    const patch = fetchMock.mock.calls.find((call) => {
      const init = call[1] as RequestInit | undefined
      return init?.method === "PATCH"
    }) as [string, RequestInit]
    expect(JSON.parse(String(patch[1].body))._id).toBeUndefined()
    expect(JSON.parse(String(patch[1].body)).deviceId).toBe("dev1")
  })

  it("applies a JSON filter to the document list", async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(ADMIN_TOKEN_KEY, TOKEN)
    mockUsersCollection([
      { ...USER_DOC },
      { _id: "u2", deviceId: "dev2", locale: "tr", createdAt: USER_DOC.createdAt },
    ])

    renderApp("/collections/users")
    expect(await screen.findByText("dev1")).toBeInTheDocument()
    expect(screen.getByText("dev2")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Filter JSON"), {
      target: { value: '{"locale":"tr"}' },
    })
    await user.click(screen.getByRole("button", { name: "Apply filter" }))

    await waitFor(() => {
      expect(screen.queryByText("dev1")).not.toBeInTheDocument()
    })
    expect(screen.getByText("dev2")).toBeInTheDocument()
  })

  it("deletes a document and closes the dialog", async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(ADMIN_TOKEN_KEY, TOKEN)
    mockUsersCollection([{ ...USER_DOC }])

    renderApp("/collections/users")
    await user.click(await screen.findByText("dev1"))
    await user.click(screen.getByRole("button", { name: "Delete" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(await screen.findByText("Document deleted")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })
  })

  it("keeps the delete dialog open when delete fails", async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(ADMIN_TOKEN_KEY, TOKEN)

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input)
      const method = init?.method ?? "GET"
      const path = url.pathname

      if (path.endsWith("/admin/collections") && method === "GET") {
        return json({
          success: true,
          data: [
            {
              name: "users",
              fields: ["_id", "deviceId", "locale", "createdAt"],
              kind: "users",
            },
          ],
        })
      }
      if (path.endsWith("/admin/collections/users") && method === "GET") {
        return json({ success: true, data: [USER_DOC] })
      }
      if (path.endsWith("/admin/collections/users/u1") && method === "DELETE") {
        return json({ success: false, error: "REQUEST_FAILED" }, 500)
      }
      return json({ success: false, error: "NOT_FOUND" }, 404)
    })

    renderApp("/collections/users")
    await user.click(await screen.findByText("dev1"))
    await user.click(screen.getByRole("button", { name: "Delete" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(await screen.findByText("REQUEST_FAILED")).toBeInTheDocument()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })

  it("signs out, clears storage, and returns to login", async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(ADMIN_TOKEN_KEY, TOKEN)
    fetchMock.mockResolvedValue(json({ success: true, data: [] }))

    renderApp("/")

    expect(await screen.findByRole("heading", { name: "Collections" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Sign out" }))

    expect(await screen.findByLabelText("Admin token")).toBeInTheDocument()
    expect(sessionStorage.getItem(ADMIN_TOKEN_KEY)).toBeNull()
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
          data: [DEVICE],
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

  it("toasts Push sent on a 200 send", async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(ADMIN_TOKEN_KEY, TOKEN)

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"

      if (url.includes("/admin/collections") && !url.includes("/admin/collections/")) {
        return json({ success: true, data: [] })
      }
      if (url.includes("/admin/push/devices")) {
        return json({ success: true, data: [DEVICE] })
      }
      if (url.includes("/admin/push/deliveries")) {
        return json({
          success: true,
          data: [
            {
              _id: "dlv_1",
              deviceId: "dev_abc123",
              status: "submitted",
              title: "Hello",
              createdAt: "2026-09-12T00:00:00.000Z",
            },
          ],
        })
      }
      if (method === "POST" && url.endsWith("/admin/push/send")) {
        return json({ success: true })
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

    expect(await screen.findByText("Push sent")).toBeInTheDocument()
    expect(await screen.findByText("submitted")).toBeInTheDocument()
  })
})
