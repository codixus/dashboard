import { useEffect, useState } from "react"
import { ArrowLeftIcon, RefreshCwIcon } from "lucide-react"
import { Link, useParams } from "react-router"

import {
  EmptyNote,
  ErrorNote,
  LoadingRows,
  PageHeader,
  TableScroll,
} from "@/components/page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ApiError, getJourneyStats } from "@/lib/api"
import type {
  PushJourneyRecipientState,
  PushJourneyStats,
  PushJourneyStatsParticipant,
} from "@/lib/types"

const PAGE_SIZE = 50

function errorCode(error: unknown): string {
  return error instanceof ApiError ? error.code : "REQUEST_FAILED"
}

function formatDate(value?: string): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase())
}

function scalar(value: unknown): string | null {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value)
  }
  return null
}

function identifiers(participant: PushJourneyStatsParticipant) {
  return Object.entries(participant.user?.identifiers ?? {}).flatMap(
    ([key, value]) => {
      const rendered = scalar(value)
      return rendered ? [{ key: titleCase(key), value: rendered }] : []
    }
  )
}

function stateVariant(state: PushJourneyRecipientState) {
  if (state === "opened" || state === "sent") return "default" as const
  if (state === "waiting" || state === "paused") return "secondary" as const
  if (state === "failed") return "destructive" as const
  return "outline" as const
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article aria-label={label} className="border bg-card px-4 py-4">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <strong className="mt-2 block font-mono text-2xl font-medium">
        {value}
      </strong>
    </article>
  )
}

function RecipientCell({
  participant,
}: {
  participant: PushJourneyStatsParticipant
}) {
  const values = identifiers(participant)
  return (
    <div className="min-w-52 space-y-1 whitespace-normal">
      {values.length > 0 ? (
        values.map(({ key, value }) => (
          <p key={`${key}:${value}`} className="text-xs break-all">
            <span className="text-muted-foreground">{key}: </span>
            {value}
          </p>
        ))
      ) : (
        <p className="text-xs break-all">
          {participant.user?._id ?? participant.deviceId}
        </p>
      )}
      {participant.user?.lastSeenIp ? (
        <p className="font-mono text-[11px] text-muted-foreground">
          {participant.user.lastSeenIp}
        </p>
      ) : null}
    </div>
  )
}

function DeviceCell({
  participant,
}: {
  participant: PushJourneyStatsParticipant
}) {
  const device = participant.device
  const platform = device?.platform
    ? `${device.platform === "ios" ? "iOS" : "Android"}${
        device.appVersion ? ` · ${device.appVersion}` : ""
      }`
    : "Unknown device"
  const location = [device?.locale, device?.timezone]
    .filter(Boolean)
    .join(" · ")
  const availability = [
    device?.permissionStatus,
    device?.enabled === undefined
      ? undefined
      : device.enabled
        ? "enabled"
        : "disabled",
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <div className="min-w-40 whitespace-normal">
      <p className="text-xs">{platform}</p>
      {location ? (
        <p className="mt-1 text-xs text-muted-foreground">{location}</p>
      ) : null}
      {availability ? (
        <p className="mt-1 text-xs text-muted-foreground">{availability}</p>
      ) : null}
      <p className="mt-1 font-mono text-[10px] break-all text-muted-foreground">
        {participant.deviceId}
      </p>
    </div>
  )
}

function ScheduleCell({
  participant,
}: {
  participant: PushJourneyStatsParticipant
}) {
  if (participant.nextRunAt) {
    return (
      <div>
        <p className="text-xs">{formatDate(participant.nextRunAt)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {participant.nextStepId ?? "Next step"}
        </p>
      </div>
    )
  }
  return (
    <div>
      <p className="text-xs">{formatDate(participant.completedAt)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Enrolled {formatDate(participant.enrolledAt)}
      </p>
    </div>
  )
}

function DeliveryCell({
  participant,
}: {
  participant: PushJourneyStatsParticipant
}) {
  const delivery = participant.deliveries.reduce<
    PushJourneyStatsParticipant["deliveries"][number] | undefined
  >((latest, candidate) => {
    if (!latest) return candidate
    return Date.parse(candidate.createdAt) > Date.parse(latest.createdAt)
      ? candidate
      : latest
  }, undefined)
  if (!delivery) {
    return <span className="text-xs text-muted-foreground">Not sent yet</span>
  }
  return (
    <div className="min-w-36 whitespace-normal">
      <p className="text-xs">
        {delivery.stepId ?? "Step"} · {delivery.status}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatDate(delivery.openedAt ?? delivery.createdAt)}
      </p>
      {delivery.errorCode ? (
        <p className="mt-1 text-xs text-destructive">
          {delivery.errorCode}
          {delivery.errorMessage ? `: ${delivery.errorMessage}` : ""}
        </p>
      ) : null}
    </div>
  )
}

export function JourneyStatsPage() {
  const { journeyId } = useParams()
  const [stats, setStats] = useState<PushJourneyStats | null>(null)
  const [skip, setSkip] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!journeyId) return
    let cancelled = false
    void getJourneyStats(journeyId, { limit: PAGE_SIZE, skip })
      .then((result) => {
        if (!cancelled) setStats(result)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(errorCode(loadError))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [journeyId, reloadKey, skip])

  function reload() {
    setLoading(true)
    setError(null)
    setReloadKey((current) => current + 1)
  }

  if (loading && !stats) {
    return (
      <div>
        <PageHeader
          title="Journey stats"
          description="Loading recipient activity..."
        />
        <LoadingRows rows={6} label="Loading journey stats" />
      </div>
    )
  }

  if ((!journeyId || error) && !stats) {
    return (
      <div>
        <PageHeader title="Journey stats" />
        <ErrorNote error={error ?? "NOT_FOUND"} />
        <Button type="button" variant="outline" onClick={reload}>
          Retry
        </Button>
      </div>
    )
  }

  if (!stats) return null

  const { journey, summary, participants } = stats
  return (
    <div className="min-w-0">
      <PageHeader
        title={journey.name}
        description="Unique device recipients; test sends are excluded."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/journeys">
                <ArrowLeftIcon data-icon="inline-start" />
                Journeys
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={reload}
            >
              <RefreshCwIcon data-icon="inline-start" />
              Refresh
            </Button>
          </>
        }
      />
      <ErrorNote error={error} />

      <section
        aria-label="Journey summary"
        className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-5"
      >
        <SummaryCard label="Enrolled" value={summary.enrolled} />
        <SummaryCard label="Reached" value={summary.reached} />
        <SummaryCard label="Waiting" value={summary.waiting} />
        <SummaryCard label="Opened" value={summary.opened} />
        <SummaryCard label="Failed" value={summary.failed} />
      </section>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Recipients</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.totalRuns} runs · {summary.completed} completed ·{" "}
            {summary.exited} exited · {summary.paused} paused
          </p>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {participants.length > 0
            ? `${skip + 1}-${skip + participants.length}`
            : "0 on this page"}
        </p>
      </div>

      <div className="mt-3">
        {participants.length === 0 ? (
          <EmptyNote>No recipients on this page.</EmptyNote>
        ) : (
          <TableScroll>
            <Table aria-label="Journey recipients">
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Scheduled / completed</TableHead>
                  <TableHead>Latest delivery</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((participant) => (
                  <TableRow key={participant.runId}>
                    <TableCell>
                      <RecipientCell participant={participant} />
                    </TableCell>
                    <TableCell>
                      <DeviceCell participant={participant} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={stateVariant(participant.state)}>
                        {titleCase(participant.state)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ScheduleCell participant={participant} />
                    </TableCell>
                    <TableCell>
                      <DeliveryCell participant={participant} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={skip === 0 || loading}
          onClick={() => {
            setLoading(true)
            setError(null)
            setSkip((current) => Math.max(0, current - PAGE_SIZE))
          }}
        >
          Previous page
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={stats.nextSkip === undefined || loading}
          onClick={() => {
            if (stats.nextSkip !== undefined) {
              setLoading(true)
              setError(null)
              setSkip(stats.nextSkip)
            }
          }}
        >
          Next page
        </Button>
      </div>
    </div>
  )
}
