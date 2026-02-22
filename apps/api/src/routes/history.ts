/**
 * GET /api/history — time-series of equity_brl across saved snapshots.
 *
 * Query params:
 *   days = 7 | 30 | 90 | 365 | all  (default: 30)
 *
 * Returns array of { date, equityBrl, byWallet: { Auvp, Passivo } }
 * sorted chronologically.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { extractActives } from '../scraper/snapshot.js';
import type { RawSnapshot, HistoryPoint } from '@investidor100/shared-types';

export const historyRouter = Router();

historyRouter.get('/', async (req: Request, res: Response) => {
  const daysParam = req.query.days;
  let since: Date | undefined;

  if (daysParam && daysParam !== 'all') {
    const n = parseInt(String(daysParam), 10);
    if (!isNaN(n) && n > 0) {
      since = new Date(Date.now() - n * 86_400_000);
    }
  }

  const rows = await prisma.snapshot.findMany({
    where: since ? { fetchedAt: { gte: since } } : undefined,
    orderBy: { fetchedAt: 'asc' },
    select: { id: true, fetchedAt: true, rawJson: true },
  });

  const points: HistoryPoint[] = rows.map((row) => {
    const snapshot = JSON.parse(row.rawJson) as RawSnapshot;
    const byWallet = { Auvp: 0, Passivo: 0 };

    for (const item of extractActives(snapshot)) {
      const eq = parseFloat(String(item.equity_brl ?? 0));
      if (isNaN(eq)) continue;
      const cart = item.Carteira as 'Auvp' | 'Passivo';
      byWallet[cart] = (byWallet[cart] ?? 0) + eq;
    }

    return {
      date: row.fetchedAt.toISOString(),
      equityBrl: Math.round((byWallet.Auvp + byWallet.Passivo) * 100) / 100,
      byWallet: {
        Auvp:    Math.round(byWallet.Auvp    * 100) / 100,
        Passivo: Math.round(byWallet.Passivo * 100) / 100,
      },
    };
  });

  return res.json({ count: points.length, data: points });
});
