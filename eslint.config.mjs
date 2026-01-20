import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import eslint from '@eslint/js'
import globals from 'globals'

export default defineConfigWithVueTs(
  // Global ignores (replaces .eslintignore)
  {
    ignores: [
      '.DS_Store',
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'ios/**',
      'android/**',
      '.env.local',
      '.env.*.local',
      'npm-debug.log*',
      'yarn-debug.log*',
      'yarn-error.log*',
      'pnpm-debug.log*',
      '.idea/**',
      '.vscode/**',
      '*.suo',
      '*.ntvs*',
      '*.njsproj',
      '*.sln',
      '*.sw?',
    ],
  },

  // ESLint recommended
  eslint.configs.recommended,

  // Vue 3 essential rules (equivalent to 'plugin:vue/vue3-essential')
  ...pluginVue.configs['flat/essential'],

  // TypeScript recommended (equivalent to '@vue/typescript/recommended')
  vueTsConfigs.recommended,

  // Custom configuration
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Production-only warnings
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      // Vue.js rules
      'vue/no-deprecated-slot-attribute': 'off',
      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
