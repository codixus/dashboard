import { useEffect, useRef, useState, type ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-x-3 gap-y-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

export function ErrorNote({ error }: { error: string | null | undefined }) {
  if (!error) {
    return null
  }
  return (
    <p
      role="alert"
      className="mb-4 border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm break-words text-destructive"
    >
      {error}
    </p>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="border border-dashed px-6 py-10 text-center text-sm text-pretty text-muted-foreground"
    >
      {children}
    </div>
  )
}

export function LoadingRows({
  rows = 3,
  label = "Loading",
}: {
  rows?: number
  label?: string
}) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function TableScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth
      setEdges({
        start: el.scrollLeft > 1,
        end: max > 1 && el.scrollLeft < max - 1,
      })
    }
    measure()
    el.addEventListener("scroll", measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    for (const child of Array.from(el.children)) {
      observer.observe(child)
    }
    return () => {
      el.removeEventListener("scroll", measure)
      observer.disconnect()
    }
  }, [])

  return (
    <div className="relative w-full min-w-0">
      <div
        ref={ref}
        className={cn(
          "@container/table w-full overflow-x-auto border",
          "[&_[data-slot=table-container]]:overflow-x-visible"
        )}
      >
        {children}
      </div>
      <div
        aria-hidden
        data-visible={edges.start}
        className="pointer-events-none absolute inset-y-px left-px w-8 bg-gradient-to-r from-background to-transparent opacity-0 transition-opacity duration-150 data-[visible=true]:opacity-100"
      />
      <div
        aria-hidden
        data-visible={edges.end}
        className="pointer-events-none absolute inset-y-px right-px w-8 bg-gradient-to-l from-background to-transparent opacity-0 transition-opacity duration-150 data-[visible=true]:opacity-100"
      />
    </div>
  )
}

export function GrowthBars({
  daily,
  label,
}: {
  daily: Array<{ day: string; count: number }>
  label: string
}) {
  const max = Math.max(1, ...daily.map((d) => d.count))
  return (
    <div className="min-w-0 border p-4">
      <h2 className="text-sm font-medium">{label}</h2>
      <p className="sr-only">
        {daily.map((d) => `${d.day}: ${d.count}`).join(", ")}
      </p>
      <div className="mt-3 flex h-28 items-end gap-1">
        {daily.map((d) => (
          <div
            key={d.day}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
          >
            <div
              title={`${d.day}: ${d.count}`}
              className="w-full bg-primary"
              style={{ height: `${Math.max(d.count === 0 ? 0 : 8, (d.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
        <span>{daily[0]?.day.slice(5)}</span>
        <span>{daily.at(-1)?.day.slice(5)}</span>
      </div>
    </div>
  )
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="border p-4">
      <div className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  )
}
