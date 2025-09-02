import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";


export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const allow = (process.env.ALLOWED_ADMINS || "")
      .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    if (allow.length && !allow.includes(user.email.toLowerCase())) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    // regenerate + save ensures Set-Cookie always goes out correctly
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.user = { id: user.id, email: user.email, role: user.role };
      req.session.save(err2 => {
        if (err2) return next(err2);
        res.json({ ok: true, user: req.session.user });
      });
    });
  } catch (e) {
    next(e);
  }
}



export async function me(req, res) {
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  res.json(req.session.user);
}

export async function logout(req, res) {
  req.session.destroy(() => res.json({ ok: true }));
}

