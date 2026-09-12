import { describe, expect, it } from "vitest"

import { omitDocumentId, parseJsonObject } from "@/lib/json"

describe("omitDocumentId", () => {
  it("drops _id and leaves other keys", () => {
    expect(omitDocumentId({ _id: "u1", locale: "en" })).toEqual({ locale: "en" })
  })

  it("does not mutate the input document", () => {
    const doc = { _id: "u1", locale: "en" }
    omitDocumentId(doc)
    expect(doc).toEqual({ _id: "u1", locale: "en" })
  })

  it("returns a copy when _id is absent", () => {
    const doc = { locale: "en" }
    expect(omitDocumentId(doc)).toEqual({ locale: "en" })
    expect(omitDocumentId(doc)).not.toBe(doc)
  })
})

describe("parseJsonObject", () => {
  it("rejects arrays", () => {
    expect(parseJsonObject("[]")).toEqual({
      ok: false,
      message: "Value must be a JSON object",
    })
  })
})
