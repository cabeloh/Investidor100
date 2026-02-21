(async () => {
  const urls = {
    donutchart_all_Auvp: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/donutchart/808637/all",
    barchart_12_all_Auvp: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/barchart/808637/12/all",
    donutchart_all_Passivo: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/donutchart/2232039/all",
    barchart_12_all_Passivo: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/barchart/2232039/12/all",
    actives_Ticker_Auvp: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/808637/Ticker",
    actives_Fii_Auvp: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/808637/Fii",
    actives_Crypto_Auvp: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/808637/Crypto",
    actives_Etf_Auvp: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/808637/Etf",
    actives_EtfInternational_Auvp: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/808637/EtfInternational",
    actives_Stock_Auvp: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/808637/Stock",
    actives_StockBdr_Auvp: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/808637/StockBdr",
    actives_Treasure_Auvp: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/808637/Treasure",
    actives_fixed_Auvp: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/808637/fixed",
    actives_Other_Auvp: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/808637/Other",
    actives_Ticker_Passivo: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/2232039/Ticker",
    actives_Fii_Passivo: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/2232039/Fii",
    actives_Crypto_Passivo: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/2232039/Crypto",
    actives_Etf_Passivo: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/2232039/Etf",
    actives_EtfInternational_Passivo: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/2232039/EtfInternational",
    actives_Stock_Passivo: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/2232039/Stock",
    actives_StockBdr_Passivo: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/2232039/StockBdr",
    actives_Treasure_Passivo: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/2232039/Treasure",
    actives_fixed_Passivo: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/2232039/fixed",
    actives_Other_Passivo: "https://investidor10.com.br/wallet/api/proxy/wallet-app/summary/actives/2232039/Other"
  };
  const ratingDescricoes = {
    "0":  "Meus",
    "10": "Luiz Auvp",
    "19": "Oportunidade",
    "20": "Emergencia",
    "21": "Jack-ups",
    "22": "Pimentas",
    "23": "Minha",
    "65": "Prata",
    "66": "Cripto",
    "67": "Ouro",
    "77": "Empresa",
    "81": "Autos",
    "82": "Brinquedos",
    "88": "Motorhome",
    "95": "Aps",
    "98": "Lar",
  };
  const ETF_RENDA_FIXA_D1 = new Set(["AUPO11", "AREA11"]);
  const PRAZO_FIXO_POR_TICKER = { "GOLD11": 10, "BSLV39": 10 };
  // FTGF (match por texto no nome) -> D+4
  const PRAZO_FIXO_MATCH_NOME = [
    {
      id: "FTGF_WA_US_GOV_LIQ_A",
      patterns: [
        "FTGF WESTERN ASSET US GOVERNMENT LIQUIDITY",
        "WESTERN ASSET US GOVERNMENT LIQUIDITY"
      ],
      dias: 4,
      base: "FTGF_WA_US_GOV_LIQ_D+4"
    }
  ];
  // ===== helpers =====
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  function normText(s) {
    // remove acentos + upper
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .trim();
  }
  function getNomeItem(item) {
    // alguns "Other" não trazem ticker_name
    return item?.ticker_name || item?.name || item?.ticker || "";
  }
  function isPoupanca(item) {
    const n = normText(getNomeItem(item));
    // cobre "Bb Poupança", "BB Poupanca", etc.
    return n.includes("POUPANCA");
  }
  async function getJSON(url, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          credentials: "include",
          headers: { "Accept": "application/json" },
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return await res.json();
      } catch (err) {
        if (attempt === retries) throw err;
        await sleep(400 * (attempt + 1));
      }
    }
  }
  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  }
  function isBusinessDay(d) {
    const day = d.getDay();
    return day !== 0 && day !== 6;
  }
  function humanizePrazo(days) {
    if (days == null) return null;
    const d = Math.max(0, Math.trunc(days));
    const pad2 = (n) => String(n).padStart(2, "0");
    if (d <= 30) return `1.d+${pad2(d)}`;
    if (d <= 330) return `2.m+${pad2(Math.ceil(d / 30))}`;
    if (d >= 365) return `3.a+${pad2(Math.ceil(d / 365))}`;
    return `2.m+11`;
  }
  function inferMarketByCurrency(currency) {
    if (!currency) return "BR";
    const c = String(currency).toUpperCase();
    if (c.includes("US") || c.includes("USD")) return "US";
    return "BR";
  }
  function isEndpointPassivo(endpointKey) {
    return String(endpointKey).includes("Passivo");
  }
  function estimatePassivoByCategoria(item, endpointKey) {
    if (!isEndpointPassivo(endpointKey)) return null;
    const cat = String(item?.categoria_rating || "").toLowerCase();
    if (cat === "empresa") return { dias: 730, base: "PASSIVO_ESTIMADO(EMPRESA_2A)" };
    return { dias: 60, base: "PASSIVO_ESTIMADO(2_MESES)" };
  }
  function matchPrazoByNome(item) {
    const nome = normText(getNomeItem(item));
    if (!nome) return null;
    for (const rule of PRAZO_FIXO_MATCH_NOME) {
      const ok = rule.patterns.some(p => nome.includes(normText(p)));
      if (ok) return { dias: rule.dias, base: `MATCH_NOME(${rule.id})` };
    }
    return null;
  }
  function calcPrazoLiquidacao(item, endpointKey) {
    const tipo = String(item?.ticker_type || "").toLowerCase();
    const tickerName = normText(item?.ticker_name || "");
    const nome = normText(getNomeItem(item));
    // 0) POUPANÇA -> D+0 (inclusive dentro do Passivo)
    if (isPoupanca(item)) {
      return { dias: 0, base: "POUPANCA(D+0)" };
    }
    // 1) override por ticker (metais)
    if (tickerName && PRAZO_FIXO_POR_TICKER[tickerName] != null) {
      return { dias: PRAZO_FIXO_POR_TICKER[tickerName], base: `OVERRIDE_TICKER(${tickerName})` };
    }
    // 1.1) match por nome (FTGF)
    const byNome = matchPrazoByNome(item);
    if (byNome) return byNome;
    // 2) RF / Outros (se tiver dailyLiquidity/due_date, usa; senão cai em estimativa do Passivo ou SEM_DADOS_RF)
    if (tipo === "fixed" || tipo === "other") {
      const daily = Number(item?.dailyLiquidity || 0) === 1;
      const due = item?.due_date ? new Date(item.due_date) : null;
      if (daily) return { dias: 0, base: "LIQUIDEZ_DIARIA" };
      if (due && !isNaN(due.getTime())) {
        const hoje = new Date();
        const a = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
        const b = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
        const ms = b - a;
        const dias = ms <= 0 ? 0 : Math.ceil(ms / 86400000);
        return { dias, base: "VENCIMENTO(due_date)" };
      }
      const est = estimatePassivoByCategoria(item, endpointKey);
      return est ? est : { dias: null, base: "SEM_DADOS_RF" };
    }
    // 3) Tesouro
    if (tipo === "treasure") {
      const agora = new Date();
      const antes13h = agora.getHours() < 13;
      const dias = (isBusinessDay(agora) && antes13h) ? 0 : 1;
      return { dias, base: "TESOURO(D+0_ATE_13H_SENAO_D+1)" };
    }
    // 4) Cripto
    if (tipo === "crypto") return { dias: 0, base: "CRYPTO(PROXY_D+0)" };
    // 5) ETFs
    if (tipo === "etf") {
      if (ETF_RENDA_FIXA_D1.has(tickerName)) return { dias: 1, base: "ETF_ESPECIAL_D+1" };
      return { dias: 2, base: "ETF_PADRAO_D+2" };
    }
    // 6) BR vs US
    const market = inferMarketByCurrency(item?.currency);
    if (market === "US") return { dias: 3, base: "US_BR_D+3" };
    return { dias: 2, base: "BR_D+2" };
  }
  // ===== TRIBUTAÇÃO (como você vinha usando no BI) =====
  // + Ajuste: POUPANÇA -> ISENTO (IR=0)
  function isFtfgFund(item) {
    const nome = normText(getNomeItem(item));
    return nome.includes("FTGF") && nome.includes("WESTERN ASSET") && nome.includes("GOVERNMENT LIQUIDITY");
  }
  function calcTributacao(item, endpointKey) {
    const tipo = String(item?.ticker_type || "").toLowerCase();
    const tickerName = normText(item?.ticker_name || "");
    const passivo = isEndpointPassivo(endpointKey);
    const cat = String(item?.categoria_rating || "").toLowerCase();
    // 0) POUPANÇA (BB Poupança etc) -> isento
    if (isPoupanca(item)) {
      return {
        ir_percent: 0,
        limite_isencao_mensal: 0,
        tributacao_str: "POUPANCA | ISENTO | IR=0% | IRRF=0% | ISENCAO_MENSAL=0",
        base: "POUPANCA_ISENTO"
      };
    }
    if (passivo) {
      if (cat === "empresa") {
        return {
          ir_percent: 15,
          limite_isencao_mensal: 0,
          tributacao_str: "PASSIVO_EMPRESA | GCAP=SIM | IR=15% | IRRF=0% | ISENCAO_MENSAL=0",
          base: "PASSIVO_EMPRESA_15_SEM_ISENCAO"
        };
      }
      return {
        ir_percent: 15,
        limite_isencao_mensal: 35000,
        tributacao_str: "PASSIVO_FISICO | GCAP=SIM | IR=15% | IRRF=0% | ISENCAO_MENSAL=35000",
        base: "PASSIVO_FISICO_GCAP_15_ISENCAO_35K"
      };
    }
    // metais físicos (representados por tickers)
    if (tickerName === "GOLD11" || tickerName === "BSLV39") {
      return {
        ir_percent: 15,
        limite_isencao_mensal: 35000,
        tributacao_str: `METAL_FISICO(${tickerName}) | GCAP=SIM | IR=15% | IRRF=0% | ISENCAO_MENSAL=35000`,
        base: "METAL_FISICO_GCAP_15_ISENCAO_35K"
      };
    }
    // FTGF (fundo exterior)
    if (isFtfgFund(item)) {
      return {
        ir_percent: 15,
        limite_isencao_mensal: 0,
        tributacao_str: "FUNDO_EXTERIOR(FTGF) | GCAP=SIM | IR=15% | IRRF=0% | ISENCAO_MENSAL=0",
        base: "FUNDO_EXTERIOR_IR_15"
      };
    }
    // cripto
    if (tipo === "crypto") {
      return {
        ir_percent: 15,
        limite_isencao_mensal: 35000,
        tributacao_str: "CRIPTO | GCAP=SIM | IR=15% | IRRF=0% | ISENCAO_MENSAL=35000",
        base: "CRIPTO_GCAP_15_ISENCAO_35K"
      };
    }
    // FII
    if (tipo === "fii") {
      return {
        ir_percent: 20,
        limite_isencao_mensal: 0,
        tributacao_str: "FII_B3 | GCAP=SIM | IR=20% | IRRF≈0.005% | ISENCAO_MENSAL=0",
        base: "FII_20_SEM_ISENCAO"
      };
    }
    // ETF
    if (tipo === "etf") {
      return {
        ir_percent: 15,
        limite_isencao_mensal: 0,
        tributacao_str: `ETF_B3 | GCAP=SIM | IR=15% | IRRF≈0.005% | ISENCAO_MENSAL=0`,
        base: (tickerName === "AUPO11" ? "AUPO11_EXCECAO_15" : "ETF_15_SEM_ISENCAO")
      };
    }
    // ações BR com isenção 20k/m
    const market = inferMarketByCurrency(item?.currency);
    if (tipo === "stock" && market === "BR") {
      return {
        ir_percent: 15,
        limite_isencao_mensal: 20000,
        tributacao_str: "ACAO_BR | GCAP=SIM | IR=15% | IRRF≈0.005% | ISENCAO_MENSAL=20000",
        base: "ACAO_BR_15_ISENCAO_20K"
      };
    }
    // exterior (genérico)
    if (market === "US") {
      return {
        ir_percent: 15,
        limite_isencao_mensal: 0,
        tributacao_str: "EXTERIOR | GCAP=SIM | IR=15% | IRRF=0% | ISENCAO_MENSAL=0",
        base: "EXTERIOR_15_SEM_ISENCAO"
      };
    }
    return {
      ir_percent: 15,
      limite_isencao_mensal: 0,
      tributacao_str: "OUTROS | GCAP=SIM | IR=15% | IRRF=0% | ISENCAO_MENSAL=0",
      base: "FALLBACK_15"
    };
  }
  function enrichItem(item, endpointKey) {
    if (item?.raw_rating != null) {
      const desc = ratingDescricoes[String(item.raw_rating)];
      if (desc) item.categoria_rating = desc;
    }
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
    const tx = calcTributacao(item, endpointKey);
    item.tributacao_str = tx.tributacao_str;
    item.ir_percent = Number(tx.ir_percent ?? 0);
    item.limite_isencao_mensal = Number(tx.limite_isencao_mensal ?? 0);
    item.tributacao_base = tx.base;
    return item;
  }
  // ===== execução =====
  const entries = Object.entries(urls);
  const result = {
    _source: "investidor10",
    _fetchedAt: new Date().toISOString(),
    _ratingDescricoes: ratingDescricoes,
    _etf_renda_fixa_d1: Array.from(ETF_RENDA_FIXA_D1),
    _prazo_fixo_por_ticker: PRAZO_FIXO_POR_TICKER,
    _prazo_match_nome: PRAZO_FIXO_MATCH_NOME,
    data: {}
  };
  const errors = {};
  console.log(`Baixando ${entries.length} endpoints...`);
  const batchSize = 4;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    await Promise.all(batch.map(async ([key, url]) => {
      try {
        const json = await getJSON(url);
        if (Array.isArray(json?.data)) json.data.forEach(item => enrichItem(item, key));
        result.data[key] = json;
        console.log("OK:", key);
      } catch (e) {
        errors[key] = String(e);
        console.warn("ERRO:", key, e);
      }
    }));
    await sleep(150);
  }
  if (Object.keys(errors).length) result._errors = errors;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `investidor10_${ts}.json`;
  downloadJSON(result, filename);
  console.log(`Concluído. Arquivo salvo: ${filename}`);
})();
