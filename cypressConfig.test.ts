// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import config from './cypress.config'

describe('cypress config', () => {
  it('runs e2e specs against the local Vite server', () => {
    expect(config.allowCypressEnv).toBe(false)
    expect(config.e2e?.baseUrl).toBe('http://127.0.0.1:5173')
    expect(config.e2e?.supportFile).toBe('tests/e2e/support/e2e.{js,jsx,ts,tsx}')
    expect(config.e2e?.specPattern).toBe('tests/e2e/specs/**/*.cy.{js,jsx,ts,tsx}')
    expect(config.e2e?.videosFolder).toBe('tests/e2e/videos')
    expect(config.e2e?.screenshotsFolder).toBe('tests/e2e/screenshots')
    expect(config.e2e?.setupNodeEvents?.(vi.fn() as never, {} as never)).toBeUndefined()
  })
})
