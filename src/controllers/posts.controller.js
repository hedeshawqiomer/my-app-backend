import { prisma } from "../lib/prisma.js";
import fs from "node:fs/promises";
import path from "node:path";

const CITY_DISTRICTS = {
  Erbil: ["Hawler", "Soran", "Shaqlawa", "Mergasor", "Choman", "Koye","Rwanduz","Dashti Hawler"],
    Sulaimani: ["Slemani", "Bazyan", "Penjwen", "Qaradax", "Sharbazher", "Dukan","Ranya","Pashadar","Penjwin","Chemchemal"],
    Duhok: ["Duhok","Akre", "Zakho", "Amadiya", "Simele","Bardarash","Shekhan"],
    Halabja: ["Halbja","Khurmal","Byara", "Tawella"]
};

function parseLatLng(text = "") {
  const m = String(text).trim().match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[3]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export async function createPost(req, res, next) {
  try {
    const { name, email, city, district, location } = req.body;
    const files = req.files || [];

    // require min 4 images
    if (files.length < 4) {
      return res.status(400).json({ error: "At least 4 images are required (min 4)." });
    }

    // city/district checks (only if provided)
    if (city) {
      const allowed = CITY_DISTRICTS[city];
      if (!allowed) {
        return res.status(400).json({ error: `Unknown city: ${city}` });
      }
      if (district && !allowed.includes(district)) {
        return res.status(400).json({ error: `District "${district}" is not in ${city}` });
      }
    }

    // location must be "lat,lng"
    const coords = parseLatLng(location);
    if (!coords) {
      return res.status(400).json({ error: "location must be 'lat,lng' (e.g., 36.1909,44.0069)" });
    }

    const post = await prisma.post.create({
      data: {
        status: "pending",
        name: name || null,
        uploaderName: name || null,
        email: email || null,
        city: city || null,
        district: district || null,
        // we keep your schema as a single string; store normalized "lat,lng"
        location: `${coords.lat},${coords.lng}`,
        images: {
          create: files.map((f, idx) => ({
            url: `/uploads/${f.filename}`,
            order: idx,
          })),
        },
      },
      include: { images: true },
    });

    res.status(201).json(post);
  } catch (e) {
    next(e);
  }
}

export async function listPosts(req, res, next) {
  try {
    const { status, city } = req.query; // status = pending | accepted

    // moderator cannot request accepted
    if (req.session.user.role === "moderator" && status === "accepted") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const where = {};
    if (status) where.status = status;          // optional
    if (city) where.city = city;                // optional

    const posts = await prisma.post.findMany({
      where,
      orderBy: [{ acceptedAt: "desc" }, { createdAt: "desc" }],
      include: { images: true },
    });

    res.json(posts);
  } catch (e) { next(e); }
}
export async function acceptPost(req, res, next) {
  try {
    const id = Number(req.params.id);

    // Verify post exists and is pending
    const existing = await prisma.post.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) return res
    .status(404).json({ error: "Not found" });
    if (existing.status === "accepted") {
      return res.status(400).json({ error: "Already accepted" });
    }

    // Update status + timestamp
    const post = await prisma.post.update({
      where: { id },
      data: { status: "accepted", acceptedAt: new Date() },
      include: { images: true },
    });

    res.json(post);
  } catch (e) {
    next(e);
  }
}
export async function updatePost(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { name, email, city, district, location } = req.body || {};

    // Optional checks only if values provided
    if (city) {
      const allowed = CITY_DISTRICTS[city];
      if (!allowed) return res.status(400).json({ error: `Unknown city: ${city}` });
      if (district && !allowed.includes(district)) {
        return res.status(400).json({ error: `District "${district}" is not in ${city}` });
      }
    }
    if (location !== undefined) {
      const coords = parseLatLng(location);
      if (!coords) {
        return res.status(400).json({ error: "location must be 'lat,lng' (e.g., 36.1909,44.0069)" });
      }
    }

    const patch = {
      updatedAt: new Date(),
      // Only set provided fields; leave others unchanged
      ...(name !== undefined ? { name, uploaderName: name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(city !== undefined ? { city } : {}),
      ...(district !== undefined ? { district } : {}),
      ...(location !== undefined ? { location } : {}),
    };

    const post = await prisma.post.update({
      where: { id },
      data: patch,
      include: { images: true },
    });

    res.json(post);
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ error: "Not found" });
    next(e);
  }
}

export async function deletePost(req, res, next) {
  try {
    const id = Number(req.params.id);
    const role = req.session.user.role;

    // load post status + images
    const post = await prisma.post.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!post) return res.status(404).json({ error: "Not found" });

    // moderators cannot delete accepted posts
    if (role === "moderator" && post.status !== "pending") {
      return res.status(403).json({ error: "Forbidden (moderator can delete only pending)" });
    }

    // try to remove image files from /uploads (best-effort)
    for (const img of post.images) {
      // img.url looks like "/uploads/<filename>"
      const filename = img.url.startsWith("/uploads/")
        ? img.url.replace("/uploads/", "")
        : img.url;
      const full = path.join(process.cwd(), "uploads", filename);
      try { await fs.unlink(full); } catch (_) { /* ignore missing */ }
    }

    // delete image rows then the post
    await prisma.image.deleteMany({ where: { postId: id } });
    await prisma.post.delete({ where: { id } });

    res.json({ ok: true });
  } catch (e) { next(e); }
}


