// scripts/seed.js
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1) Read bcrypt cost from env (default 10)
  const cost = parseInt(process.env.BCRYPT_COST || "10", 10);

  // 2) Default seed users (fallback)
  const defaultUsers = [
    { email: "realhede7@gmail.com", password: "SuperStrongPass123!", role: "super" }, // your real Gmail as super
    { email: "hedishawqi22@gmail.com", password: "UltraStrongPass#2025", role: "moderator" }, // moderator with strong pass
  ];

  // 3) If SEED_ADMINS is set, parse it instead of using defaults
  let users = defaultUsers;
  if (process.env.SEED_ADMINS) {
    users = process.env.SEED_ADMINS.split(",").map((entry) => {
      const [email, password, role] = entry.split(":");
      return { email, password, role };
    });
  }

  // 4) Protect production unless explicitly allowed
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PROD !== "true") {
    console.log("❌ Refusing to seed in production without SEED_ALLOW_PROD=true");
    process.exit(1);
  }

  // 5) Upsert users
  let superCount = 0, modCount = 0;
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, cost);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { password: hash, role: u.role },
      create: { email: u.email, password: hash, role: u.role },
    });
    if (u.role === "super") superCount++;
    if (u.role === "moderator") modCount++;
  }

  console.log(`✅ Seed completed`);
  console.log(`   Users total: ${users.length} (super: ${superCount}, moderator: ${modCount})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
