import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __db: PrismaClient | undefined
}

export const db = global.__db ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.__db = db
}

export * from '@prisma/client'
