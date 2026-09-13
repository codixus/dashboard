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
  BUILT_IN_JOURNEY_EVENTS,
  buildJourneyPayload,
  emptyJourneyEditor,
  emptyJourneyStep,
  emptyJourneyTranslation,
  journeyEditorToJson,
  journeyJsonToEditor,
  journeyToEditor,
  type JourneyEventSelection,
  type JourneyEditorState,
  type JourneyEditorStep,
  type JourneyEditorTranslation,
} from "@/lib/journeys"
import type { PushDevice, PushJourney } from "@/lib/types"

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"

const EMPTY_JOURNEY_JSON = JSON.stringify(
  {
    name: "",
    definition: {
      entryEvent: "user_created",
      steps: [
        {
          id: "welcome",
          offsetSeconds: 120,
          title: "Welcome",
          body: "Your message",
          translations: {
            tr: { title: "Hoş geldin", body: "Mesajın" },
          },
          data: { route: "/menu" },
        },
      ],
    },
  },
  null,
  2
)

function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : "REQUEST_FAILED"
}

function statusVariant(status: PushJourney["status"]) {
  if (status === "live") return "default" as const
  if (status === "paused") return "secondary" as const
  return "outline" as const
}

function JourneyEventField({
  id,
  label,
  selection,
  value,
  onChange,
}: {
  id: string
  label: string
  selection: JourneyEventSelection
  value: string
  onChange: (selection: JourneyEventSelection, value: string) => void
}) {
  const selectedEvent = BUILT_IN_JOURNEY_EVENTS.find(
    (event) => event.value === selection
  )
  const customLabel = `Custom ${label.toLowerCase()} name`

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        id={id}
        className={selectClass}
        value={selection}
        onChange={(event) => {
          const next = event.target.value as JourneyEventSelection
          onChange(
            next,
            next === "custom" ? (selection === "custom" ? value : "") : next
          )
        }}
      >
        <option value="">Select an event…</option>
        {BUILT_IN_JOURNEY_EVENTS.map((event) => (
          <option key={event.value} value={event.value}>
            {event.label}
          </option>
        ))}
        <option value="custom">Custom event…</option>
      </select>
      {selectedEvent ? (
        <p className="text-xs text-muted-foreground">
          {selectedEvent.description}
        </p>
      ) : null}
      {selection === "custom" ? (
        <Input
          aria-label={customLabel}
          value={value}
          placeholder="custom_event_name"
          onChange={(event) => onChange("custom", event.target.value)}
        />
      ) : null}
    </Field>
  )
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
  const [editorMode, setEditorMode] = useState<"builder" | "json">("builder")
  const [journeyJson, setJourneyJson] = useState(EMPTY_JOURNEY_JSON)

  const selected =
    journeys?.find((journey) => journey._id === selectedId) ?? null
  const testStep =
    editor?.steps.find((step) => step.clientId === testStepClientId) ??
    editor?.steps[0] ??
    null

  function openJourney(journey: PushJourney) {
    const nextEditor = journeyToEditor(journey)
    const nextJson = journeyEditorToJson(nextEditor)
    setSelectedId(journey._id)
    setEditor(nextEditor)
    setEditorMode("builder")
    if (nextJson.ok) setJourneyJson(nextJson.value)
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
    setEditorMode("builder")
    setJourneyJson(EMPTY_JOURNEY_JSON)
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

  function updateTranslation(
    stepClientId: string,
    translationClientId: string,
    update: (current: JourneyEditorTranslation) => JourneyEditorTranslation
  ) {
    updateStep(stepClientId, (step) => ({
      ...step,
      translations: step.translations.map((translation) =>
        translation.clientId === translationClientId
          ? update(translation)
          : translation
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

  function editableState(): JourneyEditorState | null {
    if (!editor) return null
    if (editorMode === "builder") return editor

    const parsed = journeyJsonToEditor(journeyJson)
    if (!parsed.ok) {
      setError(parsed.error)
      return null
    }
    return parsed.value
  }

  function showJsonEditor() {
    if (editorMode === "json") return
    if (!editor) return
    const serialized = journeyEditorToJson(editor)
    if (serialized.ok) setJourneyJson(serialized.value)
    setEditorMode("json")
    setError(null)
  }

  function showBuilder() {
    if (editorMode === "builder") return
    const parsed = journeyJsonToEditor(journeyJson)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setEditor(parsed.value)
    setTestStepClientId(parsed.value.steps[0]?.clientId ?? "")
    setEditorMode("builder")
    setError(null)
  }

  async function saveDraft() {
    const currentEditor = editableState()
    if (!currentEditor) return
    const payload = buildJourneyPayload(currentEditor)
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
        const currentEditor = editableState()
        if (!currentEditor) return
        const payload = buildJourneyPayload(currentEditor)
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
      const currentEditor = editableState()
      if (!currentEditor) return
      const payload = buildJourneyPayload(currentEditor)
      if (!payload.ok) {
        setError(payload.error)
        return
      }
      const selectedStepIndex = Math.max(
        0,
        editor.steps.findIndex((step) => step.clientId === testStepClientId)
      )
      const stepId = currentEditor.steps[selectedStepIndex]?.id
      if (!stepId) {
        setError("Select a device and step")
        return
      }
      const saved = await updateJourneyDraft(selected._id, payload.value)
      replaceJourney(saved)
      const results = await testJourneyStep(selected._id, {
        deviceId: testDevice.deviceId,
        stepId,
      })
      if (results.length === 0) {
        setError("NO_DEVICE")
        return
      }
      const submitted = results.filter(
        (result) => result.status === "submitted"
      )
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
      toast.success(
        `Test submitted to ${submitted.length}/${results.length} ${noun}`
      )
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

      <div
        data-testid="journey-workspace"
        data-layout="single-column"
        className="flex min-w-0 flex-col gap-6"
      >
        <section className="min-w-0" aria-label="All journeys">
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
            <div className="grid border sm:grid-cols-2 xl:grid-cols-3">
              {journeys.map((journey) => (
                <button
                  key={journey._id}
                  type="button"
                  aria-label={`Edit ${journey.name}`}
                  aria-current={selectedId === journey._id ? "true" : undefined}
                  className="flex min-w-0 items-center gap-2 border-b px-3 py-3 text-left hover:bg-muted/60 aria-current:bg-muted sm:border-r xl:[&:nth-child(3n)]:border-r-0"
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
        </section>

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
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border p-0.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          editorMode === "builder" ? "secondary" : "ghost"
                        }
                        onClick={showBuilder}
                      >
                        Builder
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={editorMode === "json" ? "secondary" : "ghost"}
                        onClick={showJsonEditor}
                      >
                        JSON
                      </Button>
                    </div>
                    {selected ? (
                      <Badge variant={statusVariant(selected.status)}>
                        {selected.status}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {editorMode === "json" ? (
                  <Field>
                    <FieldLabel htmlFor="journey-json">Journey JSON</FieldLabel>
                    <p className="text-xs text-muted-foreground">
                      Import or edit the complete API payload. Locale keys such
                      as tr, tr-TR and en-US are supported in each step's
                      translations.
                    </p>
                    <Textarea
                      id="journey-json"
                      className="min-h-[36rem] font-mono text-xs"
                      spellCheck={false}
                      value={journeyJson}
                      onChange={(event) => {
                        setJourneyJson(event.target.value)
                        setError(null)
                      }}
                    />
                  </Field>
                ) : (
                  <>
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
                        <JourneyEventField
                          id="entry-event"
                          label="Entry event"
                          selection={editor.entryEventSelection}
                          value={editor.entryEvent}
                          onChange={(selection, value) =>
                            edit((current) => ({
                              ...current,
                              entryEventSelection: selection,
                              entryEvent: value,
                            }))
                          }
                        />
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
                        {editor.audienceOperator !== "all" ? (
                          <JourneyEventField
                            id="audience-event"
                            label="Audience event"
                            selection={editor.audienceEventSelection}
                            value={editor.audienceEvent}
                            onChange={(selection, value) =>
                              edit((current) => ({
                                ...current,
                                audienceEventSelection: selection,
                                audienceEvent: value,
                              }))
                            }
                          />
                        ) : null}
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
                            <div className="mt-5 border-t pt-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-medium">
                                    Localized content
                                  </h4>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Exact locale, then base language, then the
                                    default content above.
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={step.translations.length >= 32}
                                  onClick={() =>
                                    updateStep(step.clientId, (current) => ({
                                      ...current,
                                      translations: [
                                        ...current.translations,
                                        emptyJourneyTranslation(),
                                      ],
                                    }))
                                  }
                                >
                                  <PlusIcon data-icon="inline-start" />
                                  Add translation
                                </Button>
                              </div>
                              {step.translations.length > 0 ? (
                                <div className="mt-4 flex flex-col gap-3">
                                  {step.translations.map(
                                    (translation, translationIndex) => {
                                      const translationNumber =
                                        translationIndex + 1
                                      return (
                                        <div
                                          key={translation.clientId}
                                          className="grid min-w-0 gap-3 rounded-lg border bg-card p-3 md:grid-cols-2"
                                        >
                                          <Field>
                                            <FieldLabel
                                              htmlFor={`step-${number}-translation-${translationNumber}-locale`}
                                            >
                                              Step {number} translation{" "}
                                              {translationNumber} locale
                                            </FieldLabel>
                                            <Input
                                              id={`step-${number}-translation-${translationNumber}-locale`}
                                              placeholder="tr or tr-TR"
                                              value={translation.locale}
                                              onChange={(event) =>
                                                updateTranslation(
                                                  step.clientId,
                                                  translation.clientId,
                                                  (current) => ({
                                                    ...current,
                                                    locale: event.target.value,
                                                  })
                                                )
                                              }
                                            />
                                          </Field>
                                          <div className="flex items-end justify-end">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon-sm"
                                              aria-label={`Remove step ${number} translation ${translationNumber}`}
                                              onClick={() =>
                                                updateStep(
                                                  step.clientId,
                                                  (current) => ({
                                                    ...current,
                                                    translations:
                                                      current.translations.filter(
                                                        (candidate) =>
                                                          candidate.clientId !==
                                                          translation.clientId
                                                      ),
                                                  })
                                                )
                                              }
                                            >
                                              <Trash2Icon />
                                            </Button>
                                          </div>
                                          <Field>
                                            <FieldLabel
                                              htmlFor={`step-${number}-translation-${translationNumber}-title`}
                                            >
                                              Step {number} translation{" "}
                                              {translationNumber} title
                                            </FieldLabel>
                                            <Input
                                              id={`step-${number}-translation-${translationNumber}-title`}
                                              maxLength={100}
                                              value={translation.title}
                                              onChange={(event) =>
                                                updateTranslation(
                                                  step.clientId,
                                                  translation.clientId,
                                                  (current) => ({
                                                    ...current,
                                                    title: event.target.value,
                                                  })
                                                )
                                              }
                                            />
                                          </Field>
                                          <Field>
                                            <FieldLabel
                                              htmlFor={`step-${number}-translation-${translationNumber}-message`}
                                            >
                                              Step {number} translation{" "}
                                              {translationNumber} message
                                            </FieldLabel>
                                            <Textarea
                                              id={`step-${number}-translation-${translationNumber}-message`}
                                              maxLength={1000}
                                              value={translation.body}
                                              onChange={(event) =>
                                                updateTranslation(
                                                  step.clientId,
                                                  translation.clientId,
                                                  (current) => ({
                                                    ...current,
                                                    body: event.target.value,
                                                  })
                                                )
                                              }
                                            />
                                          </Field>
                                          <Field className="md:col-span-2">
                                            <FieldLabel
                                              htmlFor={`step-${number}-translation-${translationNumber}-image`}
                                            >
                                              Step {number} translation{" "}
                                              {translationNumber} image URL
                                            </FieldLabel>
                                            <Input
                                              id={`step-${number}-translation-${translationNumber}-image`}
                                              type="url"
                                              placeholder="Optional; inherits the default image"
                                              value={translation.imageUrl}
                                              onChange={(event) =>
                                                updateTranslation(
                                                  step.clientId,
                                                  translation.clientId,
                                                  (current) => ({
                                                    ...current,
                                                    imageUrl:
                                                      event.target.value,
                                                  })
                                                )
                                              }
                                            />
                                          </Field>
                                        </div>
                                      )
                                    }
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </fieldset>
                        )
                      })}
                    </div>
                  </>
                )}

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
