import { parseJsonObject } from "@/lib/json"
import type {
  PushJourney,
  PushJourneyDefinition,
  PushJourneyStep,
} from "@/lib/types"

export type DelayUnit = "minutes" | "hours" | "days"
export type AudienceOperator = "all" | "has_event" | "not_has_event"

export const BUILT_IN_JOURNEY_EVENTS = [
  {
    value: "user_created",
    label: "New install / user created",
    description: "Emitted once when Codixus creates the user.",
  },
  {
    value: "push_registered",
    label: "Push notifications registered",
    description: "Emitted when the device registers a push token.",
  },
  {
    value: "app_opened",
    label: "App opened",
    description: "Emitted when the app records an open event.",
  },
  {
    value: "purchase_completed",
    label: "Purchase completed",
    description: "Emitted by the RevenueCat purchase webhook.",
  },
  {
    value: "subscription_renewed",
    label: "Subscription renewed",
    description: "Emitted by the RevenueCat renewal webhook.",
  },
  {
    value: "subscription_cancelled",
    label: "Subscription cancelled",
    description: "Emitted by the RevenueCat cancellation webhook.",
  },
  {
    value: "subscription_expired",
    label: "Subscription expired",
    description: "Emitted by the RevenueCat expiration webhook.",
  },
] as const

type BuiltInJourneyEvent = (typeof BUILT_IN_JOURNEY_EVENTS)[number]["value"]
export type JourneyEventSelection = "" | "custom" | BuiltInJourneyEvent

export type JourneyEditorTranslation = {
  clientId: string
  locale: string
  title: string
  body: string
  imageUrl: string
}

export type JourneyEditorStep = {
  clientId: string
  id: string
  delay: string
  delayUnit: DelayUnit
  title: string
  body: string
  imageUrl: string
  route: string
  dataText: string
  translations: JourneyEditorTranslation[]
}

export type JourneyEditorState = {
  name: string
  entryEventSelection: JourneyEventSelection
  entryEvent: string
  audienceOperator: AudienceOperator
  audienceEventSelection: JourneyEventSelection
  audienceEvent: string
  steps: JourneyEditorStep[]
}

export type JourneyPayload = {
  name: string
  definition: PushJourneyDefinition
}

export type JourneyValidationResult =
  { ok: true; value: JourneyPayload } | { ok: false; error: string }

export type JourneyEditorResult =
  { ok: true; value: JourneyEditorState } | { ok: false; error: string }

export type JourneyJsonResult =
  { ok: true; value: string } | { ok: false; error: string }

const EVENT_NAME = /^[a-z][a-z0-9_]{0,63}$/
const STEP_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/
const MAX_OFFSET_SECONDS = 365 * 24 * 60 * 60
const RESERVED_DATA_KEYS = ["deliveryId", "journeyId", "journeyStepId"]
const BUILT_IN_EVENT_VALUES = new Set<string>(
  BUILT_IN_JOURNEY_EVENTS.map((event) => event.value)
)

function clientId() {
  return crypto.randomUUID()
}

export function eventSelectionFor(value: string): JourneyEventSelection {
  if (!value) return ""
  return BUILT_IN_EVENT_VALUES.has(value)
    ? (value as BuiltInJourneyEvent)
    : "custom"
}

export function emptyJourneyTranslation(): JourneyEditorTranslation {
  return {
    clientId: clientId(),
    locale: "",
    title: "",
    body: "",
    imageUrl: "",
  }
}

export function emptyJourneyStep(index = 0): JourneyEditorStep {
  return {
    clientId: clientId(),
    id: `step-${index + 1}`,
    delay: "0",
    delayUnit: "minutes",
    title: "",
    body: "",
    imageUrl: "",
    route: "",
    dataText: "{}",
    translations: [],
  }
}

export function emptyJourneyEditor(): JourneyEditorState {
  return {
    name: "",
    entryEventSelection: "",
    entryEvent: "",
    audienceOperator: "all",
    audienceEventSelection: "",
    audienceEvent: "",
    steps: [emptyJourneyStep()],
  }
}

function offsetSeconds(delay: string, unit: DelayUnit): number {
  const multiplier = unit === "days" ? 86_400 : unit === "hours" ? 3_600 : 60
  return Number(delay) * multiplier
}

function displayDelay(seconds: number): {
  delay: string
  delayUnit: DelayUnit
} {
  if (seconds > 0 && seconds % 86_400 === 0) {
    return { delay: String(seconds / 86_400), delayUnit: "days" }
  }
  if (seconds > 0 && seconds % 3_600 === 0) {
    return { delay: String(seconds / 3_600), delayUnit: "hours" }
  }
  return { delay: String(seconds / 60), delayUnit: "minutes" }
}

function canonicalLocale(value: string): string | null {
  try {
    return (
      Intl.getCanonicalLocales(value.trim().replaceAll("_", "-"))[0] ?? null
    )
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function definitionToEditor(
  name: string,
  definition: PushJourneyDefinition
): JourneyEditorState {
  return {
    name,
    entryEventSelection: eventSelectionFor(definition.entryEvent),
    entryEvent: definition.entryEvent,
    audienceOperator: definition.audience?.operator ?? "all",
    audienceEventSelection: eventSelectionFor(
      definition.audience?.eventName ?? ""
    ),
    audienceEvent: definition.audience?.eventName ?? "",
    steps: definition.steps.map((step) => {
      const data = { ...(step.data ?? {}) }
      const route = typeof data.route === "string" ? data.route : ""
      delete data.route
      return {
        clientId: clientId(),
        id: step.id,
        ...displayDelay(step.offsetSeconds),
        title: step.title,
        body: step.body,
        imageUrl: step.imageUrl ?? "",
        route,
        dataText: JSON.stringify(data, null, 2),
        translations: Object.entries(step.translations ?? {}).map(
          ([locale, translation]) => ({
            clientId: clientId(),
            locale,
            title: translation.title,
            body: translation.body,
            imageUrl: translation.imageUrl ?? "",
          })
        ),
      }
    }),
  }
}

export function journeyToEditor(journey: PushJourney): JourneyEditorState {
  return definitionToEditor(journey.name, journey.draft)
}

export function buildJourneyPayload(
  state: JourneyEditorState
): JourneyValidationResult {
  const name = state.name.trim()
  if (!name) return { ok: false, error: "Journey name is required" }
  if (name.length > 100) return { ok: false, error: "Journey name is too long" }

  const entryEvent = state.entryEvent.trim()
  if (!entryEvent) {
    return { ok: false, error: "Entry event is required" }
  }
  if (!EVENT_NAME.test(entryEvent)) {
    return { ok: false, error: "Entry event must use lowercase snake_case" }
  }
  if (
    state.audienceOperator !== "all" &&
    !EVENT_NAME.test(state.audienceEvent.trim())
  ) {
    return { ok: false, error: "Audience event is required" }
  }
  if (state.steps.length === 0 || state.steps.length > 20) {
    return { ok: false, error: "A journey needs 1-20 steps" }
  }

  const seenIds = new Set<string>()
  const steps: PushJourneyStep[] = []
  let previousOffset = -1

  for (const [index, draft] of state.steps.entries()) {
    const number = index + 1
    const id = draft.id.trim()
    if (!STEP_ID.test(id)) {
      return { ok: false, error: `Step ${number} ID is invalid` }
    }
    if (seenIds.has(id)) {
      return { ok: false, error: `Step ${number} ID is duplicated` }
    }
    seenIds.add(id)

    const offset = offsetSeconds(draft.delay, draft.delayUnit)
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > MAX_OFFSET_SECONDS
    ) {
      return { ok: false, error: `Step ${number} delay is invalid` }
    }
    if (offset < previousOffset) {
      return { ok: false, error: "Step delays must be in ascending order" }
    }
    previousOffset = offset

    const title = draft.title.trim()
    const body = draft.body.trim()
    if (!title || title.length > 100) {
      return { ok: false, error: `Step ${number} title is required` }
    }
    if (!body || body.length > 1000) {
      return { ok: false, error: `Step ${number} message is required` }
    }

    const imageUrl = draft.imageUrl.trim()
    if (imageUrl) {
      try {
        const image = new URL(imageUrl)
        if (image.protocol !== "https:" || imageUrl.length > 2048) {
          throw new Error("invalid")
        }
      } catch {
        return { ok: false, error: `Step ${number} image must use HTTPS` }
      }
    }

    const translationDrafts = draft.translations ?? []
    if (translationDrafts.length > 20) {
      return {
        ok: false,
        error: `Step ${number} can have at most 20 translations`,
      }
    }
    const translations: NonNullable<PushJourneyStep["translations"]> = {}
    for (const [translationIndex, translation] of translationDrafts.entries()) {
      const translationNumber = translationIndex + 1
      const locale = canonicalLocale(translation.locale)
      if (!locale) {
        return {
          ok: false,
          error: `Step ${number} translation ${translationNumber} locale is invalid`,
        }
      }
      if (locale in translations) {
        return {
          ok: false,
          error: `Step ${number} translation locale ${locale} is duplicated`,
        }
      }
      const translatedTitle = translation.title.trim()
      const translatedBody = translation.body.trim()
      if (!translatedTitle || translatedTitle.length > 100) {
        return {
          ok: false,
          error: `Step ${number} translation ${translationNumber} title is required`,
        }
      }
      if (!translatedBody || translatedBody.length > 1000) {
        return {
          ok: false,
          error: `Step ${number} translation ${translationNumber} message is required`,
        }
      }
      const translatedImageUrl = translation.imageUrl.trim()
      if (translatedImageUrl) {
        try {
          const image = new URL(translatedImageUrl)
          if (image.protocol !== "https:" || translatedImageUrl.length > 2048) {
            throw new Error("invalid")
          }
        } catch {
          return {
            ok: false,
            error: `Step ${number} translation ${translationNumber} image must use HTTPS`,
          }
        }
      }
      translations[locale] = {
        title: translatedTitle,
        body: translatedBody,
        ...(translatedImageUrl ? { imageUrl: translatedImageUrl } : {}),
      }
    }

    const parsedData = parseJsonObject(draft.dataText)
    if (!parsedData.ok) {
      return { ok: false, error: `Step ${number} data must be a JSON object` }
    }
    if (RESERVED_DATA_KEYS.some((key) => key in parsedData.value)) {
      return { ok: false, error: `Step ${number} data contains a reserved key` }
    }

    const data = { ...parsedData.value }
    const route = draft.route.trim()
    if (route) data.route = route
    if (new TextEncoder().encode(JSON.stringify(data)).length > 3072) {
      return { ok: false, error: `Step ${number} data is too large` }
    }

    steps.push({
      id,
      offsetSeconds: offset,
      title,
      body,
      ...(imageUrl ? { imageUrl } : {}),
      ...(Object.keys(translations).length > 0 ? { translations } : {}),
      ...(Object.keys(data).length > 0 ? { data } : {}),
    })
  }

  return {
    ok: true,
    value: {
      name,
      definition: {
        entryEvent,
        ...(state.audienceOperator === "all"
          ? {}
          : {
              audience: {
                operator: state.audienceOperator,
                eventName: state.audienceEvent.trim(),
              },
            }),
        steps,
      },
    },
  }
}

export function journeyEditorToJson(
  state: JourneyEditorState
): JourneyJsonResult {
  const payload = buildJourneyPayload(state)
  return payload.ok
    ? { ok: true, value: JSON.stringify(payload.value, null, 2) }
    : payload
}

function payloadFromUnknown(value: unknown): JourneyValidationResult {
  if (!isRecord(value) || typeof value.name !== "string") {
    return { ok: false, error: "Journey JSON must include a name" }
  }
  const definition = value.definition
  if (
    !isRecord(definition) ||
    typeof definition.entryEvent !== "string" ||
    !Array.isArray(definition.steps)
  ) {
    return { ok: false, error: "Journey JSON must include a definition" }
  }

  let audience: PushJourneyDefinition["audience"]
  if (definition.audience !== undefined) {
    if (
      !isRecord(definition.audience) ||
      (definition.audience.operator !== "has_event" &&
        definition.audience.operator !== "not_has_event") ||
      typeof definition.audience.eventName !== "string"
    ) {
      return { ok: false, error: "Journey audience is invalid" }
    }
    audience = {
      operator: definition.audience.operator,
      eventName: definition.audience.eventName,
    }
  }

  const steps: PushJourneyStep[] = []
  for (const [index, rawStep] of definition.steps.entries()) {
    if (
      !isRecord(rawStep) ||
      typeof rawStep.id !== "string" ||
      typeof rawStep.offsetSeconds !== "number" ||
      typeof rawStep.title !== "string" ||
      typeof rawStep.body !== "string"
    ) {
      return { ok: false, error: `Journey step ${index + 1} is invalid` }
    }
    if (
      rawStep.imageUrl !== undefined &&
      typeof rawStep.imageUrl !== "string"
    ) {
      return { ok: false, error: `Journey step ${index + 1} image is invalid` }
    }
    if (rawStep.data !== undefined && !isRecord(rawStep.data)) {
      return { ok: false, error: `Journey step ${index + 1} data is invalid` }
    }

    let translations: PushJourneyStep["translations"]
    if (rawStep.translations !== undefined) {
      if (!isRecord(rawStep.translations)) {
        return {
          ok: false,
          error: `Journey step ${index + 1} translations are invalid`,
        }
      }
      translations = {}
      for (const [locale, rawTranslation] of Object.entries(
        rawStep.translations
      )) {
        if (
          !isRecord(rawTranslation) ||
          typeof rawTranslation.title !== "string" ||
          typeof rawTranslation.body !== "string" ||
          (rawTranslation.imageUrl !== undefined &&
            typeof rawTranslation.imageUrl !== "string")
        ) {
          return {
            ok: false,
            error: `Journey step ${index + 1} translation ${locale} is invalid`,
          }
        }
        translations[locale] = {
          title: rawTranslation.title,
          body: rawTranslation.body,
          ...(rawTranslation.imageUrl
            ? { imageUrl: rawTranslation.imageUrl }
            : {}),
        }
      }
    }

    steps.push({
      id: rawStep.id,
      offsetSeconds: rawStep.offsetSeconds,
      title: rawStep.title,
      body: rawStep.body,
      ...(rawStep.imageUrl ? { imageUrl: rawStep.imageUrl } : {}),
      ...(translations ? { translations } : {}),
      ...(rawStep.data ? { data: rawStep.data } : {}),
    })
  }

  const editor = definitionToEditor(value.name, {
    entryEvent: definition.entryEvent,
    ...(audience ? { audience } : {}),
    steps,
  })
  return buildJourneyPayload(editor)
}

export function journeyJsonToEditor(text: string): JourneyEditorResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: "Journey JSON is invalid" }
  }

  const payload = payloadFromUnknown(parsed)
  if (!payload.ok) return payload
  return {
    ok: true,
    value: definitionToEditor(payload.value.name, payload.value.definition),
  }
}
