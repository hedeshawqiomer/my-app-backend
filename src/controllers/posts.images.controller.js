// controllers/posts.images.controller.js
import { prisma } from "../lib/prisma.js";
import { supabase } from "../lib/supabase.js";

const removeSupabase = async (u) => {
  try {
    const filename = extractFilename(u);
    if (filename) {
      await supabase.storage.from('images').remove([filename]);
    }
  } catch (e) {
    console.warn("Failed to parse/remove Supabase URL", u);
  }
};

const extractFilename = (url) => {
  if (!url) return null;
  try {
    const parts = new URL(url).pathname.split('/');
    return parts[parts.length - 1];
  } catch (e) {
    const parts = url.split('/');
    return parts[parts.length - 1];
  }
};

export async function deleteImageByUrl(req, res, next) {
  try {
    const postId = Number(req.params.id);
    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).json({ error: "Missing url" });
    const filename = extractFilename(rawUrl);
    if (!filename) return res.status(400).json({ error: "Invalid url" });

    const img = await prisma.image.findFirst({ 
      where: { postId, url: { contains: filename } } 
    }); 
    if (!img) return res.status(404).json({ error: "Image not found" });

    await prisma.image.delete({ where: { id: img.id } });
    await removeSupabase(img.url);
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
    await removeSupabase(img.url);
    res.json({ ok: true, removed: { id: imageId } });
  } catch (e) { next(e); }
}

export async function deleteImagesBulk(req, res, next) {
  try {
    console.log("HIT BULK DELETE", req.params.id, req.body);
    const postId = Number(req.params.id);
    const { ids = [], urls = [] } = req.body || {};

    const filenames = urls.map(extractFilename).filter(Boolean);

    const orConditions = [];
    if (ids.length) orConditions.push({ id: { in: ids } });
    filenames.forEach(f => orConditions.push({ url: { contains: f } }));

    // If no ids or urls were provided, just return empty
    if (!orConditions.length) return res.json({ ok: true, removed: [] });

    const imgs = await prisma.image.findMany({
      where: { postId, OR: orConditions },
    });
    console.log("Found images:", imgs.length);
    if (!imgs.length) return res.json({ ok: true, removed: [] });

    await prisma.image.deleteMany({ where: { id: { in: imgs.map((i) => i.id) } } });
    await Promise.allSettled(imgs.map((i) => removeSupabase(i.url)));

    res.json({ ok: true, removed: imgs.map((i) => ({ id: i.id, url: i.url })) });
  } catch (e) {
    console.error("BULK DELETE ERROR", e);
    next(e); 
  }
}
