import fp from 'fastify-plugin'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import { resolve } from 'path'
import { mkdirSync } from 'fs'

// Registered in apps/server/src/index.ts, inside main(), before glue.

// This file lives at apps/server/src/plugins/ — two levels up reaches apps/server.
const UPLOADS_DIR = resolve(__dirname, '../../uploads')

export default fp(async (server) => {
  // Multipart parsing — must be registered before fastify-openapi-glue
  await server.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // hard ceiling; MediaService enforces the configurable limit per-request
    },
  })

  // Serve local uploads in dev. Bypassed once STORAGE_PROVIDER points at a cloud
  // provider, since those serve files from their own URLs directly.
  if (!process.env.STORAGE_PROVIDER || process.env.STORAGE_PROVIDER === 'local') {
    mkdirSync(UPLOADS_DIR, { recursive: true })
    await server.register(staticFiles, {
      root: UPLOADS_DIR,
      prefix: '/uploads/',
      decorateReply: false,
    })
  }
})
