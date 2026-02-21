// ============================================================
// Power Query (M) extraído do investidor10.pbix
// Serve como referência para o modelo de dados do app
// ============================================================

// ----- Downloads (base: lê todos os JSONs da pasta) -----
// Um arquivo JSON por dia = um snapshot histórico
let
    Fonte = Folder.Files("C:\Users\fabio\Downloads"),
    #"Linhas Filtradas"  = Table.SelectRows(Fonte, each ([Extension] = ".json")),
    #"Linhas Filtradas1" = Table.SelectRows(#"Linhas Filtradas", each Text.StartsWith([Name], "investidor10_")),
    #"Linhas Filtradas2" = Table.SelectRows(#"Linhas Filtradas1", each [Date created] > #datetime(2025, 9, 16, 0, 0, 0)),
    #"JSON Analisado"    = Table.TransformColumns(#"Linhas Filtradas2",{{"Content", Json.Document}}),
    // expande: data, _ratingDescricoes, _analysis
    // expande data: todos os 26 endpoints (incluindo OuroFisico_Passivo e PrataFisica_Passivo)
    #"Linhas Classificadas" = Table.Sort(...),
    #"Duplicatas Removidas" = Table.Distinct(..., {"Date created"})  // 1 snapshot por dia
in
    ...

// ----- donutchart_all (alocação por classe, pizza) -----
// Campos: value, name, type, percent, Carteira, Date created
let
    Fonte = Downloads,
    // unpivot Auvp + Passivo
    // extrai: value (R$), name (classe), type, percent (%)
in ...

// ----- barchart_12 (evolução 12 meses) -----
// Campos: month, date, sum_applied, sum_equity, sum_flow, profitability, Carteira, Data
let
    Fonte = Downloads,
    // sum_applied  = total investido
    // sum_equity   = valor atual
    // sum_flow     = fluxo líquido (aportes - resgates)
    // profitability = rentabilidade %
in ...

// ----- actives (todos os ativos individualmente) -----
// Campos completos extraídos — ver seção 6 do PLANEJAMENTO.md
// Inclui rankings, fundamentals, enrichment (prazo, tributação)
let
    Fonte = Downloads,
    // 22 endpoints de ativos expandidos
    // campos adicionais: ranking (years/profitable/dy/roe/debt/cagrr5/cagrl/liquidity/rating)
    // limpeza: buy (remove HTML), quantity (locale), equity_total (locale)
    // coluna calculada: Nome = ticker_name ?? ticker
in ...
