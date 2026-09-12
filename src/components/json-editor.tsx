import { useEffect, useId, useRef } from "react"

import { tokenizeJson } from "@/lib/highlight-json"

const TOKEN_CLASS: Record<string, string> = {
  key: "text-primary",
  string: "text-[oklch(0.42_0.08_200)] dark:text-[oklch(0.78_0.08_200)]",
  number: "text-[oklch(0.45_0.1_70)] dark:text-[oklch(0.78_0.1_75)]",
  boolean: "text-[oklch(0.4_0.12_310)] dark:text-[oklch(0.78_0.1_310)]",
  null: "text-muted-foreground",
  punct: "text-foreground/70",
  space: "",
  error: "text-destructive",
}

export function JsonEditor({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id?: string
  label: string
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const preRef = useRef<HTMLPreElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const tokens = tokenizeJson(value)

  useEffect(() => {
    const area = areaRef.current
    const pre = preRef.current
    if (!area || !pre) {
      return
    }
    const sync = () => {
      pre.scrollTop = area.scrollTop
      pre.scrollLeft = area.scrollLeft
    }
    area.addEventListener("scroll", sync)
    return () => area.removeEventListener("scroll", sync)
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative min-h-48 overflow-hidden border bg-card font-mono text-xs leading-5">
        <pre
          ref={preRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-auto p-3 whitespace-pre-wrap break-all"
        >
          {tokens.map((token, index) => (
            <span
              key={`${token.kind}-${index}`}
              data-token={token.kind}
              className={TOKEN_CLASS[token.kind]}
            >
              {token.value}
            </span>
          ))}
        </pre>
        <textarea
          ref={areaRef}
          id={fieldId}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="relative z-10 min-h-48 w-full resize-y bg-transparent p-3 font-mono text-xs leading-5 break-all whitespace-pre-wrap text-transparent caret-foreground outline-none"
        />
      </div>
    </div>
  )
}
