// controllers/posts.images.controller.js
import { prisma } from "../lib/prisma.js";
import { supabase } from "../lib/supabase.js";

const removeSupabase = async (u) => {
  try {
    // u is full public URL: https://.../filename.jpg
    const urlObj = new URL(u);
    const parts = urlObj.pathname.split('/');
    const filename = parts[parts.length - 1];
    if (filename) {
      await supabase.storage.from('images').remove([filename]);
    }
  } catch (e) {
    console.warn("Failed to parse/remove Supabase URL", u);
  }
};

export async function deleteImageByUrl(req, res, next) {
  try {
    const postId = Number(req.params.id);
    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).json({ error: "Missing url" });
    // In new system, we expect full URL. For compat, we use it as is.
    const url = rawUrl;

    const img = await prisma.image.findFirst({ where: { postId, url } }); // <-- model/field names!
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
    const postId = Number(req.params.id);
    const { ids = [], urls = [] } = req.body || {};

    const imgs = await prisma.image.findMany({
      where: { postId, OR: [{ id: { in: ids } }, { url: { in: urls } }] },
    });
    if (!imgs.length) return res.json({ ok: true, removed: [] });

    await prisma.image.deleteMany({ where: { id: { in: imgs.map((i) => i.id) } } });
    await Promise.allSettled(imgs.map((i) => removeSupabase(i.url)));

    res.json({ ok: true, removed: imgs.map((i) => ({ id: i.id, url: i.url })) });
  } catch (e) { next(e); }
}
