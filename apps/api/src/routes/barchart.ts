/**
 * GET /api/barchart — 12-month evolution bar chart.
 *
 * Query params:
 *   carteira = Auvp | Passivo | all (default: all)
 *
 * Returns array of monthly points: { month, sumApplied, sumEquity, sumFlow, profitability }
 */
import { Router, Request, Response } from 'express';
import { getLatestSnapshot } from '../scraper/snapshot.js';

export const barchartRouter = Router();

interface RawBar {
  month: string;
  date: string;
  sum_applied: number;
  sum_equity: number;
  sum_flow: number;
  profitability: number;
  currency: string;
}

barchartRouter.get('/', async (req: Request, res: Response) => {
  const snapshot = await getLatestSnapshot();

  if (!snapshot) {
    return res.status(503).json({ error: 'Nenhum snapshot disponível.' });
  }

  const carteira = String(req.query.carteira ?? 'all').toLowerCase();

  const keys: string[] = [];
  if (carteira === 'auvp' || carteira === 'all') keys.push('barchart_12_all_Auvp');
  if (carteira === 'passivo' || carteira === 'all') keys.push('barchart_12_all_Passivo');

  // Merge months from both wallets
  const byMonth: Record<string, {
    month: string;
    sumApplied: number;
    sumEquity: number;
    sumFlow: number;
  }> = {};

  for (const key of keys) {
    const raw = snapshot.data[key];
    if (!raw) continue;

    const bars: RawBar[] = Object.values(raw).filter(
      (v): v is RawBar => typeof v === 'object' && v !== null && 'month' in v
    );

    for (const bar of bars) {
      const existing = byMonth[bar.month] ?? { month: bar.month, sumApplied: 0, sumEquity: 0, sumFlow: 0 };
      byMonth[bar.month] = {
        month: bar.month,
        sumApplied: existing.sumApplied + (bar.sum_applied ?? 0),
        sumEquity:  existing.sumEquity  + (bar.sum_equity  ?? 0),
        sumFlow:    existing.sumFlow    + (bar.sum_flow    ?? 0),
      };
    }
  }

  // Sort chronologically (month format is MM/YY)
  const result = Object.values(byMonth).sort((a, b) => {
    const [am, ay] = a.month.split('/');
    const [bm, by] = b.month.split('/');
    const da = new Date(2000 + parseInt(ay), parseInt(am) - 1);
    const db = new Date(2000 + parseInt(by), parseInt(bm) - 1);
    return da.getTime() - db.getTime();
  }).map((p) => ({
    month: p.month,
    sumApplied: Math.round(p.sumApplied * 100) / 100,
    sumEquity:  Math.round(p.sumEquity  * 100) / 100,
    sumFlow:    Math.round(p.sumFlow    * 100) / 100,
  }));

  return res.json({ fetchedAt: snapshot._fetchedAt, data: result });
});
