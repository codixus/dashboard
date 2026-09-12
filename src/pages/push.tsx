import { useState } from "react"
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
  const [query, setQuery] = useState("")
  const [devices, setDevices] = useState<PushDevice[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<PushDevice | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
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

  async function onSearch() {
    const q = query.trim()
    if (!q) {
      toast.error("Query is required")
      return
    }
    setSearching(true)
    try {
      const rows = await searchDevices(q)
      setDevices(rows)
      setSelected(null)
      setDeliveries(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.code : "REQUEST_FAILED")
    } finally {
      setSearching(false)
    }
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
      data?: Record<string, unknown>
    } = {
      deviceId: selected.deviceId,
      title: nextTitle,
      body: nextBody,
    }
    if (Object.keys(parsed.value).length > 0) {
      payload.data = parsed.value
    }

    setSending(true)
    try {
      await sendPush(payload)
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
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">Push</h1>
        <p className="text-sm text-muted-foreground">
          Search a registered device and send a single notification.
        </p>
      </div>

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
                <InputGroupButton type="submit" variant="ghost" disabled={searching}>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>deviceId</TableHead>
              <TableHead>platform</TableHead>
              <TableHead>enabled</TableHead>
              <TableHead>token</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => (
              <TableRow
                key={device._id}
                className="cursor-pointer"
                data-state={selected?._id === device._id ? "selected" : undefined}
                tabIndex={0}
                onClick={() => void onSelect(device)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    void onSelect(device)
                  }
                }}
              >
                <TableCell className="font-medium">{device.deviceId}</TableCell>
                <TableCell>{device.platform}</TableCell>
                <TableCell>{device.enabled ? "true" : "false"}</TableCell>
                <TableCell className="max-w-64 truncate text-muted-foreground">
                  {device.token}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>createdAt</TableHead>
                <TableHead>title</TableHead>
                <TableHead>status</TableHead>
                <TableHead>errorCode</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((row) => (
                <TableRow key={row._id}>
                  <TableCell>{formatCell(row.createdAt)}</TableCell>
                  <TableCell className="max-w-64 truncate">{row.title}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.errorCode ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </div>
    </div>
  )
}
