const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const jobs = await prisma.jobQueue.findMany({ where: { lastError: { contains: 'RANKINGS_REBUILD' } } });
  console.log(jobs);
}

main().finally(() => prisma.$disconnect());
