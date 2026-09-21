import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import openapiGlue from 'fastify-openapi-glue'
import { load } from 'js-yaml'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as handlers from './handlers'
import * as adminHandlers from './handlers/admin'
import * as quickPickHandlers from './handlers/quickPicks'
import * as security from './plugins/security'
import uploadsPlugin from './plugins/uploads'

const server = Fastify({ logger: true })

const specPath = resolve(__dirname, '../../../packages/api-spec/openapi.yaml')
const spec = load(readFileSync(specPath, 'utf-8')) as object

const adminQueryCursor = { type: 'string', minLength: 1, maxLength: 2048 }
const adminSearchQuery = { type: 'string', minLength: 1, maxLength: 120 }

const adminSchemas = {
  queryCursor: adminQueryCursor,
  searchQuery: adminSearchQuery,
  userActionBody: {
    type: 'object',
    required: ['userId', 'verify'],
    properties: {
      userId: { type: 'string', minLength: 1 },
      verify: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  banUserActionBody: {
    type: 'object',
    required: ['userId', 'ban'],
    properties: {
      userId: { type: 'string', minLength: 1 },
      ban: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  planUpdateBody: {
    type: 'object',
    required: ['planId', 'priceCents'],
    properties: {
      planId: { type: 'string', minLength: 1 },
      priceCents: { type: 'integer', minimum: 0, maximum: 1000000 },
      isActive: { type: 'boolean' },
      features: { type: 'object', additionalProperties: true },
    },
    additionalProperties: false,
  },
  planCreateBody: {
    type: 'object',
    required: ['label', 'slug', 'interval', 'priceCents'],
    properties: {
      label: { type: 'string', minLength: 1 },
      slug: { type: 'string', minLength: 1 },
      interval: { type: 'string', enum: ['MONTHLY', 'ANNUAL', 'LIFETIME'] },
      priceCents: { type: 'integer', minimum: 0, maximum: 1000000 },
      isActive: { type: 'boolean' },
      features: { type: 'object', additionalProperties: true },
    },
    additionalProperties: false,
  },
  userMembershipOverrideBody: {
    type: 'object',
    required: ['userId', 'planId'],
    properties: {
      userId: { type: 'string', minLength: 1 },
      planId: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
  userMembershipRevokeBody: {
    type: 'object',
    required: ['userId'],
    properties: {
      userId: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
  createEntityTypeBody: {
    type: 'object',
    required: ['slug', 'label', 'pluralLabel'],
    properties: {
      slug: { type: 'string', minLength: 1, maxLength: 100 },
      label: { type: 'string', minLength: 1, maxLength: 150 },
      pluralLabel: { type: 'string', minLength: 1, maxLength: 150 },
      parentId: { type: ['string', 'null'], minLength: 1 },
      icon: { type: ['string', 'null'], maxLength: 100 },
    },
    additionalProperties: false,
  },
  updateEntityTypeBody: {
    type: 'object',
    required: ['slug', 'label', 'pluralLabel'],
    properties: {
      slug: { type: 'string', minLength: 1, maxLength: 100 },
      label: { type: 'string', minLength: 1, maxLength: 150 },
      pluralLabel: { type: 'string', minLength: 1, maxLength: 150 },
      parentId: { type: ['string', 'null'], minLength: 1 },
      icon: { type: ['string', 'null'], maxLength: 100 },
      isActive: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  createEntityBody: {
    type: 'object',
    required: ['entityTypeId', 'canonicalName', 'slug'],
    properties: {
      entityTypeId: { type: 'string', minLength: 1 },
      canonicalName: { type: 'string', minLength: 1, maxLength: 150 },
      slug: { type: 'string', minLength: 1, maxLength: 100 },
      parentId: { type: ['string', 'null'], minLength: 1 },
    },
    additionalProperties: false,
  },
  updateEntityBody: {
    type: 'object',
    required: ['canonicalName', 'slug'],
    properties: {
      canonicalName: { type: 'string', minLength: 1, maxLength: 150 },
      slug: { type: 'string', minLength: 1, maxLength: 100 },
      parentId: { type: ['string', 'null'], minLength: 1 },
      status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
    },
    additionalProperties: false,
  },

  entityQuery: {
    type: 'object',
    properties: {
      entityTypeId: { type: 'string', minLength: 1 },
      parentId: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
  generateEntitiesBody: {
    type: 'object',
    required: ['categoryName', 'prompt'],
    properties: {
      categoryName: { type: 'string', minLength: 1, maxLength: 150 },
      prompt: { type: 'string', minLength: 1, maxLength: 5000 },
      count: { type: 'integer', minimum: 1, maximum: 50 },
    },
    additionalProperties: false,
  },
  bulkSaveEntitiesBody: {
    type: 'object',
    required: ['entityTypeId', 'entities'],
    properties: {
      entityTypeId: { type: 'string', minLength: 1 },
      parentId: { type: ['string', 'null'], minLength: 1 },
      entities: {
        type: 'array',
        minItems: 1,
        maxItems: 1000,
        items: { type: 'string', minLength: 1, maxLength: 200 },
      },
    },
    additionalProperties: false,
  },
  userQuery: {
    type: 'object',
    properties: {
      cursor: adminQueryCursor,
      limit: { type: 'integer', minimum: 1, maximum: 100 },
      search: adminSearchQuery,
      planId: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
}

async function main() {
  // CORS — must be first so preflight OPTIONS requests are handled before routing.
  // CORS_ORIGIN takes a comma-separated allowlist (there was a second origin
  // — a standalone admin web app — for a while, which is why this supports a
  // list and not just one string; that app has since been folded into
  // apps/mobile's role-gated Admin surface). Unset falls back to reflecting
  // any request origin, fine for pure local dev but real deployments should
  // set this explicitly.
  const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : true
  await server.register(cors, {
    origin: corsOrigin,
    credentials: true,
  })

  // cookies — must register before glue so request.cookies is populated
  await server.register(cookie)

  // multipart parsing + local file serving — must register before glue
  await server.register(uploadsPlugin)

  // live swagger UI at /docs in dev
  await server.register(swagger, { openapi: spec })
  await server.register(swaggerUi, { routePrefix: '/docs' })

  // global error handler — maps known shapes to HTTP responses
  server.setErrorHandler((error, _request, reply) => {
    if (error.validation) {
      return reply.status(400).send({ error: 'Validation failed', details: error.validation })
    }
    if (error.statusCode) {
      return reply.status(error.statusCode).send({ error: error.message })
    }
    if ((error as any).code === 'P2025') {
      return reply.status(404).send({ error: 'Not found' })
    }
    if ((error as any).code === 'P2002') {
      return reply.status(409).send({ error: 'Already exists' })
    }
    server.log.error(error)
    return reply.status(500).send({ error: 'Internal server error' })
  })

  // spec-driven routing — operationId → handler export, security scheme → handler
  await server.register(openapiGlue, {
    specification: specPath,
    service: handlers,
    securityHandlers: security,
    noAdditional: true,
  } as any)

  // health check — not in spec, always public
  server.get('/health', async () => ({ status: 'ok' }))

  // admin endpoints
  // NOTE: GET /admin/queue is no longer registered here — it's now spec-driven
  // (see openapi.yaml's /admin/queue + the adminAuth security scheme), reusing
  // this same handlers.getQueueMetrics export via the glue registration above.
  // NOTE: GET/POST /admin/users*, and GET /admin/plans (pulled forward for
  // the membership-override picker) are no longer registered here — all
  // spec-driven now (apps/mobile Admin migration batch 3), reusing these
  // same handlers.* exports via the glue registration above.
  // NOTE: POST /admin/plans and POST /admin/plans/update are no longer
  // registered here either — spec-driven now (batch 4), reusing these same
  // handlers.createPlan/updatePlan exports via the glue registration above.

  // NOTE: all /admin/taxonomy/types* and /admin/taxonomy/entities* routes
  // are no longer registered here — all spec-driven now (apps/mobile Admin
  // migration batch 5), reusing these same handlers.* exports via the glue
  // registration above.

  // NOTE: all /admin/media/* routes are no longer registered here —
  // spec-driven now (apps/mobile Admin migration batch 7), reusing these
  // same adminMediaHandlers.* exports via the glue registration above.

  // NOTE: all /admin/lists/definitions* routes are no longer registered
  // here — spec-driven now (apps/mobile Admin migration batch 6), reusing
  // these same adminCategoriesHandlers.* exports via the glue registration
  // above.

  // NOTE: all four /admin/moderation/* routes are no longer registered here
  // — they're spec-driven now (apps/mobile Admin migration batch 2), reusing
  // these same adminModerationHandlers exports via the glue registration above.

  // Quick Picks
  server.post('/quick-picks/generate', { preHandler: [security.bearerAuth] }, quickPickHandlers.generateQuickPicks)
  server.post('/quick-picks/submit', { preHandler: [security.bearerAuth] }, quickPickHandlers.submitQuickPick)


  await server.listen({
    port: Number(process.env.PORT ?? 3001),
    host: '0.0.0.0',
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
