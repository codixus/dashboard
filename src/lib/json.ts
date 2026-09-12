export function parseJsonObject(
  text: string
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  try {
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, message: "Value must be a JSON object" }
    }
    return { ok: true, value: parsed as Record<string, unknown> }
  } catch {
    return { ok: false, message: "Value must be valid JSON" }
  }
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function formatCell(value: unknown): string {
  if (value == null) {
    return ""
  }
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return JSON.stringify(value)
}
