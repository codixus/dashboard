export type AdminCollectionKind =
  | "model"
  | "users"
  | "push_devices"
  | "push_deliveries"

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
  data?: Record<string, unknown>
  status: string
  ticketId?: string
  errorCode?: string
  idempotencyKey?: string
  createdAt?: string
  openedAt?: string
  receiptedAt?: string
}
