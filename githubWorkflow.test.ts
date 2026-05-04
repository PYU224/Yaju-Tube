// @vitest-environment node

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  new URL('./.github/workflows/ci.yml', import.meta.url),
  'utf8',
)

describe('GitHub Actions CI workflow', () => {
  it('runs the same web quality gates used for local release checks', () => {
    expect(workflow).toContain("node-version: '20.19'")
    expect(workflow).toContain('run: npm ci')
    expect(workflow).toContain('run: npm audit')
    expect(workflow).toContain('run: git diff --check')
    expect(workflow).toContain('run: npm run lint')
    expect(workflow).toContain('run: npm test')
    expect(workflow).toContain('run: npx vitest --run --coverage')
    expect(workflow).toContain('run: npm run build')
    expect(workflow).toContain('run: npm run test:e2e')
  })

  it('builds Android with pinned Java and SDK prerequisites', () => {
    expect(workflow).toContain("java-version: '17'")
    expect(workflow).toContain('uses: android-actions/setup-android@v3')
    expect(workflow).toContain("packages: 'platform-tools platforms;android-35 build-tools;35.0.0'")
    expect(workflow).toContain('run: npx cap sync android')
    expect(workflow).toContain('run: ./gradlew lintDebug')
    expect(workflow).toContain('run: ./gradlew testDebugUnitTest')
    expect(workflow).toContain('run: ./gradlew assembleDebug')
    expect(workflow).toContain('path: android/app/build/outputs/apk/debug/*.apk')
  })
})
