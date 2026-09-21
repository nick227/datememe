import { db } from '@project/db';

async function main() {
  const admins = await db.user.findMany({ where: { role: 'ADMIN' } });
  console.log(admins);
}
main().finally(() => db.$disconnect());
