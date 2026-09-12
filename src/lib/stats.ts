import type { AdminCollectionInfo, CollectionDoc } from "@/lib/types"
import { lastUtcDays, toCreatedAtMs, utcDayKey } from "@/lib/fields"

export const STAT_KINDS = ["users", "push_devices", "push_deliveries"] as const

export type StatKind = (typeof STAT_KINDS)[number]

export type DayBucket = {
  day: string
  count: number
}

export type SeriesStats = {
  kind: StatKind
  name: string | null
  count: number
  capped: boolean
  daily: DayBucket[]
}

const WINDOW_DAYS = 14

export function pickStatCollections(
  collections: AdminCollectionInfo[]
): Partial<Record<StatKind, AdminCollectionInfo>> {
  const picked: Partial<Record<StatKind, AdminCollectionInfo>> = {}
  for (const kind of STAT_KINDS) {
    const match =
      collections.find((item) => item.kind === kind) ??
      collections.find((item) => item.name === kind)
    if (match) {
      picked[kind] = match
    }
  }
  return picked
}

export function seriesFromDocs(
  kind: StatKind,
  name: string | null,
  docs: CollectionDoc[],
  nextSkip: number | undefined,
  nowMs = Date.now()
): SeriesStats {
  const days = lastUtcDays(WINDOW_DAYS, nowMs)
  const counts = new Map(days.map((day) => [day, 0]))
  for (const doc of docs) {
    const ms = toCreatedAtMs(doc.createdAt)
    if (ms == null) {
      continue
    }
    const key = utcDayKey(ms)
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return {
    kind,
    name,
    count: docs.length,
    capped: nextSkip != null,
    daily: days.map((day) => ({ day, count: counts.get(day) ?? 0 })),
  }
}

export function emptySeries(kind: StatKind, nowMs = Date.now()): SeriesStats {
  return seriesFromDocs(kind, null, [], undefined, nowMs)
}
