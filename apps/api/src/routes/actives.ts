/**
 * GET /api/actives — full list of wallet items with optional filters.
 *
 * Query params:
 *   carteira   = Auvp | Passivo
 *   tipo       = Fii | Stock | fixed | ...
 *   categoria  = Meus | Pimentas | Empresa | ...
 *   search     = ticker or name substring (case-insensitive)
 */
import { Router, Request, Response } from 'express';
import { getLatestSnapshot, extractActives } from '../scraper/snapshot.js';

export const activesRouter = Router();

activesRouter.get('/', async (req: Request, res: Response) => {
  const snapshot = await getLatestSnapshot();

  if (!snapshot) {
    return res.status(503).json({ error: 'Nenhum snapshot disponível.' });
  }

  let items = extractActives(snapshot);

  // ── Filters ──────────────────────────────────────────────────────────────────
  const { carteira, tipo, categoria, search } = req.query;

  if (carteira) {
    items = items.filter((i) => i.Carteira === carteira);
  }

  if (tipo) {
    items = items.filter((i) =>
      String(i.Tipo ?? '').toLowerCase() === String(tipo).toLowerCase()
    );
  }

  if (categoria) {
    items = items.filter((i) =>
      String(i.categoria_rating ?? '').toLowerCase() === String(categoria).toLowerCase()
    );
  }

  if (search) {
    const q = String(search).toLowerCase();
    items = items.filter((i) => {
      const nome = String(i.Nome ?? '').toLowerCase();
      const ticker = String(i.ticker_name ?? i.ticker ?? '').toLowerCase();
      return nome.includes(q) || ticker.includes(q);
    });
  }

  // ── Sort by equity_brl desc ──────────────────────────────────────────────────
  items.sort((a, b) => {
    const ea = parseFloat(String(a.equity_brl ?? 0));
    const eb = parseFloat(String(b.equity_brl ?? 0));
    return eb - ea;
  });

  return res.json({ total: items.length, fetchedAt: snapshot._fetchedAt, data: items });
});
