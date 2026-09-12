import { describe, expect, it } from "vitest"

import { buildJourneyPayload, type JourneyEditorState } from "@/lib/journeys"

function validState(
  overrides: Partial<JourneyEditorState> = {}
): JourneyEditorState {
  return {
    name: "Purchase nurture",
    entryEvent: "purchase_completed",
    audienceOperator: "has_event",
    audienceEvent: "purchase_completed",
    steps: [
      {
        clientId: "client-step-1",
        id: "thank-you",
        delay: "30",
        delayUnit: "minutes",
        title: "Thanks",
        body: "Your bonus is ready.",
        imageUrl: "https://cdn.oknok.app/bonus.jpg",
        route: "/menu",
        dataText: '{"campaign":"purchase-thanks"}',
      },
      {
        clientId: "client-step-2",
        id: "day-three",
        delay: "3",
        delayUnit: "days",
        title: "Try another room",
        body: "A new room is waiting.",
        imageUrl: "",
        route: "",
        dataText: "{}",
      },
    ],
    ...overrides,
  }
}

describe("journey editor validation", () => {
  it("builds absolute offsets, audience, image and merged route data", () => {
    expect(buildJourneyPayload(validState())).toEqual({
      ok: true,
      value: {
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
            {
              id: "day-three",
              offsetSeconds: 259200,
              title: "Try another room",
              body: "A new room is waiting.",
            },
          ],
        },
      },
    })
  })

  it.each([
    ["name", validState({ name: "" }), "Journey name is required"],
    [
      "entry event",
      validState({ entryEvent: "Purchase Complete" }),
      "Entry event must use lowercase snake_case",
    ],
    [
      "audience event",
      validState({ audienceEvent: "" }),
      "Audience event is required",
    ],
    [
      "insecure image",
      validState({
        steps: [
          {
            ...validState().steps[0],
            imageUrl: "http://cdn.oknok.app/bonus.jpg",
          },
        ],
      }),
      "Step 1 image must use HTTPS",
    ],
    [
      "invalid data",
      validState({
        steps: [{ ...validState().steps[0], dataText: "[]" }],
      }),
      "Step 1 data must be a JSON object",
    ],
    [
      "unordered offsets",
      validState({
        steps: [
          { ...validState().steps[0], delay: "3", delayUnit: "days" },
          { ...validState().steps[1], delay: "30", delayUnit: "minutes" },
        ],
      }),
      "Step delays must be in ascending order",
    ],
    [
      "reserved data",
      validState({
        steps: [
          {
            ...validState().steps[0],
            dataText: '{"deliveryId":"forged"}',
          },
        ],
      }),
      "Step 1 data contains a reserved key",
    ],
  ])("rejects %s", (_label, state, message) => {
    expect(buildJourneyPayload(state)).toEqual({ ok: false, error: message })
  })
})
