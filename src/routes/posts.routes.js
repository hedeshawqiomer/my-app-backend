import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { createPost, listPosts,acceptPost,updatePost,deletePost } from "../controllers/posts.controller.js";
import { requireAuth ,requireRole } from "../middlewares/auth.js";
import { prisma } from '../lib/prisma.js';
import * as ctrl from "../controllers/posts.images.controller.js";








// 🔒 accept (both roles)



// (your existing multer storage here) ...
// Recompute the same directory here (or import from server file)
const UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
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
