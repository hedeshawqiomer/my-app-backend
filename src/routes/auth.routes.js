import { Router } from 'express';
import { login, me, logout } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { loginLimiter } from '../middlewares/rateLimit.js';

const r = Router();
r.post('/login', loginLimiter, login);
r.get('/me', requireAuth, me);
r.post('/logout', requireAuth, logout);
export default r;
