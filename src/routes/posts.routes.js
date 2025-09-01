import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { createPost, listPosts,acceptPost,updatePost,deletePost } from "../controllers/posts.controller.js";
import { requireAuth ,requireRole } from "../middlewares/auth.js";
import { prisma } from '../lib/prisma.js';
import * as ctrl from "../controllers/posts.images.controller.js";








// 🔒 accept (both roles)



// (your existing multer storage here) ...
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString().slice(2)}${path.extname(file.originalname)}`)
});

const upload = multer({ storage });

const r = Router();

// PUBLIC create
r.post("/", upload.array("images", 10), createPost);

// 🔒 AUTH required to list
r.get("/", requireAuth, listPosts);
r.post("/:id/accept", requireAuth, requireRole(["super", "moderator"]), acceptPost);
r.patch("/:id", requireAuth, requireRole("super"), updatePost);
r.delete("/:id", requireAuth, requireRole(["super", "moderator"]), deletePost);
// GET /posts/public?city=Erbil
// GET /posts/public?city=Erbil
r.get('/public', async (req, res, next) => {
  try {
    const { city } = req.query;
    const where = { status: 'accepted' };
    if (city) where.city = city;

    const posts = await prisma.post.findMany({
      where,
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
      include: { images: { orderBy: { order: 'asc' } } }, // adjust if no "order" column
    });

    res.json(posts);
  } catch (e) {
    next(e);
  }
});

r.delete("/posts/:id/images/:imageId", ctrl.deleteImageById);

// delete ONE by url  ✅ this matches your frontend call
// e.g. DELETE /posts/10/images?url=/uploads/abc.jpg
r.delete("/posts/:id/images", ctrl.deleteImageByUrl);

// (optional) bulk delete for multiple ids/urls
// e.g. POST /posts/10/images:delete  { ids:[], urls:[] }
r.post("/posts/:id/images:delete", ctrl.deleteImagesBulk);



export default r;
