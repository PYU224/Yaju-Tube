// @vitest-environment node

import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const appId = 'com.github.pyu224.yaju_tube'
const javaPath = './android/app/src/main/java/com/github/pyu224/yaju_tube/MainActivity.java'
const unitTestPath = './android/app/src/test/java/com/github/pyu224/yaju_tube/ExampleUnitTest.java'
const instrumentedTestPath = './android/app/src/androidTest/java/com/github/pyu224/yaju_tube/ExampleInstrumentedTest.java'

describe('Android project metadata', () => {
  it('keeps the Gradle namespace, application id, manifest activity, and Java package aligned', () => {
    const buildGradle = readFileSync('./android/app/build.gradle', 'utf8')
    const manifest = readFileSync('./android/app/src/main/AndroidManifest.xml', 'utf8')

    expect(buildGradle).toContain(`namespace = "${appId}"`)
    expect(buildGradle).toContain(`applicationId = "${appId}"`)
    expect(manifest).toContain('android:name=".MainActivity"')
    expect(existsSync(javaPath)).toBe(true)
    expect(readFileSync(javaPath, 'utf8')).toContain(`package ${appId};`)
  })

  it('uses the production application id in Android test packages', () => {
    expect(existsSync(unitTestPath)).toBe(true)
    expect(existsSync(instrumentedTestPath)).toBe(true)

    const unitTest = readFileSync(unitTestPath, 'utf8')
    const instrumentedTest = readFileSync(instrumentedTestPath, 'utf8')

    expect(unitTest).toContain(`package ${appId};`)
    expect(instrumentedTest).toContain(`package ${appId};`)
    expect(instrumentedTest).toContain(`assertEquals("${appId}", appContext.getPackageName())`)
  })

  it('uses Gradle assignment syntax for project-owned Android DSL properties', () => {
    const buildGradle = readFileSync('./android/app/build.gradle', 'utf8')

    expect(buildGradle).not.toMatch(/^\s*namespace\s+"/m)
    expect(buildGradle).not.toMatch(/^\s*ignoreAssetsPattern\s+'/m)
    expect(buildGradle).toContain("ignoreAssetsPattern = '!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~'")
  })
})
