// Shared helpers for unit tests. Application code never imports this module, so
// bundlers tree-shake it out of the production build; it lives under src/ only
// so spec files can import it through the same alias/tooling as the code they
// exercise.
import type { Component } from 'vue'
import type { Pinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router, type RouteRecordRaw } from 'vue-router'
import i18n from '@/i18n'

// Builds a small in-memory File for upload tests (matches the fixture the
// PeerTube API specs relied on before this helper was shared).
export function makeFile(size: number): File {
  return new File([new Uint8Array(size)], 'v.mp4', { type: 'video/mp4' })
}

// Creates a vue-router instance backed by in-memory history, wrapping the
// createRouter/createMemoryHistory pairing every view spec repeats verbatim.
export function createTestRouter(routes: RouteRecordRaw[]): Router {
  return createRouter({ history: createMemoryHistory(), routes })
}

// Builds the `global` mount option shared by every view spec: the app i18n
// plugin alongside the test's pinia and router, plus the caller's Ionic stubs.
export function testGlobal(pinia: Pinia, router: Router, stubs: Record<string, Component>) {
  return { plugins: [pinia, router, i18n], stubs }
}

// The subset of an axios error shape that the view error-mapping specs assert
// against.
export type AxiosLikeError = Error & {
  isAxiosError: true
  code?: string
  response?: {
    status: number
    statusText: string
  }
  request?: object
}

// Creates an axios-shaped rejection with `isAxiosError` pinned true, letting a
// spec override only the fields relevant to the branch under test.
export function axiosError(overrides: Omit<Partial<AxiosLikeError>, 'isAxiosError'> = {}): AxiosLikeError {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true as const,
    ...overrides,
  })
}
