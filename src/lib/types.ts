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
  createdAt?: string
  openedAt?: string
  receiptedAt?: string
}

export type PushJourneyAudience = {
  operator: "has_event" | "not_has_event"
  eventName: string
}

export type PushJourneyStep = {
  id: string
  offsetSeconds: number
  title: string
  body: string
  imageUrl?: string
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
