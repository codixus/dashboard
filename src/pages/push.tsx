import { useEffect, useState } from "react"
import { useSearchParams } from "react-router"
import { SmartphoneIcon } from "lucide-react"
import { toast } from "sonner"

import { ApiError, listDeliveries, searchDevices, sendPush } from "@/lib/api"
import { formatCell, parseJsonObject } from "@/lib/json"
import type { PushDelivery, PushDevice } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { PageHeader, TableScroll } from "@/components/page"
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
import { Input } from "@/components/ui/input"

const EMPTY_OBJECT = "{}"

function statusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "failed") {
    return "destructive"
  }
  if (status === "opened") {
    return "default"
  }
  if (status === "submitted") {
    return "secondary"
  }
  return "outline"
}

export function PushPage() {
  const [searchParams] = useSearchParams()
  const preset = searchParams.get("deviceId") ?? searchParams.get("user") ?? ""
  const [query, setQuery] = useState(preset)
  const [devices, setDevices] = useState<PushDevice[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<PushDevice | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [dataText, setDataText] = useState(EMPTY_OBJECT)
  const [sending, setSending] = useState(false)
  const [deliveries, setDeliveries] = useState<PushDelivery[] | null>(null)

  async function loadDeliveries(deviceId: string) {
    try {
      const rows = await listDeliveries(deviceId)
      setDeliveries(rows)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.code : "REQUEST_FAILED")
    }
  }

  async function runSearch(raw: string) {
    const q = raw.trim()
    if (!q) {
      toast.error("Query is required")
      return
    }
    setSearching(true)
    try {
      const rows = await searchDevices(q)
      setDevices(rows)
      if (rows.length === 1) {
        setSelected(rows[0])
        await loadDeliveries(rows[0].deviceId)
      } else {
        setSelected(null)
        setDeliveries(null)
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.code : "REQUEST_FAILED")
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    if (!preset) {
      return
    }

    let cancelled = false
    async function loadPreset() {
      setSearching(true)
      try {
        const rows = await searchDevices(preset)
        if (cancelled) return
        setDevices(rows)
        if (rows.length === 1) {
          const device = rows[0]
          setSelected(device)
          const recent = await listDeliveries(device.deviceId)
          if (!cancelled) setDeliveries(recent)
        } else {
          setSelected(null)
          setDeliveries(null)
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.code : "REQUEST_FAILED")
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    }

    void loadPreset()
    return () => {
      cancelled = true
    }
  }, [preset])

  async function onSearch() {
    await runSearch(query)
  }

  async function onSelect(device: PushDevice) {
    setSelected(device)
    setDeliveries(null)
    await loadDeliveries(device.deviceId)
  }

  async function onSend() {
    if (!selected) {
      toast.error("Select a device")
      return
    }
    const nextTitle = title.trim()
    const nextBody = body.trim()
    if (!nextTitle || !nextBody) {
      toast.error("Title and body are required")
      return
    }
    const parsed = parseJsonObject(dataText)
    if (!parsed.ok) {
      toast.error(parsed.message)
      return
    }
    const payload: {
      deviceId: string
      title: string
      body: string
      imageUrl?: string
      data?: Record<string, unknown>
    } = {
      deviceId: selected.deviceId,
      title: nextTitle,
      body: nextBody,
    }
    if (Object.keys(parsed.value).length > 0) {
      payload.data = parsed.value
    }
    const nextImageUrl = imageUrl.trim()
    if (nextImageUrl) {
      try {
        if (new URL(nextImageUrl).protocol !== "https:")
          throw new Error("invalid")
      } catch {
        toast.error("Image URL must use HTTPS")
        return
      }
      payload.imageUrl = nextImageUrl
    }

    setSending(true)
    try {
      const results = await sendPush(payload)
      const submitted = results.filter((result) => result.status === "submitted")
      if (submitted.length === 0) {
        const failed = results.find(
          (result) => result.status === "failed" || result.status === "skipped"
        )
        const code = failed?.errorCode ?? "SEND_FAILED"
        toast.error(
          failed?.errorMessage ? `${code}: ${failed.errorMessage}` : code
        )
        await loadDeliveries(selected.deviceId)
        return
      }
      toast.success("Push sent")
      await loadDeliveries(selected.deviceId)
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.code)
        return
      }
      toast.error("Could not send push")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Push"
        description="Search a registered device and send a single notification."
      />

      <form
        className="flex max-w-xl flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void onSearch()
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="device-query">Device query</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="device-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="deviceId or token substring"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="submit"
                  variant="ghost"
                  disabled={searching}
                >
                  {searching ? <Spinner /> : "Search"}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </FieldGroup>
      </form>

      {devices && devices.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SmartphoneIcon />
            </EmptyMedia>
            <EmptyTitle>No devices</EmptyTitle>
            <EmptyDescription>
              No enabled or matching devices for that query.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {devices && devices.length > 0 ? (
        <TableScroll>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>deviceId</TableHead>
                <TableHead>platform</TableHead>
                <TableHead className="hidden @lg/table:table-cell">
                  enabled
                </TableHead>
                <TableHead>token</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((device) => (
                <TableRow
                  key={device._id}
                  className="cursor-pointer"
                  data-state={
                    selected?._id === device._id ? "selected" : undefined
                  }
                  tabIndex={0}
                  onClick={() => void onSelect(device)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      void onSelect(device)
                    }
                  }}
                >
                  <TableCell className="font-medium">
                    {device.deviceId}
                  </TableCell>
                  <TableCell>{device.platform}</TableCell>
                  <TableCell className="hidden @lg/table:table-cell">
                    {device.enabled ? "true" : "false"}
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    {device.token}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScroll>
      ) : null}

      <form
        className="flex max-w-xl flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void onSend()
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="push-title">Title</FieldLabel>
            <Input
              id="push-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={!selected}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="push-body">Body</FieldLabel>
            <Textarea
              id="push-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              disabled={!selected}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="push-data">Data JSON</FieldLabel>
            <Textarea
              id="push-data"
              className="min-h-20 font-mono text-xs"
              value={dataText}
              onChange={(event) => setDataText(event.target.value)}
              disabled={!selected}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="push-image">Image URL</FieldLabel>
            <Input
              id="push-image"
              type="url"
              placeholder="https://..."
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              disabled={!selected}
            />
          </Field>
        </FieldGroup>
        <div>
          <Button type="submit" disabled={!selected || sending}>
            {sending ? <Spinner data-icon="inline-start" /> : null}
            Send
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Deliveries</h2>
        {selected && deliveries && deliveries.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No deliveries</EmptyTitle>
              <EmptyDescription>
                This device has no recent push deliveries.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {deliveries && deliveries.length > 0 ? (
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>createdAt</TableHead>
                  <TableHead>title</TableHead>
                  <TableHead>status</TableHead>
                  <TableHead className="hidden @lg/table:table-cell">
                    errorCode
                  </TableHead>
                  <TableHead className="hidden @xl/table:table-cell">
                    details
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell>{formatCell(row.createdAt)}</TableCell>
                    <TableCell className="max-w-64 truncate">
                      {row.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground @lg/table:table-cell">
                      {row.errorCode ?? ""}
                    </TableCell>
                    <TableCell className="hidden max-w-96 whitespace-normal text-muted-foreground @xl/table:table-cell">
                      {row.errorMessage ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        ) : null}
      </div>
    </div>
  )
}
