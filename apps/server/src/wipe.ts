import { db } from '@project/db';
async function main() {
  await db.quickPickSignal.deleteMany();
}
main().finally(() => process.exit(0));
