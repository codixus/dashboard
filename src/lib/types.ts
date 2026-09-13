export type AdminCollectionKind =
  "model" | "users" | "push_devices" | "push_deliveries"

export type AdminCollectionInfo = {
  name: string
  fields: string[]
  kind: AdminCollectionKind
}

export type CollectionDoc = Record<string, unknown>

export type PushDevice = {
  _id: string
  deviceId: string
  token: string
  provider: string
  platform: string
  locale?: string
  timezone?: string
  appVersion?: string
  permissionStatus?: string
  enabled: boolean
  lastSeenAt?: string
  properties?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export type PushDelivery = {
  _id: string
  deviceId: string
  token?: string
  provider?: string
  title: string
  body: string
  imageUrl?: string
  data?: Record<string, unknown>
  status: string
  ticketId?: string
  errorCode?: string
  errorMessage?: string
  idempotencyKey?: string
  journeyRunId?: string
  createdAt?: string
  openedAt?: string
  receiptedAt?: string
}

export type PushJourneyRecipientState =
  "waiting" | "paused" | "sent" | "opened" | "failed" | "exited"

export type PushJourneyStatsSummary = {
  totalRuns: number
  enrolled: number
  reached: number
  opened: number
  waiting: number
  paused: number
  completed: number
  failed: number
  exited: number
}

export type PushJourneyStatsUser = {
  _id: string
  deviceId?: string
  locale?: string
  identifiers?: Record<string, unknown>
  firstSeenIp?: string
  lastSeenIp?: string
  createdAt?: string
  lastSeenAt?: string
}

export type PushJourneyStatsDevice = {
  platform?: "ios" | "android"
  locale?: string
  timezone?: string
  appVersion?: string
  permissionStatus?: string
  enabled?: boolean
  lastSeenAt?: string
}

export type PushJourneyStatsDelivery = {
  deliveryId: string
  runId?: string
  stepId?: string
  status: "sending" | "submitted" | "failed" | "opened"
  createdAt: string
  openedAt?: string
  receiptedAt?: string
  errorCode?: string
  errorMessage?: string
}

export type PushJourneyStatsParticipant = {
  runId: string
  deviceId: string
  revision: number
  state: PushJourneyRecipientState
  runStatus: "active" | "paused" | "completed" | "exited" | "failed"
  eventOccurredAt: string
  enrolledAt: string
  nextStepId?: string
  nextRunAt?: string
  completedAt?: string
  attempts: number
  lastError?: string
  user?: PushJourneyStatsUser
  device?: PushJourneyStatsDevice
  deliveries: PushJourneyStatsDelivery[]
}

export type PushJourneyStats = {
  journey: PushJourney
  summary: PushJourneyStatsSummary
  participants: PushJourneyStatsParticipant[]
  nextSkip?: number
}

export type PushJourneyAudience = {
  operator: "has_event" | "not_has_event"
  eventName: string
}

export type PushJourneyStepTranslation = {
  title: string
  body: string
  imageUrl?: string
}

export type PushJourneyStep = {
  id: string
  offsetSeconds: number
  title: string
  body: string
  imageUrl?: string
  translations?: Record<string, PushJourneyStepTranslation>
  data?: Record<string, unknown>
}

export type PushJourneyDefinition = {
  entryEvent: string
  audience?: PushJourneyAudience
  steps: PushJourneyStep[]
}

export type PushJourney = {
  _id: string
  name: string
  status: "draft" | "live" | "paused"
  draft: PushJourneyDefinition
  revisionCounter: number
  liveRevision?: number
  liveEntryEvent?: string
  liveSince?: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

export type PushSendResult = {
  deviceId: string
  status: "skipped" | "submitted" | "failed" | "opened"
  deliveryId?: string
  errorCode?: string
  errorMessage?: string
}
