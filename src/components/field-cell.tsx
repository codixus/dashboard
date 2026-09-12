import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { formatCell } from "@/lib/json"
import { isImageField } from "@/lib/fields"

export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string
  alt: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4"
      onClick={onClose}
    >
      <Button
        type="button"
        variant="secondary"
        className="absolute top-4 right-4"
        onClick={(event) => {
          event.stopPropagation()
          onClose()
        }}
      >
        Close
      </Button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-full object-contain outline outline-1 outline-black/10 dark:outline-white/10"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  )
}

export function FieldCell({
  field,
  value,
  onOpenImage,
}: {
  field: string
  value: unknown
  onOpenImage: (src: string, alt: string) => void
}) {
  if (isImageField(field, value)) {
    return (
      <button
        type="button"
        className="block size-10 overflow-hidden border bg-muted"
        aria-label={`View ${field}`}
        onClick={(event) => {
          event.stopPropagation()
          onOpenImage(value, field)
        }}
      >
        <img
          src={value}
          alt=""
          className="size-full object-cover outline outline-1 outline-black/10 dark:outline-white/10"
        />
      </button>
    )
  }

  return <span className="block max-w-48 truncate">{formatCell(value)}</span>
}

export function UsersActions({
  deviceId,
  onSendPush,
}: {
  deviceId: string
  onSendPush: (deviceId: string) => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={(event) => {
        event.stopPropagation()
        onSendPush(deviceId)
      }}
    >
      Send push
    </Button>
  )
}
