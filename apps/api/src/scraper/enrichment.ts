/**
 * TypeScript port of the enrichment logic from extractor.js.
 * Calculates prazo_liquidacao and tributacao for each WalletItem.
 */
import type { WalletItem } from '@investidor100/shared-types';

// ─── Config constants (mirror of extractor.js) ────────────────────────────────

export const RATING_DESCRICOES: Record<string, string> = {
  '0': 'Meus',
  '10': 'Luiz Auvp',
  '19': 'Oportunidade',
  '20': 'Emergencia',
  '21': 'Jack-ups',
  '22': 'Pimentas',
  '23': 'Minha',
  '65': 'Prata',
  '66': 'Cripto',
  '67': 'Ouro',
  '77': 'Empresa',
  '81': 'Autos',
  '82': 'Brinquedos',
  '88': 'Motorhome',
  '95': 'Aps',
  '98': 'Lar',
};

const ETF_RENDA_FIXA_D1 = new Set(['AUPO11', 'AREA11']);
const PRAZO_FIXO_POR_TICKER: Record<string, number> = { GOLD11: 10, BSLV39: 10 };

interface PrazoMatchRule {
  id: string;
  patterns: string[];
  dias: number;
  base: string;
}

const PRAZO_FIXO_MATCH_NOME: PrazoMatchRule[] = [
  {
    id: 'FTGF_WA_US_GOV_LIQ_A',
    patterns: [
      'FTGF WESTERN ASSET US GOVERNMENT LIQUIDITY',
      'WESTERN ASSET US GOVERNMENT LIQUIDITY',
    ],
    dias: 4,
    base: 'FTGF_WA_US_GOV_LIQ_D+4',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normText(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function getNomeItem(item: WalletItem): string {
  return item?.ticker_name ?? item?.name ?? item?.ticker ?? '';
}

function isPoupanca(item: WalletItem): boolean {
  return normText(getNomeItem(item)).includes('POUPANCA');
}

function isBusinessDay(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

export function humanizePrazo(days: number | null | undefined): string | null {
  if (days == null) return null;
  const d = Math.max(0, Math.trunc(days));
  const pad2 = (n: number) => String(n).padStart(2, '0');
  if (d <= 30) return `1.d+${pad2(d)}`;
  if (d <= 330) return `2.m+${pad2(Math.ceil(d / 30))}`;
  if (d >= 365) return `3.a+${pad2(Math.ceil(d / 365))}`;
  return '2.m+11';
}

function inferMarketByCurrency(currency: string | undefined): 'US' | 'BR' {
  if (!currency) return 'BR';
  const c = currency.toUpperCase();
  if (c.includes('US') || c.includes('USD')) return 'US';
  return 'BR';
}

function isPassivoEndpoint(endpointKey: string): boolean {
  return endpointKey.includes('Passivo');
}

function estimatePassivoByCategoria(
  item: WalletItem,
  endpointKey: string
): { dias: number; base: string } | null {
  if (!isPassivoEndpoint(endpointKey)) return null;
  const cat = String(item?.categoria_rating ?? '').toLowerCase();
  if (cat === 'empresa') return { dias: 730, base: 'PASSIVO_ESTIMADO(EMPRESA_2A)' };
  return { dias: 60, base: 'PASSIVO_ESTIMADO(2_MESES)' };
}

function matchPrazoByNome(item: WalletItem): { dias: number; base: string } | null {
  const nome = normText(getNomeItem(item));
  if (!nome) return null;
  for (const rule of PRAZO_FIXO_MATCH_NOME) {
    if (rule.patterns.some((p) => nome.includes(normText(p)))) {
      return { dias: rule.dias, base: `MATCH_NOME(${rule.id})` };
    }
  }
  return null;
}

// ─── Prazo de liquidação ─────────────────────────────────────────────────────

function calcPrazoLiquidacao(
  item: WalletItem,
  endpointKey: string
): { dias: number | null; base: string } {
  const tipo = String(item?.ticker_type ?? '').toLowerCase();
  const tickerName = normText(item?.ticker_name ?? '');

  // 0) Poupança -> D+0
  if (isPoupanca(item)) return { dias: 0, base: 'POUPANCA(D+0)' };

  // 1) Override por ticker (metais físicos)
  if (tickerName && PRAZO_FIXO_POR_TICKER[tickerName] != null) {
    return { dias: PRAZO_FIXO_POR_TICKER[tickerName], base: `OVERRIDE_TICKER(${tickerName})` };
  }

  // 1.1) Match por nome (FTGF)
  const byNome = matchPrazoByNome(item);
  if (byNome) return byNome;

  // 2) Renda Fixa / Other
  if (tipo === 'fixed' || tipo === 'other') {
    const daily = Number(item?.dailyLiquidity ?? 0) === 1;
    if (daily) return { dias: 0, base: 'LIQUIDEZ_DIARIA' };

    const due = item?.due_date ? new Date(item.due_date) : null;
    if (due && !isNaN(due.getTime())) {
      const hoje = new Date();
      const a = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
      const b = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
      const ms = b - a;
      const dias = ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
      return { dias, base: 'VENCIMENTO(due_date)' };
    }

    const est = estimatePassivoByCategoria(item, endpointKey);
    return est ?? { dias: null, base: 'SEM_DADOS_RF' };
  }

  // 3) Tesouro
  if (tipo === 'treasure') {
    const agora = new Date();
    const dias = isBusinessDay(agora) && agora.getHours() < 13 ? 0 : 1;
    return { dias, base: 'TESOURO(D+0_ATE_13H_SENAO_D+1)' };
  }

  // 4) Cripto
  if (tipo === 'crypto') return { dias: 0, base: 'CRYPTO(PROXY_D+0)' };

  // 5) ETFs
  if (tipo === 'etf') {
    if (ETF_RENDA_FIXA_D1.has(tickerName)) return { dias: 1, base: 'ETF_ESPECIAL_D+1' };
    return { dias: 2, base: 'ETF_PADRAO_D+2' };
  }

  // 6) BR vs US
  const market = inferMarketByCurrency(item?.currency);
  if (market === 'US') return { dias: 3, base: 'US_BR_D+3' };
  return { dias: 2, base: 'BR_D+2' };
}

// ─── Tributação ───────────────────────────────────────────────────────────────

interface TributacaoResult {
  ir_percent: number;
  limite_isencao_mensal: number;
  tributacao_str: string;
  base: string;
}

function isFtgfFund(item: WalletItem): boolean {
  const nome = normText(getNomeItem(item));
  return (
    nome.includes('FTGF') &&
    nome.includes('WESTERN ASSET') &&
    nome.includes('GOVERNMENT LIQUIDITY')
  );
}

function calcTributacao(item: WalletItem, endpointKey: string): TributacaoResult {
  const tipo = String(item?.ticker_type ?? '').toLowerCase();
  const tickerName = normText(item?.ticker_name ?? '');
  const passivo = isPassivoEndpoint(endpointKey);
  const cat = String(item?.categoria_rating ?? '').toLowerCase();

  if (isPoupanca(item)) {
    return {
      ir_percent: 0,
      limite_isencao_mensal: 0,
      tributacao_str: 'POUPANCA | ISENTO | IR=0% | IRRF=0% | ISENCAO_MENSAL=0',
      base: 'POUPANCA_ISENTO',
    };
  }

  if (passivo) {
    if (cat === 'empresa') {
      return {
        ir_percent: 15,
        limite_isencao_mensal: 0,
        tributacao_str: 'PASSIVO_EMPRESA | GCAP=SIM | IR=15% | IRRF=0% | ISENCAO_MENSAL=0',
        base: 'PASSIVO_EMPRESA_15_SEM_ISENCAO',
      };
    }
    return {
      ir_percent: 15,
      limite_isencao_mensal: 35_000,
      tributacao_str: 'PASSIVO_FISICO | GCAP=SIM | IR=15% | IRRF=0% | ISENCAO_MENSAL=35000',
      base: 'PASSIVO_FISICO_GCAP_15_ISENCAO_35K',
    };
  }

  if (tickerName === 'GOLD11' || tickerName === 'BSLV39') {
    return {
      ir_percent: 15,
      limite_isencao_mensal: 35_000,
      tributacao_str: `METAL_FISICO(${tickerName}) | GCAP=SIM | IR=15% | IRRF=0% | ISENCAO_MENSAL=35000`,
      base: 'METAL_FISICO_GCAP_15_ISENCAO_35K',
    };
  }

  if (isFtgfFund(item)) {
    return {
      ir_percent: 15,
      limite_isencao_mensal: 0,
      tributacao_str: 'FUNDO_EXTERIOR(FTGF) | GCAP=SIM | IR=15% | IRRF=0% | ISENCAO_MENSAL=0',
      base: 'FUNDO_EXTERIOR_IR_15',
    };
  }

  if (tipo === 'crypto') {
    return {
      ir_percent: 15,
      limite_isencao_mensal: 35_000,
      tributacao_str: 'CRIPTO | GCAP=SIM | IR=15% | IRRF=0% | ISENCAO_MENSAL=35000',
      base: 'CRIPTO_GCAP_15_ISENCAO_35K',
    };
  }

  if (tipo === 'fii') {
    return {
      ir_percent: 20,
      limite_isencao_mensal: 0,
      tributacao_str: 'FII_B3 | GCAP=SIM | IR=20% | IRRF≈0.005% | ISENCAO_MENSAL=0',
      base: 'FII_20_SEM_ISENCAO',
    };
  }

  if (tipo === 'etf') {
    return {
      ir_percent: 15,
      limite_isencao_mensal: 0,
      tributacao_str: `ETF_B3 | GCAP=SIM | IR=15% | IRRF≈0.005% | ISENCAO_MENSAL=0`,
      base: tickerName === 'AUPO11' ? 'AUPO11_EXCECAO_15' : 'ETF_15_SEM_ISENCAO',
    };
  }

  const market = inferMarketByCurrency(item?.currency);
  if (tipo === 'stock' && market === 'BR') {
    return {
      ir_percent: 15,
      limite_isencao_mensal: 20_000,
      tributacao_str: 'ACAO_BR | GCAP=SIM | IR=15% | IRRF≈0.005% | ISENCAO_MENSAL=20000',
      base: 'ACAO_BR_15_ISENCAO_20K',
    };
  }

  if (market === 'US') {
    return {
      ir_percent: 15,
      limite_isencao_mensal: 0,
      tributacao_str: 'EXTERIOR | GCAP=SIM | IR=15% | IRRF=0% | ISENCAO_MENSAL=0',
      base: 'EXTERIOR_15_SEM_ISENCAO',
    };
  }

  return {
    ir_percent: 15,
    limite_isencao_mensal: 0,
    tributacao_str: 'OUTROS | GCAP=SIM | IR=15% | IRRF=0% | ISENCAO_MENSAL=0',
    base: 'FALLBACK_15',
  };
}

// ─── Public enrichItem function ───────────────────────────────────────────────

export function enrichItem(item: WalletItem, endpointKey: string): WalletItem {
  // Categoria (custom rating group)
  if (item?.raw_rating != null) {
    const desc = RATING_DESCRICOES[String(item.raw_rating)];
    if (desc) item.categoria_rating = desc;
  }

  // Prazo de liquidação
  const p = calcPrazoLiquidacao(item, endpointKey);
  let dias = p.dias;
  let basePrazo = p.base;

  if (dias == null) {
    const est = estimatePassivoByCategoria(item, endpointKey);
    if (est) {
      dias = est.dias;
      basePrazo = est.base;
    }
  }

  item.prazo_liquidacao_dias = dias;
  item.prazo_liquidacao_str = humanizePrazo(dias);
  item.prazo_liquidacao_base = basePrazo;

  // Tributação
  const tx = calcTributacao(item, endpointKey);
  item.tributacao_str = tx.tributacao_str;
  item.ir_percent = Number(tx.ir_percent ?? 0);
  item.limite_isencao_mensal = Number(tx.limite_isencao_mensal ?? 0);
  item.tributacao_base = tx.base;

  return item;
}
