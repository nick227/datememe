import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // These tests hit the real dev MariaDB instance (project convention —
    // see CLAUDE.md's live-verification posture), not a mock. Several suites
    // create/delete rows in shared global tables (CategoryGroup, Category,
    // Entity) that other suites read in full (e.g. getListsFeed's
    // group-by-group pagination) — running test files in parallel let one
    // file's transient fixture rows shift another file's live pagination
    // mid-run, causing real but non-reproducible-in-isolation flakiness.
    fileParallelism: false,
    // Vite sets process.env.BASE_URL to its public base path ('/'), which
    // localStorageConfig then rejects as an invalid URL at import time.
    env: { BASE_URL: 'http://localhost:3002' },
  },
})
