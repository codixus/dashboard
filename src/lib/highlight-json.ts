export type JsonTokenKind =
  | "key"
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "punct"
  | "space"
  | "error"

export type JsonToken = {
  kind: JsonTokenKind
  value: string
}

const KEYWORDS: Record<string, JsonTokenKind> = {
  true: "boolean",
  false: "boolean",
  null: "null",
}

export function tokenizeJson(text: string): JsonToken[] {
  const tokens: JsonToken[] = []
  let i = 0
  let expectingKey = false
  const stack: Array<"object" | "array"> = []

  const push = (kind: JsonTokenKind, value: string) => {
    tokens.push({ kind, value })
  }

  while (i < text.length) {
    const ch = text[i]

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      let j = i + 1
      while (j < text.length && /[ \t\n\r]/.test(text[j] ?? "")) {
        j += 1
      }
      push("space", text.slice(i, j))
      i = j
      continue
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch === "{" ? "object" : "array")
      expectingKey = ch === "{"
      push("punct", ch)
      i += 1
      continue
    }

    if (ch === "}" || ch === "]") {
      stack.pop()
      expectingKey = stack[stack.length - 1] === "object"
      push("punct", ch)
      i += 1
      continue
    }

    if (ch === ":") {
      expectingKey = false
      push("punct", ch)
      i += 1
      continue
    }

    if (ch === ",") {
      expectingKey = stack[stack.length - 1] === "object"
      push("punct", ch)
      i += 1
      continue
    }

    if (ch === '"') {
      let j = i + 1
      let escaped = false
      while (j < text.length) {
        const next = text[j]
        if (escaped) {
          escaped = false
        } else if (next === "\\") {
          escaped = true
        } else if (next === '"') {
          j += 1
          break
        }
        j += 1
      }
      const value = text.slice(i, j)
      const closed = value.length >= 2 && value.endsWith('"')
      if (!closed) {
        push("error", value)
      } else {
        push(expectingKey ? "key" : "string", value)
      }
      i = j
      continue
    }

    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      const match = text.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)
      if (!match) {
        push("error", ch)
        i += 1
        continue
      }
      push("number", match[0])
      i += match[0].length
      continue
    }

    if (/[a-zA-Z]/.test(ch)) {
      let j = i + 1
      while (j < text.length && /[a-zA-Z]/.test(text[j] ?? "")) {
        j += 1
      }
      const word = text.slice(i, j)
      const kind = KEYWORDS[word]
      if (kind) {
        push(kind, word)
      } else {
        push("error", word)
      }
      i = j
      continue
    }

    push("error", ch)
    i += 1
  }

  return tokens
}
