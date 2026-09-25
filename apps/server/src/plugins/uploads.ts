import fp from 'fastify-plugin'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import { mkdirSync } from 'fs'
import { localStorageConfig } from '../providers/localStorageConfig'

// Registered in apps/server/src/index.ts, inside main(), before glue.

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
    const { directory } = localStorageConfig()
    mkdirSync(directory, { recursive: true })
    await server.register(staticFiles, {
      root: directory,
      prefix: '/uploads/',
      decorateReply: false,
      setHeaders: (response) => {
        response.setHeader('X-Content-Type-Options', 'nosniff')
      },
    })
  }
})
