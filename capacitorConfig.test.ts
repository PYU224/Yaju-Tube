// @vitest-environment node

import { describe, expect, it } from 'vitest'
import config from './capacitor.config'

describe('capacitor config', () => {
  it('uses the production app id, app name, and built web directory', () => {
    expect(config).toMatchObject({
      appId: 'com.github.pyu224.yaju_tube',
      appName: 'Yaju-Tube',
      webDir: 'dist',
    })
  })
})
