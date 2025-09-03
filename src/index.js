import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pgSession from 'connect-pg-simple';
import pkg from 'pg'; // pg Pool
const PgStore = pgSession(session);

import authRouter from './routes/auth.routes.js';
import postsRouter from './routes/posts.routes.js';
import postsImagesRouter from './routes/posts.images.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* =========================
   CORS (env-driven, flexible)
   ========================= */
const allowedFromEnv = (process.env.BACKEND_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedFromEnv.includes(origin)) return cb(null, true);
    try {
      const { hostname } = new URL(origin);
      if (
        hostname.endsWith('.vercel.app') ||
        hostname.endsWith('.ngrok-free.app') ||
        hostname.endsWith('.ngrok.app') ||
        hostname.endsWith('.netlify.app')
      ) return cb(null, true);
    } catch {}
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

/* =========================
   Security, logging, parsing
   ========================= */
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

/* =========================
   Static uploads (configurable)
   ========================= */
export const UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

app.use(
  '/uploads',
  helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }),
  express.static(UPLOADS_DIR)
);
app.use(
  '/public',
  helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }),
  express.static(UPLOADS_DIR)
);

/* =========================
   Sessions (HTTP vs HTTPS)
   ========================= */
app.set('trust proxy', 1);

// 1) decide cookie mode BEFORE using it
const usingHttps =
  process.env.NODE_ENV === 'production' || process.env.DEV_HTTPS === '1';

// 2) PG pool with SSL relaxed for Supabase's managed CA
const pool = new pkg.Pool({
  connectionString: process.env.DATABASE_URL, // use 5432 + sslmode=require at runtime
  ssl: { rejectUnauthorized: false },
});

// 3) session store that uses the pool
app.use(session({
  store: new PgStore({
    pool,
    schemaName: 'public',
    tableName: 'session',
    createTableIfMissing: true,
  }),
  name: process.env.SESSION_NAME || 'ek_session',
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    sameSite: usingHttps ? 'none' : 'lax',
    secure: usingHttps,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

/* =========================
   Routes
   ========================= */
app.use(postsImagesRouter);
app.use('/auth', authRouter);
app.use('/posts', postsRouter);

// health check (simple, no DB)
app.get('/health', (_req, res) => res.json({ ok: true }));

/* =========================
   Basic error handler
   ========================= */
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, error: err?.message || 'Server error' });
});

/* =========================
   Start server
   ========================= */
const PORT = process.env.PORT || 4000; // Railway injects 8080
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API on http://0.0.0.0:${PORT}`);
  console.log(`Uploads served from: ${UPLOADS_DIR}`);
});
