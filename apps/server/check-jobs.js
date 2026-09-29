const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const jobs = await prisma.jobQueue.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  console.log(jobs);
}

main().finally(() => prisma.$disconnect());
