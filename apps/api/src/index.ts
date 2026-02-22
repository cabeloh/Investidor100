import 'dotenv/config';
import express from 'express';
import { authRouter } from './routes/auth.js';
import { portfolioRouter } from './routes/portfolio.js';
import { activesRouter } from './routes/actives.js';
import { donutRouter } from './routes/donut.js';
import { barchartRouter } from './routes/barchart.js';
import { historyRouter } from './routes/history.js';
import { startScheduler } from './scheduler/cron.js';
import { runFetchCycle } from './scraper/snapshot.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());

// CORS — allow the PWA (same VPS or localhost dev)
app.use((_req, res, next) => {
  const origin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/actives',   activesRouter);
app.use('/api/donut',     donutRouter);
app.use('/api/barchart',  barchartRouter);
app.use('/api/history',   historyRouter);

// Manual trigger: POST /api/fetch — useful during dev and from the UI
app.post('/api/fetch', async (_req, res) => {
  try {
    const snapshot = await runFetchCycle();
    const errors = Object.keys(snapshot._errors ?? {}).length;
    res.json({ ok: true, fetchedAt: snapshot._fetchedAt, errorCount: errors });
  } catch (e: unknown) {
    const msg = (e as Error).message ?? String(e);
    const status = msg.startsWith('NO_SESSION') || msg.startsWith('SESSION_EXPIRED') ? 401 : 500;
    res.status(status).json({ error: msg });
  }
});

// Health check
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[api] Servidor rodando em http://localhost:${PORT}`);
  startScheduler();
});
