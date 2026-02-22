/**
 * Fetcher — calls all 26 Investidor10 endpoints using the stored session cookie.
 * Mirrors the batch logic of extractor.js but runs server-side with node-fetch.
 */
import fetch from 'node-fetch';
import type { RawSnapshot, EndpointResult, WalletItem } from '@investidor100/shared-types';
import { WALLET_IDS } from '@investidor100/shared-types';
import { enrichItem, RATING_DESCRICOES } from './enrichment.js';

export { RATING_DESCRICOES };
export const ETF_RENDA_FIXA_D1 = ['AUPO11', 'AREA11'];
export const PRAZO_FIXO_POR_TICKER: Record<string, number> = { GOLD11: 10, BSLV39: 10 };

const BASE =
  'https://investidor10.com.br/wallet/api/proxy/wallet-app/summary';

const ENDPOINTS: Record<string, string> = {
  donutchart_all_Auvp:          `${BASE}/donutchart/${WALLET_IDS.Auvp}/all`,
  barchart_12_all_Auvp:         `${BASE}/barchart/${WALLET_IDS.Auvp}/12/all`,
  donutchart_all_Passivo:       `${BASE}/donutchart/${WALLET_IDS.Passivo}/all`,
  barchart_12_all_Passivo:      `${BASE}/barchart/${WALLET_IDS.Passivo}/12/all`,
  actives_Ticker_Auvp:          `${BASE}/actives/${WALLET_IDS.Auvp}/Ticker`,
  actives_Fii_Auvp:             `${BASE}/actives/${WALLET_IDS.Auvp}/Fii`,
  actives_Crypto_Auvp:          `${BASE}/actives/${WALLET_IDS.Auvp}/Crypto`,
  actives_Etf_Auvp:             `${BASE}/actives/${WALLET_IDS.Auvp}/Etf`,
  actives_EtfInternational_Auvp:`${BASE}/actives/${WALLET_IDS.Auvp}/EtfInternational`,
  actives_Stock_Auvp:           `${BASE}/actives/${WALLET_IDS.Auvp}/Stock`,
  actives_StockBdr_Auvp:        `${BASE}/actives/${WALLET_IDS.Auvp}/StockBdr`,
  actives_Treasure_Auvp:        `${BASE}/actives/${WALLET_IDS.Auvp}/Treasure`,
  actives_fixed_Auvp:           `${BASE}/actives/${WALLET_IDS.Auvp}/fixed`,
  actives_Other_Auvp:           `${BASE}/actives/${WALLET_IDS.Auvp}/Other`,
  actives_Ticker_Passivo:       `${BASE}/actives/${WALLET_IDS.Passivo}/Ticker`,
  actives_Fii_Passivo:          `${BASE}/actives/${WALLET_IDS.Passivo}/Fii`,
  actives_Crypto_Passivo:       `${BASE}/actives/${WALLET_IDS.Passivo}/Crypto`,
  actives_Etf_Passivo:          `${BASE}/actives/${WALLET_IDS.Passivo}/Etf`,
  actives_EtfInternational_Passivo:`${BASE}/actives/${WALLET_IDS.Passivo}/EtfInternational`,
  actives_Stock_Passivo:        `${BASE}/actives/${WALLET_IDS.Passivo}/Stock`,
  actives_StockBdr_Passivo:     `${BASE}/actives/${WALLET_IDS.Passivo}/StockBdr`,
  actives_Treasure_Passivo:     `${BASE}/actives/${WALLET_IDS.Passivo}/Treasure`,
  actives_fixed_Passivo:        `${BASE}/actives/${WALLET_IDS.Passivo}/fixed`,
  actives_Other_Passivo:        `${BASE}/actives/${WALLET_IDS.Passivo}/Other`,
  actives_OuroFisico_Passivo:   `${BASE}/actives/${WALLET_IDS.Passivo}/OuroFisico`,
  actives_PrataFisica_Passivo:  `${BASE}/actives/${WALLET_IDS.Passivo}/PrataFisica`,
};

const BATCH_SIZE = 4;
const BATCH_DELAY_MS = 150;
const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 400;

// Light endpoint used to validate a session cookie before saving it
export const VALIDATION_ENDPOINT =
  `${BASE}/donutchart/${WALLET_IDS.Auvp}/all`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(
  url: string,
  cookie: string,
  retries = RETRY_ATTEMPTS
): Promise<unknown> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: {
        Cookie: cookie,
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (compatible; Investidor100-Server/1.0)',
      },
    });

    if (res.status === 401 || res.status === 403) {
      // Session expired — throw a specific error so the caller can mark it
      const err = new Error(`SESSION_EXPIRED:${res.status}`);
      (err as NodeJS.ErrnoException).code = 'SESSION_EXPIRED';
      throw err;
    }

    if (!res.ok) {
      if (attempt === retries) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      await sleep(RETRY_DELAY_MS * (attempt + 1));
      continue;
    }

    return res.json();
  }
  throw new Error('Max retries exceeded');
}

/**
 * Validates a raw cookie string by calling one lightweight endpoint.
 * Returns true if the session is valid, throws SESSION_EXPIRED otherwise.
 */
export async function validateCookie(cookie: string): Promise<true> {
  await fetchJSON(VALIDATION_ENDPOINT, cookie);
  return true;
}

/**
 * Fetches all 26 endpoints and returns a RawSnapshot.
 * Throws if the session is expired (code SESSION_EXPIRED).
 */
export async function fetchAllEndpoints(cookie: string): Promise<RawSnapshot> {
  const entries = Object.entries(ENDPOINTS);
  const result: RawSnapshot = {
    _source: 'investidor10',
    _fetchedAt: new Date().toISOString(),
    _ratingDescricoes: RATING_DESCRICOES,
    _etf_renda_fixa_d1: ETF_RENDA_FIXA_D1,
    _prazo_fixo_por_ticker: PRAZO_FIXO_POR_TICKER,
    data: {},
  };
  const errors: Record<string, string> = {};

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async ([key, url]) => {
        try {
          const json = await fetchJSON(url, cookie) as EndpointResult;
          if (Array.isArray(json?.data)) {
            json.data.forEach((item: WalletItem) => enrichItem(item, key));
          }
          result.data[key] = json;
        } catch (e: unknown) {
          const err = e as NodeJS.ErrnoException;
          if (err.code === 'SESSION_EXPIRED') throw e; // bubble up
          errors[key] = String(e);
          console.warn(`[fetcher] ERRO em ${key}:`, e);
        }
      })
    );

    if (i + BATCH_SIZE < entries.length) await sleep(BATCH_DELAY_MS);
  }

  if (Object.keys(errors).length > 0) result._errors = errors;
  return result;
}

// ─── Helper: load a snapshot from the JSON sample file (for local testing) ────

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export function loadSampleSnapshot(): RawSnapshot | null {
  const samplesDir = join(process.cwd(), 'data', 'samples');
  try {
    const files = readdirSync(samplesDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length === 0) return null;
    const raw = readFileSync(join(samplesDir, files[0]), 'utf8');
    return JSON.parse(raw) as RawSnapshot;
  } catch {
    return null;
  }
}
