/**
 * GET /api/donut — asset allocation donut chart data.
 *
 * Query params:
 *   carteira = Auvp | Passivo | all (default: all)
 *
 * Returns array of { name, type, valueBrl, percent } sorted by value desc.
 */
import { Router, Request, Response } from 'express';
import { getLatestSnapshot } from '../scraper/snapshot.js';

export const donutRouter = Router();

interface DonutSlice {
  value: number;
  name: string;
  type: string;
  percent: number;
}

donutRouter.get('/', async (req: Request, res: Response) => {
  const snapshot = await getLatestSnapshot();

  if (!snapshot) {
    return res.status(503).json({ error: 'Nenhum snapshot disponível.' });
  }

  const carteira = String(req.query.carteira ?? 'all').toLowerCase();

  // Collect raw donut slices per wallet
  const keys: string[] = [];
  if (carteira === 'auvp' || carteira === 'all') keys.push('donutchart_all_Auvp');
  if (carteira === 'passivo' || carteira === 'all') keys.push('donutchart_all_Passivo');

  // donutchart is a numeric-keyed object — convert to array
  const merged: Record<string, { valueBrl: number; percent: number }> = {};

  for (const key of keys) {
    const raw = snapshot.data[key];
    if (!raw) continue;

    // The endpoint returns an object with numeric keys: { "0": {...}, "1": {...} }
    const slices: DonutSlice[] = Object.values(raw).filter(
      (v): v is DonutSlice => typeof v === 'object' && v !== null && 'value' in v
    );

    for (const slice of slices) {
      const existing = merged[slice.type] ?? { valueBrl: 0, percent: 0 };
      merged[slice.type] = {
        valueBrl: existing.valueBrl + slice.value,
        percent: 0, // recalculated below
      };
      // Keep the human-readable name
      (merged[slice.type] as DonutSlice & { valueBrl: number; percent: number; name?: string; type?: string }).name = slice.name;
    }
  }

  const totalBrl = Object.values(merged).reduce((s, v) => s + v.valueBrl, 0);

  const result = Object.entries(merged)
    .map(([type, v]) => ({
      type,
      name: (v as unknown as Record<string, string>).name ?? type,
      valueBrl: Math.round(v.valueBrl * 100) / 100,
      percent:
        totalBrl > 0 ? Math.round((v.valueBrl / totalBrl) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.valueBrl - a.valueBrl);

  return res.json({ fetchedAt: snapshot._fetchedAt, data: result });
});
