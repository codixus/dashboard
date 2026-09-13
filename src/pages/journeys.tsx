import { useEffect, useState } from "react"
import {
  PlusIcon,
  RefreshCwIcon,
  SendIcon,
  SmartphoneIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  ErrorNote,
  EmptyNote,
  LoadingRows,
  PageHeader,
} from "@/components/page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  ApiError,
  createJourney,
  listJourneys,
  pauseJourney,
  publishJourney,
  resumeJourney,
  searchDevices,
  testJourneyStep,
  updateJourneyDraft,
} from "@/lib/api"
import {
  buildJourneyPayload,
  emptyJourneyEditor,
  emptyJourneyStep,
  journeyToEditor,
  type JourneyEditorState,
  type JourneyEditorStep,
} from "@/lib/journeys"
import type { PushDevice, PushJourney } from "@/lib/types"

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"

function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : "REQUEST_FAILED"
}

function statusVariant(status: PushJourney["status"]) {
  if (status === "live") return "default" as const
  if (status === "paused") return "secondary" as const
  return "outline" as const
}

export function JourneysPage() {
  const [journeys, setJourneys] = useState<PushJourney[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editor, setEditor] = useState<JourneyEditorState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deviceQuery, setDeviceQuery] = useState("")
  const [devices, setDevices] = useState<PushDevice[] | null>(null)
  const [testDevice, setTestDevice] = useState<PushDevice | null>(null)
  const [testStepClientId, setTestStepClientId] = useState("")
  const [searching, setSearching] = useState(false)
  const [testing, setTesting] = useState(false)

  const selected =
    journeys?.find((journey) => journey._id === selectedId) ?? null
  const testStep =
    editor?.steps.find((step) => step.clientId === testStepClientId) ??
    editor?.steps[0] ??
    null

  function openJourney(journey: PushJourney) {
    const nextEditor = journeyToEditor(journey)
    setSelectedId(journey._id)
    setEditor(nextEditor)
    setTestStepClientId(nextEditor.steps[0]?.clientId ?? "")
    setDevices(null)
    setTestDevice(null)
    setError(null)
  }

  async function refreshJourneys() {
    setError(null)
    try {
      const rows = await listJourneys()
      setJourneys(rows)
      if (rows.length > 0) {
        const current = rows.find((journey) => journey._id === selectedId)
        openJourney(current ?? rows[0])
      } else {
        setSelectedId(null)
        setEditor(null)
      }
    } catch (loadError) {
      setJourneys([])
      setError(errorCode(loadError))
    }
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const rows = await listJourneys()
        if (cancelled) return
        setJourneys(rows)
        if (rows.length > 0) {
          const first = rows[0]
          const nextEditor = journeyToEditor(first)
          setSelectedId(first._id)
          setEditor(nextEditor)
          setTestStepClientId(nextEditor.steps[0]?.clientId ?? "")
        } else {
          setSelectedId(null)
          setEditor(null)
        }
      } catch (loadError) {
        if (cancelled) return
        setJourneys([])
        setError(errorCode(loadError))
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  function startNewJourney() {
    setSelectedId(null)
    setEditor(emptyJourneyEditor())
    setTestStepClientId("")
    setDevices(null)
    setTestDevice(null)
    setError(null)
  }

  function edit(update: (current: JourneyEditorState) => JourneyEditorState) {
    setEditor((current) => (current ? update(current) : current))
    setError(null)
  }

  function updateStep(
    clientId: string,
    update: (current: JourneyEditorStep) => JourneyEditorStep
  ) {
    edit((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.clientId === clientId ? update(step) : step
      ),
    }))
  }

  function replaceJourney(next: PushJourney) {
    setJourneys((current) => {
      const rows = current ?? []
      return rows.some((journey) => journey._id === next._id)
        ? rows.map((journey) => (journey._id === next._id ? next : journey))
        : [next, ...rows]
    })
    openJourney(next)
  }

  async function saveDraft() {
    if (!editor) return
    const payload = buildJourneyPayload(editor)
    if (!payload.ok) {
      setError(payload.error)
      return
    }

    setBusy(true)
    setError(null)
    try {
      const next = selectedId
        ? await updateJourneyDraft(selectedId, payload.value)
        : await createJourney(payload.value)
      replaceJourney(next)
      toast.success(selectedId ? "Draft saved" : "Draft created")
    } catch (saveError) {
      setError(errorCode(saveError))
    } finally {
      setBusy(false)
    }
  }

  async function runTransition(action: "publish" | "pause" | "resume") {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      let target = selected
      if (action === "publish") {
        if (!editor) return
        const payload = buildJourneyPayload(editor)
        if (!payload.ok) {
          setError(payload.error)
          return
        }
        target = await updateJourneyDraft(selected._id, payload.value)
        replaceJourney(target)
      }
      const next =
        action === "publish"
          ? await publishJourney(target._id)
          : action === "pause"
            ? await pauseJourney(selected._id)
            : await resumeJourney(selected._id)
      replaceJourney(next)
      toast.success(
        action === "publish"
          ? "Journey published"
          : action === "pause"
            ? "Journey paused"
            : "Journey resumed"
      )
    } catch (transitionError) {
      setError(errorCode(transitionError))
    } finally {
      setBusy(false)
    }
  }

  async function findDevices() {
    const query = deviceQuery.trim()
    if (!query) {
      setError("Test device is required")
      return
    }
    setSearching(true)
    setError(null)
    try {
      setDevices(await searchDevices(query))
      setTestDevice(null)
    } catch (searchError) {
      setError(errorCode(searchError))
    } finally {
      setSearching(false)
    }
  }

  async function sendTest() {
    if (!selected || !editor || !testDevice || !testStep?.id) {
      setError("Select a device and step")
      return
    }
    setTesting(true)
    setError(null)
    try {
      const payload = buildJourneyPayload(editor)
      if (!payload.ok) {
        setError(payload.error)
        return
      }
      const saved = await updateJourneyDraft(selected._id, payload.value)
      replaceJourney(saved)
      const results = await testJourneyStep(selected._id, {
        deviceId: testDevice.deviceId,
        stepId: testStep.id,
      })
      if (results.length === 0) {
        setError("NO_DEVICE")
        return
      }
      const submitted = results.filter((result) => result.status === "submitted")
      if (submitted.length === 0) {
        const failed = results.find(
          (result) => result.status === "failed" || result.status === "skipped"
        )
        const code = failed?.errorCode ?? "SEND_FAILED"
        setError(
          failed?.errorMessage ? `${code}: ${failed.errorMessage}` : code
        )
        return
      }
      const noun = results.length === 1 ? "token" : "tokens"
      toast.success(`Test submitted to ${submitted.length}/${results.length} ${noun}`)
    } catch (testError) {
      setError(errorCode(testError))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Journeys"
        description="Build event-driven, linear push sequences. New events enroll only while a journey is live."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refreshJourneys()}
            >
              <RefreshCwIcon data-icon="inline-start" />
              Refresh
            </Button>
            <Button type="button" onClick={startNewJourney}>
              <PlusIcon data-icon="inline-start" />
              New journey
            </Button>
          </>
        }
      />

      <ErrorNote error={error} />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">All journeys</h2>
            <span className="font-mono text-xs text-muted-foreground">
              {journeys?.length ?? 0}
            </span>
          </div>
          {journeys === null ? <LoadingRows label="Loading journeys" /> : null}
          {journeys?.length === 0 ? (
            <EmptyNote>No journeys yet</EmptyNote>
          ) : null}
          {journeys && journeys.length > 0 ? (
            <div className="flex flex-col border">
              {journeys.map((journey) => (
                <button
                  key={journey._id}
                  type="button"
                  aria-label={`Edit ${journey.name}`}
                  aria-current={selectedId === journey._id ? "true" : undefined}
                  className="flex min-w-0 items-center gap-2 border-b px-3 py-3 text-left last:border-b-0 hover:bg-muted/60 aria-current:bg-muted"
                  onClick={() => openJourney(journey)}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {journey.name}
                  </span>
                  <Badge variant={statusVariant(journey.status)}>
                    {journey.status}
                  </Badge>
                </button>
              ))}
            </div>
          ) : null}
        </aside>

        <main className="min-w-0">
          {!editor && journeys !== null ? (
            <EmptyNote>Select a journey or create a new draft.</EmptyNote>
          ) : null}
          {editor ? (
            <div className="flex min-w-0 flex-col gap-6">
              <form
                className="flex min-w-0 flex-col gap-6 border bg-card p-4 sm:p-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  void saveDraft()
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                  <div>
                    <h2 className="font-medium">
                      {selected ? "Draft editor" : "New draft"}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Delays are absolute from the entry event, not from the
                      previous step.
                    </p>
                  </div>
                  {selected ? (
                    <Badge variant={statusVariant(selected.status)}>
                      {selected.status}
                    </Badge>
                  ) : null}
                </div>

                <FieldGroup>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="journey-name">
                        Journey name
                      </FieldLabel>
                      <Input
                        id="journey-name"
                        value={editor.name}
                        maxLength={100}
                        onChange={(event) =>
                          edit((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="entry-event">Entry event</FieldLabel>
                      <Input
                        id="entry-event"
                        value={editor.entryEvent}
                        placeholder="purchase_completed"
                        onChange={(event) =>
                          edit((current) => ({
                            ...current,
                            entryEvent: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="audience-operator">
                        Audience
                      </FieldLabel>
                      <select
                        id="audience-operator"
                        className={selectClass}
                        value={editor.audienceOperator}
                        onChange={(event) =>
                          edit((current) => ({
                            ...current,
                            audienceOperator: event.target
                              .value as JourneyEditorState["audienceOperator"],
                          }))
                        }
                      >
                        <option value="all">Everyone entering</option>
                        <option value="has_event">Has event</option>
                        <option value="not_has_event">
                          Does not have event
                        </option>
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="audience-event">
                        Audience event
                      </FieldLabel>
                      <Input
                        id="audience-event"
                        value={editor.audienceEvent}
                        placeholder="purchase_completed"
                        disabled={editor.audienceOperator === "all"}
                        onChange={(event) =>
                          edit((current) => ({
                            ...current,
                            audienceEvent: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                </FieldGroup>

                <div className="flex min-w-0 flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">Message steps</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ordered from earliest to latest. Maximum 20 steps.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={editor.steps.length >= 20}
                      onClick={() =>
                        edit((current) => ({
                          ...current,
                          steps: [
                            ...current.steps,
                            emptyJourneyStep(current.steps.length),
                          ],
                        }))
                      }
                    >
                      <PlusIcon data-icon="inline-start" />
                      Add step
                    </Button>
                  </div>

                  {editor.steps.map((step, index) => {
                    const number = index + 1
                    return (
                      <fieldset
                        key={step.clientId}
                        className="min-w-0 border bg-background p-4"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <legend className="text-sm font-medium">
                            Step {number}
                          </legend>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove step ${number}`}
                            disabled={editor.steps.length === 1}
                            onClick={() =>
                              edit((current) => ({
                                ...current,
                                steps: current.steps.filter(
                                  (candidate) =>
                                    candidate.clientId !== step.clientId
                                ),
                              }))
                            }
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                        <div className="grid min-w-0 gap-4 md:grid-cols-2">
                          <Field>
                            <FieldLabel htmlFor={`step-${number}-id`}>
                              Step {number} ID
                            </FieldLabel>
                            <Input
                              id={`step-${number}-id`}
                              value={step.id}
                              onChange={(event) =>
                                updateStep(step.clientId, (current) => ({
                                  ...current,
                                  id: event.target.value,
                                }))
                              }
                            />
                          </Field>
                          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
                            <Field>
                              <FieldLabel htmlFor={`step-${number}-delay`}>
                                Step {number} delay
                              </FieldLabel>
                              <Input
                                id={`step-${number}-delay`}
                                type="number"
                                min="0"
                                step="any"
                                value={step.delay}
                                onChange={(event) =>
                                  updateStep(step.clientId, (current) => ({
                                    ...current,
                                    delay: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={`step-${number}-unit`}>
                                Unit
                              </FieldLabel>
                              <select
                                id={`step-${number}-unit`}
                                className={selectClass}
                                value={step.delayUnit}
                                onChange={(event) =>
                                  updateStep(step.clientId, (current) => ({
                                    ...current,
                                    delayUnit: event.target
                                      .value as JourneyEditorStep["delayUnit"],
                                  }))
                                }
                              >
                                <option value="minutes">Minutes</option>
                                <option value="hours">Hours</option>
                                <option value="days">Days</option>
                              </select>
                            </Field>
                          </div>
                          <Field>
                            <FieldLabel htmlFor={`step-${number}-title`}>
                              Step {number} title
                            </FieldLabel>
                            <Input
                              id={`step-${number}-title`}
                              maxLength={100}
                              value={step.title}
                              onChange={(event) =>
                                updateStep(step.clientId, (current) => ({
                                  ...current,
                                  title: event.target.value,
                                }))
                              }
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor={`step-${number}-message`}>
                              Step {number} message
                            </FieldLabel>
                            <Textarea
                              id={`step-${number}-message`}
                              maxLength={1000}
                              value={step.body}
                              onChange={(event) =>
                                updateStep(step.clientId, (current) => ({
                                  ...current,
                                  body: event.target.value,
                                }))
                              }
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor={`step-${number}-image`}>
                              Step {number} image URL
                            </FieldLabel>
                            <Input
                              id={`step-${number}-image`}
                              type="url"
                              placeholder="https://..."
                              value={step.imageUrl}
                              onChange={(event) =>
                                updateStep(step.clientId, (current) => ({
                                  ...current,
                                  imageUrl: event.target.value,
                                }))
                              }
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor={`step-${number}-route`}>
                              Step {number} route
                            </FieldLabel>
                            <Input
                              id={`step-${number}-route`}
                              placeholder="/menu"
                              value={step.route}
                              onChange={(event) =>
                                updateStep(step.clientId, (current) => ({
                                  ...current,
                                  route: event.target.value,
                                }))
                              }
                            />
                          </Field>
                          <Field className="md:col-span-2">
                            <FieldLabel htmlFor={`step-${number}-data`}>
                              Step {number} data JSON
                            </FieldLabel>
                            <Textarea
                              id={`step-${number}-data`}
                              className="min-h-24 font-mono text-xs"
                              value={step.dataText}
                              onChange={(event) =>
                                updateStep(step.clientId, (current) => ({
                                  ...current,
                                  dataText: event.target.value,
                                }))
                              }
                            />
                          </Field>
                        </div>
                      </fieldset>
                    )
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                  <Button type="submit" disabled={busy}>
                    {busy ? <Spinner data-icon="inline-start" /> : null}
                    {selected ? "Save draft" : "Create draft"}
                  </Button>
                  {selected?.status === "draft" ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void runTransition("publish")}
                    >
                      Publish
                    </Button>
                  ) : null}
                  {selected?.status === "live" ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void runTransition("publish")}
                      >
                        Publish changes
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void runTransition("pause")}
                      >
                        Pause
                      </Button>
                    </>
                  ) : null}
                  {selected?.status === "paused" ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void runTransition("publish")}
                      >
                        Publish changes
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void runTransition("resume")}
                      >
                        Resume
                      </Button>
                    </>
                  ) : null}
                </div>
              </form>

              {selected ? (
                <section className="border bg-card p-4 sm:p-5">
                  <div className="mb-4">
                    <h2 className="text-sm font-medium">Test a draft step</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sends immediately to one currently registered device and
                      creates no journey run.
                    </p>
                  </div>
                  <form
                    className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto]"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void findDevices()
                    }}
                  >
                    <Field>
                      <FieldLabel htmlFor="test-device">Test device</FieldLabel>
                      <Input
                        id="test-device"
                        value={deviceQuery}
                        placeholder="deviceId or token substring"
                        onChange={(event) => {
                          setDeviceQuery(event.target.value)
                          setError(null)
                        }}
                      />
                    </Field>
                    <Button
                      type="submit"
                      variant="outline"
                      className="self-end"
                      disabled={searching}
                    >
                      {searching ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <SmartphoneIcon />
                      )}
                      Search devices
                    </Button>
                  </form>

                  {devices?.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No devices found.
                    </p>
                  ) : null}
                  {devices && devices.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {devices.map((device) => (
                        <Button
                          key={device._id}
                          type="button"
                          size="sm"
                          variant={
                            testDevice?._id === device._id
                              ? "secondary"
                              : "outline"
                          }
                          aria-label={`Select ${device.deviceId}`}
                          onClick={() => {
                            setTestDevice(device)
                            setError(null)
                          }}
                        >
                          {device.deviceId} · {device.platform}
                        </Button>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <Field>
                      <FieldLabel htmlFor="test-step">Test step</FieldLabel>
                      <select
                        id="test-step"
                        className={selectClass}
                        value={testStep?.clientId ?? ""}
                        onChange={(event) =>
                          setTestStepClientId(event.target.value)
                        }
                      >
                        {editor.steps.map((step) => (
                          <option key={step.clientId} value={step.clientId}>
                            {step.id || "Unnamed step"}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Button
                      type="button"
                      className="self-end"
                      disabled={!testDevice || !testStep?.id || testing}
                      onClick={() => void sendTest()}
                    >
                      {testing ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <SendIcon />
                      )}
                      Send test
                    </Button>
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  )
}
