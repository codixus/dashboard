import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"

import { ApiError, listCollections, listDocuments } from "@/lib/api"
import {
  emptySeries,
  pickStatCollections,
  seriesFromDocs,
  type SeriesStats,
  type StatKind,
} from "@/lib/stats"
import type { AdminCollectionInfo } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import {
  EmptyNote,
  ErrorNote,
  GrowthBars,
  LoadingRows,
  PageHeader,
  StatTile,
  TableScroll,
} from "@/components/page"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const LABELS: Record<StatKind, string> = {
  users: "Users",
  push_devices: "Devices",
  push_deliveries: "Deliveries",
}

export function OverviewPage() {
  const navigate = useNavigate()
  const [collections, setCollections] = useState<AdminCollectionInfo[] | null>(
    null
  )
  const [series, setSeries] = useState<Record<StatKind, SeriesStats> | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const list = await listCollections()
        if (cancelled) {
          return
        }
        const picked = pickStatCollections(list)
        const kinds = Object.keys(picked) as StatKind[]
        const rows = await Promise.all(
          kinds.map((kind) => {
            const col = picked[kind]
            if (!col) {
              return Promise.resolve({
                kind,
                result: { docs: [], nextSkip: undefined as number | undefined },
              })
            }
            return listDocuments(col.name, {
              filter: "{}",
              limit: 100,
              skip: 0,
              sort: { createdAt: -1 },
            }).then((result) => ({ kind, result }))
          })
        )
        if (cancelled) {
          return
        }
        const next = {
          users: emptySeries("users"),
          push_devices: emptySeries("push_devices"),
          push_deliveries: emptySeries("push_deliveries"),
        }
        for (const row of rows) {
          const col = picked[row.kind]
          next[row.kind] = seriesFromDocs(
            row.kind,
            col?.name ?? null,
            row.result.docs,
            row.result.nextSkip
          )
        }
        setCollections(list)
        setSeries(next)
        setError(null)
      } catch (err) {
        if (cancelled) {
          return
        }
        const message = err instanceof ApiError ? err.code : "REQUEST_FAILED"
        setError(message)
        toast.error(message)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const loading = collections == null && !error

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description="Users, devices, and deliveries from the latest 100 rows of each collection. No stats endpoint."
      />
      <ErrorNote error={error} />

      {loading ? <LoadingRows rows={4} label="Loading overview" /> : null}

      {series ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(["users", "push_devices", "push_deliveries"] as const).map((kind) => {
            const item = series[kind]
            return (
              <StatTile
                key={kind}
                label={LABELS[kind]}
                value={item.capped ? `${item.count}+` : String(item.count)}
                hint={
                  item.name
                    ? item.capped
                      ? `Latest 100 in ${item.name}`
                      : item.name
                    : "Collection not mounted"
                }
              />
            )
          })}
        </div>
      ) : null}

      {series ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {(["users", "push_devices", "push_deliveries"] as const).map((kind) => (
            <GrowthBars
              key={kind}
              label={`${LABELS[kind]} / 14d`}
              daily={series[kind].daily}
            />
          ))}
        </div>
      ) : null}

      {collections && collections.length === 0 ? (
        <EmptyNote>This API has not registered any admin collections.</EmptyNote>
      ) : null}

      {collections && collections.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">On this API</h2>
            <Link
              to="/collections"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              All collections
            </Link>
          </div>
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead className="hidden @lg/table:table-cell">
                    Fields
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((collection) => (
                  <TableRow
                    key={collection.name}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={() => navigate(`/collections/${collection.name}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        navigate(`/collections/${collection.name}`)
                      }
                    }}
                  >
                    <TableCell className="font-medium">{collection.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{collection.kind}</Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-md truncate text-muted-foreground @lg/table:table-cell">
                      {collection.fields.join(", ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        </section>
      ) : null}
    </div>
  )
}
