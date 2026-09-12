import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { FileJsonIcon } from "lucide-react"
import { toast } from "sonner"

import {
  ApiError,
  createDocument,
  deleteDocument,
  listCollections,
  listDocuments,
  patchDocument,
} from "@/lib/api"
import { formatCell, parseJsonObject, prettyJson } from "@/lib/json"
import type { AdminCollectionInfo, CollectionDoc } from "@/lib/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

const PAGE_LIMIT = 50
const EMPTY_OBJECT = "{}"

function documentId(doc: CollectionDoc): string {
  return String(doc._id ?? "")
}

export function CollectionPage() {
  const { name = "" } = useParams()
  const [collection, setCollection] = useState<AdminCollectionInfo | null>(null)
  const [missing, setMissing] = useState(false)
  const [docs, setDocs] = useState<CollectionDoc[] | null>(null)
  const [nextSkip, setNextSkip] = useState<number | undefined>()
  const [skip, setSkip] = useState(0)
  const [filterText, setFilterText] = useState(EMPTY_OBJECT)
  const [appliedFilter, setAppliedFilter] = useState(EMPTY_OBJECT)
  const [listError, setListError] = useState<string | null>(null)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorDoc, setEditorDoc] = useState<CollectionDoc | null>(null)
  const [editorText, setEditorText] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createText, setCreateText] = useState(EMPTY_OBJECT)
  const [creating, setCreating] = useState(false)

  const fields = collection?.fields ?? ["_id"]
  const [pageName, setPageName] = useState(name)
  if (name !== pageName) {
    setPageName(name)
    setSkip(0)
    setDocs(null)
    setFilterText(EMPTY_OBJECT)
    setAppliedFilter(EMPTY_OBJECT)
    setListError(null)
    setEditorOpen(false)
    setCreateOpen(false)
    setNextSkip(undefined)
    setMissing(false)
    setCollection(null)
  }

  const reload = useCallback(async () => {
    try {
      const result = await listDocuments(name, {
        filter: appliedFilter,
        limit: PAGE_LIMIT,
        skip,
      })
      setDocs(result.docs)
      setNextSkip(result.nextSkip)
      setListError(null)
    } catch (err) {
      const message = err instanceof ApiError ? err.code : "REQUEST_FAILED"
      setListError(message)
      toast.error(message)
    }
  }, [appliedFilter, name, skip])

  useEffect(() => {
    let cancelled = false

    async function loadMeta() {
      try {
        const collections = await listCollections()
        if (cancelled) {
          return
        }
        const match = collections.find((item) => item.name === name)
        if (!match) {
          setMissing(true)
          setCollection(null)
          return
        }
        setMissing(false)
        setCollection(match)
      } catch (err) {
        if (cancelled) {
          return
        }
        const message = err instanceof ApiError ? err.code : "REQUEST_FAILED"
        toast.error(message)
      }
    }

    void loadMeta()
    return () => {
      cancelled = true
    }
  }, [name])

  useEffect(() => {
    if (!name || missing) {
      return
    }

    let cancelled = false

    async function loadDocs() {
      try {
        const result = await listDocuments(name, {
          filter: appliedFilter,
          limit: PAGE_LIMIT,
          skip,
        })
        if (cancelled) {
          return
        }
        setDocs(result.docs)
        setNextSkip(result.nextSkip)
        setListError(null)
      } catch (err) {
        if (cancelled) {
          return
        }
        const message = err instanceof ApiError ? err.code : "REQUEST_FAILED"
        setListError(message)
        toast.error(message)
      }
    }

    void loadDocs()
    return () => {
      cancelled = true
    }
  }, [appliedFilter, missing, name, skip])

  const rangeLabel = useMemo(() => {
    if (!docs || docs.length === 0) {
      return "No rows"
    }
    const start = skip + 1
    const end = skip + docs.length
    return `${start}-${end}`
  }, [docs, skip])

  function applyFilter() {
    const parsed = parseJsonObject(filterText)
    if (!parsed.ok) {
      toast.error(parsed.message)
      return
    }
    setAppliedFilter(JSON.stringify(parsed.value))
    setSkip(0)
    setDocs(null)
  }

  function openEditor(doc: CollectionDoc) {
    setEditorDoc(doc)
    setEditorText(prettyJson(doc))
    setEditorOpen(true)
  }

  async function saveEditor() {
    if (!editorDoc) {
      return
    }
    const parsed = parseJsonObject(editorText)
    if (!parsed.ok) {
      toast.error(parsed.message)
      return
    }
    const id = documentId(editorDoc)
    if (!id) {
      toast.error("Document is missing _id")
      return
    }
    setSaving(true)
    try {
      await patchDocument(name, id, parsed.value)
      toast.success("Document saved")
      setEditorOpen(false)
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.code : "REQUEST_FAILED")
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!editorDoc) {
      return
    }
    const id = documentId(editorDoc)
    if (!id) {
      toast.error("Document is missing _id")
      return
    }
    try {
      await deleteDocument(name, id)
      toast.success("Document deleted")
      setDeleteOpen(false)
      setEditorOpen(false)
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.code : "REQUEST_FAILED")
    }
  }

  async function createDoc() {
    const parsed = parseJsonObject(createText)
    if (!parsed.ok) {
      toast.error(parsed.message)
      return
    }
    setCreating(true)
    try {
      await createDocument(name, parsed.value)
      toast.success("Document created")
      setCreateOpen(false)
      setCreateText(EMPTY_OBJECT)
      setSkip(0)
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.code : "REQUEST_FAILED")
    } finally {
      setCreating(false)
    }
  }

  if (missing) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileJsonIcon />
            </EmptyMedia>
            <EmptyTitle>Collection not found</EmptyTitle>
            <EmptyDescription>
              <Link to="/" className="underline underline-offset-4">
                Back to collections
              </Link>
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            <Link to="/" className="underline-offset-4 hover:underline">
              Collections
            </Link>
          </p>
          <h1 className="text-lg font-medium">{name}</h1>
        </div>
        <Button
          onClick={() => {
            setCreateText(EMPTY_OBJECT)
            setCreateOpen(true)
          }}
        >
          New
        </Button>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          applyFilter()
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="collection-filter">Filter JSON</FieldLabel>
            <Textarea
              id="collection-filter"
              className="min-h-20 font-mono text-xs"
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
            />
          </Field>
        </FieldGroup>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="outline" size="sm">
            Apply filter
          </Button>
          <span className="text-xs text-muted-foreground">{rangeLabel}</span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={skip === 0}
              onClick={() => setSkip(Math.max(0, skip - PAGE_LIMIT))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={nextSkip == null}
              onClick={() => {
                if (nextSkip != null) {
                  setSkip(nextSkip)
                }
              }}
            >
              Next
            </Button>
          </div>
        </div>
      </form>

      {docs == null && !listError ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading documents">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : null}

      {listError ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileJsonIcon />
            </EmptyMedia>
            <EmptyTitle>Could not load documents</EmptyTitle>
            <EmptyDescription>{listError}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {docs && docs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileJsonIcon />
            </EmptyMedia>
            <EmptyTitle>No documents</EmptyTitle>
            <EmptyDescription>
              Adjust the filter or create a new document.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {docs && docs.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              {fields.map((field) => (
                <TableHead key={field}>{field}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc, index) => (
              <TableRow
                key={documentId(doc) || String(index)}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => openEditor(doc)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    openEditor(doc)
                  }
                }}
              >
                {fields.map((field) => (
                  <TableCell key={field} className="max-w-48 truncate">
                    {formatCell(doc[field])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Edit document</SheetTitle>
            <SheetDescription>
              {name}
              {editorDoc ? ` / ${documentId(editorDoc)}` : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col px-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="document-json">Document JSON</FieldLabel>
                <Textarea
                  id="document-json"
                  className="min-h-64 font-mono text-xs"
                  value={editorText}
                  onChange={(event) => setEditorText(event.target.value)}
                />
              </Field>
            </FieldGroup>
          </div>
          <SheetFooter>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
            <Button type="button" onClick={() => void saveEditor()} disabled={saving}>
              {saving ? <Spinner data-icon="inline-start" /> : null}
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the document.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void confirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New document</DialogTitle>
            <DialogDescription>
              POST a JSON document to {name}.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-document-json">Document JSON</FieldLabel>
              <Textarea
                id="new-document-json"
                className="min-h-48 font-mono text-xs"
                value={createText}
                onChange={(event) => setCreateText(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void createDoc()} disabled={creating}>
              {creating ? <Spinner data-icon="inline-start" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
