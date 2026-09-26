import { db } from '@project/db'

async function run() {
  await db.$executeRaw`UPDATE ResultSet SET scopeValue = '_GLOBAL_' WHERE scopeValue IS NULL`
}
run().then(() => process.exit(0))
