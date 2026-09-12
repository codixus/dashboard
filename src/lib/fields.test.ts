import { describe, expect, it } from "vitest"

import { isImageField, isImageUrl, toCreatedAtMs, utcDayKey } from "@/lib/fields"
import { tokenizeJson } from "@/lib/highlight-json"
import { pickStatCollections, seriesFromDocs } from "@/lib/stats"

describe("isImageUrl", () => {
  it("accepts http urls with an image extension", () => {
    expect(isImageUrl("https://cdn.example.com/shot.png")).toBe(true)
    expect(isImageUrl("http://cdn.example.com/shot.JPG?w=40")).toBe(true)
  })

  it("accepts known image hosts without an extension", () => {
    expect(isImageUrl("https://images.unsplash.com/photo-abc")).toBe(true)
  })

  it("rejects non-http and non-image strings", () => {
    expect(isImageUrl("not-a-url")).toBe(false)
    expect(isImageUrl("https://example.com/readme.md")).toBe(false)
    expect(isImageUrl("")).toBe(false)
    expect(isImageUrl(null)).toBe(false)
  })
})

describe("isImageField", () => {
  it("requires an image url even when the field name looks visual", () => {
    expect(isImageField("avatar", "dev1")).toBe(false)
    expect(isImageField("avatar", "https://cdn.example.com/a.png")).toBe(true)
  })
})

describe("toCreatedAtMs", () => {
  it("reads iso strings, epoch ms, and epoch seconds", () => {
    expect(toCreatedAtMs("2026-09-12T00:00:00.000Z")).toBe(
      Date.parse("2026-09-12T00:00:00.000Z")
    )
    expect(toCreatedAtMs(1_725_148_800_000)).toBe(1_725_148_800_000)
    expect(toCreatedAtMs(1_725_148_800)).toBe(1_725_148_800_000)
  })

  it("returns null for missing or garbage values", () => {
    expect(toCreatedAtMs(undefined)).toBeNull()
    expect(toCreatedAtMs("nope")).toBeNull()
  })
})

describe("seriesFromDocs", () => {
  it("buckets createdAt into the 14 day window and flags a cap", () => {
    const now = Date.parse("2026-09-12T12:00:00.000Z")
    const stats = seriesFromDocs(
      "users",
      "users",
      [
        { createdAt: "2026-09-12T01:00:00.000Z" },
        { createdAt: "2026-09-12T02:00:00.000Z" },
        { createdAt: "2026-08-01T00:00:00.000Z" },
      ],
      100,
      now
    )
    expect(stats.count).toBe(3)
    expect(stats.capped).toBe(true)
    expect(stats.daily.at(-1)).toEqual({ day: utcDayKey(now), count: 2 })
    expect(stats.daily[0]?.count).toBe(0)
  })

  it("picks only the three stat kinds", () => {
    const picked = pickStatCollections([
      { name: "notes", fields: ["_id"], kind: "model" },
      { name: "users", fields: ["_id"], kind: "users" },
      { name: "push_devices", fields: ["_id"], kind: "push_devices" },
    ])
    expect(Object.keys(picked).sort()).toEqual(["push_devices", "users"])
  })

  it("falls back to collection name when kind is model", () => {
    const picked = pickStatCollections([
      { name: "notes", fields: ["_id"], kind: "model" },
      { name: "users", fields: ["_id"], kind: "model" },
    ])
    expect(picked.users?.name).toBe("users")
    expect(picked.push_devices).toBeUndefined()
  })
})

describe("tokenizeJson", () => {
  it("marks keys, strings, numbers, and keywords", () => {
    const kinds = tokenizeJson('{"a":"x","n":1,"ok":true,"z":null}').map(
      (t) => t.kind
    )
    expect(kinds).toContain("key")
    expect(kinds).toContain("string")
    expect(kinds).toContain("number")
    expect(kinds).toContain("boolean")
    expect(kinds).toContain("null")
  })

  it("marks unterminated strings as errors", () => {
    expect(tokenizeJson('{"a":"oops').some((t) => t.kind === "error")).toBe(true)
  })
})
