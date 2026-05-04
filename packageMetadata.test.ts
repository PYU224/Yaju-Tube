// @vitest-environment node

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface PackageMetadata {
  dependencies: Record<string, string>
  scripts: Record<string, string>
  devDependencies: Record<string, string>
  overrides?: Record<string, string>
}

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as PackageMetadata

describe('package metadata', () => {
  it('keeps Cypress e2e self-contained and overrides the vulnerable request chain', () => {
    expect(packageJson.scripts['test:e2e']).toBe(
      'start-server-and-test "vite --host 127.0.0.1 --port 5173" http://127.0.0.1:5173 "cypress run"',
    )
    expect(packageJson.devDependencies.cypress).toBe('^15.14.2')
    expect(packageJson.devDependencies['start-server-and-test']).toBe('^2.1.5')
    expect(packageJson.overrides?.['@cypress/request']).toBe('^4.0.0')
  })

  it('does not ship the unused Cordova fullscreen plugin path', () => {
    expect(packageJson.dependencies).not.toHaveProperty('@awesome-cordova-plugins/android-full-screen')
    expect(packageJson.dependencies).not.toHaveProperty('cordova-plugin-fullscreen')
  })

  it('keeps the test-only DOM toolchain off deprecated transitive packages', () => {
    expect(packageJson.devDependencies.jsdom).toBe('^29.1.1')
    expect(packageJson.overrides?.glob).toBe('^13.0.6')
  })
})
