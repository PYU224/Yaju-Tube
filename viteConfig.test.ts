// @vitest-environment node

import { describe, expect, it } from 'vitest'
import config, {
  manualChunks,
  shouldSuppressMissingVendorSourcemap,
  stripMissingVendorSourcemap,
} from './vite.config'

describe('vite config', () => {
  it('excludes generated native project output from coverage', () => {
    const coverageExclude = config.test?.coverage?.exclude ?? []

    expect(coverageExclude).toContain('android/**')
    expect(coverageExclude).toContain('ios/**')
    expect(coverageExclude).toContain('dist/**')
    expect(coverageExclude).toContain('src/types/**')
  })

  it('splits large vendor families into stable manual chunks', () => {
    expect(manualChunks('/repo/node_modules/@ionic/core/components/ion-input.js')).toBe('ionic-forms')
    expect(manualChunks('/repo/node_modules/@ionic/core/components/ion-modal.js')).toBe('ionic-overlays')
    expect(manualChunks('/repo/node_modules/@ionic/core/components/ion-router-outlet.js')).toBe('ionic-navigation')
    expect(manualChunks('/repo/node_modules/@ionic/core/components/ion-card.js')).toBe('ionic-layout')
    expect(manualChunks('/repo/node_modules/@ionic/core/components/ion-icon.js')).toBe('ionic-components')
    expect(manualChunks('/repo/node_modules/@ionic/core/components/index.js')).toBe('ionic-components')
    expect(manualChunks('/repo/node_modules/@ionic/core/components/p-BJoMtgfR.js')).toBe('ionic-core')
    expect(manualChunks('/repo/node_modules/@ionic/core/components/p-Csw8xuz4.js')).toBe('ionic-core')
    expect(manualChunks('/repo/node_modules/@ionic/core/components/p-DUqnmRFi.js')).toBe('ionic-core')
    expect(manualChunks('/repo/node_modules/@ionic/core/dist/index.js')).toBe('ionic-runtime')
    expect(manualChunks('/repo/node_modules/@ionic/vue/dist/index.js')).toBe('ionic-vue')
    expect(manualChunks('/repo/node_modules/@ionic/vue-router/dist/index.js')).toBe('ionic-vue-router')
    expect(manualChunks('/repo/node_modules/ionicons/icons/index.js')).toBe('ionicons')
    expect(manualChunks('/repo/node_modules/vue/dist/vue.runtime.esm-bundler.js')).toBe('vue-vendor')
    expect(manualChunks('/repo/node_modules/vue-router/dist/vue-router.mjs')).toBe('vue-vendor')
    expect(manualChunks('/repo/node_modules/pinia/dist/pinia.mjs')).toBe('vue-vendor')
    expect(manualChunks('/repo/node_modules/@capacitor/core/dist/index.js')).toBe('capacitor')
    expect(manualChunks('/repo/node_modules/marked/lib/marked.esm.js')).toBe('player-vendor')
    expect(manualChunks('/repo/node_modules/some-package/index.js')).toBeUndefined()
    expect(manualChunks('/repo/src/main.ts')).toBeUndefined()
  })

  it('suppresses sourcemaps for Ionic package entries with missing sources', () => {
    const ionicVueId = '/repo/node_modules/@ionic/vue/dist/index.js'
    const ionicRouterId = '/repo/node_modules/@ionic/vue-router/dist/index.js'
    const appId = '/repo/src/main.ts'

    expect(shouldSuppressMissingVendorSourcemap(ionicVueId)).toBe(true)
    expect(shouldSuppressMissingVendorSourcemap(ionicRouterId)).toBe(true)
    expect(shouldSuppressMissingVendorSourcemap(appId)).toBe(false)
    expect(config.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'suppress-missing-vendor-sourcemaps' }),
      ]),
    )
    expect(stripMissingVendorSourcemap('export {}\n//# sourceMappingURL=index.js.map', ionicVueId)).toEqual({
      code: 'export {}',
      map: {
        version: 3,
        sources: [],
        names: [],
        mappings: '',
      },
    })
    expect(stripMissingVendorSourcemap('export {}', appId)).toBeNull()
  })
})
