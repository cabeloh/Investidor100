/**
 * Snapshot helpers — run a fetch cycle and persist, load the latest snapshot.
 */
import { prisma } from '../lib/prisma.js';
import { fetchAllEndpoints, loadSampleSnapshot } from './fetcher.js';
import { loadActiveCookie, markSessionExpired } from '../routes/auth.js';
import type { RawSnapshot } from '@investidor100/shared-types';

/**
 * Runs a full fetch cycle:
 * 1. Load active cookie from DB
 * 2. Call all 26 endpoints
 * 3. Save resulting snapshot to DB
 * Returns the saved snapshot, or throws if no session is available.
 */
export async function runFetchCycle(): Promise<RawSnapshot> {
  const cookie = await loadActiveCookie();

  if (!cookie) {
    throw new Error('NO_SESSION: nenhuma sessão activa. Configure o cookie em /api/auth/session.');
  }

  let snapshot: RawSnapshot;
  try {
    snapshot = await fetchAllEndpoints(cookie);
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'SESSION_EXPIRED') {
      await markSessionExpired();
      throw new Error('SESSION_EXPIRED: sessão expirada. Renove o cookie em Configurações.');
    }
    throw e;
  }

  // Update lastUsedAt
  await prisma.session.updateMany({ data: { lastUsedAt: new Date() } });

  const hasErrors = Object.keys(snapshot._errors ?? {}).length > 0;
  await prisma.snapshot.create({
    data: {
      fetchedAt: new Date(snapshot._fetchedAt),
      rawJson: JSON.stringify(snapshot),
      hasErrors,
    },
  });

  console.log(`[snapshot] Salvo. hasErrors=${hasErrors} fetchedAt=${snapshot._fetchedAt}`);
  return snapshot;
}

/**
 * Returns the latest snapshot from DB.
 * Falls back to the sample JSON file if no snapshot exists in DB (dev mode).
 */
export async function getLatestSnapshot(): Promise<RawSnapshot | null> {
  const row = await prisma.snapshot.findFirst({ orderBy: { fetchedAt: 'desc' } });

  if (row) return JSON.parse(row.rawJson) as RawSnapshot;

  // Dev fallback: use sample JSON
  const sample = loadSampleSnapshot();
  if (sample) {
    console.log('[snapshot] Usando arquivo de amostra (DB vazio).');
  }
  return sample;
}

/**
 * Extracts all actives items from a snapshot, tagged with Tipo and Carteira.
 */
export function extractActives(snapshot: RawSnapshot) {
  const items: Array<Record<string, unknown>> = [];

  for (const [key, endpoint] of Object.entries(snapshot.data)) {
    if (!Array.isArray(endpoint?.data)) continue;

    // Derive Tipo and Carteira from the endpoint key
    // e.g. actives_Fii_Auvp -> Tipo=Fii, Carteira=Auvp
    const parts = key.split('_');
    const carteira = parts[parts.length - 1] as 'Auvp' | 'Passivo';
    const tipo = parts.slice(1, -1).join('_'); // handles multi-part types

    for (const item of endpoint.data) {
      items.push({
        ...item,
        Tipo: tipo,
        Carteira: carteira,
        Nome: (item as Record<string, unknown>).ticker_name
          ?? (item as Record<string, unknown>).name
          ?? (item as Record<string, unknown>).ticker
          ?? '',
      });
    }
  }

  return items;
}
