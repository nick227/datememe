import { db } from '@project/db'
async function test() {
  await db.resultSet.upsert({
    where: { idx_result_set_unique: { subjectType: 'PROFILE', metric: 'MOST_LIKED', scopeType: 'GLOBAL', scopeValue: null as any, window: 'ALL_TIME' } },
    update: {},
    create: { subjectType: 'PROFILE', metric: 'MOST_LIKED', scopeType: 'GLOBAL', scopeValue: null, window: 'ALL_TIME' }
  })
}
