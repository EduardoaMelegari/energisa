// ===========================================================================
// Energisa - Projetos Eletricos
// Cliente JS: lista projetos, filtros, destaques, modais (documentos +
// vistoria com dropzone), atualizacao incremental de observacoes em segundo
// plano e marcacao de "visto". Renderiza com as classes do novo design
// (.row-new/.row-chg, .mini-btn, .vist/.btn-vist, etc.).
// ===========================================================================

// ---- Refs do DOM -----------------------------------------------------------
const btnAtualizar = document.getElementById("btn-atualizar");
const btnCookie = document.getElementById("btn-cookie");
const cookieInput = document.getElementById("cookie-input");
const cookieStatus = document.getElementById("cookie-status");
const configSection = document.getElementById("config-section");
const lastUpdate = document.getElementById("last-update");
const mensagem = document.getElementById("mensagem");
const progresso = document.getElementById("progresso");
const progressoTexto = document.getElementById("progresso-texto");
const progressoContador = document.getElementById("progresso-contador");
const progressoBarra = document.getElementById("progresso-barra");
const filtroBusca = document.getElementById("filtro-busca");
const filtroTipo = document.getElementById("filtro-tipo");
const filtroStatus = document.getElementById("filtro-status");
const filtroVistoria = document.getElementById("filtro-vistoria");
const tbody = document.querySelector("#tabela-projetos tbody");
const statTotal = document.getElementById("stat-total");
const statNovos = document.getElementById("stat-novos");
const statAlterados = document.getElementById("stat-alterados");
const statVistorias = document.getElementById("stat-vistorias");
const modalDocs = document.getElementById("modal-docs");
const modalDocsTitulo = document.getElementById("modal-docs-titulo");
const modalDocsSub = document.getElementById("modal-docs-sub");
const modalDocsCorpo = document.getElementById("modal-docs-corpo");
const modalDocsFechar = document.getElementById("modal-docs-fechar");
const modalVistoria = document.getElementById("modal-vistoria");
const modalVistoriaTitulo = document.getElementById("modal-vistoria-titulo");
const modalVistoriaSub = document.getElementById("modal-vistoria-sub");
const modalVistoriaFechar = document.getElementById("modal-vistoria-fechar");
const formVistoria = document.getElementById("form-vistoria");
const vistoriaArquivo = document.getElementById("vistoria-arquivo");
const vistoriaDropzone = document.getElementById("vistoria-dropzone");
const vistoriaStatus = document.getElementById("vistoria-status");
const vistoriaEnviar = document.getElementById("vistoria-enviar");
const vistoriaCancelar = document.getElementById("vistoria-cancelar");
const sessaoStatus = document.getElementById("sessao-status");
const viewTabela = document.getElementById("view-tabela");
const viewCards = document.getElementById("view-cards");
const segTabela = document.getElementById("seg-tabela");
const segCards = document.getElementById("seg-cards");
const btnTema = document.getElementById("btn-tema");
const btnLimparFiltros = document.getElementById("btn-limpar-filtros");

// Projeto selecionado quando o modal de vistoria esta aberto.
let vistoriaProjetoAtual = null;

let projetos = [];

// Layout atual: "table" ou "cards". Persistido em localStorage; em telas
// estreitas o default e "cards" pra caber melhor.
let layoutAtual = "table";

// Timestamp da ultima atualizacao (vem do /api/atualizar). Mantido aqui pra
// re-renderizar a footnote tambem em mudancas de filtro.
let ultimoTimestamp = "";

// ---- Icones SVG (inline) ---------------------------------------------------
// Strings prontas pra serem usadas via innerHTML. Stroke = currentColor pra
// herdar a cor do botao/container pai. Conjunto enxuto — so o que a tabela e
// os modais usam.
const ic = {
  refresh: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/></svg>',
  refreshSpin: '<svg class="spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/></svg>',
  refreshMini: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/></svg>',
  spark: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>',
  doc: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  docBig: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/></svg>',
  check: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  upload: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>',
  inbox: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>',
  pin: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
};

// ---- Mapeamento status -> cor da bolinha -----------------------------------
// A bolinha .sd dentro de .status. Match exato primeiro, depois heuristica
// por palavra-chave pra cobrir variacoes que o portal use no futuro.
const STATUS_DOT_EXATO = {
  "Projeto Aprovado": "var(--st-aprovado)",
  "Projeto em Análise": "var(--st-analise)",
  "Parecer de Acesso em Aberto": "var(--st-pendencia)",
  "Relacionamento Operacional em Aberto": "var(--st-pendencia)",
  "Etapa de Obra": "var(--st-vistoria)",
  "Projeto Concluido": "var(--st-concluido)",
  "Projeto Concluído": "var(--st-concluido)",
  "Projeto Reprovado": "var(--st-reprovado)",
  "Projeto Cancelado": "var(--st-reprovado)",
};

function corDoStatus(status) {
  const s = (status || "").trim();
  if (!s) return "var(--text-3)";
  if (STATUS_DOT_EXATO[s]) return STATUS_DOT_EXATO[s];
  const lo = s.toLowerCase();
  if (lo.includes("aprovado")) return "var(--st-aprovado)";
  if (lo.includes("analise") || lo.includes("análise")) return "var(--st-analise)";
  if (lo.includes("aberto") || lo.includes("pendencia") || lo.includes("pendência")) return "var(--st-pendencia)";
  if (lo.includes("obra")) return "var(--st-vistoria)";
  if (lo.includes("concluido") || lo.includes("concluído")) return "var(--st-concluido)";
  if (lo.includes("reprovado") || lo.includes("cancelado")) return "var(--st-reprovado)";
  return "var(--text-3)";
}

// ---- Listeners principais --------------------------------------------------
btnAtualizar.addEventListener("click", atualizar);
btnCookie.addEventListener("click", salvarCookie);
filtroBusca.addEventListener("input", renderizar);
filtroTipo.addEventListener("change", renderizar);
filtroStatus.addEventListener("change", renderizar);
filtroVistoria.addEventListener("change", renderizar);
modalDocsFechar.addEventListener("click", fecharModalDocumentos);
modalDocs.addEventListener("click", (e) => {
  if (e.target === modalDocs) fecharModalDocumentos();
});
modalVistoriaFechar.addEventListener("click", fecharModalVistoria);
vistoriaCancelar.addEventListener("click", fecharModalVistoria);
modalVistoria.addEventListener("click", (e) => {
  if (e.target === modalVistoria) fecharModalVistoria();
});
formVistoria.addEventListener("submit", enviarVistoria);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!modalVistoria.hidden) fecharModalVistoria();
    else if (!modalDocs.hidden) fecharModalDocumentos();
  }
});

// Dropzone do modal de vistoria — drag-and-drop + clique abre file picker.
vistoriaDropzone.addEventListener("click", () => vistoriaArquivo.click());
vistoriaDropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    vistoriaArquivo.click();
  }
});
vistoriaDropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  vistoriaDropzone.classList.add("drag");
});
vistoriaDropzone.addEventListener("dragleave", () => {
  vistoriaDropzone.classList.remove("drag");
});
vistoriaDropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  vistoriaDropzone.classList.remove("drag");
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) escolherArquivoVistoria(f);
});
vistoriaArquivo.addEventListener("change", () => {
  const f = vistoriaArquivo.files && vistoriaArquivo.files[0];
  if (f) escolherArquivoVistoria(f);
});

window.addEventListener("DOMContentLoaded", async () => {
  aplicarTemaInicial();
  aplicarLayoutInicial();
  wireUpControles();
  await carregarCookieAtual();
  atualizar();
  atualizarStatusSessao();
  setInterval(atualizarStatusSessao, 60000);
});

// ---- Tema (claro / escuro) -------------------------------------------------
function aplicarTemaInicial() {
  const salvo = localStorage.getItem("energisa_theme");
  aplicarTema(salvo === "dark" ? "dark" : "light");
}

function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  localStorage.setItem("energisa_theme", tema);
  const isDark = tema === "dark";
  // O botao mostra o icone do que clicar FARA: lua quando claro, sol quando escuro.
  btnTema.innerHTML = isDark ? ic.sun : ic.moon;
  btnTema.title = isDark ? "Mudar para modo claro" : "Mudar para modo escuro";
  btnTema.setAttribute("aria-label", btnTema.title);
}

// ---- Layout (tabela / cards) -----------------------------------------------
function aplicarLayoutInicial() {
  const salvo = localStorage.getItem("energisa_layout");
  if (salvo === "table" || salvo === "cards") {
    aplicarLayout(salvo);
  } else {
    // Default: cards em telas estreitas, tabela nas demais.
    aplicarLayout(window.matchMedia("(max-width: 600px)").matches ? "cards" : "table");
  }
}

function aplicarLayout(layout) {
  layoutAtual = layout;
  localStorage.setItem("energisa_layout", layout);
  segTabela.classList.toggle("on", layout === "table");
  segCards.classList.toggle("on", layout === "cards");
  viewTabela.hidden = layout !== "table";
  viewCards.hidden = layout !== "cards";
  if (projetos.length > 0) renderizar();
}

// ---- Controles (tema, layout, limpar filtros) ------------------------------
function wireUpControles() {
  btnTema.addEventListener("click", () => {
    const atual = document.documentElement.getAttribute("data-theme") || "light";
    aplicarTema(atual === "dark" ? "light" : "dark");
  });
  segTabela.addEventListener("click", () => aplicarLayout("table"));
  segCards.addEventListener("click", () => aplicarLayout("cards"));
  btnLimparFiltros.addEventListener("click", limparFiltros);
}

function limparFiltros() {
  filtroBusca.value = "";
  filtroTipo.value = "";
  filtroStatus.value = "";
  filtroVistoria.value = "";
  renderizar();
}

function atualizarVisibilidadeLimparFiltros() {
  const ativo = !!(
    filtroBusca.value || filtroTipo.value ||
    filtroStatus.value || filtroVistoria.value
  );
  btnLimparFiltros.hidden = !ativo;
}

// ---- Utilidades ------------------------------------------------------------
function formatarHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatarData(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

function formatarDataCurta(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR") + " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatarTamanho(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cssEscape(s) {
  if (window.CSS && CSS.escape) return CSS.escape(s);
  return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function setMensagem(html) {
  mensagem.innerHTML = html;
}

// Se a sessao expirou, o backend responde 401 — manda o usuario ao login.
function tratar401(r) {
  if (r.status === 401) {
    window.location.href = "/login";
    return true;
  }
  return false;
}

// ---- Pill de sessao --------------------------------------------------------
// Consulta /api/sessao e atualiza o pill no topo. data.ok: true=ativa,
// false=expirou, null=ainda verificando. Mantemos o <span class="dot"></span>
// dentro do pill em todos os estados.
async function atualizarStatusSessao() {
  try {
    const r = await fetch("/api/sessao");
    if (tratar401(r)) return;
    const data = await r.json();
    sessaoStatus.innerHTML = "";
    const dot = document.createElement("span");
    dot.className = "dot";
    sessaoStatus.appendChild(dot);
    let texto;
    if (data.ok === true) {
      sessaoStatus.className = "session";
      texto = " Sessao ativa" + (data.ts ? " · verificada " + formatarHora(data.ts) : "");
    } else if (data.ok === false) {
      sessaoStatus.className = "session err";
      texto = " Sessao: " + (data.msg || "expirada");
    } else {
      sessaoStatus.className = "session";
      texto = " Sessao: verificando…";
    }
    sessaoStatus.appendChild(document.createTextNode(texto));
  } catch (e) {
    // silencioso — nao polui a interface se /api/sessao falhar
  }
}

// ---- Cookie ----------------------------------------------------------------
async function carregarCookieAtual() {
  try {
    const r = await fetch("/api/cookie");
    const data = await r.json();
    if (data.cookie) {
      cookieInput.value = data.cookie;
    }
  } catch (e) {
    // silencioso — usuario pode preencher manualmente
  }
}

async function salvarCookie() {
  const cookie = cookieInput.value.trim();
  cookieStatus.textContent = "";
  cookieStatus.className = "";
  if (!cookie) {
    cookieStatus.textContent = "Cole o cookie antes de salvar.";
    cookieStatus.className = "erro";
    return;
  }
  btnCookie.disabled = true;
  try {
    const r = await fetch("/api/cookie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookie }),
    });
    const data = await r.json();
    if (r.ok) {
      cookieStatus.textContent = "Cookie salvo. Atualizando lista…";
      cookieStatus.className = "ok";
      atualizar();
    } else {
      cookieStatus.textContent = data.erro || "Erro ao salvar.";
      cookieStatus.className = "erro";
    }
  } catch (e) {
    cookieStatus.textContent = e.message;
    cookieStatus.className = "erro";
  } finally {
    btnCookie.disabled = false;
  }
}

// ---- Atualizar principal ---------------------------------------------------
async function atualizar() {
  btnAtualizar.disabled = true;
  btnAtualizar.innerHTML = ic.refreshSpin + " Atualizando…";
  setMensagem("");
  try {
    const r = await fetch("/api/atualizar", { method: "POST" });
    if (tratar401(r)) return;
    const data = await r.json();
    if (!r.ok) {
      const erro = data.erro || `Erro HTTP ${r.status}`;
      setMensagem(`<div class="erro"><strong>Falha ao atualizar.</strong> ${escapeHtml(erro)}</div>`);
      if (/cookie/i.test(erro) || /login/i.test(erro)) {
        configSection.open = true;
      }
      return;
    }

    projetos = ordenarProjetos(data.projetos);
    popularFiltroStatus(projetos);
    ultimoTimestamp = data.timestamp;

    atualizarContadores();

    if (data.primeira_vez) {
      setMensagem(
        `<div class="info">Primeira execucao registrada. A partir da proxima atualizacao, ` +
        `projetos novos e mudancas de status serao destacados.</div>`
      );
    }

    renderizar();
    carregarObservacoesPendentes();
  } catch (e) {
    setMensagem(`<div class="erro">Erro de conexao: ${escapeHtml(e.message)}</div>`);
  } finally {
    btnAtualizar.disabled = false;
    btnAtualizar.innerHTML = ic.refresh + " Atualizar";
  }
}

// ---- Stats (4 cards) -------------------------------------------------------
function atualizarContadores() {
  const total = projetos.length;
  const novos = projetos.filter(p => p.diff === "novo").length;
  const alterados = projetos.filter(p => p.diff === "alterado").length;
  const vistPend = projetos.filter(p => p.vistoria_disponivel && !p.vistoria_solicitada).length;
  statTotal.textContent = total;
  statNovos.textContent = novos;
  statAlterados.textContent = alterados;
  statVistorias.textContent = vistPend;
}

// ---- Marcar como visto -----------------------------------------------------
async function marcarVisto(numPe) {
  const p = projetos.find(x => x.NUM_PE === numPe);
  if (!p) return;
  try {
    const r = await fetch("/api/marcar_visto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ NUM_PE: numPe }),
    });
    const data = await r.json();
    if (!r.ok) {
      setMensagem(`<div class="erro">Falha ao marcar como visto: ${escapeHtml(data.erro || "erro")}</div>`);
      return;
    }
    p.diff = "";
    p.status_anterior = null;
    projetos = ordenarProjetos(projetos);
    atualizarContadores();
    renderizar();
  } catch (e) {
    setMensagem(`<div class="erro">Erro de conexao: ${escapeHtml(e.message)}</div>`);
  }
}

// ---- Ordenacao -------------------------------------------------------------
function chaveOrdenacao(numPe) {
  // NUM_PE no formato <prefixo><ano2digitos>. Ex: "8604226" -> prefixo 86042, ano 26.
  // Ordena: ano desc (26 antes de 25/24...) e dentro do ano, prefixo desc.
  const s = String(numPe ?? "");
  const ano = parseInt(s.slice(-2), 10);
  const prefixo = parseInt(s.slice(0, -2), 10);
  return {
    ano: Number.isNaN(ano) ? -1 : ano,
    prefixo: Number.isNaN(prefixo) ? -1 : prefixo,
  };
}

function ordenarProjetos(lista) {
  const peso = { novo: 0, alterado: 1, "": 2 };
  return [...lista].sort((a, b) => {
    const pa = peso[a.diff] ?? 2;
    const pb = peso[b.diff] ?? 2;
    if (pa !== pb) return pa - pb;
    const ka = chaveOrdenacao(a.NUM_PE);
    const kb = chaveOrdenacao(b.NUM_PE);
    if (ka.ano !== kb.ano) return kb.ano - ka.ano;
    return kb.prefixo - ka.prefixo;
  });
}

function popularFiltroStatus(lista) {
  const valorAtual = filtroStatus.value;
  const statusUnicos = [...new Set(lista.map(p => p.Status).filter(Boolean))].sort();
  filtroStatus.innerHTML = '<option value="">Todos os status</option>';
  for (const s of statusUnicos) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    filtroStatus.appendChild(opt);
  }
  if (valorAtual && statusUnicos.includes(valorAtual)) {
    filtroStatus.value = valorAtual;
  }
}

// ---- Renderizar tabela -----------------------------------------------------
function filtrarProjetos() {
  const filtro = filtroBusca.value.trim().toLowerCase();
  const tipo = filtroTipo.value;
  const statusSelecionado = filtroStatus.value;
  const vistoriaSelecionada = filtroVistoria.value;
  return projetos.filter(p => {
    if (tipo === "novo" && p.diff !== "novo") return false;
    if (tipo === "alterado" && p.diff !== "alterado") return false;
    if (tipo === "destaque" && !p.diff) return false;
    if (statusSelecionado && p.Status !== statusSelecionado) return false;
    if (vistoriaSelecionada === "pendente" && p.vistoria_solicitada) return false;
    if (vistoriaSelecionada === "solicitada" && !p.vistoria_solicitada) return false;
    if (filtro) {
      const haystack = [
        p.NUM_PE, p.Proprietario, p.Tipo, p.Logradouro, p.Status, p.status_anterior || ""
      ].join(" ").toLowerCase();
      if (!haystack.includes(filtro)) return false;
    }
    return true;
  });
}

// Dispatcher: filtra e renderiza no layout atual (tabela ou cards).
function renderizar() {
  const filtered = filtrarProjetos();
  if (layoutAtual === "cards") renderizarCards(filtered);
  else renderizarTabela(filtered);
  atualizarVisibilidadeLimparFiltros();
  atualizarFootnote(filtered.length);
}

function atualizarFootnote(filtradosCount) {
  if (!ultimoTimestamp) {
    lastUpdate.textContent = "Carregando…";
    return;
  }
  const ts = formatarData(ultimoTimestamp);
  const total = projetos.length;
  if (filtradosCount === undefined || filtradosCount === total) {
    lastUpdate.innerHTML =
      "Última atualização: <b>" + escapeHtml(ts) + "</b> · " + total + " projetos";
  } else {
    lastUpdate.innerHTML =
      "Última atualização: <b>" + escapeHtml(ts) + "</b> · " +
      filtradosCount + " de " + total + " projetos";
  }
}

function renderizarTabela(filtered) {
  tbody.innerHTML = "";
  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 9;
    td.innerHTML =
      '<div class="empty-state">' +
      '<div style="color: var(--text-3)">' + ic.inbox + '</div>' +
      '<div class="es-t">Nenhum projeto encontrado</div>' +
      '<div class="es-s">Ajuste os filtros para ver mais resultados.</div>' +
      '</div>';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  for (let i = 0; i < filtered.length; i++) {
    tbody.appendChild(montarLinhaTabela(filtered[i], i + 1));
  }
}

function renderizarCards(filtered) {
  viewCards.innerHTML = "";
  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.style.gridColumn = "1 / -1";
    empty.innerHTML =
      '<div style="color: var(--text-3)">' + ic.inbox + '</div>' +
      '<div class="es-t">Nenhum projeto encontrado</div>' +
      '<div class="es-s">Ajuste os filtros para ver mais resultados.</div>';
    viewCards.appendChild(empty);
    return;
  }
  for (const p of filtered) {
    viewCards.appendChild(montarCard(p));
  }
}

function montarCard(p) {
  const card = document.createElement("div");
  card.className = "card" + (p.diff === "novo" ? " row-new" : p.diff === "alterado" ? " row-chg" : "");
  card.dataset.numpe = p.NUM_PE;

  const topline = document.createElement("span");
  topline.className = "topline";
  card.appendChild(topline);

  // Cabecalho: NUM_PE (mono) + data + badge a direita (se destaque)
  const head = document.createElement("div");
  head.className = "card-head";
  const headLeft = document.createElement("div");
  const numpe = document.createElement("div");
  numpe.className = "card-numpe";
  numpe.textContent = p.NUM_PE;
  headLeft.appendChild(numpe);
  if (p.Data) {
    const date = document.createElement("div");
    date.className = "card-date";
    date.textContent = p.Data;
    headLeft.appendChild(date);
  }
  head.appendChild(headLeft);
  if (p.diff === "novo") {
    const badge = document.createElement("span");
    badge.className = "row-badge new";
    badge.innerHTML = ic.spark + " Novo";
    head.appendChild(badge);
  } else if (p.diff === "alterado") {
    const badge = document.createElement("span");
    badge.className = "row-badge chg";
    badge.textContent = "Status mudou";
    head.appendChild(badge);
  }
  card.appendChild(head);

  // Proprietario + tipo + endereco
  const body = document.createElement("div");
  const owner = document.createElement("div");
  owner.className = "card-owner";
  owner.textContent = p.Proprietario || "";
  body.appendChild(owner);
  if (p.Tipo) {
    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.style.marginTop = "6px";
    const tag = document.createElement("span");
    tag.className = "tipo-tag";
    tag.textContent = p.Tipo;
    meta.appendChild(tag);
    body.appendChild(meta);
  }
  if (p.Logradouro) {
    const addr = document.createElement("div");
    addr.className = "card-addr";
    addr.style.marginTop = "8px";
    addr.innerHTML = ic.pin + " ";
    addr.appendChild(document.createTextNode(p.Logradouro));
    body.appendChild(addr);
  }
  card.appendChild(body);

  // Divider + status + botao visto
  card.appendChild(criarDivider());
  const statusRow = document.createElement("div");
  statusRow.className = "card-row card-row-status";
  statusRow.appendChild(montarStatusTag(p));
  if (p.diff) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mini-btn seen";
    btn.innerHTML = ic.check + " visto";
    btn.title = "Remove o destaque";
    btn.addEventListener("click", () => marcarVisto(p.NUM_PE));
    statusRow.appendChild(btn);
  }
  card.appendChild(statusRow);

  // Vistoria
  const vistRow = document.createElement("div");
  vistRow.className = "card-row card-row-vist";
  vistRow.style.alignItems = "flex-start";
  const vistContainer = document.createElement("div");
  pintarVistoria(vistContainer, p);
  vistRow.appendChild(vistContainer);
  card.appendChild(vistRow);

  // Observacao (so se houver/precisar)
  if (p.Observacao || p.precisa_buscar_obs || p.obs_fetched) {
    card.appendChild(criarDivider());
    const obsContainer = document.createElement("div");
    obsContainer.className = "card-obs";
    pintarObservacao(obsContainer, p);
    card.appendChild(obsContainer);
  }

  // Rodape: botao documentos
  const foot = document.createElement("div");
  foot.className = "card-foot";
  foot.appendChild(criarBotaoDocs(p.NUM_PE));
  card.appendChild(foot);

  return card;
}

function criarDivider() {
  const d = document.createElement("div");
  d.className = "card-divider";
  return d;
}

function montarLinhaTabela(p, idx) {
  const tr = document.createElement("tr");
  tr.dataset.numpe = p.NUM_PE;
  tr.className = p.diff === "novo" ? "row-new" : p.diff === "alterado" ? "row-chg" : "normal";

  // # (indice)
  const tdIdx = document.createElement("td");
  tdIdx.className = "cell-idx";
  tdIdx.textContent = String(idx);
  tr.appendChild(tdIdx);

  // Data
  const tdData = document.createElement("td");
  tdData.className = "cell-data";
  tdData.textContent = p.Data || "";
  tr.appendChild(tdData);

  // NUM_PE com badge "Novo" (se aplicavel) + botao documentos
  const tdNum = document.createElement("td");
  const numWrap = document.createElement("div");
  numWrap.className = "numpe-row";
  if (p.diff === "novo") {
    const badge = document.createElement("span");
    badge.className = "row-badge new";
    badge.innerHTML = ic.spark + " Novo";
    numWrap.appendChild(badge);
  }
  const numText = document.createElement("span");
  numText.className = "numpe";
  numText.textContent = p.NUM_PE;
  numWrap.appendChild(numText);
  numWrap.appendChild(criarBotaoDocs(p.NUM_PE));
  tdNum.appendChild(numWrap);
  tr.appendChild(tdNum);

  // Proprietario
  const tdOwn = document.createElement("td");
  const own = document.createElement("span");
  own.className = "owner";
  own.textContent = p.Proprietario || "";
  tdOwn.appendChild(own);
  tr.appendChild(tdOwn);

  // Tipo (tag)
  const tdTipo = document.createElement("td");
  if (p.Tipo) {
    const tag = document.createElement("span");
    tag.className = "tipo-tag";
    tag.textContent = p.Tipo;
    tdTipo.appendChild(tag);
  }
  tr.appendChild(tdTipo);

  // Logradouro
  const tdAddr = document.createElement("td");
  const addr = document.createElement("span");
  addr.className = "addr";
  addr.textContent = p.Logradouro || "";
  tdAddr.appendChild(addr);
  tr.appendChild(tdAddr);

  // Status (com badge "Status mudou" + status anterior riscado + botao visto)
  tr.appendChild(montarCelulaStatus(p));

  // Vistoria
  const tdVist = document.createElement("td");
  tdVist.className = "vistoria-cell";
  pintarVistoria(tdVist, p);
  tr.appendChild(tdVist);

  // Observacao
  const tdObs = document.createElement("td");
  tdObs.className = "obs-cell";
  pintarObservacao(tdObs, p);
  tr.appendChild(tdObs);

  return tr;
}

function montarCelulaStatus(p) {
  const td = document.createElement("td");
  if (p.diff === "alterado") {
    const badge = document.createElement("span");
    badge.className = "row-badge chg";
    badge.style.marginBottom = "6px";
    badge.style.display = "inline-flex";
    badge.textContent = "Status mudou";
    td.appendChild(badge);
  }
  td.appendChild(montarStatusTag(p));
  if (p.diff) {
    const div = document.createElement("div");
    div.style.marginTop = "7px";
    div.appendChild(criarBotaoVisto(p.NUM_PE));
    td.appendChild(div);
  }
  return td;
}

function montarStatusTag(p) {
  const wrap = document.createElement("div");
  wrap.className = "status-wrap";
  if (p.diff === "alterado" && p.status_anterior) {
    const prev = document.createElement("span");
    prev.className = "status-prev";
    prev.textContent = p.status_anterior;
    wrap.appendChild(prev);
  }
  const st = document.createElement("span");
  st.className = "status";
  const sd = document.createElement("span");
  sd.className = "sd";
  sd.style.background = corDoStatus(p.Status);
  st.appendChild(sd);
  st.appendChild(document.createTextNode(p.Status || ""));
  wrap.appendChild(st);
  return wrap;
}

function criarBotaoDocs(numPe) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mini-btn docs";
  btn.innerHTML = ic.doc + " documentos";
  btn.title = "Ver documentos emitidos deste projeto";
  btn.addEventListener("click", () => abrirModalDocumentos(numPe));
  return btn;
}

function criarBotaoVisto(numPe) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mini-btn seen";
  btn.innerHTML = ic.check + " marcar como visto";
  btn.title = "Remove o destaque e devolve o projeto a ordenacao normal";
  btn.addEventListener("click", () => marcarVisto(numPe));
  return btn;
}

// ---- Vistoria cell ---------------------------------------------------------
// Tres estados: solicitada, disponivel (botao roxo), bloqueada (botao
// cinza disabled com tooltip).
function pintarVistoria(td, p) {
  td.textContent = "";
  const wrap = document.createElement("div");
  wrap.className = "vist";

  if (p.vistoria_solicitada) {
    wrap.classList.add("vist-done");
    const label = document.createElement("span");
    label.className = "vist-label";
    const vd = document.createElement("span");
    vd.className = "vd";
    label.appendChild(vd);
    label.appendChild(document.createTextNode(" Vistoria solicitada"));
    wrap.appendChild(label);

    if (p.vistoria_data) {
      const sub = document.createElement("span");
      sub.className = "vist-sub";
      sub.textContent = "em " + formatarDataCurta(p.vistoria_data);
      wrap.appendChild(sub);
    } else if (p.vistoria_origem === "externo") {
      const sub = document.createElement("span");
      sub.className = "vist-sub";
      sub.textContent = "(detectada pelo portal)";
      wrap.appendChild(sub);
    }

    if (p.vistoria_arquivo) {
      const f = document.createElement("span");
      f.className = "vist-file";
      f.title = p.vistoria_arquivo;
      f.textContent = p.vistoria_arquivo;
      wrap.appendChild(f);
    }
  } else if (p.vistoria_disponivel) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-vist";
    btn.textContent = "Solicitar vistoria";
    btn.title = "Anexar documentacao e solicitar vistoria deste projeto";
    btn.addEventListener("click", () => abrirModalVistoria(p.NUM_PE));
    wrap.appendChild(btn);
  } else {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-vist";
    btn.disabled = true;
    btn.textContent = "Solicitar vistoria";
    btn.title = `Disponível apenas com status "Projeto Aprovado" (atual: ${p.Status || "?"})`;
    wrap.appendChild(btn);
  }

  td.appendChild(wrap);
}

// ---- Observacao cell -------------------------------------------------------
function pintarObservacao(td, p) {
  td.textContent = "";
  const wrap = document.createElement("div");
  wrap.className = "obs";

  if (p.precisa_buscar_obs && !p.Observacao) {
    const span = document.createElement("span");
    span.className = "obs-loading";
    span.innerHTML = '<span class="skeleton" style="width: 120px"></span> buscando…';
    wrap.appendChild(span);
  } else if (p.Observacao) {
    const text = document.createElement("div");
    text.className = "obs-text";
    if (p.obs_erro) {
      text.style.color = "var(--st-reprovado)";
      text.style.fontStyle = "italic";
    }
    text.textContent = p.Observacao;
    wrap.appendChild(text);
    wrap.appendChild(criarBotaoBuscar(p, "rebuscar", true));
  } else if (p.obs_fetched) {
    const span = document.createElement("span");
    span.className = "obs-empty";
    span.textContent = "(sem observação) ";
    wrap.appendChild(span);
    wrap.appendChild(criarBotaoBuscar(p, "rebuscar", false));
    wrap.title = "Portal retornou vazio. Clique em 'rebuscar' para verificar de novo.";
  } else {
    wrap.appendChild(criarBotaoBuscar(p, "buscar observação", false));
  }

  td.appendChild(wrap);
}

function criarBotaoBuscar(p, rotulo, comIcone) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mini-btn";
  if (comIcone) btn.innerHTML = ic.refreshMini + " " + escapeHtml(rotulo);
  else btn.textContent = rotulo;
  btn.title = "Buscar observacao deste projeto";
  btn.addEventListener("click", () => buscarObservacaoSobDemanda(p.NUM_PE));
  return btn;
}

// Em cards mode, reconstroi o card inteiro (mais simples que sub-blocos).
function reconstruirCard(numPe) {
  const p = projetos.find(x => x.NUM_PE === numPe);
  if (!p) return;
  const old = viewCards.querySelector(`.card[data-numpe="${cssEscape(numPe)}"]`);
  if (!old) return;
  old.replaceWith(montarCard(p));
}

function atualizarCelulaObservacao(numPe) {
  if (layoutAtual === "cards") return reconstruirCard(numPe);
  const tr = tbody.querySelector(`tr[data-numpe="${cssEscape(numPe)}"]`);
  if (!tr) return;
  const td = tr.querySelector("td.obs-cell");
  if (!td) return;
  const p = projetos.find(x => x.NUM_PE === numPe);
  if (!p) return;
  pintarObservacao(td, p);
}

function atualizarCelulaVistoria(numPe) {
  if (layoutAtual === "cards") return reconstruirCard(numPe);
  const tr = tbody.querySelector(`tr[data-numpe="${cssEscape(numPe)}"]`);
  if (!tr) return;
  const td = tr.querySelector("td.vistoria-cell");
  if (!td) return;
  const p = projetos.find(x => x.NUM_PE === numPe);
  if (!p) return;
  pintarVistoria(td, p);
}

function atualizarCelulaData(numPe) {
  if (layoutAtual === "cards") return reconstruirCard(numPe);
  const tr = tbody.querySelector(`tr[data-numpe="${cssEscape(numPe)}"]`);
  if (!tr || !tr.children[1]) return;
  const p = projetos.find(x => x.NUM_PE === numPe);
  if (!p) return;
  tr.children[1].textContent = p.Data || "";
}

// ---- Carga de observacoes em segundo plano --------------------------------
// Aplica a resposta de /api/observacao no projeto. Retorna true quando a
// busca detectou mudanca (virou destaque / status mudou) e a tabela inteira
// precisa ser reordenada para o projeto subir ao topo.
function aplicarRespostaObservacao(p, data) {
  p.Observacao = data.observacao || "";
  p.obs_erro = false;
  p.obs_fetched = true;
  if (data.data) {
    p.Data = data.data;
    atualizarCelulaData(p.NUM_PE);
  }
  let mudou = false;
  if (data.diff && p.diff !== data.diff) {
    p.diff = data.diff;
    mudou = true;
  }
  if (data.status_mudou) {
    if (data.status) p.Status = data.status;
    p.status_anterior = data.status_anterior || null;
    mudou = true;
  }
  // /api/observacao tambem devolve o estado de vistoria detectado no detalhe.
  // Atualiza o projeto local pra refletir vistoria solicitada externamente.
  if (typeof data.vistoria_solicitada === "boolean") {
    const antesSol = !!p.vistoria_solicitada;
    const antesDisp = !!p.vistoria_disponivel;
    p.vistoria_solicitada = data.vistoria_solicitada;
    p.vistoria_disponivel = !!data.vistoria_disponivel;
    p.vistoria_data = data.vistoria_data || "";
    p.vistoria_arquivo = data.vistoria_arquivo || "";
    p.vistoria_origem = data.vistoria_origem || "";
    if (antesSol !== p.vistoria_solicitada || antesDisp !== p.vistoria_disponivel) {
      atualizarCelulaVistoria(p.NUM_PE);
      atualizarContadores();
    }
  }
  return mudou;
}

function reordenarERenderizar() {
  projetos = ordenarProjetos(projetos);
  atualizarContadores();
  renderizar();
}

async function buscarObservacaoSobDemanda(numPe) {
  const p = projetos.find(x => x.NUM_PE === numPe);
  if (!p) return;
  p.precisa_buscar_obs = true;
  p.Observacao = "";
  p.obs_fetched = false;
  atualizarCelulaObservacao(numPe);
  let mudou = false;
  try {
    const r = await fetch("/api/observacao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ NUM_PE: p.NUM_PE, CodEmp: p.CodEmp }),
    });
    const data = await r.json();
    if (r.ok) {
      mudou = aplicarRespostaObservacao(p, data);
    } else {
      p.Observacao = `[erro: ${data.erro || "falha"}]`;
      p.obs_erro = true;
    }
  } catch (e) {
    p.Observacao = `[erro de rede: ${e.message}]`;
    p.obs_erro = true;
  }
  p.precisa_buscar_obs = false;
  if (mudou) reordenarERenderizar();
  else atualizarCelulaObservacao(numPe);
}

// ---- Barra de progresso ----------------------------------------------------
function mostrarProgresso(total) {
  progresso.classList.remove("done");
  progressoBarra.style.width = "0%";
  progressoTexto.textContent = "Atualizando observações…";
  progressoContador.textContent = "0 / " + total;
  progresso.hidden = false;
}

function renderProgresso(feito, total, numPe) {
  const pct = total ? Math.round((feito / total) * 100) : 0;
  progressoBarra.style.width = pct + "%";
  if (numPe) {
    progresso.classList.remove("done");
    progressoTexto.textContent = "Atualizando observação — projeto " + numPe;
    progressoContador.textContent =
      feito + " / " + total + " (faltam " + (total - feito) + ")";
  } else {
    progresso.classList.add("done");
    progressoTexto.textContent = "Observações atualizadas";
    progressoContador.textContent = total + " / " + total + " concluídos";
  }
}

function esconderProgresso() {
  progresso.hidden = true;
}

let observacaoLoaderId = 0;

async function carregarObservacoesPendentes() {
  const meuId = ++observacaoLoaderId;
  const pendentes = projetos.filter(p => p.precisa_buscar_obs);
  let precisaReordenar = false;
  if (pendentes.length === 0) {
    esconderProgresso();
    return;
  }
  mostrarProgresso(pendentes.length);
  let feito = 0;
  for (const p of pendentes) {
    if (meuId !== observacaoLoaderId) return;
    renderProgresso(feito, pendentes.length, p.NUM_PE);
    try {
      const r = await fetch("/api/observacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ NUM_PE: p.NUM_PE, CodEmp: p.CodEmp }),
      });
      const data = await r.json();
      if (r.ok) {
        if (aplicarRespostaObservacao(p, data)) precisaReordenar = true;
      } else {
        p.Observacao = `[erro: ${data.erro || "falha"}]`;
        p.obs_erro = true;
      }
    } catch (e) {
      p.Observacao = `[erro de rede: ${e.message}]`;
      p.obs_erro = true;
    }
    p.precisa_buscar_obs = false;
    atualizarCelulaObservacao(p.NUM_PE);
    feito++;
    await sleep(500);
  }
  if (meuId !== observacaoLoaderId) return;
  renderProgresso(feito, pendentes.length, null);
  if (precisaReordenar) reordenarERenderizar();
  setTimeout(() => {
    if (meuId === observacaoLoaderId) esconderProgresso();
  }, 2500);
}

// ===========================================================================
// Modal: documentos emitidos
// ===========================================================================
let docsLoaderId = 0;

function fecharModalDocumentos() {
  modalDocs.hidden = true;
  modalDocsCorpo.innerHTML = "";
  docsLoaderId++; // invalida qualquer carga em andamento
}

async function abrirModalDocumentos(numPe) {
  const p = projetos.find(x => x.NUM_PE === numPe);
  if (!p) return;
  const meuId = ++docsLoaderId;

  modalDocsTitulo.textContent = "Documentos emitidos";
  modalDocsSub.textContent = p.NUM_PE + " · " +
    [p.Proprietario, p.Logradouro].filter(Boolean).join(" — ");
  modalDocsCorpo.innerHTML =
    '<div class="modal-loading">' + ic.refreshSpin + ' Carregando documentos…</div>';
  modalDocs.hidden = false;

  try {
    const r = await fetch("/api/documentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ NUM_PE: p.NUM_PE, CodEmp: p.CodEmp }),
    });
    const data = await r.json();
    if (meuId !== docsLoaderId) return; // modal fechado ou outro projeto aberto
    if (r.ok) renderModalDocumentos(data.documentos || []);
    else renderModalMensagem("Erro ao carregar: " + (data.erro || ("HTTP " + r.status)), true);
  } catch (e) {
    if (meuId !== docsLoaderId) return;
    renderModalMensagem("Erro de conexao: " + e.message, true);
  }
}

function renderModalMensagem(texto, erro) {
  modalDocsCorpo.innerHTML = "";
  const div = document.createElement("div");
  div.className = "modal-loading";
  if (erro) div.style.color = "var(--st-reprovado)";
  div.textContent = texto;
  modalDocsCorpo.appendChild(div);
}

function renderModalDocumentos(docs) {
  modalDocsCorpo.innerHTML = "";
  if (docs.length === 0) {
    const div = document.createElement("div");
    div.className = "empty-state";
    div.style.padding = "26px 10px";
    div.innerHTML =
      '<div style="color: var(--text-3)">' + ic.docBig + '</div>' +
      '<div class="es-t" style="margin-top: 8px">Nenhum documento emitido</div>' +
      '<div class="es-s">Documentos aparecem aqui apos a aprovacao do projeto.</div>';
    modalDocsCorpo.appendChild(div);
    return;
  }
  for (const doc of docs) {
    const item = document.createElement("div");
    item.className = "doc-item";

    const info = document.createElement("div");
    info.className = "doc-info";

    const ico = document.createElement("span");
    ico.className = "doc-ico";
    ico.innerHTML = ic.docBig;
    info.appendChild(ico);

    const meta = document.createElement("div");
    meta.style.minWidth = "0";
    const desc = document.createElement("div");
    desc.className = "doc-desc";
    desc.textContent = doc.descricao || "Documento";
    meta.appendChild(desc);
    if (doc.arquivo) {
      const arq = document.createElement("div");
      arq.className = "doc-file";
      arq.textContent = doc.arquivo;
      meta.appendChild(arq);
    }
    info.appendChild(meta);
    item.appendChild(info);

    if (doc.link) {
      const a = document.createElement("a");
      a.className = "doc-open";
      a.href = "/api/documento?path=" + encodeURIComponent(doc.link);
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "abrir";
      item.appendChild(a);
    }
    modalDocsCorpo.appendChild(item);
  }
}

// ===========================================================================
// Modal: solicitar vistoria (com dropzone drag-and-drop)
// ===========================================================================
function renderDropzoneVazio() {
  vistoriaDropzone.classList.remove("has-file");
  vistoriaDropzone.innerHTML =
    '<div class="dz-ico">' + ic.upload + '</div>' +
    '<div class="dz-t">Arraste o arquivo aqui ou clique para selecionar</div>' +
    '<div class="dz-s">Zipe toda a documentação em um único arquivo</div>';
}

function renderDropzoneArquivo(file) {
  vistoriaDropzone.classList.add("has-file");
  vistoriaDropzone.innerHTML =
    '<div class="dz-file">' + ic.check + ' ' + escapeHtml(file.name) +
    ' <span class="fsz">' + formatarTamanho(file.size) + '</span></div>';
}

function escolherArquivoVistoria(file) {
  const nome = (file.name || "").toLowerCase();
  if (!(nome.endsWith(".zip") || nome.endsWith(".rar"))) {
    setVistoriaStatus("Apenas arquivos .zip ou .rar.", "vstatus err");
    return;
  }
  // Sincroniza o input com o arquivo selecionado (drag-and-drop tambem).
  const dt = new DataTransfer();
  dt.items.add(file);
  vistoriaArquivo.files = dt.files;
  setVistoriaStatus("", "");
  renderDropzoneArquivo(file);
}

function setVistoriaStatus(texto, classes) {
  if (!texto) {
    vistoriaStatus.hidden = true;
    vistoriaStatus.textContent = "";
    vistoriaStatus.className = "vstatus";
    return;
  }
  vistoriaStatus.hidden = false;
  vistoriaStatus.textContent = texto;
  vistoriaStatus.className = classes || "vstatus";
}

function abrirModalVistoria(numPe) {
  const p = projetos.find(x => x.NUM_PE === numPe);
  if (!p) return;
  if (p.vistoria_solicitada) return; // defesa
  vistoriaProjetoAtual = p;
  modalVistoriaTitulo.textContent = "Solicitar vistoria";
  modalVistoriaSub.textContent = p.NUM_PE + " · " +
    [p.Proprietario, p.Logradouro].filter(Boolean).join(" — ");
  vistoriaArquivo.value = "";
  renderDropzoneVazio();
  setVistoriaStatus("", "");
  vistoriaEnviar.disabled = false;
  vistoriaEnviar.textContent = "Enviar solicitação";
  vistoriaCancelar.disabled = false;
  modalVistoria.hidden = false;
  setTimeout(() => vistoriaDropzone.focus(), 50);
}

function fecharModalVistoria() {
  if (vistoriaEnviar.disabled) return; // envio em andamento — nao deixa fechar
  modalVistoria.hidden = true;
  vistoriaProjetoAtual = null;
  vistoriaArquivo.value = "";
  renderDropzoneVazio();
  setVistoriaStatus("", "");
}

async function enviarVistoria(e) {
  e.preventDefault();
  const p = vistoriaProjetoAtual;
  if (!p) return;
  const file = vistoriaArquivo.files && vistoriaArquivo.files[0];
  if (!file) {
    setVistoriaStatus("Selecione um arquivo .zip ou .rar.", "vstatus err");
    return;
  }
  const nome = file.name.toLowerCase();
  if (!(nome.endsWith(".zip") || nome.endsWith(".rar"))) {
    setVistoriaStatus("Apenas .zip ou .rar.", "vstatus err");
    return;
  }

  vistoriaEnviar.disabled = true;
  vistoriaCancelar.disabled = true;
  vistoriaEnviar.innerHTML = ic.refreshSpin + " Enviando…";
  setVistoriaStatus("Enviando arquivo (" + formatarTamanho(file.size) + ")…", "vstatus info");

  const form = new FormData();
  form.append("NUM_PE", p.NUM_PE);
  form.append("CodEmp", p.CodEmp);
  form.append("arquivo", file);

  try {
    const r = await fetch("/api/vistoria/solicitar", { method: "POST", body: form });
    if (tratar401(r)) return;
    const data = await r.json();
    if (!r.ok) {
      setVistoriaStatus(data.erro || ("Erro HTTP " + r.status), "vstatus err");
      vistoriaEnviar.disabled = false;
      vistoriaCancelar.disabled = false;
      vistoriaEnviar.textContent = "Tentar novamente";
      return;
    }
    // Sucesso: atualiza o projeto local, atualiza a linha e fecha o modal.
    p.vistoria_solicitada = true;
    p.vistoria_disponivel = false;
    p.vistoria_data = data.timestamp || new Date().toISOString();
    p.vistoria_arquivo = data.arquivo || file.name;
    p.vistoria_origem = "app";
    atualizarCelulaVistoria(p.NUM_PE);
    atualizarContadores();

    setVistoriaStatus(
      data.aviso ? "Vistoria solicitada (com aviso: " + data.aviso + ")"
                 : "Vistoria solicitada com sucesso.",
      "vstatus ok"
    );
    setTimeout(() => {
      vistoriaEnviar.disabled = false;
      vistoriaCancelar.disabled = false;
      vistoriaEnviar.textContent = "Enviar solicitação";
      fecharModalVistoria();
    }, 1200);
  } catch (err) {
    setVistoriaStatus("Erro de conexão: " + err.message, "vstatus err");
    vistoriaEnviar.disabled = false;
    vistoriaCancelar.disabled = false;
    vistoriaEnviar.textContent = "Tentar novamente";
  }
}
