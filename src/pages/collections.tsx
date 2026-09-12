import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { DatabaseIcon } from "lucide-react"
import { toast } from "sonner"

import { ApiError, listCollections } from "@/lib/api"
import type { AdminCollectionInfo } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function CollectionsPage() {
  const navigate = useNavigate()
  const [collections, setCollections] = useState<AdminCollectionInfo[] | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await listCollections()
        if (!cancelled) {
          setCollections(data)
          setError(null)
        }
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

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">Collections</h1>
        <p className="text-sm text-muted-foreground">
          Browse models, users, and push collections on this API.
        </p>
      </div>

      {collections == null && !error ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading collections">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : null}

      {error ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <DatabaseIcon />
            </EmptyMedia>
            <EmptyTitle>Could not load collections</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {collections && collections.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <DatabaseIcon />
            </EmptyMedia>
            <EmptyTitle>No collections</EmptyTitle>
            <EmptyDescription>
              This API has not registered any admin collections.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {collections && collections.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Fields</TableHead>
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
                <TableCell className="max-w-md truncate text-muted-foreground">
                  {collection.fields.join(", ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  )
}
