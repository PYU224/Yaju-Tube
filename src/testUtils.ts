// Shared helpers for unit tests. Application code never imports this module, so
// bundlers tree-shake it out of the production build; it lives under src/ only
// so spec files can import it through the same alias/tooling as the code they
// exercise.

// Builds a small in-memory File for upload tests (matches the fixture the
// PeerTube API specs relied on before this helper was shared).
export function makeFile(size: number): File {
  return new File([new Uint8Array(size)], 'v.mp4', { type: 'video/mp4' })
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
