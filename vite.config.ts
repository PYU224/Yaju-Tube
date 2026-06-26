/// <reference types="vitest" />

import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'
import type { Plugin, TransformResult } from 'vite'
import { configDefaults } from 'vitest/config'

const missingVendorSourcemapEntries = [
  '/node_modules/@ionic/vue/dist/index.js',
  '/node_modules/@ionic/vue-router/dist/index.js',
] as const

export function shouldSuppressMissingVendorSourcemap(id: string): boolean {
  const normalizedId = id.replaceAll(path.sep, '/')

  return missingVendorSourcemapEntries.some((entry) => normalizedId.endsWith(entry))
}

export function stripMissingVendorSourcemap(code: string, id: string): TransformResult | null {
  if (!shouldSuppressMissingVendorSourcemap(id)) {
    return null
  }

  return {
    code: code.replace(/\r?\n?\/\/# sourceMappingURL=.*$/u, ''),
    map: {
      version: 3,
      sources: [],
      names: [],
      mappings: '',
    },
  }
}

export function suppressMissingVendorSourcemaps(): Plugin {
  return {
    name: 'suppress-missing-vendor-sourcemaps',
    enforce: 'post',
    transform: stripMissingVendorSourcemap,
  }
}

export function manualChunks(id: string): string | undefined {
  const normalizedId = id.replaceAll(path.sep, '/')
  const nodeModulesIndex = normalizedId.lastIndexOf('/node_modules/')

  if (nodeModulesIndex === -1) {
    return undefined
  }

  const packagePath = normalizedId.slice(nodeModulesIndex + '/node_modules/'.length)

  if (packagePath.startsWith('@ionic/core/components/')) {
    const componentPath = packagePath.slice('@ionic/core/components/'.length)

    if (/^p-[\w-]+\.js$/.test(componentPath)) {
      return 'ionic-core'
    }

    if (/^(ion-input|ion-searchbar|ion-select|ion-segment|ion-toggle|ion-checkbox|ion-radio|ion-range|ion-textarea)/.test(componentPath)) {
      return 'ionic-forms'
    }

    if (/^(ion-alert|ion-modal|ion-popover|ion-action-sheet|ion-toast|ion-loading|ion-picker|select-modal|select-popover)/.test(componentPath)) {
      return 'ionic-overlays'
    }

    if (/^(ion-router|ion-route|ion-nav|ion-tab|ion-tabs|ion-back-button|ion-menu|ion-split-pane)/.test(componentPath)) {
      return 'ionic-navigation'
    }

    if (/^(ion-card|ion-list|ion-item|ion-label|ion-thumbnail|ion-content|ion-header|ion-footer|ion-toolbar|ion-title|ion-buttons)/.test(componentPath)) {
      return 'ionic-layout'
    }

    return 'ionic-components'
  }

  if (packagePath.startsWith('@ionic/core/dist/')) {
    return 'ionic-runtime'
  }

  if (packagePath.startsWith('@ionic/vue-router/')) {
    return 'ionic-vue-router'
  }

  if (packagePath.startsWith('@ionic/vue/')) {
    return 'ionic-vue'
  }

  if (packagePath.startsWith('ionicons/')) {
    return 'ionicons'
  }

  if (
    packagePath.startsWith('@vue/')
    || packagePath.startsWith('vue/')
    || packagePath.startsWith('vue-router/')
    || packagePath.startsWith('pinia/')
    || packagePath.startsWith('pinia-plugin-persistedstate/')
  ) {
    return 'vue-vendor'
  }

  if (packagePath.startsWith('@capacitor/')) {
    return 'capacitor'
  }

  if (
    packagePath.startsWith('axios/')
    || packagePath.startsWith('dompurify/')
    || packagePath.startsWith('jschannel/')
    || packagePath.startsWith('marked/')
  ) {
    return 'player-vendor'
  }
  return undefined
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    suppressMissingVendorSourcemaps(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      exclude: [
        ...(configDefaults.coverage.exclude ?? []),
        'android/**',
        'ios/**',
        'src/types/**',
      ],
    },
  }
})
