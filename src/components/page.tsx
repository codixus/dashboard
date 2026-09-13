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
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {actions}
        </div>
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
    <div
      className="flex flex-col gap-2"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
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

export function GrowthLineChart({
  daily,
  label,
}: {
  daily: Array<{ day: string; count: number }>
  label: string
}) {
  const max = Math.max(1, ...daily.map((d) => d.count))
  const plotTop = 8
  const plotBottom = 92
  const points = daily.map((entry, index) => ({
    ...entry,
    x: daily.length <= 1 ? 50 : (index / (daily.length - 1)) * 100,
    y: plotBottom - (entry.count / max) * (plotBottom - plotTop),
  }))
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")
  const areaPath = points.length
    ? `${linePath} L ${points.at(-1)!.x} ${plotBottom} L ${points[0]!.x} ${plotBottom} Z`
    : ""
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const activePoint = activeIndex === null ? null : points[activeIndex]

  return (
    <div className="min-w-0 border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{label}</h2>
        <span className="text-[10px] text-muted-foreground">
          Hover for details
        </span>
      </div>
      <p className="sr-only">
        {daily.map((d) => `${d.day}: ${d.count}`).join(", ")}
      </p>
      <div className="relative mt-3 h-28">
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          {[plotTop, 50, plotBottom].map((y) => (
            <line
              key={y}
              className="stroke-border"
              strokeDasharray="1.5 2.5"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              x1="0"
              x2="100"
              y1={y}
              y2={y}
            />
          ))}
          {areaPath ? <path className="fill-primary/10" d={areaPath} /> : null}
          {linePath ? (
            <path
              data-testid="growth-line"
              className="fill-none stroke-primary"
              d={linePath}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>

        {points.map((point, index) => (
          <button
            key={point.day}
            type="button"
            aria-label={`${point.day}: ${point.count}`}
            className="group absolute z-10 flex size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            onBlur={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(index)}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <span className="size-2 rounded-full border-2 border-background bg-primary transition-transform group-hover:scale-150 group-focus-visible:scale-150" />
          </button>
        ))}

        {activePoint ? (
          <div
            role="tooltip"
            className={cn(
              "pointer-events-none absolute z-20 border bg-popover px-2 py-1 font-mono text-[11px] whitespace-nowrap text-popover-foreground tabular-nums shadow-sm",
              activePoint.x < 12
                ? "translate-x-0"
                : activePoint.x > 88
                  ? "-translate-x-full"
                  : "-translate-x-1/2",
              activePoint.y < 25
                ? "translate-y-3"
                : "-translate-y-[calc(100%+0.75rem)]"
            )}
            style={{ left: `${activePoint.x}%`, top: `${activePoint.y}%` }}
          >
            {activePoint.day} · {activePoint.count}
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground tabular-nums">
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
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  )
}
