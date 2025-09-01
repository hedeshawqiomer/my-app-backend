// scripts/seed.js
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = [
    { email: 'admin1@example.com', password: '123456', role: 'super' },
    { email: 'admin2@example.com', password: '654321', role: 'moderator' },

  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { password: hash, role: u.role }, // update if exists
      create: { email: u.email, password: hash, role: u.role },
    });
  }

  console.log('✅ Seeded/updated admin + test users');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
