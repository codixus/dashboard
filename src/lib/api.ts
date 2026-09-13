import { clearAdminToken, getAdminToken } from "@/lib/auth"
import { omitDocumentId } from "@/lib/json"
import type {
  AdminCollectionInfo,
  CollectionDoc,
  PushDelivery,
  PushDevice,
  PushJourney,
  PushJourneyDefinition,
  PushJourneyStats,
  PushSendResult,
} from "@/lib/types"

export const DEFAULT_API_URL = "http://localhost:3001/oknok"
export const ADMIN_HEADER = "X-Codixus-Admin"

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(code)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

export function getApiUrl(): string {
  const raw = import.meta.env.VITE_API_URL
  const value =
    typeof raw === "string" && raw.trim().length > 0
      ? raw.trim()
      : DEFAULT_API_URL
  return value.replace(/\/+$/, "")
}

export function getApiOrigin(): string {
  try {
    return new URL(getApiUrl()).origin
  } catch {
    return getApiUrl()
  }
}

export function withQuery(
  path: string,
  query: Record<string, string | number | undefined>
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue
    }
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

type AdminFetchInit = RequestInit & { token?: string }

export async function adminFetch(
  path: string,
  init: AdminFetchInit = {}
): Promise<Response> {
  const { token: tokenOverride, ...rest } = init
  const token = tokenOverride ?? getAdminToken()
  const headers = new Headers(rest.headers)

  if (token) {
    headers.set(ADMIN_HEADER, token)
  }

  if (rest.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const url = `${getApiUrl()}${path.startsWith("/") ? path : `/${path}`}`
  const response = await fetch(url, { ...rest, headers })

  if (response.status === 401 && getAdminToken()) {
    clearAdminToken()
  }

  return response
}

type ApiSuccess<T> = {
  success: true
  data?: T
  nextSkip?: number
}

type ApiFailure = {
  success: false
  error: string
}

export type AdminJsonResult<T> = {
  data: T
  nextSkip?: number
  status: number
}

async function readErrorCode(response: Response): Promise<string> {
  const fallback =
    response.status === 401
      ? "UNAUTHORIZED"
      : response.status === 404
        ? "NOT_FOUND"
        : "REQUEST_FAILED"

  const text = await response.text()
  if (!text) {
    return fallback
  }

  try {
    const parsed: unknown = JSON.parse(text)
    if (
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (parsed as ApiFailure).error === "string"
    ) {
      return (parsed as ApiFailure).error
    }
  } catch {
    return fallback
  }

  return fallback
}

export async function adminJson<T>(
  path: string,
  init: AdminFetchInit = {}
): Promise<AdminJsonResult<T>> {
  const response = await adminFetch(path, init)

  if (response.status === 204) {
    return { data: undefined as T, status: 204 }
  }

  const text = await response.text()
  if (!text) {
    if (!response.ok) {
      throw new ApiError(
        response.status,
        response.status === 401 ? "UNAUTHORIZED" : "REQUEST_FAILED"
      )
    }
    return { data: undefined as T, status: response.status }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ApiError(response.status, "REQUEST_FAILED")
  }

  if (!response.ok) {
    const failure = parsed as ApiFailure
    throw new ApiError(
      response.status,
      typeof failure?.error === "string" ? failure.error : "REQUEST_FAILED"
    )
  }

  const payload = parsed as ApiSuccess<T> | ApiFailure
  if (!payload || payload.success !== true) {
    throw new ApiError(
      response.status,
      payload && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "REQUEST_FAILED"
    )
  }

  return {
    data: payload.data as T,
    nextSkip: payload.nextSkip,
    status: response.status,
  }
}

export async function adminVoid(
  path: string,
  init: AdminFetchInit = {}
): Promise<void> {
  const response = await adminFetch(path, init)
  if (response.status === 204) {
    return
  }
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorCode(response))
  }
}

export async function checkSession(token: string): Promise<number> {
  const response = await adminFetch("/admin/session", { token })
  if (response.status === 204) {
    return 204
  }
  throw new ApiError(response.status, await readErrorCode(response))
}

export async function listCollections(): Promise<AdminCollectionInfo[]> {
  const result = await adminJson<AdminCollectionInfo[]>("/admin/collections")
  return result.data ?? []
}

export async function listDocuments(
  name: string,
  opts: {
    filter: string
    limit: number
    skip: number
    sort?: Record<string, 1 | -1>
  }
): Promise<{ docs: CollectionDoc[]; nextSkip?: number }> {
  const result = await adminJson<CollectionDoc[]>(
    withQuery(`/admin/collections/${encodeURIComponent(name)}`, {
      filter: opts.filter,
      limit: opts.limit,
      skip: opts.skip,
      sort: opts.sort ? JSON.stringify(opts.sort) : undefined,
    })
  )
  return { docs: result.data ?? [], nextSkip: result.nextSkip }
}

export async function createDocument(
  name: string,
  doc: CollectionDoc
): Promise<CollectionDoc> {
  const result = await adminJson<CollectionDoc>(
    `/admin/collections/${encodeURIComponent(name)}`,
    { method: "POST", body: JSON.stringify(doc) }
  )
  return result.data
}

export async function patchDocument(
  name: string,
  id: string,
  doc: CollectionDoc
): Promise<CollectionDoc> {
  const result = await adminJson<CollectionDoc>(
    `/admin/collections/${encodeURIComponent(name)}/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(omitDocumentId(doc)) }
  )
  return result.data
}

export async function deleteDocument(name: string, id: string): Promise<void> {
  await adminVoid(
    `/admin/collections/${encodeURIComponent(name)}/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  )
}

export async function searchDevices(q: string): Promise<PushDevice[]> {
  const result = await adminJson<PushDevice[]>(
    withQuery("/admin/push/devices", { q })
  )
  return result.data ?? []
}

export async function sendPush(input: {
  deviceId: string
  title: string
  body: string
  imageUrl?: string
  data?: Record<string, unknown>
}): Promise<PushSendResult[]> {
  const result = await adminJson<PushSendResult[]>("/admin/push/send", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return result.data ?? []
}

export async function listDeliveries(
  deviceId: string
): Promise<PushDelivery[]> {
  const result = await adminJson<PushDelivery[]>(
    withQuery("/admin/push/deliveries", { deviceId })
  )
  return result.data ?? []
}

export async function listJourneys(): Promise<PushJourney[]> {
  const result = await adminJson<PushJourney[]>("/admin/push/journeys")
  return result.data ?? []
}

export async function getJourneyStats(
  journeyId: string,
  opts: { limit: number; skip: number }
): Promise<PushJourneyStats> {
  const result = await adminJson<PushJourneyStats>(
    withQuery(
      `/admin/push/journeys/${encodeURIComponent(journeyId)}/stats`,
      opts
    )
  )
  return {
    ...result.data,
    nextSkip: result.nextSkip ?? result.data.nextSkip,
  }
}

export async function createJourney(input: {
  name: string
  definition: PushJourneyDefinition
}): Promise<PushJourney> {
  const result = await adminJson<PushJourney>("/admin/push/journeys", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return result.data
}

export async function updateJourneyDraft(
  journeyId: string,
  input: { name: string; definition: PushJourneyDefinition }
): Promise<PushJourney> {
  const result = await adminJson<PushJourney>(
    `/admin/push/journeys/${encodeURIComponent(journeyId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  )
  return result.data
}

async function transitionJourney(
  journeyId: string,
  action: "publish" | "pause" | "resume"
): Promise<PushJourney> {
  const result = await adminJson<PushJourney>(
    `/admin/push/journeys/${encodeURIComponent(journeyId)}/${action}`,
    { method: "POST" }
  )
  return result.data
}

export function publishJourney(journeyId: string): Promise<PushJourney> {
  return transitionJourney(journeyId, "publish")
}

export function pauseJourney(journeyId: string): Promise<PushJourney> {
  return transitionJourney(journeyId, "pause")
}

export function resumeJourney(journeyId: string): Promise<PushJourney> {
  return transitionJourney(journeyId, "resume")
}

export async function testJourneyStep(
  journeyId: string,
  input: { deviceId: string; stepId: string }
): Promise<PushSendResult[]> {
  const result = await adminJson<PushSendResult[]>(
    `/admin/push/journeys/${encodeURIComponent(journeyId)}/test`,
    { method: "POST", body: JSON.stringify(input) }
  )
  return result.data ?? []
}
