import { PrismaClient } from '@prisma/client';
import { updateAllMatches } from '../lib/matchEngine';

const db = new PrismaClient();

async function main() {
  await updateAllMatches();
}

main().catch(console.error).finally(() => db.$disconnect());
