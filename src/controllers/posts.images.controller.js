// controllers/posts.images.controller.js
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma.js";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const normalizePath = (u="") => {
  try { u = new URL(u).pathname; } catch {}
  if (!u.startsWith("/")) u = `/${u}`;
  if (!u.startsWith("/uploads/")) u = u.replace(/^\/?/, "/").replace(/^\/?uploads\/?/, "/uploads/");
  return u;
};
const removePhysical = async (u) => {
  const rel = normalizePath(u).replace(/^\/uploads\//, "");
  await fs.unlink(path.join(UPLOADS_DIR, rel)).catch(() => {});
};

export async function deleteImageByUrl(req, res, next) {
  try {
    const postId = Number(req.params.id);
    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).json({ error: "Missing url" });
    const url = normalizePath(rawUrl);

    const img = await prisma.image.findFirst({ where: { postId, url } }); // <-- model/field names!
    if (!img) return res.status(404).json({ error: "Image not found" });

    await prisma.image.delete({ where: { id: img.id } });
    await removePhysical(img.url);
    res.json({ ok: true, removed: { url } });
  } catch (e) { next(e); }
}

export async function deleteImageById(req, res, next) {
  try {
    const postId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    const img = await prisma.image.findFirst({ where: { id: imageId, postId } });
    if (!img) return res.status(404).json({ error: "Image not found" });

    await prisma.image.delete({ where: { id: img.id } });
    await removePhysical(img.url);
    res.json({ ok: true, removed: { id: imageId } });
  } catch (e) { next(e); }
}

export async function deleteImagesBulk(req, res, next) {
  try {
    const postId = Number(req.params.id);
    const { ids = [], urls = [] } = req.body || {};

    const imgs = await prisma.image.findMany({
      where: { postId, OR: [{ id: { in: ids } }, { url: { in: urls.map(normalizePath) } }] },
    });
    if (!imgs.length) return res.json({ ok: true, removed: [] });

    await prisma.image.deleteMany({ where: { id: { in: imgs.map((i) => i.id) } } });
    await Promise.allSettled(imgs.map((i) => removePhysical(i.url)));

    res.json({ ok: true, removed: imgs.map((i) => ({ id: i.id, url: i.url })) });
  } catch (e) { next(e); }
}
