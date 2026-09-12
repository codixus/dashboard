import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"

import {
  ApiError,
  createDocument,
  deleteDocument,
  listCollections,
  listDocuments,
  patchDocument,
} from "@/lib/api"
import { parseJsonObject, prettyJson } from "@/lib/json"
import type { AdminCollectionInfo, CollectionDoc } from "@/lib/types"
import { FieldCell, ImageLightbox, UsersActions } from "@/components/field-cell"
import { JsonEditor } from "@/components/json-editor"
import { EmptyNote, ErrorNote, LoadingRows, PageHeader, TableScroll } from "@/components/page"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
  const navigate = useNavigate()
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
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null
  )

  const fields = collection?.fields ?? ["_id"]
  const isUsers = collection?.kind === "users" || name === "users"
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
    setLightbox(null)
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
      const result = await listDocuments(name, {
        filter: appliedFilter,
        limit: PAGE_LIMIT,
        skip: 0,
      })
      setDocs(result.docs)
      setNextSkip(result.nextSkip)
      setListError(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.code : "REQUEST_FAILED")
    } finally {
      setCreating(false)
    }
  }

  if (missing) {
    return (
      <EmptyNote>
        Collection not found.{" "}
        <Link to="/collections" className="underline underline-offset-4">
          Back to collections
        </Link>
      </EmptyNote>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={name}
        description="Filter, inspect, and edit documents as JSON."
        actions={
          <Button
            onClick={() => {
              setCreateText(EMPTY_OBJECT)
              setCreateOpen(true)
            }}
          >
            New
          </Button>
        }
      />

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
          <span className="font-mono text-xs text-muted-foreground">{rangeLabel}</span>
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
        <LoadingRows label="Loading documents" />
      ) : null}

      <ErrorNote error={listError} />

      {docs && docs.length === 0 ? (
        <EmptyNote>Adjust the filter or create a new document.</EmptyNote>
      ) : null}

      {docs && docs.length > 0 ? (
        <TableScroll>
          <Table>
            <TableHeader>
              <TableRow>
                {fields.map((field) => (
                  <TableHead key={field}>{field}</TableHead>
                ))}
                {isUsers ? <TableHead>Actions</TableHead> : null}
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
                    <TableCell key={field} className="max-w-48">
                      <FieldCell
                        field={field}
                        value={doc[field]}
                        onOpenImage={(src, alt) => setLightbox({ src, alt })}
                      />
                    </TableCell>
                  ))}
                  {isUsers ? (
                    <TableCell>
                      <UsersActions
                        deviceId={String(doc.deviceId ?? "")}
                        onSendPush={(deviceId) => {
                          navigate(`/push?deviceId=${encodeURIComponent(deviceId)}`)
                        }}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScroll>
      ) : null}

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Edit document</SheetTitle>
            <SheetDescription>
              Updates keys in this JSON; omitted keys are kept.
              {editorDoc ? ` ${name} / ${documentId(editorDoc)}` : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col px-4">
            <JsonEditor
              id="document-json"
              label="Document JSON"
              value={editorText}
              onChange={setEditorText}
            />
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
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
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
            <DialogDescription>POST a JSON document to {name}.</DialogDescription>
          </DialogHeader>
          <JsonEditor
            id="new-document-json"
            label="Document JSON"
            value={createText}
            onChange={setCreateText}
          />
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

      {lightbox ? (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  )
}
