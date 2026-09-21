import { db } from '@project/db';
import * as bcrypt from 'bcryptjs';

async function main() {
  const hash = await bcrypt.hash('password123', 10);
  await db.user.updateMany({
    where: { email: 'admin@datememe.com' },
    data: { passwordHash: hash }
  });
  console.log('Password updated for admin@datememe.com to password123');
}
main().finally(() => db.$disconnect());
