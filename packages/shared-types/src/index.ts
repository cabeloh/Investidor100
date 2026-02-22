// ─── Wallet constants ────────────────────────────────────────────────────────

export const WALLET_IDS = {
  Auvp: '808637',
  Passivo: '2232039',
} as const;

export type WalletName = keyof typeof WALLET_IDS;

export type ActiveType =
  | 'Ticker'
  | 'Fii'
  | 'Crypto'
  | 'Etf'
  | 'EtfInternational'
  | 'Stock'
  | 'StockBdr'
  | 'Treasure'
  | 'fixed'
  | 'Other'
  | 'OuroFisico'
  | 'PrataFisica';

// ─── Ranking ─────────────────────────────────────────────────────────────────

export interface RankingItem {
  value: number | null;
  title: string;
  description: string;
}

// ─── Wallet item (ativos individuais) ────────────────────────────────────────

export interface WalletItem {
  // Identification
  id?: number;
  ticker_name?: string;
  ticker?: string;
  ticker_type?: string;
  tickerable_id?: number;
  name?: string;
  currency?: string;
  url?: string;
  image?: string;

  // Position
  quantity?: number;
  user_avg_price?: number;
  avg_price?: number;
  current_price?: number;
  equity_brl?: number;
  equity_total?: number;

  // Performance
  appreciation?: number;
  weighted_return?: number;
  profitability?: number;
  earnings_received?: number;
  dividend_yield_last_5_years?: number;

  // Portfolio / Allocation
  percent_wallet?: number;
  percent_ideal?: number;
  buy?: number;
  rating?: number;
  raw_rating?: number;
  avg_rating?: number;
  raw_avg_rating?: number;

  // Fundamentals (stocks / FIIs)
  payout?: number;
  p_l?: number;
  p_vp?: number;
  dy?: number;
  graham?: number;
  bazin?: number;
  roe?: number;
  net_margin?: number;
  gross_margin?: number;
  gnr?: number;
  gnp?: number;
  yoc?: number;

  // FII specific
  segment?: string;
  fii_type?: string;

  // Renda Fixa specific
  avg_price_treasure?: number;
  current_price_treasure?: number;
  applied?: number;
  indexer?: string;
  emitter?: string;
  investment_type?: string;
  rate_type?: string;
  percentage_cdi?: number;
  percentage_year?: number;
  due_date?: string;
  dailyLiquidity?: number;

  // Crypto specific
  capitalization?: number;
  profit_1?: number;
  profit_7?: number;
  profit_30?: number;
  profit_365?: number;

  // Ranking (object with up to 10 sub-items)
  ranking?: {
    items?: {
      years?: RankingItem;
      profitable?: RankingItem;
      profitable5years?: RankingItem;
      dy?: RankingItem;
      roe?: RankingItem;
      debt?: RankingItem;
      cagrr5?: RankingItem;
      cagrl?: RankingItem;
      liquidity?: RankingItem;
      rating?: RankingItem;
    };
  };

  // Enrichment (calculated by backend — port of extractor.js)
  categoria_rating?: string;
  prazo_liquidacao_dias?: number | null;
  prazo_liquidacao_str?: string | null;
  prazo_liquidacao_base?: string;
  tributacao_str?: string;
  ir_percent?: number;
  limite_isencao_mensal?: number;
  tributacao_base?: string;

  // Added by API
  Tipo?: string;
  Carteira?: WalletName;
  Nome?: string;
}

// ─── Endpoint result shape ────────────────────────────────────────────────────

export interface EndpointResult {
  data?: WalletItem[];
  [key: string]: unknown;
}

// ─── Raw snapshot (mirrors extractor.js output) ───────────────────────────────

export interface RawSnapshot {
  _source: 'investidor10';
  _fetchedAt: string;
  _ratingDescricoes: Record<string, string>;
  _etf_renda_fixa_d1: string[];
  _prazo_fixo_por_ticker: Record<string, number>;
  _errors?: Record<string, string>;
  data: Record<string, EndpointResult>;
}

// ─── API response types ───────────────────────────────────────────────────────

export interface AllocationSlice {
  name: string;
  valueBrl: number;
  percent: number;
}

export interface PortfolioSummary {
  snapshotId: number;
  fetchedAt: string;
  totalEquityBrl: number;
  byWallet: { Auvp: number; Passivo: number };
  byClass: AllocationSlice[];
  sessionExpired: boolean;
}

export interface HistoryPoint {
  date: string;
  equityBrl: number;
  byWallet: { Auvp: number; Passivo: number };
}

export interface AuthStatus {
  hasSession: boolean;
  validatedAt?: string;
  lastUsedAt?: string;
  sessionExpired: boolean;
}
