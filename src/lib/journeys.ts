import { parseJsonObject } from "@/lib/json"
import type {
  PushJourney,
  PushJourneyDefinition,
  PushJourneyStep,
} from "@/lib/types"

export type DelayUnit = "minutes" | "hours" | "days"
export type AudienceOperator = "all" | "has_event" | "not_has_event"

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
}

export type JourneyEditorState = {
  name: string
  entryEvent: string
  audienceOperator: AudienceOperator
  audienceEvent: string
  steps: JourneyEditorStep[]
}

export type JourneyPayload = {
  name: string
  definition: PushJourneyDefinition
}

export type JourneyValidationResult =
  { ok: true; value: JourneyPayload } | { ok: false; error: string }

const EVENT_NAME = /^[a-z][a-z0-9_]{0,63}$/
const STEP_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/
const MAX_OFFSET_SECONDS = 365 * 24 * 60 * 60
const RESERVED_DATA_KEYS = ["deliveryId", "journeyId", "journeyStepId"]

function clientId() {
  return crypto.randomUUID()
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
  }
}

export function emptyJourneyEditor(): JourneyEditorState {
  return {
    name: "",
    entryEvent: "",
    audienceOperator: "all",
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

export function journeyToEditor(journey: PushJourney): JourneyEditorState {
  return {
    name: journey.name,
    entryEvent: journey.draft.entryEvent,
    audienceOperator: journey.draft.audience?.operator ?? "all",
    audienceEvent: journey.draft.audience?.eventName ?? "",
    steps: journey.draft.steps.map((step) => {
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
      }
    }),
  }
}

export function buildJourneyPayload(
  state: JourneyEditorState
): JourneyValidationResult {
  const name = state.name.trim()
  if (!name) return { ok: false, error: "Journey name is required" }
  if (name.length > 100) return { ok: false, error: "Journey name is too long" }

  const entryEvent = state.entryEvent.trim()
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
