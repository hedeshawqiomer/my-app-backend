// routes/posts.images.routes.js
import { Router } from "express";
import {
  deleteImageByUrl,
  deleteImageById,
  deleteImagesBulk,
} from "../controllers/posts.images.controller.js";

const router = Router();

// DELETE /posts/:id/images?url=/uploads/abc.jpg
router.delete("/posts/:id/images", deleteImageByUrl);

// DELETE /posts/:id/images/:imageId
router.delete("/posts/:id/images/:imageId", deleteImageById);

// POST /posts/:id/images:delete  { ids:[], urls:[] }
router.post("/posts/:id/images:delete", deleteImagesBulk);

export default router;
