import { Router } from "express";
import multer from "multer";
import { createPost, listPosts, acceptPost, updatePost, deletePost } from "../controllers/posts.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { publicPostLimiter } from "../middlewares/rateLimit.js";
import { prisma } from '../lib/prisma.js';
import * as ctrl from "../controllers/posts.images.controller.js";

// Multer setup (Store in Memory for Supabase Upload)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  },
});

const r = Router();

// PUBLIC create
r.post("/", publicPostLimiter, upload.array("images", 15), createPost);

// 🔒 AUTH required to list
r.get("/", requireAuth, listPosts);
r.post("/:id/accept", requireAuth, requireRole(["super", "moderator"]), acceptPost);
r.patch("/:id", requireAuth, requireRole("super"), updatePost);
r.delete("/:id", requireAuth, requireRole(["super", "moderator"]), deletePost);

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

// Secure image deletion routes
r.delete("/posts/:id/images/:imageId", requireAuth, requireRole(["super", "moderator"]), ctrl.deleteImageById);

// delete ONE by url  ✅ this matches your frontend call
// e.g. DELETE /posts/10/images?url=/uploads/abc.jpg
r.delete("/posts/:id/images", requireAuth, requireRole(["super", "moderator"]), ctrl.deleteImageByUrl);

// (optional) bulk delete for multiple ids/urls
// e.g. POST /posts/10/images:delete  { ids:[], urls:[] }
r.post("/posts/:id/images:delete", requireAuth, requireRole(["super", "moderator"]), ctrl.deleteImagesBulk);

export default r;
