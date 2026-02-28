// scripts/seed.js
import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1) Read bcrypt cost from env (default 10)
  const cost = parseInt(process.env.BCRYPT_COST || "10", 10);

  // 2) Read admin users from env (REQUIRED — never hardcode passwords!)
  //    Format: email:password:role,email:password:role
  //    Example: SEED_ADMINS="admin@gmail.com:MyPass123!:super,mod@gmail.com:ModPass456!:moderator"
  if (!process.env.SEED_ADMINS) {
    console.log("❌ SEED_ADMINS env variable is required.");
    console.log('   Format: SEED_ADMINS="email:password:role,email:password:role"');
    console.log('   Example: SEED_ADMINS="admin@gmail.com:StrongPass!:super"');
    process.exit(1);
  }

  const users = process.env.SEED_ADMINS.trim().split(",").map((entry) => {
    const [email, password, role] = entry.split(":");
    return { email: email.trim(), password: password.trim(), role: role.trim() };
  });

  // 4) Protect production unless explicitly allowed
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SEED_ALLOW_PROD !== "true"
  ) {
    console.log(
      "❌ Refusing too seed in n production without SEED_ALLOW_PROD=true"
    );
    process.exit(1);
  }

  // 5) Upsert users
  let superCount = 0,
    modCount = 0;
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
  console.log(
    `   Users total: ${users.length} (super: ${superCount}, moderator: ${modCount})`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
