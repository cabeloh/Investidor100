/**
 * GET /api/portfolio — consolidated portfolio summary (latest snapshot).
 *
 * Response: PortfolioSummary
 */
import { Router, Request, Response } from 'express';
import { getLatestSnapshot, extractActives } from '../scraper/snapshot.js';
import { prisma } from '../lib/prisma.js';
import type { PortfolioSummary } from '@investidor100/shared-types';

export const portfolioRouter = Router();

portfolioRouter.get('/', async (_req: Request, res: Response) => {
  const snapshot = await getLatestSnapshot();

  if (!snapshot) {
    return res.status(503).json({
      error: 'Nenhum snapshot disponível. Configure a sessão e aguarde o próximo ciclo.',
    });
  }

  const session = await prisma.session.findFirst({ orderBy: { id: 'desc' } });

  // Totals by wallet
  const byWallet = { Auvp: 0, Passivo: 0 };
  const byClass: Record<string, number> = {};

  for (const item of extractActives(snapshot)) {
    const eq = parseFloat(String(item.equity_brl ?? 0));
    if (isNaN(eq)) continue;

    const carteira = item.Carteira as 'Auvp' | 'Passivo';
    byWallet[carteira] = (byWallet[carteira] ?? 0) + eq;

    const tipo = String(item.Tipo ?? 'Other');
    byClass[tipo] = (byClass[tipo] ?? 0) + eq;
  }

  const totalEquityBrl = byWallet.Auvp + byWallet.Passivo;

  const byClassArray = Object.entries(byClass)
    .map(([name, valueBrl]) => ({
      name,
      valueBrl: Math.round(valueBrl * 100) / 100,
      percent: totalEquityBrl > 0 ? Math.round((valueBrl / totalEquityBrl) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.valueBrl - a.valueBrl);

  // Latest snapshot id
  const row = await prisma.snapshot.findFirst({ orderBy: { fetchedAt: 'desc' } });

  const summary: PortfolioSummary = {
    snapshotId: row?.id ?? 0,
    fetchedAt: snapshot._fetchedAt,
    totalEquityBrl: Math.round(totalEquityBrl * 100) / 100,
    byWallet: {
      Auvp: Math.round(byWallet.Auvp * 100) / 100,
      Passivo: Math.round(byWallet.Passivo * 100) / 100,
    },
    byClass: byClassArray,
    sessionExpired: session?.sessionExpired ?? false,
  };

  return res.json(summary);
});
