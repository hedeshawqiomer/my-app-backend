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
import pkg from 'pg';

const PgStore = pgSession(session);
const app = express();

/* ----- basic middleware, NO DB yet ----- */
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

/* ----- CORS (no DB) ----- */
const allowedFromEnv = (process.env.BACKEND_ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedFromEnv.includes(origin)) return cb(null, true);
    try {
      const { hostname } = new URL(origin);
      if (hostname.endsWith('.vercel.app') ||
          hostname.endsWith('.ngrok-free.app') ||
          hostname.endsWith('.ngrok.app') ||
          hostname.endsWith('.netlify.app')) {
        return cb(null, true);
      }
    } catch {}
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

/* ----- HEALTH FIRST (no DB touched) ----- */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ----- static uploads (no DB) ----- */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

import authRouter from './routes/auth.routes.js';
import postsRouter from './routes/posts.routes.js';
import postsImagesRouter from './routes/posts.images.routes.js';

/* ----- Sessions (DB used) ----- */
app.set('trust proxy', 1);
const usingHttps =
  process.env.NODE_ENV === 'production' || process.env.DEV_HTTPS === '1';

const { Pool, Client } = pkg;

// 1) verify the DB TLS first (clean error if wrong)
async function initSessions() {
  try {
    const test = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { require: true, rejectUnauthorized: false },
    });
    await test.connect();
    await test.end();

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { require: true, rejectUnauthorized: false },
    });

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

    console.log('Session store: Postgres OK');
  } catch (e) {
    console.error('Session store init failed:', e?.message);
    // Fallback (so /health & public routes still work)
    app.use(session({
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
    console.warn('Using in-memory session store temporaril');
  }
}
await initSessions();

/* ----- routes that may use sessions ----- */
app.use('/uploads', helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }), express.static(UPLOADS_DIR));
app.use('/public',  helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }), express.static(UPLOADS_DIR));

app.use(postsImagesRouter);
app.use('/auth',  authRouter);
app.use('/posts', postsRouter);

/* ----- error handler ----- */
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, error: err?.message || 'Server error' });
});

/* ----- start ----- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API on http://0.0.0.0:${PORT}`);
  console.log(`Uploads served from: ${UPLOADS_DIR}`);
});
