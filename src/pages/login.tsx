import { useState, type FormEvent } from "react"
import { Navigate, useNavigate } from "react-router"
import { toast } from "sonner"

import { ApiError, checkSession, getApiOrigin } from "@/lib/api"
import { setAdminToken, useAdminToken } from "@/lib/auth"
import { dashboardBrand } from "@/lib/brand"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export function LoginPage() {
  const token = useAdminToken()
  const navigate = useNavigate()
  const apiOrigin = getApiOrigin()
  const [value, setValue] = useState("")
  const [pending, setPending] = useState(false)

  if (token) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextToken = value.trim()
    if (!nextToken) {
      toast.error("Token is required")
      return
    }

    setPending(true)
    try {
      await checkSession(nextToken)
      setAdminToken(nextToken)
      navigate("/", { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.code)
      } else {
        toast.error("Could not reach API")
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full min-w-0 flex-col bg-background md:flex-row">
      <aside className="flex w-full shrink-0 flex-col justify-between gap-4 self-stretch bg-primary px-5 py-6 text-primary-foreground sm:px-8 md:min-h-svh md:w-[min(42%,28rem)] md:px-10 md:py-12">
        <div className="flex min-w-0 flex-col gap-2 md:gap-3">
          <p className="text-[0.7rem] font-medium tracking-[0.22em] text-primary-foreground/65 uppercase">
            Operator
          </p>
          <p className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            {dashboardBrand.name}
          </p>
          <p className="max-w-xs text-sm leading-6 text-primary-foreground/70">
            {dashboardBrand.description}
          </p>
        </div>
        <p className="truncate font-mono text-xs text-primary-foreground/55 md:break-all md:whitespace-normal">
          {apiOrigin}
        </p>
      </aside>

      <main className="flex w-full min-w-0 flex-1 items-center justify-center self-stretch px-5 py-8 sm:px-8 md:px-12">
        <form
          onSubmit={onSubmit}
          className="flex w-full max-w-md flex-col gap-8"
        >
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Paste the admin token. It stays in this browser session.
            </p>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="admin-token">Admin token</FieldLabel>
              <Input
                id="admin-token"
                name="token"
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={pending}
                className="h-11 font-mono"
              />
              <FieldDescription>
                Sent only as the admin authorization header. Not stored in env.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full"
            disabled={pending}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Sign in
          </Button>
        </form>
      </main>
    </div>
  )
}
