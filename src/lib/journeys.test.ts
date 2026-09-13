import { describe, expect, it } from "vitest"

import {
  BUILT_IN_JOURNEY_EVENTS,
  buildJourneyPayload,
  eventSelectionFor,
  journeyEditorToJson,
  journeyJsonToEditor,
  type JourneyEditorState,
} from "@/lib/journeys"

function validState(
  overrides: Partial<JourneyEditorState> = {}
): JourneyEditorState {
  return {
    name: "Purchase nurture",
    entryEventSelection: "purchase_completed",
    entryEvent: "purchase_completed",
    audienceOperator: "has_event",
    audienceEventSelection: "purchase_completed",
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
        translations: [],
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
        translations: [],
      },
    ],
    ...overrides,
  }
}

describe("journey editor validation", () => {
  it("publishes the supported automatic and RevenueCat event catalog", () => {
    expect(BUILT_IN_JOURNEY_EVENTS).toEqual([
      expect.objectContaining({
        value: "user_created",
        label: "New install / user created",
      }),
      expect.objectContaining({ value: "push_registered" }),
      expect.objectContaining({ value: "app_opened" }),
      expect.objectContaining({ value: "purchase_completed" }),
      expect.objectContaining({ value: "subscription_renewed" }),
      expect.objectContaining({ value: "subscription_cancelled" }),
      expect.objectContaining({ value: "subscription_expired" }),
    ])
  })

  it("maps empty, built-in and unknown persisted events to explicit choices", () => {
    expect(eventSelectionFor("")).toBe("")
    expect(eventSelectionFor("user_created")).toBe("user_created")
    expect(eventSelectionFor("wardrobe_scanned")).toBe("custom")
  })

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

  it("canonicalizes and builds localized step content", () => {
    const state = validState()
    Object.assign(state.steps[0], {
      translations: [
        {
          clientId: "translation-1",
          locale: "tr_TR",
          title: "Teşekkürler",
          body: "Bonusun hazır.",
          imageUrl: "https://cdn.oknok.app/bonus-tr.jpg",
        },
      ],
    })

    const result = buildJourneyPayload(state)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.definition.steps[0].translations).toEqual({
      "tr-TR": {
        title: "Teşekkürler",
        body: "Bonusun hazır.",
        imageUrl: "https://cdn.oknok.app/bonus-tr.jpg",
      },
    })
  })

  it("round-trips a complete localized journey through JSON", () => {
    const state = validState()
    state.steps[0].translations = [
      {
        clientId: "translation-1",
        locale: "tr_TR",
        title: "Teşekkürler",
        body: "Bonusun hazır.",
        imageUrl: "",
      },
    ]

    const exported = journeyEditorToJson(state)
    expect(exported.ok).toBe(true)
    if (!exported.ok) return

    const imported = journeyJsonToEditor(exported.value)
    expect(imported.ok).toBe(true)
    if (!imported.ok) return

    expect(buildJourneyPayload(imported.value)).toEqual(
      buildJourneyPayload(state)
    )
    const exportedPayload = JSON.parse(exported.value)
    expect(exportedPayload).toMatchObject({
      name: "Purchase nurture",
      definition: { entryEvent: "purchase_completed" },
    })
    expect(exportedPayload.definition.steps[0].translations).toEqual({
      "tr-TR": {
        title: "Teşekkürler",
        body: "Bonusun hazır.",
      },
    })
  })

  it.each([
    ["invalid JSON", "{"],
    ["missing definition", '{"name":"Broken"}'],
    [
      "invalid journey",
      '{"name":"Broken","definition":{"entryEvent":"","steps":[]}}',
    ],
  ])("rejects %s imports", (_label, text) => {
    expect(journeyJsonToEditor(text)).toMatchObject({ ok: false })
  })

  it.each([
    ["invalid locale", "not a locale", "Başlık", "Mesaj", ""],
    ["missing title", "tr", "", "Mesaj", ""],
    ["missing message", "tr", "Başlık", "", ""],
    ["insecure image", "tr", "Başlık", "Mesaj", "http://cdn.oknok.app/tr.jpg"],
  ])(
    "rejects localized content with %s",
    (_label, locale, title, body, imageUrl) => {
      const state = validState()
      Object.assign(state.steps[0], {
        translations: [
          { clientId: "translation-1", locale, title, body, imageUrl },
        ],
      })

      expect(buildJourneyPayload(state)).toMatchObject({ ok: false })
    }
  )

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
