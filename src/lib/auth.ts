import { useSyncExternalStore } from "react"

export const ADMIN_TOKEN_KEY = "codixus.adminToken"

const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY)
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
  emit()
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY)
  emit()
}

export function subscribeAdminToken(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAdminToken(): string | null {
  return useSyncExternalStore(subscribeAdminToken, getAdminToken, () => null)
}
