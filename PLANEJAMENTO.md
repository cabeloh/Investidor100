# Investidor100 — Planejamento do App

> PWA de consolidação das duas carteiras do Investidor10
> Última atualização: 2026-02-21

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

### Infraestrutura (sugestão)
| Opção          | Custo      | Observação                          |
|----------------|------------|-------------------------------------|
| Fly.io         | ~free tier | Backend + banco, simples de deployar|
| Railway        | ~free tier | Alternativa ao Fly.io               |
| VPS próprio    | ~R$20/mês  | Máximo controle, Hetzner/Vultr      |

---

## 5. Fluxo de Dados

```
1. Cron job dispara a cada N horas
        │
2. Playwright abre browser headless
        │
3. Login na Conta A do Investidor10
        │
4. Navega pelas páginas de carteira
        │
5. Extrai JSON (replicando lógica do script atual)
        │
6. Repete para Conta B
        │
7. Mescla, normaliza e salva snapshot no banco
        │
8. PWA consulta API → exibe dashboards atualizados
```

---

## 6. Módulos do Script Atual (a mapear)

> **Pendente**: colar o script aqui para análise detalhada.

Baseado no que foi descrito, o script provavelmente:
- [ ] Acessa páginas específicas do Investidor10
- [ ] Lê elementos do DOM ou intercepta chamadas XHR/fetch
- [ ] Monta um objeto JSON com posições, preços e quantidades
- [ ] Diferencia as classes de ativos (Ações, FIIs, RF, BDRs)

**Próximo passo**: colar o script para confirmar quais endpoints/seletores usar no Playwright.

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
- Credenciais das contas (Conta A e Conta B)
- Frequência do scraping
- Gerenciar passivos manualmente
- Exportar dados (JSON / CSV)

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
| Investidor10 bloqueia scraping (captcha, detecção de bot) | Usar Playwright com perfil real; respeitar rate limit; fallback para import manual do JSON |
| Mudança no layout do Investidor10 quebra o scraper | Testar semanalmente; manter script manual como backup |
| Credenciais expostas | Armazenar em `.env` nunca commitado; usar secrets manager em produção |
| Dados desatualizados | Cron job a cada 6h + botão "Atualizar agora" no app |

---

## 11. Próximos Passos Imediatos

1. **Colar o script do Chrome console** para análise dos endpoints/seletores
2. **Compartilhar estrutura do .pbix** (quais métricas/gráficos existem) para garantir paridade visual
3. **Confirmar credenciais**: as duas contas ficam no mesmo `.env` no servidor?
4. **Decidir hospedagem**: self-hosted (VPS) ou plataforma gerenciada?
5. **Iniciar Fase 1**: setup do monorepo e primeiro scraper

---

*Documento gerado durante sessão de planejamento — aguarda revisão e aprovação para início do desenvolvimento.*
