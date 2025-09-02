import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";


export async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // ✅ allowlist check comes first
  const allow = (process.env.ALLOWED_ADMINS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  if (!allow.includes(user.email.toLowerCase())) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // ✅ then password check
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // ✅ finally set session and respond
  req.session.user = { id: user.id, email: user.email, role: user.role };
  res.json(req.session.user);
}


export async function me(req, res) {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  res.json(req.session.user);
}

export async function logout(req, res) {
  req.session.destroy(() => res.json({ ok: true }));
}

