import { defineConfig } from 'cypress';

export default defineConfig({
  allowCypressEnv: false,
  e2e: {
    supportFile: 'tests/e2e/support/e2e.{js,jsx,ts,tsx}',
    specPattern: 'tests/e2e/specs/**/*.cy.{js,jsx,ts,tsx}',
    videosFolder: 'tests/e2e/videos',
    screenshotsFolder: 'tests/e2e/screenshots',
    baseUrl: 'http://127.0.0.1:5173',
    setupNodeEvents() {
      // implement node event listeners here
    },
  },
});
