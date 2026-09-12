import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ADMIN_HEADER, getApiUrl } from "@/lib/api"
import { ADMIN_TOKEN_KEY } from "@/lib/auth"
import type { PushJourney } from "@/lib/types"
import { renderApp } from "@/test/render"

const TOKEN = "journey-admin-token"

const JOURNEY: PushJourney = {
  _id: "journey-1",
  name: "Purchase nurture",
  status: "draft",
  draft: {
    entryEvent: "purchase_completed",
    audience: { operator: "has_event", eventName: "purchase_completed" },
    steps: [
      {
        id: "thank-you",
        offsetSeconds: 1800,
        title: "Thanks",
        body: "Your bonus is ready.",
        imageUrl: "https://cdn.oknok.app/bonus.jpg",
        data: { route: "/menu", campaign: "purchase-thanks" },
      },
    ],
  },
  revisionCounter: 0,
  createdAt: "2026-09-12T10:00:00.000Z",
  updatedAt: "2026-09-12T10:00:00.000Z",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function urlOf(input: RequestInfo | URL) {
  return new URL(String(input))
}

describe("journeys page", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, TOKEN)
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  it("creates a draft with event, audience, absolute delay, image and route data", async () => {
    const user = userEvent.setup()
    let created: PushJourney | null = null
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = urlOf(input)
        const method = init?.method ?? "GET"
        expect(new Headers(init?.headers).get(ADMIN_HEADER)).toBe(TOKEN)

        if (url.pathname.endsWith("/admin/push/journeys") && method === "GET") {
          return json({ success: true, data: created ? [created] : [] })
        }
        if (
          url.pathname.endsWith("/admin/push/journeys") &&
          method === "POST"
        ) {
          const payload = JSON.parse(String(init?.body))
          expect(payload).toEqual({
            name: "Purchase nurture",
            definition: {
              entryEvent: "purchase_completed",
              audience: {
                operator: "has_event",
                eventName: "purchase_completed",
              },
              steps: [
                {
                  id: "thank-you",
                  offsetSeconds: 1800,
                  title: "Thanks",
                  body: "Your bonus is ready.",
                  imageUrl: "https://cdn.oknok.app/bonus.jpg",
                  data: { campaign: "purchase-thanks", route: "/menu" },
                },
              ],
            },
          })
          created = JOURNEY
          return json({ success: true, data: created }, 201)
        }
        return json({ success: false, error: "NOT_FOUND" }, 404)
      }
    )

    renderApp("/journeys")
    expect(await screen.findByText("No journeys yet")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "New journey" }))
    await user.type(screen.getByLabelText("Journey name"), "Purchase nurture")
    await user.type(screen.getByLabelText("Entry event"), "purchase_completed")
    await user.selectOptions(screen.getByLabelText("Audience"), "has_event")
    await user.type(
      screen.getByLabelText("Audience event"),
      "purchase_completed"
    )
    await user.clear(screen.getByLabelText("Step 1 ID"))
    await user.type(screen.getByLabelText("Step 1 ID"), "thank-you")
    await user.clear(screen.getByLabelText("Step 1 delay"))
    await user.type(screen.getByLabelText("Step 1 delay"), "30")
    await user.type(screen.getByLabelText("Step 1 title"), "Thanks")
    await user.type(
      screen.getByLabelText("Step 1 message"),
      "Your bonus is ready."
    )
    await user.type(
      screen.getByLabelText("Step 1 image URL"),
      "https://cdn.oknok.app/bonus.jpg"
    )
    await user.type(screen.getByLabelText("Step 1 route"), "/menu")
    fireEvent.change(screen.getByLabelText("Step 1 data JSON"), {
      target: { value: '{"campaign":"purchase-thanks"}' },
    })
    await user.click(screen.getByRole("button", { name: "Create draft" }))

    expect(await screen.findByText("Draft created")).toBeInTheDocument()
    expect(await screen.findByText("Purchase nurture")).toBeInTheDocument()
  })

  it("edits, publishes, pauses and resumes using explicit state actions", async () => {
    const user = userEvent.setup()
    let journey = structuredClone(JOURNEY)
    const calls: string[] = []
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = urlOf(input)
        const method = init?.method ?? "GET"
        if (url.pathname.endsWith("/admin/push/journeys") && method === "GET") {
          return json({ success: true, data: [journey] })
        }
        if (
          url.pathname.endsWith("/admin/push/journeys/journey-1") &&
          method === "PATCH"
        ) {
          calls.push("patch")
          const payload = JSON.parse(String(init?.body))
          journey = {
            ...journey,
            name: payload.name,
            draft: payload.definition,
          }
          return json({ success: true, data: journey })
        }
        for (const action of ["publish", "pause", "resume"] as const) {
          if (
            url.pathname.endsWith(`/journey-1/${action}`) &&
            method === "POST"
          ) {
            calls.push(action)
            journey = {
              ...journey,
              status: action === "pause" ? "paused" : "live",
              revisionCounter:
                action === "publish" ? 1 : journey.revisionCounter,
            }
            return json({ success: true, data: journey })
          }
        }
        return json({ success: false, error: "NOT_FOUND" }, 404)
      }
    )

    renderApp("/journeys")
    await screen.findByDisplayValue("Purchase nurture")
    await user.clear(screen.getByLabelText("Journey name"))
    await user.type(screen.getByLabelText("Journey name"), "Purchase follow-up")
    await user.click(screen.getByRole("button", { name: "Publish" }))
    await user.click(await screen.findByRole("button", { name: "Pause" }))
    await user.click(await screen.findByRole("button", { name: "Resume" }))

    expect(calls).toEqual(["patch", "publish", "pause", "resume"])
    expect(journey.name).toBe("Purchase follow-up")
    expect(await screen.findByText("Journey resumed")).toBeInTheDocument()
  })

  it("searches an existing device and reports draft test-send delivery status", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = urlOf(input)
        const method = init?.method ?? "GET"
        if (url.pathname.endsWith("/admin/push/journeys")) {
          return json({ success: true, data: [JOURNEY] })
        }
        if (
          url.pathname.endsWith("/admin/push/journeys/journey-1") &&
          method === "PATCH"
        ) {
          const payload = JSON.parse(String(init?.body))
          expect(payload.definition.steps[0].title).toBe("Updated test title")
          expect(payload.definition.steps[0].id).toBe("updated-thank-you")
          return json({
            success: true,
            data: { ...JOURNEY, draft: payload.definition },
          })
        }
        if (url.pathname.endsWith("/admin/push/devices")) {
          expect(url.searchParams.get("q")).toBe("device-123")
          return json({
            success: true,
            data: [
              {
                _id: "push-device-1",
                deviceId: "device-123",
                token: "ExponentPushToken[test]",
                provider: "expo",
                platform: "ios",
                enabled: true,
              },
            ],
          })
        }
        if (url.pathname.endsWith("/journey-1/test") && method === "POST") {
          expect(JSON.parse(String(init?.body))).toEqual({
            deviceId: "device-123",
            stepId: "updated-thank-you",
          })
          return json({
            success: true,
            data: [{ deviceId: "device-123", status: "submitted" }],
          })
        }
        return json({ success: false, error: "NOT_FOUND" }, 404)
      }
    )

    renderApp("/journeys")
    await screen.findByDisplayValue("Purchase nurture")
    await user.clear(screen.getByLabelText("Step 1 ID"))
    await user.type(screen.getByLabelText("Step 1 ID"), "updated-thank-you")
    await user.clear(screen.getByLabelText("Step 1 title"))
    await user.type(screen.getByLabelText("Step 1 title"), "Updated test title")
    await user.type(screen.getByLabelText("Test device"), "device-123")
    await user.click(screen.getByRole("button", { name: "Search devices" }))
    await user.click(await screen.findByRole("button", { name: /device-123/ }))
    await user.click(screen.getByRole("button", { name: "Send test" }))

    expect(
      await screen.findByText("Test submitted to 1/1 token")
    ).toBeInTheDocument()
  })

  it("shows validation without sending and recovers from an API failure", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(json({ success: true, data: [] }))
    renderApp("/journeys")
    await screen.findByText("No journeys yet")
    await user.click(screen.getByRole("button", { name: "New journey" }))
    await user.click(screen.getByRole("button", { name: "Create draft" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Journey name is required"
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fetchMock.mockResolvedValueOnce(
      json({ success: false, error: "INVALID_INPUT" }, 400)
    )
    await user.type(screen.getByLabelText("Journey name"), "Broken")
    await user.type(screen.getByLabelText("Entry event"), "app_opened")
    await user.type(screen.getByLabelText("Step 1 title"), "Hello")
    await user.type(screen.getByLabelText("Step 1 message"), "World")
    await user.click(screen.getByRole("button", { name: "Create draft" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("INVALID_INPUT")

    await user.clear(screen.getByLabelText("Journey name"))
    await user.type(screen.getByLabelText("Journey name"), "Recovered")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("uses the configured API base for the list request", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [] }))
    renderApp("/journeys")
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${getApiUrl()}/admin/push/journeys`
    )
  })
})
