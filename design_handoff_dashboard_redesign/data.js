// Mock data for the Energisa — Projetos Elétricos dashboard prototype.
// Mirrors the real portal's shape: NUM_PE codes, owners, addresses, statuses,
// inspection (vistoria) state, observations and emitted documents.
(function () {
  // Status taxonomy used by the portal. `vistoriaOk` => inspection requestable.
  const STATUS = {
    PROTOCOLADO:  { label: "Protocolado",            dot: "var(--st-analise)" },
    ANALISE:      { label: "Em Análise",             dot: "var(--st-analise)" },
    PENDENCIA:    { label: "Em Pendência",           dot: "var(--st-pendencia)" },
    APROVADO:     { label: "Projeto Aprovado",       dot: "var(--st-aprovado)" },
    AGUARD_VIST:  { label: "Aguardando Vistoria",    dot: "var(--st-vistoria)" },
    OBRA:         { label: "Obra Liberada",          dot: "var(--st-concluido)" },
    CONCLUIDO:    { label: "Concluído / Energizado", dot: "var(--st-concluido)" },
    REPROVADO:    { label: "Reprovado",              dot: "var(--st-reprovado)" },
  };

  const TIPOS = [
    "Ligação Nova", "Aumento de Carga", "Obra de Rede", "Ligação Provisória",
    "Religação", "Extensão de Rede", "Mudança de Padrão",
  ];

  // helpers to keep the literal list compact
  const obsBank = {
    pendDoc: "Pendência: ART de execução não anexada e memorial de cálculo divergente do projeto apresentado. Reenviar documentação corrigida pelo portal.",
    aprovado: "Projeto aprovado sem ressalvas. Liberado para solicitação de vistoria após conclusão da obra conforme projeto.",
    aguardVist: "Vistoria solicitada. Equipe de campo agendada. Manter o padrão de entrada acessível e o ramal pronto para inspeção.",
    analise: "Em análise técnica pela engenharia da distribuidora. Prazo regulatório de resposta em andamento.",
    obra: "Obra liberada para execução. Atentar para o ponto de conexão definido na nota técnica e cota do padrão.",
    reprov: "Reprovado: distância do ponto de entrega superior ao permitido para o tipo de ligação. Reapresentar com solução de extensão de rede.",
    concluido: "Unidade energizada. Número de instalação gerado e medidor instalado. Processo encerrado.",
    pendPadrao: "Pendência: padrão de entrada fora da norma de distribuição (NDU). Adequar aterramento e disjuntor ao memorial.",
  };

  const docsBank = {
    aprovado: [
      { descricao: "Nota Técnica de Aprovação", arquivo: "NT_APROV_{PE}.pdf" },
      { descricao: "Projeto Elétrico Carimbado", arquivo: "PROJ_{PE}_REV02.pdf" },
      { descricao: "ART de Projeto", arquivo: "ART_{PE}.pdf" },
    ],
    pendencia: [
      { descricao: "Carta de Pendência", arquivo: "PENDENCIA_{PE}.pdf" },
    ],
    obra: [
      { descricao: "Liberação de Obra", arquivo: "LIB_OBRA_{PE}.pdf" },
      { descricao: "Nota Técnica de Aprovação", arquivo: "NT_APROV_{PE}.pdf" },
      { descricao: "Projeto Elétrico Carimbado", arquivo: "PROJ_{PE}_REV02.pdf" },
    ],
    concluido: [
      { descricao: "Termo de Energização", arquivo: "ENERGIZACAO_{PE}.pdf" },
      { descricao: "Liberação de Obra", arquivo: "LIB_OBRA_{PE}.pdf" },
      { descricao: "Nota Técnica de Aprovação", arquivo: "NT_APROV_{PE}.pdf" },
    ],
    none: [],
  };

  function docsFor(kind, pe) {
    return (docsBank[kind] || []).map((d, i) => ({
      descricao: d.descricao,
      arquivo: d.arquivo.replace("{PE}", pe),
      link: "doc/" + pe + "/" + i,
    }));
  }

  // raw rows: [numpe, data, owner, tipo, addr, statusKey, diff, prevStatusKey,
  //            vistState, obs, docsKind, obsFetched]
  // diff: "novo" | "alterado" | ""
  // vistState: "n/a" | "available" | "requested" | "external"
  const R = [
    ["8604226", "27/05/2026", "Marina Albuquerque Tavares", "Ligação Nova",       "Rua das Acácias, 412 — Jd. Aeroporto", "APROVADO", "novo", null, "available", "aprovado", "aprovado", true],
    ["8603987", "27/05/2026", "Construtora Vale Verde Ltda", "Obra de Rede",       "Av. Brasil, 2150 — Distrito Industrial", "ANALISE", "novo", null, "n/a", "analise", "none", true],
    ["8512044", "26/05/2026", "Rodrigo Pacheco Nunes",       "Aumento de Carga",   "Rua Sete de Setembro, 88 — Centro", "APROVADO", "alterado", "ANALISE", "available", "aprovado", "aprovado", true],
    ["8511902", "26/05/2026", "Condomínio Residencial Ipê",  "Ligação Nova",       "Alameda dos Flamboyants, 305", "PENDENCIA", "alterado", "ANALISE", "n/a", "pendDoc", "pendencia", true],
    ["8498771", "24/05/2026", "Auto Posto Bandeirante S.A.", "Aumento de Carga",   "Rod. BR-364, Km 12 — Saída Sul", "AGUARD_VIST", "", null, "requested", "aguardVist", "obra", true],
    ["8498312", "23/05/2026", "José Carlos de Oliveira",     "Ligação Nova",       "Rua Projetada A, 17 — Loteamento Bela Vista", "APROVADO", "", null, "available", "aprovado", "aprovado", true],
    ["8497655", "23/05/2026", "Mercado Central Comércio Ltda", "Aumento de Carga", "Av. Getúlio Vargas, 901 — Centro", "OBRA", "", null, "requested", "obra", "obra", true],
    ["8490233", "21/05/2026", "Fernanda Lima Carvalho",      "Religação",          "Rua das Palmeiras, 56 — Vila Nova", "CONCLUIDO", "", null, "external", "concluido", "concluido", true],
    ["8489001", "20/05/2026", "Agropecuária Santa Rita",     "Extensão de Rede",   "Estrada da Lagoa, s/n — Zona Rural", "PENDENCIA", "", null, "n/a", "pendPadrao", "pendencia", true],
    ["8487744", "20/05/2026", "Paulo Henrique Mendes",       "Ligação Nova",       "Rua dos Ipês, 233 — Jd. Primavera", "ANALISE", "", null, "n/a", "analise", "none", false],
    ["8485120", "19/05/2026", "Distribuidora Norte Ltda",    "Obra de Rede",       "Av. das Indústrias, 4500 — Polo Industrial", "APROVADO", "", null, "available", "aprovado", "aprovado", true],
    ["8483099", "18/05/2026", "Camila Souza Ribeiro",        "Ligação Provisória", "Praça da Matriz, 12 — Centro", "CONCLUIDO", "", null, "requested", "concluido", "concluido", true],
    ["8479876", "16/05/2026", "Edifício Solar das Águas",    "Ligação Nova",       "Rua Marechal Deodoro, 670", "OBRA", "", null, "available", "obra", "obra", true],
    ["8478221", "15/05/2026", "Tiago Ferreira da Silva",     "Mudança de Padrão",  "Rua das Hortênsias, 19 — Bairro Alto", "REPROVADO", "", null, "n/a", "reprov", "pendencia", true],
    ["8476540", "14/05/2026", "Padaria Pão Quente ME",       "Aumento de Carga",   "Av. Castelo Branco, 1340 — Centro", "AGUARD_VIST", "", null, "requested", "aguardVist", "obra", true],
    ["8472188", "12/05/2026", "Beatriz Nogueira Pinto",      "Ligação Nova",       "Rua Santos Dumont, 405 — Aeroporto", "ANALISE", "", null, "n/a", "analise", "none", false],
    ["8470033", "10/05/2026", "Loteamento Recanto Verde",    "Extensão de Rede",   "Av. Perimetral, s/n — Setor Oeste", "APROVADO", "", null, "available", "aprovado", "aprovado", true],
    ["8466721", "08/05/2026", "Antônio Marcos Pereira",      "Religação",          "Rua da Saudade, 78 — Vila Operária", "CONCLUIDO", "", null, "external", "concluido", "concluido", true],
    ["8463450", "06/05/2026", "Indústria Metalúrgica Forte", "Obra de Rede",       "Rod. BR-070, Km 5 — Distrito Industrial", "OBRA", "", null, "available", "obra", "obra", true],
    ["8460112", "05/05/2026", "Larissa Andrade Gomes",       "Ligação Nova",       "Rua das Orquídeas, 144 — Jd. Botânico", "PENDENCIA", "", null, "n/a", "pendDoc", "pendencia", true],
    ["8458990", "02/05/2026", "Supermercado Economia Ltda",  "Aumento de Carga",   "Av. Tancredo Neves, 2200 — Centro", "APROVADO", "", null, "available", "aprovado", "aprovado", true],
    ["8455201", "29/04/2026", "Gustavo Teixeira Ramos",      "Ligação Nova",       "Rua Bela Vista, 61 — Morada do Sol", "CONCLUIDO", "", null, "requested", "concluido", "concluido", true],
  ];

  const projetos = R.map((r, idx) => {
    const [numpe, data, owner, tipo, addr, statusKey, diff, prevKey, vist, obsKey, docsKind, obsFetched] = r;
    return {
      id: idx + 1,
      NUM_PE: numpe,
      CodEmp: 4,
      Data: data,
      Proprietario: owner,
      Tipo: tipo,
      Logradouro: addr,
      statusKey,
      Status: STATUS[statusKey].label,
      statusDot: STATUS[statusKey].dot,
      diff,
      status_anterior: prevKey ? STATUS[prevKey].label : null,
      // vistoria
      vistoria_solicitada: vist === "requested" || vist === "external",
      vistoria_disponivel: vist === "available",
      vistoria_origem: vist === "external" ? "externo" : (vist === "requested" ? "app" : ""),
      vistoria_data: vist === "requested" ? "2026-05-22T14:30:00" : "",
      vistoria_arquivo: vist === "requested" ? "documentacao_" + numpe + ".zip" : "",
      // observation
      Observacao: obsFetched ? obsBank[obsKey] : "",
      obs_fetched: obsFetched,
      precisa_buscar_obs: !obsFetched,
      obs_erro: false,
      // documents
      _docsKind: docsKind,
      documentos: docsFor(docsKind, numpe),
    };
  });

  window.STATUS_MAP = STATUS;
  window.MOCK_PROJETOS = projetos;
  window.LAST_UPDATE = "2026-05-29T09:14:00";
})();
