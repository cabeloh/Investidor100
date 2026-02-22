/**
 * Auth routes — cookie paste flow.
 *
 * POST /api/auth/session  — validate and save an Investidor10 session cookie
 * GET  /api/auth/status   — current session status
 * DELETE /api/auth/session — remove saved session
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { validateCookie } from '../scraper/fetcher.js';

export const authRouter = Router();

// ─── POST /api/auth/session ───────────────────────────────────────────────────

const SessionBody = z.object({
  /** Raw cookie string, e.g. "laravel_session=abc; xsrf-token=xyz" */
  cookies: z.string().min(10),
});

authRouter.post('/session', async (req: Request, res: Response) => {
  const parsed = SessionBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'cookies field is required (string)' });
  }

  const { cookies } = parsed.data;

  try {
    // 1. Validate by calling a lightweight Investidor10 endpoint
    await validateCookie(cookies);
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'SESSION_EXPIRED') {
      return res.status(401).json({
        error: 'Cookie inválido ou sessão expirada. Faça login no Investidor10 e copie o cookie novamente.',
      });
    }
    return res.status(502).json({ error: `Erro ao validar cookie: ${String(e)}` });
  }

  // 2. Encrypt and upsert (keep only one session row)
  const encrypted = encrypt(cookies);
  const now = new Date();

  await prisma.session.deleteMany();
  await prisma.session.create({
    data: {
      cookieEncrypted: encrypted,
      validatedAt: now,
      lastUsedAt: now,
      sessionExpired: false,
    },
  });

  return res.json({ ok: true, message: 'Sessão salva com sucesso.' });
});

// ─── GET /api/auth/status ─────────────────────────────────────────────────────

authRouter.get('/status', async (_req: Request, res: Response) => {
  const session = await prisma.session.findFirst({ orderBy: { id: 'desc' } });

  if (!session) {
    return res.json({ hasSession: false, sessionExpired: false });
  }

  return res.json({
    hasSession: true,
    validatedAt: session.validatedAt.toISOString(),
    lastUsedAt: session.lastUsedAt.toISOString(),
    sessionExpired: session.sessionExpired,
  });
});

// ─── DELETE /api/auth/session ─────────────────────────────────────────────────

authRouter.delete('/session', async (_req: Request, res: Response) => {
  await prisma.session.deleteMany();
  return res.json({ ok: true });
});

// ─── Internal helper: load the current cookie ─────────────────────────────────

export async function loadActiveCookie(): Promise<string | null> {
  const session = await prisma.session.findFirst({ orderBy: { id: 'desc' } });
  if (!session || session.sessionExpired) return null;
  return decrypt(session.cookieEncrypted);
}

export async function markSessionExpired(): Promise<void> {
  await prisma.session.updateMany({ data: { sessionExpired: true } });
}
