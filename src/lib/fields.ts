const IMAGE_EXT = /\.(avif|gif|jpe?g|png|svg|webp)(\?|#|$)/i
const IMAGE_HINT =
  /(?:cloudinary|googleusercontent|images\.|imgix|media\.|unsplash|twimg)|\b(?:cdn|image|photo|thumb)\b/i
const IMAGE_FIELD = /(avatar|cover|icon|image|img|logo|photo|picture|thumb)/i

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

export function isImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || !isHttpUrl(value)) {
    return false
  }
  return IMAGE_EXT.test(value) || IMAGE_HINT.test(value)
}

export function isImageField(field: string, value: unknown): value is string {
  if (!isImageUrl(value)) {
    return false
  }
  return IMAGE_EXT.test(value) || IMAGE_FIELD.test(field)
}

export function toCreatedAtMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getTime()
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const asNumber = Number(value)
    if (Number.isFinite(asNumber) && value.trim() !== "") {
      if (asNumber >= 1e9 && asNumber < 1e14) {
        return asNumber < 1e12 ? asNumber * 1000 : asNumber
      }
    }
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

export function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function lastUtcDays(count: number, nowMs = Date.now()): string[] {
  const days: string[] = []
  const start = new Date(nowMs)
  start.setUTCHours(0, 0, 0, 0)
  for (let i = count - 1; i >= 0; i -= 1) {
    days.push(utcDayKey(start.getTime() - i * 86_400_000))
  }
  return days
}
