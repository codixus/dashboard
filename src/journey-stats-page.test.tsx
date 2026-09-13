import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ADMIN_HEADER } from "@/lib/api"
import { ADMIN_TOKEN_KEY } from "@/lib/auth"
import type { PushJourneyStats } from "@/lib/types"
import { renderApp } from "@/test/render"

const TOKEN = "journey-stats-admin-token"

const STATS: PushJourneyStats = {
  journey: {
    _id: "journey-1",
    name: "Welcome after install",
    status: "live",
    draft: {
      entryEvent: "user_created",
      steps: [
        {
          id: "welcome",
          offsetSeconds: 1800,
          title: "Welcome",
          body: "Start a round",
        },
      ],
    },
    revisionCounter: 1,
    liveRevision: 1,
    createdAt: "2026-09-12T10:00:00.000Z",
    updatedAt: "2026-09-12T10:00:00.000Z",
  },
  summary: {
    totalRuns: 3,
    enrolled: 2,
    reached: 1,
    opened: 1,
    waiting: 1,
    paused: 0,
    completed: 1,
    failed: 0,
    exited: 0,
  },
  participants: [
    {
      runId: "run-waiting",
      deviceId: "device-waiting",
      revision: 1,
      state: "waiting",
      runStatus: "active",
      eventOccurredAt: "2026-09-13T09:00:00.000Z",
      enrolledAt: "2026-09-13T09:00:00.000Z",
      nextStepId: "welcome",
      nextRunAt: "2026-09-13T09:30:00.000Z",
      attempts: 0,
      user: {
        _id: "user-waiting",
        identifiers: {
          revenueCatId: "rc_waiting",
          firebaseId: "firebase_waiting",
        },
        firstSeenIp: "198.51.100.10",
        lastSeenIp: "198.51.100.11",
      },
      device: {
        platform: "ios",
        locale: "tr-TR",
        timezone: "Europe/Istanbul",
        appVersion: "1.3.0",
        permissionStatus: "granted",
        enabled: true,
      },
      deliveries: [],
    },
    {
      runId: "run-opened",
      deviceId: "device-opened",
      revision: 1,
      state: "opened",
      runStatus: "completed",
      eventOccurredAt: "2026-09-12T09:00:00.000Z",
      enrolledAt: "2026-09-12T09:00:00.000Z",
      completedAt: "2026-09-12T09:30:03.000Z",
      attempts: 0,
      user: { _id: "user-opened" },
      device: { platform: "android", locale: "en-US" },
      deliveries: [
        {
          deliveryId: "delivery-opened",
          runId: "run-opened",
          stepId: "welcome",
          status: "opened",
          createdAt: "2026-09-12T09:30:00.000Z",
          openedAt: "2026-09-12T09:31:00.000Z",
        },
        {
          deliveryId: "delivery-latest",
          runId: "run-opened",
          stepId: "follow-up",
          status: "submitted",
          createdAt: "2026-09-12T09:32:00.000Z",
        },
      ],
    },
  ],
  nextSkip: 50,
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("journey stats page", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, TOKEN)
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  it("shows unique-recipient totals, recipient identity, device and delivery timing", async () => {
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input))
        expect(new Headers(init?.headers).get(ADMIN_HEADER)).toBe(TOKEN)
        expect(url.pathname).toContain("/admin/push/journeys/journey-1/stats")
        expect(url.searchParams.get("limit")).toBe("50")
        expect(url.searchParams.get("skip")).toBe("0")
        return json({ success: true, data: STATS, nextSkip: STATS.nextSkip })
      }
    )

    renderApp("/journeys/journey-1/stats")

    expect(
      await screen.findByRole("heading", { name: "Welcome after install" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Unique device recipients; test sends are excluded.")
    ).toBeInTheDocument()
    const summary = screen.getByRole("region", { name: "Journey summary" })
    expect(
      within(
        within(summary).getByRole("article", { name: "Enrolled" })
      ).getByText("2")
    ).toBeInTheDocument()
    expect(
      within(
        within(summary).getByRole("article", { name: "Waiting" })
      ).getByText("1")
    ).toBeInTheDocument()

    const recipients = screen.getByRole("table", { name: "Journey recipients" })
    expect(within(recipients).getByText("rc_waiting")).toBeInTheDocument()
    expect(within(recipients).getByText("firebase_waiting")).toBeInTheDocument()
    expect(within(recipients).getByText("198.51.100.11")).toBeInTheDocument()
    expect(within(recipients).getByText("iOS · 1.3.0")).toBeInTheDocument()
    expect(
      within(recipients).getByText("granted · enabled")
    ).toBeInTheDocument()
    expect(
      within(recipients).getByText("tr-TR · Europe/Istanbul")
    ).toBeInTheDocument()
    expect(within(recipients).getByText("Waiting")).toBeInTheDocument()
    expect(within(recipients).getByText("Opened")).toBeInTheDocument()
    expect(
      within(recipients).getByText("follow-up · submitted")
    ).toBeInTheDocument()
  })

  it("paginates with the API cursor and can return to the first page", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const skip = Number(url.searchParams.get("skip"))
      return json({
        success: true,
        data: {
          ...STATS,
          participants: [],
          nextSkip: skip === 0 ? 50 : undefined,
        },
        nextSkip: skip === 0 ? 50 : undefined,
      })
    })

    renderApp("/journeys/journey-1/stats")
    await user.click(await screen.findByRole("button", { name: "Next page" }))
    await waitFor(() => {
      expect(
        new URL(String(fetchMock.mock.calls.at(-1)?.[0])).searchParams.get(
          "skip"
        )
      ).toBe("50")
    })
    expect(screen.getByText("0 on this page")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Previous page" }))
    await waitFor(() => {
      expect(
        new URL(String(fetchMock.mock.calls.at(-1)?.[0])).searchParams.get(
          "skip"
        )
      ).toBe("0")
    })
  })

  it("shows a recoverable error state", async () => {
    fetchMock.mockResolvedValue(
      json({ success: false, error: "REQUEST_FAILED" }, 500)
    )
    renderApp("/journeys/journey-1/stats")
    expect(await screen.findByRole("alert")).toHaveTextContent("REQUEST_FAILED")
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })
})
