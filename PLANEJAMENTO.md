# Investidor100 — Planejamento do App

> PWA de consolidação das duas carteiras do Investidor10
> Última atualização: 2026-02-21 (decisões de auth e hospedagem fechadas)

---

## 1. Visão Geral

Aplicativo web progressivo (PWA) que:
- Faz scraping automatizado das duas contas do Investidor10
- Consolida todas as classes de ativos + passivos em uma visão unificada
- Exibe dashboards interativos replicando (e evoluindo) os do Power BI atual
- Calcula patrimônio líquido real (Ativos − Passivos)
- Compara rentabilidade com benchmarks (CDI, IBOV, IFIX, IPCA)

---

## 2. Classes de Ativos/Passivos Mapeadas

| Classe            | Origem             |
|-------------------|--------------------|
| Ações BR          | Investidor10       |
| FIIs              | Investidor10       |
| Renda Fixa        | Investidor10       |
| BDRs / Exterior   | Investidor10       |
| Passivos          | Manual / Investidor10 (carros, imóveis, outros) |

---

## 3. Arquitetura Proposta

```
┌──────────────────────────────────────────────────────┐
│                     PWA (Browser)                    │
│   React + Vite │ Recharts │ Tailwind + shadcn/ui     │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │Dashboard │  │Carteiras │  │ Patrimônio Líquido │ │
│  │ principal│  │detalhadas│  │ Ativos - Passivos  │ │
│  └──────────┘  └──────────┘  └────────────────────┘ │
└──────────────────────────┬───────────────────────────┘
                           │ REST API (fetch/axios)
┌──────────────────────────▼───────────────────────────┐
│                  Backend API (Node.js)               │
│           Express + TypeScript                       │
│                                                      │
│  ┌─────────────┐   ┌────────────┐  ┌─────────────┐  │
│  │  Scraper    │   │  Scheduler │  │  API Routes │  │
│  │ Playwright  │   │  cron job  │  │  /portfolio │  │
│  │ (2 contas)  │   │  (ex: 6h)  │  │  /assets    │  │
│  └─────────────┘   └────────────┘  │  /history   │  │
│                                    │  /benchmarks│  │
│  ┌─────────────────────────────┐   └─────────────┘  │
│  │       SQLite / PostgreSQL   │                     │
│  │  snapshots históricos       │                     │
│  └─────────────────────────────┘                     │
└──────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────┐
│              Investidor10 (site externo)             │
│   Conta A                        Conta B             │
└──────────────────────────────────────────────────────┘
```

---

## 4. Stack Tecnológico

### Frontend (PWA)
| Tecnologia     | Papel                          |
|----------------|--------------------------------|
| React 18 + Vite| Framework + build tool         |
| TypeScript     | Type safety                    |
| Tailwind CSS   | Estilização utilitária         |
| shadcn/ui      | Componentes UI acessíveis      |
| Recharts       | Gráficos interativos           |
| React Query    | Cache e sync de dados da API   |
| Workbox        | Service Worker / PWA offline   |

### Backend
| Tecnologia       | Papel                           |
|------------------|---------------------------------|
| Node.js + Express| Servidor HTTP / API REST        |
| TypeScript       | Type safety                     |
| Playwright       | Scraping automatizado           |
| node-cron        | Agendamento do scraping         |
| Prisma           | ORM para banco de dados         |
| SQLite (dev)     | Banco local (migrar para Postgres em produção) |
| dotenv           | Credenciais das contas          |

### Infraestrutura

#### Decisão confirmada: Hetzner CX22 ✅

Requisitos que guiaram a escolha:
- Acesso de qualquer lugar: celular + PC + 24/7
- Playwright/Chromium precisam de ~400–700MB RAM
- App pessoal (1 usuário), custo deve ser mínimo

| Opção | Custo/mês | RAM | Playwright | Veredito |
|-------|-----------|-----|------------|---------|
| **Hetzner CX22** ← **escolhido** | €4,35 (~R$25) | 4GB | ✅ Roda bem | Melhor custo-benefício |
| Railway Starter | ~$5–10 | 512MB–2GB | ⚠️ Apertado | DX melhor, mas caro e instável |
| Fly.io | free → $5+ | 256MB–1GB | ❌ Muito apertado | Memória insuficiente |
| VPS Vultr/DigitalOcean | $12+ | 2GB | ✅ | Mais caro que Hetzner |

**Stack no VPS:**
```
Docker Compose
├── api         (Node.js + Express + Playwright)  → porta 3001
├── web         (Nginx servindo o build React)    → porta 80/443
└── caddy       (HTTPS automático via Let's Encrypt)
```

**Deploy:** push no GitHub → GitHub Actions faz build + SSH deploy automático.

---

## 5. Fluxo de Dados

### 5.1 Setup inicial (feito uma vez por mês)

```
1. Usuário faz login no investidor10.com.br com Google OAuth (no próprio browser)
        │
2. Usuário abre o app → Configurações → Sessão → "Renovar sessão"
        │
3. App mostra instruções: copiar cookie de sessão do DevTools
        │
4. Usuário cola o cookie → app valida via chamada de teste → salva criptografado
```

### 5.2 Coleta automática (a cada 6h)

```
1. Cron job dispara a cada 6 horas
        │
2. Backend carrega cookies criptografados do banco
        │
3. axios/node-fetch com os cookies persistidos
   └─ 26 chamadas REST em paralelo (batches de 4, delay 150ms)
   └─ Aplica lógica de enriquecimento (prazo + tributação)
        │
4. Se API retornar 401/403 → sessão expirada
   └─ Marca no banco: session_expired = true
   └─ App exibe aviso: "Sessão expirada — renove em Configurações"
        │
5. Normaliza e mescla Auvp + Passivo (26 endpoints → 1 snapshot consolidado)
        │
6. Salva snapshot no banco (com timestamp)
        │
7. PWA consulta API → exibe dashboards atualizados
```

> Playwright **não é usado** para login (OAuth é incompatível com automação).
> Toda coleta é feita via chamadas HTTP simples com cookies persistidos.
> Playwright permanece na stack como opção futura se necessário.

---

## 6. Análise Técnica do Script (extractor.js)

> Script completo em `scripts/chrome-console/extractor.js`

### 6.1 Descoberta Crítica: É 100% API REST — sem scraping de DOM

O script não lê HTML da página. Ele chama **24 endpoints JSON** do próprio backend
do Investidor10, aproveitando os cookies de sessão do browser logado.

Isso simplifica radicalmente a arquitetura: **Playwright só é necessário para autenticação**.
Após capturar os cookies de sessão, as 24 chamadas são requests HTTP simples (axios/fetch).

---

### 6.2 IDs das Carteiras (hardcoded no script)

| Alias no Script | Wallet ID | Descrição                     |
|-----------------|-----------|-------------------------------|
| `Auvp`          | `808637`  | Carteira de investimentos      |
| `Passivo`       | `2232039` | Carteira de passivos/bens      |

---

### 6.3 Os 24 Endpoints

**Padrão das URLs:**
```
https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/{tipo}/{walletId}/{...}
```

**Por carteira (× 2):**

| Endpoint              | Rota                                    | Dados                      |
|-----------------------|-----------------------------------------|----------------------------|
| `donutchart/all`      | `/donutchart/{id}/all`                  | Alocação por classe (pizza)|
| `barchart/12/all`     | `/barchart/{id}/12/all`                 | Evolução 12 meses (barras) |
| `actives/Ticker`      | `/actives/{id}/Ticker`                  | Ações BR (tickers gerais)  |
| `actives/Fii`         | `/actives/{id}/Fii`                     | FIIs                       |
| `actives/Crypto`      | `/actives/{id}/Crypto`                  | Criptomoedas               |
| `actives/Etf`         | `/actives/{id}/Etf`                     | ETFs nacionais             |
| `actives/EtfInternational` | `/actives/{id}/EtfInternational`   | ETFs internacionais        |
| `actives/Stock`       | `/actives/{id}/Stock`                   | Ações                      |
| `actives/StockBdr`    | `/actives/{id}/StockBdr`                | BDRs                       |
| `actives/Treasure`    | `/actives/{id}/Treasure`                | Tesouro Direto             |
| `actives/fixed`       | `/actives/{id}/fixed`                   | Renda fixa (CDB, LCI…)     |
| `actives/Other`       | `/actives/{id}/Other`                   | Outros (metais, bens…)     |

Total: **2 + 2 + (10 × 2) = 24 chamadas** por execução.

---

### 6.4 Autenticação

O fetch usa `credentials: "include"` — os cookies de sessão do Investidor10
já abertos no Chrome são enviados automaticamente.

#### Decisão confirmada: Google OAuth → Cookie Paste via Admin UI ✅

O login do Investidor10 usa **Google OAuth** — não existe formulário email/senha.
Isso inviabiliza a automação direta do login com Playwright:
- Google detecta navegadores automatizados e aciona CAPTCHA/verificação extra
- O fluxo OAuth abre uma popup do Google que é difícil de controlar programaticamente

**Abordagem adotada: Cookie paste manual** (simples, confiável, funciona perfeitamente com OAuth)

**Fluxo da autenticação:**

```
1. Usuário abre investidor10.com.br no Chrome e faz login normalmente (Google OAuth)
2. Abre o app no celular/browser → vai em Configurações → Sessão
3. Clica em "Renovar sessão" → app mostra instruções + link direto para DevTools
4. Usuário copia o valor do cookie de sessão (ex: laravel_session ou similar)
5. Cola no campo do app → backend valida fazendo 1 chamada de teste
6. Se válido: salva criptografado no banco → scraping funciona automaticamente
7. App mostra "Sessão expira em ~X dias" com alerta antes de expirar
```

**Por que funciona bem:**
- Cookies do Investidor10 pós-OAuth duram tipicamente 30–90 dias
- Renovar leva ~2 minutos (login já está feito no browser do usuário)
- Zero credenciais armazenadas no servidor
- Completamente imune a mudanças no fluxo OAuth do Google

| Aspecto | Cookie Paste |
|---------|-------------|
| Complexidade de implementação | Baixa |
| Confiabilidade | Alta (100%) |
| Manutenção | ~1 vez por mês (2 min) |
| Segurança | Alta (cookie criptografado no banco) |
| Automação | Scraping 100% automático após setup |

**Implementação no backend:**

```typescript
// admin route: POST /api/auth/session
// body: { cookies: "laravel_session=abc123; xsrf-token=xyz..." }
// 1. Testa cookies fazendo GET em um endpoint leve do Investidor10
// 2. Se 200: salva criptografado (AES-256) no banco com timestamp
// 3. Scraper usa os cookies persistidos para todas as 26 chamadas
// 4. Se API retornar 401/403: marca sessão como expirada, notifica no app
```

---

### 6.5 Lógica de Enriquecimento (já implementada no script)

O script já calculam dois campos extras em cada item — vamos portar isso para TypeScript no backend:

#### Prazo de Liquidação (`prazo_liquidacao_dias`)

| Tipo de ativo        | Prazo   | Regra                                      |
|----------------------|---------|--------------------------------------------|
| Poupança             | D+0     | Detecção por nome                          |
| GOLD11, BSLV39       | D+10    | Override por ticker (metais físicos)       |
| FTGF Western Asset   | D+4     | Match por nome                             |
| RF com liquidez diária | D+0  | Campo `dailyLiquidity === 1`               |
| RF com vencimento    | D+N     | Calculado de `due_date`                    |
| Tesouro Direto       | D+0/D+1 | D+0 se dia útil antes das 13h, senão D+1  |
| Cripto               | D+0     | Proxy (liquidez contínua)                  |
| ETF especial (AUPO11, AREA11) | D+1 | Lista fixa                           |
| ETF padrão           | D+2     | Padrão B3                                  |
| Ações BR             | D+2     | Padrão B3                                  |
| Ações EUA/exterior   | D+3     | Detectado por `currency` USD               |
| Passivo empresa      | D+730   | Estimativa 2 anos                          |
| Passivo físico       | D+60    | Estimativa 2 meses                         |

#### Tributação (`tributacao_str`, `ir_percent`, `limite_isencao_mensal`)

| Tipo de ativo        | IR    | Isenção mensal | Observação              |
|----------------------|-------|----------------|-------------------------|
| Poupança             | 0%    | —              | Isento                  |
| Ações BR             | 15%   | R$ 20.000      | GCAP + IRRF ≈ 0,005%    |
| FII                  | 20%   | —              | GCAP + IRRF ≈ 0,005%    |
| ETF B3               | 15%   | —              | GCAP + IRRF ≈ 0,005%    |
| Cripto               | 15%   | R$ 35.000      | GCAP                    |
| Metais (GOLD11, BSLV39) | 15% | R$ 35.000   | GCAP                    |
| FTGF (fundo exterior)| 15%  | —              | GCAP                    |
| Exterior genérico    | 15%   | —              | GCAP                    |
| Passivo físico       | 15%   | R$ 35.000      | GCAP                    |
| Passivo empresa      | 15%   | —              | GCAP sem isenção        |

---

### 6.6 Categorias Customizadas (raw_rating → categoria_rating)

O usuário criou grupos próprios dentro do Investidor10:

| raw_rating | Categoria    | raw_rating | Categoria   |
|-----------|--------------|-----------|-------------|
| 0         | Meus         | 66        | Cripto      |
| 10        | Luiz Auvp    | 67        | Ouro        |
| 19        | Oportunidade | 77        | Empresa     |
| 20        | Emergencia   | 81        | Autos       |
| 21        | Jack-ups     | 82        | Brinquedos  |
| 22        | Pimentas     | 88        | Motorhome   |
| 23        | Minha        | 95        | Aps         |
| 65        | Prata        | 98        | Lar         |

Estes grupos aparecem em filtros e análises no app.

---

### 6.7 Estrutura do JSON de Saída

```json
{
  "_source": "investidor10",
  "_fetchedAt": "2026-02-21T...",
  "_ratingDescricoes": { "0": "Meus", ... },
  "_etf_renda_fixa_d1": ["AUPO11", "AREA11"],
  "_prazo_fixo_por_ticker": { "GOLD11": 10, "BSLV39": 10 },
  "_prazo_match_nome": [...],
  "data": {
    "donutchart_all_Auvp": { ... },
    "barchart_12_all_Auvp": { ... },
    "actives_Fii_Auvp": {
      "data": [
        {
          "ticker_name": "XPML11",
          "ticker_type": "Fii",
          "currency": "BRL",
          "raw_rating": 22,
          "categoria_rating": "Pimentas",
          "prazo_liquidacao_dias": 2,
          "prazo_liquidacao_str": "1.d+02",
          "tributacao_str": "FII_B3 | GCAP=SIM | IR=20% ...",
          "ir_percent": 20,
          "limite_isencao_mensal": 0
        }
      ]
    },
    ...
  }
}
```

---

## 7. Telas Planejadas (MVP)

### 7.1 Dashboard Principal
- Patrimônio total consolidado (Ativos − Passivos)
- Gráfico de pizza: alocação por classe
- Variação do dia / mês / ano
- Card de rentabilidade vs CDI / IBOV / IFIX

### 7.2 Carteiras Detalhadas
- Lista de ativos por classe com filtro
- Coluna: Ticker | Quantidade | Preço Médio | Preço Atual | Resultado | %
- Toggle: ver Conta A | Conta B | Consolidado

### 7.3 Patrimônio Líquido
- Ativos totais
- Passivos (imóveis, carros, outros)
- PL = Ativos − Passivos
- Evolução histórica (linha do tempo)

### 7.4 Análise de Rentabilidade
- Rentabilidade por período (1M, 3M, 6M, 1A, Total)
- Comparação com CDI, IBOV, IFIX, IPCA
- Contribuição individual de cada ativo

### 7.5 Configurações
- **Sessão** — colar cookie do Investidor10, status da sessão, data de expiração estimada
- Frequência do scraping (padrão: 6h)
- Gerenciar passivos manualmente
- Exportar dados (JSON / CSV)
- Botão "Forçar atualização agora"

---

## 8. Estrutura de Pastas Proposta

```
Investidor100/
├── apps/
│   ├── web/                    # PWA React
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── services/       # chamadas à API
│   │   │   └── types/
│   │   ├── public/
│   │   │   └── manifest.json
│   │   └── vite.config.ts
│   └── api/                    # Backend Express
│       ├── src/
│       │   ├── routes/
│       │   ├── scraper/        # lógica Playwright
│       │   ├── scheduler/      # cron jobs
│       │   ├── db/             # Prisma schema + migrations
│       │   └── types/
│       └── .env.example
├── packages/
│   └── shared-types/           # tipos compartilhados (monorepo)
├── scripts/
│   └── chrome-console/         # script original mantido aqui
│       └── extractor.js
├── PLANEJAMENTO.md             # este arquivo
├── package.json                # workspace root (pnpm)
└── .gitignore
```

---

## 9. Roadmap por Fases

### Fase 1 — Fundação (Backend + Scraper)
- [ ] Analisar script atual e identificar endpoints/seletores
- [ ] Configurar projeto monorepo (pnpm workspaces)
- [ ] Implementar scraper Playwright para Conta A
- [ ] Estender para Conta B
- [ ] Criar banco de dados (schema Prisma)
- [ ] API básica: `GET /portfolio`, `GET /history`

### Fase 2 — PWA MVP
- [ ] Setup React + Vite + Tailwind + shadcn
- [ ] Dashboard principal com dados reais
- [ ] Tela de carteiras detalhadas
- [ ] PWA manifest + service worker

### Fase 3 — Análise & Passivos
- [ ] Tela de Patrimônio Líquido com passivos
- [ ] Comparação com benchmarks (CDI, IBOV, IFIX, IPCA)
- [ ] Histórico de evolução patrimonial
- [ ] Cadastro manual de passivos (imóveis, carros)

### Fase 4 — Produção
- [ ] Deploy backend (Fly.io ou VPS)
- [ ] Deploy PWA (Vercel ou mesmo servidor)
- [ ] Autenticação básica (proteger dados sensíveis)
- [ ] Notificações push (dividendos, variações relevantes)

---

## 10. Riscos e Decisões

| Risco | Mitigação |
|-------|-----------|
| ~~Login automatizado bloqueado~~ | **Resolvido**: não automatizamos login. Cookie paste manual elimina o problema. |
| Cookie de sessão expira | App monitora resposta das APIs; se 401/403 → alerta no app; renovação leva ~2 min |
| Investidor10 muda IDs das carteiras (808637, 2232039) | Mesma conta confirmada; alerta por log se endpoint retornar 404 |
| Mudança nos endpoints da API interna | Health check semanal; extractor.js original como fallback imediato |
| Dados sensíveis (cookie de sessão) expostos | Cookie criptografado com AES-256 no banco; nunca em `.env` ou logs |
| Rate limiting da API do Investidor10 | Manter batch de 4 requisições com delay de 150ms (igual ao script original) |
| Dados desatualizados | Cron job a cada 6h + botão "Atualizar agora" no app + timestamp visível na UI |
| VPS Hetzner fora do ar | Uptime típico >99,9%; backup do SQLite para S3/R2 (gratuito até 10GB) |

### Decisões fechadas

| Pergunta | Resposta | Impacto |
|----------|----------|---------|
| Tipo de login | Google OAuth | Não automatizamos login; usamos cookie paste |
| Número de contas | 1 conta (2 carteiras) | Auth única, dois wallet IDs |
| Hospedagem | Hetzner CX22 (~R$25/mês) | Docker Compose + HTTPS automático |
| Acesso | Qualquer dispositivo 24/7 | PWA instalável no celular |

---

## 11. Análise do Power BI (pbix)

> Código M Query em `scripts/powerbi/mashup_queries.pq`
> Screenshots analisadas: Página 1 (matriz + treemap), Página 2 (séries temporais), Página 3 (liquidez + IR)

### 11.1 Modelo de Dados (Power Query)

O pbix tem **4 queries**:

| Query | Papel | Carrega para relatório |
|-------|-------|----------------------|
| `Downloads` | Base: lê todos os JSONs da pasta `Downloads`, 1 por dia = 1 snapshot | Não |
| `donutchart_all` | Alocação por classe (Auvp + Passivo), unpivotado | Sim |
| `barchart_12` | Evolução 12 meses com `sum_applied/equity/flow/profitability` | Sim |
| `actives` | Todos os ativos individuais, todos os endpoints, todos os campos | Sim |
| `Downloads (2)` | Alias de `Downloads` para uso em visuais | Sim |

**Modelo temporal:** um arquivo JSON por dia. O pbix lê TODOS e cria série histórica. O app replicará isso com snapshots no banco de dados.

---

### 11.2 Descoberta: 2 Endpoints Faltando no extractor.js!

O pbix consome **26 endpoints** de ativos, mas o script atual tem apenas **24**. Faltam:

| Endpoint ausente | Tipo | Carteira |
|-----------------|------|----------|
| `actives_OuroFisico_Passivo` | `OuroFisico` | 2232039 (Passivo) |
| `actives_PrataFisica_Passivo` | `PrataFisica` | 2232039 (Passivo) |

**Ação**: adicionar esses dois endpoints ao extractor.js e ao backend.

---

### 11.3 Campos Completos da Tabela `actives`

Abaixo todos os campos que o pbix expande de cada item:

**Identificação:**
`id`, `ticker_name`, `ticker`, `ticker_type`, `tickerable_id`, `name`, `currency`, `url`, `image`

**Posição:**
`quantity`, `user_avg_price`, `avg_price`, `current_price`, `equity_brl`, `equity_total`

**Performance:**
`appreciation`, `weighted_return`, `profitability`, `earnings_received`, `dividend_yield_last_5_years`

**Carteira/Alocação:**
`percent_wallet`, `percent_ideal`, `buy`, `rating`, `raw_rating`, `avg_rating`, `raw_avg_rating`

**Fundamentals (ações/FIIs):**
`payout`, `p_l`, `p_vp`, `dy`, `graham`, `bazin`, `roe`, `net_margin`, `gross_margin`, `gnr`, `gnp`, `yoc`

**FII específico:** `segment`, `fii_type`

**Renda Fixa específico:**
`avg_price_treasure`, `current_price_treasure`, `applied`, `indexer`, `emitter`,
`investment_type`, `rate_type`, `percentage_cdi`, `percentage_year`, `due_date`, `dailyLiquidity`

**Cripto específico:** `capitalization`, `profit_1`, `profit_7`, `profit_30`, `profit_365`

**Ranking (objeto expandido, 10 sub-itens com `value/title/description`):**
`ranking.items.years`, `ranking.items.profitable`, `ranking.items.profitable5years`,
`ranking.items.dy`, `ranking.items.roe`, `ranking.items.debt`,
`ranking.items.cagrr5`, `ranking.items.cagrl`, `ranking.items.liquidity`, `ranking.items.rating`

**Enriquecimento (calculado pelo extractor.js):**
`categoria_rating`, `prazo_liquidacao_dias`, `prazo_liquidacao_str`, `prazo_liquidacao_base`,
`limite_isencao_mensal`, `tributacao_resumo`, `ir_percent`

**Adicionado pelo pbix:** `Tipo` (de endpoint), `Carteira` (Auvp/Passivo), `Nome` (= ticker_name ?? ticker), `checklist_rate`

---

### 11.4 Dashboards Existentes (a replicar no PWA)

#### Página 1 — Patrimônio por Categoria
```
┌─────────────────────────────┬──────────────────────────┐
│ Matrix: Data × Carteira     │ Treemap: por             │
│ (Auvp / Passivo / Total)    │ categoria_rating         │
│ equity_brl por dia          │ (Empresa, Aps, Lar, etc) │
├─────────────────────────────┴──────────────────────────┤
│ Tabela detalhada: Ano/Mês/Dia × categoria_rating        │
│ colunas: Aps | Autos | Brinquedos | Cripto | Empresa   │
│          | Jack-ups | Lar | Luiz Auvp | Meus | ...     │
└─────────────────────────────────────────────────────────┘
Filtros: Carteira, categoria_rating, Tipo, Carteira
```

#### Página 2 — Evolução Temporal
```
┌─────────────────────────────────────────────────────────┐
│ Linha: Soma de equity_brl por Date created              │
│ (~R$929K → R$1.24M ao longo dos meses)                 │
├─────────────────────────────────────────────────────────┤
│ Waterfall: equity_brl (DoD) — variação dia a dia       │
│ Verde = aumento, Vermelho = queda, Azul = Total         │
├─────────────────────────────────────────────────────────┤
│ Linhas múltiplas: equity_brl por categoria_rating       │
│ (Luiz Auvp ~R$500K, Meus ~R$408-513K)                  │
└─────────────────────────────────────────────────────────┘
Filtros: Carteira, categoria_rating, Ano/Mês/Dia
```

#### Página 3 — Liquidez & Tributação
```
┌─────────────────┬───────────────────┬──────────────────┐
│ Treemap:        │ Tabela IR:        │ Pizza:           │
│ prazo_liquidacao│ ir_percent ×      │ categoria_rating │
│ × equity_brl   │ limite_isencao    │ × equity_brl     │
│                 │ × equity_brl      │                  │
├─────────────────┼───────────────────┼──────────────────┤
│ D+0: R$155K    │ IR=15% lim=0:    │ Tabela: Tipo     │
│ D+1: R$239K    │   R$5.9M (59%)   │ × equity_brl × % │
│ D+2: R$419K    │ IR=15% lim=35K:  │                  │
│ D+10: R$462K   │   R$3.8M (38%)   │                  │
│ 2m+02: R$3.2M  │ IR=20% lim=0:    │                  │
│ 3a+02: R$4.9M  │   R$215K (2%)    │                  │
└─────────────────┴───────────────────┴──────────────────┘
Tabela bottom: Nome | quantity | equity_brl | prazo_dias | categoria | Carteira | prazo_base
Filtros: Carteira (Auvp/Passivo), categoria_rating, Tipo, Ano/Mês/Dia
```

---

### 11.5 Patrimônio Atual (baseado nos screenshots)

| Categoria | Valor | % |
|-----------|-------|---|
| Empresa (Questor) | ~R$4,9M | 49,3% |
| Lar | ~R$1,19M | 12,0% |
| Aps | ~R$1,15M | 11,5% |
| Luiz Auvp | ~R$521K | 5,3% |
| Motorhome | ~R$500K | 5,0% |
| Ouro | ~R$446K | 4,5% |
| Meus | ~R$409K | 4,1% |
| Oportunidade | ~R$226K | 2,3% |
| Outros | ~R$480K | 5,0% |
| **Total** | **~R$9,93M** | 100% |

**Por liquidez (prazo):**
- Imediato/curto (D+0 a D+10): ~50%
- Médio prazo (2m): ~32%
- Longo prazo (2a+): ~49% (dominado pela empresa)

---

## 12. Próximos Passos Imediatos

1. ~~**Analisar o script do Chrome console**~~ ✅ Concluído — ver seção 6
2. ~~**Analisar o pbix**~~ ✅ Concluído — ver seção 11
3. ~~**Confirmar login**~~ ✅ Google OAuth → cookie paste manual
4. ~~**Confirmar contas**~~ ✅ Mesma conta, duas carteiras (808637 / 2232039)
5. ~~**Decidir hospedagem**~~ ✅ Hetzner CX22 (~R$25/mês)
6. **Corrigir o extractor.js**: adicionar `OuroFisico_Passivo` e `PrataFisica_Passivo` (ver 11.2)
7. **Iniciar Fase 1**: setup do monorepo + módulo de auth por cookie + fetcher REST

### Ordem de implementação (Fase 1 detalhada)

```
1. Corrigir extractor.js (adicionar OuroFisico + PrataFisica no Passivo)
2. Setup monorepo pnpm (apps/api, apps/web, packages/shared-types)
3. Backend: módulo de sessão (cookie paste)
   └─ POST /api/auth/session   → valida e salva cookie criptografado (AES-256)
   └─ GET  /api/auth/status    → sessão válida? expira em?
4. Backend: módulo fetcher (26 endpoints)
   └─ porta calcPrazoLiquidacao + calcTributacao + enrichItem → TypeScript
   └─ batch de 4 com delay 150ms
5. Backend: schema Prisma
   └─ Session { id, cookieEncrypted, validatedAt, lastUsedAt }
   └─ Snapshot { id, fetchedAt, rawJson }
   └─ WalletItem { snapshotId, wallet, tipo, ...campos }
6. Backend: cron + API routes
   └─ GET /api/portfolio          → snapshot mais recente consolidado
   └─ GET /api/history?days=30   → série temporal equity_brl
   └─ GET /api/actives           → lista de ativos com filtros
   └─ GET /api/donut             → alocação por classe
   └─ GET /api/barchart          → evolução mensal
7. Testar localmente com o JSON existente antes de fazer chamadas reais
8. Frontend: tela de Configurações → aba Sessão (campo para colar cookie)
```

---

*Documento gerado durante sessão de planejamento — aguarda revisão e aprovação para início do desenvolvimento.*
