const btnAtualizar = document.getElementById("btn-atualizar");
const btnCookie = document.getElementById("btn-cookie");
const cookieInput = document.getElementById("cookie-input");
const cookieStatus = document.getElementById("cookie-status");
const configSection = document.getElementById("config-section");
const lastUpdate = document.getElementById("last-update");
const stats = document.getElementById("stats");
const mensagem = document.getElementById("mensagem");
const progresso = document.getElementById("progresso");
const progressoTexto = document.getElementById("progresso-texto");
const progressoContador = document.getElementById("progresso-contador");
const progressoBarra = document.getElementById("progresso-barra");
const filtroBusca = document.getElementById("filtro-busca");
const filtroTipo = document.getElementById("filtro-tipo");
const filtroStatus = document.getElementById("filtro-status");
const tbody = document.querySelector("#tabela-projetos tbody");
const modalDocs = document.getElementById("modal-docs");
const modalDocsTitulo = document.getElementById("modal-docs-titulo");
const modalDocsSub = document.getElementById("modal-docs-sub");
const modalDocsCorpo = document.getElementById("modal-docs-corpo");
const modalDocsFechar = document.getElementById("modal-docs-fechar");
const sessaoStatus = document.getElementById("sessao-status");

let projetos = [];

btnAtualizar.addEventListener("click", atualizar);
btnCookie.addEventListener("click", salvarCookie);
filtroBusca.addEventListener("input", renderizarTabela);
filtroTipo.addEventListener("change", renderizarTabela);
filtroStatus.addEventListener("change", renderizarTabela);
modalDocsFechar.addEventListener("click", fecharModalDocumentos);
modalDocs.addEventListener("click", (e) => {
  if (e.target === modalDocs) fecharModalDocumentos();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalDocs.hidden) fecharModalDocumentos();
});

window.addEventListener("DOMContentLoaded", async () => {
  await carregarCookieAtual();
  atualizar();
  atualizarStatusSessao();
  setInterval(atualizarStatusSessao, 60000);
});

function formatarHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Consulta /api/sessao e mostra no cabecalho se o keep-alive mantem a sessao
// viva. data.ok: true = ativa, false = expirou/falhou, null = ainda verificando.
async function atualizarStatusSessao() {
  try {
    const r = await fetch("/api/sessao");
    if (tratar401(r)) return;
    const data = await r.json();
    if (data.ok === true) {
      sessaoStatus.textContent =
        "Sessao ativa" + (data.ts ? " (verificada " + formatarHora(data.ts) + ")" : "");
      sessaoStatus.className = "sessao-ok";
    } else if (data.ok === false) {
      sessaoStatus.textContent = "Sessao: " + (data.msg || "expirada");
      sessaoStatus.className = "sessao-erro";
    } else {
      sessaoStatus.textContent = "Sessao: verificando...";
      sessaoStatus.className = "sessao-neutro";
    }
  } catch (e) {
    // silencioso — nao polui a interface se /api/sessao falhar
  }
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

function formatarData(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

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

async function atualizar() {
  btnAtualizar.disabled = true;
  btnAtualizar.textContent = "Atualizando...";
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
    lastUpdate.textContent = "Ultima atualizacao: " + formatarData(data.timestamp);

    if (data.primeira_vez) {
      stats.innerHTML = `${data.total} projetos (primeira execucao — comparacoes aparecem da proxima vez)`;
    } else {
      atualizarContadores();
    }

    if (data.primeira_vez) {
      setMensagem(
        `<div class="info">Primeira execucao registrada. A partir da proxima atualizacao, ` +
        `projetos novos e mudancas de status serao destacados.</div>`
      );
    }

    renderizarTabela();
    carregarObservacoesPendentes();
  } catch (e) {
    setMensagem(`<div class="erro">Erro de conexao: ${escapeHtml(e.message)}</div>`);
  } finally {
    btnAtualizar.disabled = false;
    btnAtualizar.textContent = "Atualizar";
  }
}

function atualizarContadores() {
  const novos = projetos.filter(p => p.diff === "novo").length;
  const alterados = projetos.filter(p => p.diff === "alterado").length;
  stats.innerHTML =
    `${projetos.length} projetos &middot; ` +
    `<span class="stat-novo">${novos} novo(s)</span> &middot; ` +
    `<span class="stat-alterado">${alterados} alterado(s)</span>`;
}

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
    renderizarTabela();
  } catch (e) {
    setMensagem(`<div class="erro">Erro de conexao: ${escapeHtml(e.message)}</div>`);
  }
}

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

function renderizarTabela() {
  const filtro = filtroBusca.value.trim().toLowerCase();
  const tipo = filtroTipo.value;
  const statusSelecionado = filtroStatus.value;

  tbody.innerHTML = "";
  let i = 0;
  for (const p of projetos) {
    if (tipo === "novo" && p.diff !== "novo") continue;
    if (tipo === "alterado" && p.diff !== "alterado") continue;
    if (tipo === "destaque" && !p.diff) continue;
    if (statusSelecionado && p.Status !== statusSelecionado) continue;

    if (filtro) {
      const haystack = [
        p.NUM_PE, p.Proprietario, p.Tipo, p.Logradouro, p.Status, p.status_anterior || ""
      ].join(" ").toLowerCase();
      if (!haystack.includes(filtro)) continue;
    }

    i++;
    const tr = document.createElement("tr");
    tr.dataset.numpe = p.NUM_PE;
    if (p.diff) tr.className = p.diff;

    appendCelula(tr, String(i));
    appendCelula(tr, p.Data || "");

    const tdNum = document.createElement("td");
    tdNum.appendChild(document.createTextNode(p.NUM_PE));
    const acaoDoc = document.createElement("div");
    acaoDoc.className = "num-acao";
    const btnDoc = document.createElement("button");
    btnDoc.type = "button";
    btnDoc.className = "btn-docs";
    btnDoc.textContent = "documentos";
    btnDoc.title = "Ver documentos emitidos deste projeto";
    btnDoc.addEventListener("click", () => abrirModalDocumentos(p.NUM_PE));
    acaoDoc.appendChild(btnDoc);
    tdNum.appendChild(acaoDoc);
    tr.appendChild(tdNum);

    appendCelula(tr, p.Proprietario);
    appendCelula(tr, p.Tipo);
    appendCelula(tr, p.Logradouro);

    const tdStatus = document.createElement("td");
    tdStatus.className = "status-cell";
    if (p.diff === "alterado" && p.status_anterior) {
      const ant = document.createElement("span");
      ant.className = "status-anterior";
      ant.textContent = p.status_anterior;
      tdStatus.appendChild(ant);
      tdStatus.appendChild(document.createTextNode(p.Status));
    } else {
      tdStatus.appendChild(document.createTextNode(p.Status));
    }
    if (p.diff) {
      const acao = document.createElement("div");
      acao.className = "status-acao";
      const btnVisto = document.createElement("button");
      btnVisto.type = "button";
      btnVisto.className = "btn-visto";
      btnVisto.textContent = "marcar como visto";
      btnVisto.title = "Remove o destaque e devolve o projeto a ordenacao normal";
      btnVisto.addEventListener("click", () => marcarVisto(p.NUM_PE));
      acao.appendChild(btnVisto);
      tdStatus.appendChild(acao);
    }
    tr.appendChild(tdStatus);

    const tdObs = document.createElement("td");
    tdObs.className = "obs-cell";
    pintarObservacao(tdObs, p);
    tr.appendChild(tdObs);

    tbody.appendChild(tr);
  }

  if (i === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.className = "empty";
    td.textContent = "Nenhum projeto encontrado com os filtros aplicados.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

function pintarObservacao(td, p) {
  td.textContent = "";
  td.removeAttribute("title");
  td.classList.remove("obs-vazio", "obs-loading", "obs-erro");
  if (p.precisa_buscar_obs && !p.Observacao) {
    td.textContent = "carregando...";
    td.classList.add("obs-loading");
  } else if (p.Observacao) {
    if (p.obs_erro) td.classList.add("obs-erro");
    const wrap = document.createElement("div");
    wrap.className = "obs-text";
    wrap.textContent = p.Observacao;
    td.appendChild(wrap);
    td.appendChild(criarBotaoBuscar(p, "rebuscar"));
  } else if (p.obs_fetched) {
    const span = document.createElement("span");
    span.className = "obs-empty-text";
    span.textContent = "(sem observacao)";
    td.appendChild(span);
    td.appendChild(document.createTextNode(" "));
    td.appendChild(criarBotaoBuscar(p, "rebuscar"));
    td.title = "Portal retornou vazio. Clique em 'rebuscar' para verificar de novo.";
    td.classList.add("obs-vazio");
  } else {
    td.appendChild(criarBotaoBuscar(p, "buscar"));
    td.classList.add("obs-vazio");
  }
}

function criarBotaoBuscar(p, rotulo) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "obs-buscar";
  btn.textContent = rotulo;
  btn.title = "Buscar observacao deste projeto";
  btn.addEventListener("click", () => buscarObservacaoSobDemanda(p.NUM_PE));
  return btn;
}

function atualizarCelulaObservacao(numPe) {
  const tr = tbody.querySelector(`tr[data-numpe="${cssEscape(numPe)}"]`);
  if (!tr) return;
  const td = tr.querySelector("td.obs-cell");
  if (!td) return;
  const p = projetos.find(x => x.NUM_PE === numPe);
  if (!p) return;
  pintarObservacao(td, p);
}

function atualizarCelulaData(numPe) {
  const tr = tbody.querySelector(`tr[data-numpe="${cssEscape(numPe)}"]`);
  if (!tr || !tr.children[1]) return;
  const p = projetos.find(x => x.NUM_PE === numPe);
  if (!p) return;
  tr.children[1].textContent = p.Data || "";
}

function cssEscape(s) {
  if (window.CSS && CSS.escape) return CSS.escape(s);
  return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

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
  return mudou;
}

function reordenarERenderizar() {
  projetos = ordenarProjetos(projetos);
  atualizarContadores();
  renderizarTabela();
}

async function buscarObservacaoSobDemanda(numPe) {
  const p = projetos.find(x => x.NUM_PE === numPe);
  if (!p) return;
  p.precisa_buscar_obs = true;
  p.Observacao = "";
  p.obs_fetched = false;
  atualizarCelulaObservacao(numPe);
  console.log(`[obs] buscando ${numPe} (CodEmp=${p.CodEmp})`);
  let mudou = false;
  try {
    const r = await fetch("/api/observacao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ NUM_PE: p.NUM_PE, CodEmp: p.CodEmp }),
    });
    const data = await r.json();
    console.log(`[obs] resposta ${numPe}:`, r.status, data);
    if (r.ok) {
      mudou = aplicarRespostaObservacao(p, data);
    } else {
      p.Observacao = `[erro: ${data.erro || "falha"}]`;
      p.obs_erro = true;
    }
  } catch (e) {
    console.error(`[obs] erro de rede ${numPe}:`, e);
    p.Observacao = `[erro de rede: ${e.message}]`;
    p.obs_erro = true;
  }
  p.precisa_buscar_obs = false;
  if (mudou) {
    reordenarERenderizar();
  } else {
    atualizarCelulaObservacao(numPe);
  }
}

// Barra de progresso da carga de observacoes em segundo plano.
function mostrarProgresso(total) {
  progresso.classList.remove("concluido");
  progressoBarra.style.width = "0%";
  progressoTexto.textContent = "Atualizando observacoes...";
  progressoContador.textContent = "0 / " + total;
  progresso.hidden = false;
}

function renderProgresso(feito, total, numPe) {
  const pct = total ? Math.round((feito / total) * 100) : 0;
  progressoBarra.style.width = pct + "%";
  if (numPe) {
    progresso.classList.remove("concluido");
    progressoTexto.textContent = "Atualizando observacao - projeto " + numPe;
    progressoContador.textContent =
      feito + " / " + total + " (faltam " + (total - feito) + ")";
  } else {
    progresso.classList.add("concluido");
    progressoTexto.textContent = "Observacoes atualizadas";
    progressoContador.textContent = total + " / " + total + " concluidos";
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

function appendCelula(tr, texto) {
  const td = document.createElement("td");
  td.textContent = texto ?? "";
  tr.appendChild(td);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- Modal de documentos emitidos ------------------------------------------

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

  modalDocsTitulo.textContent = "Documentos emitidos - projeto " + p.NUM_PE;
  modalDocsSub.textContent = [p.Proprietario, p.Logradouro].filter(Boolean).join(" - ");
  modalDocsCorpo.innerHTML = "";
  const carregando = document.createElement("div");
  carregando.className = "modal-loading";
  carregando.textContent = "Carregando documentos...";
  modalDocsCorpo.appendChild(carregando);
  modalDocs.hidden = false;

  try {
    const r = await fetch("/api/documentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ NUM_PE: p.NUM_PE, CodEmp: p.CodEmp }),
    });
    const data = await r.json();
    if (meuId !== docsLoaderId) return; // modal fechado ou outro projeto aberto
    if (r.ok) {
      renderModalDocumentos(data.documentos || []);
    } else {
      renderModalMensagem("modal-erro", data.erro || ("Erro HTTP " + r.status));
    }
  } catch (e) {
    if (meuId !== docsLoaderId) return;
    renderModalMensagem("modal-erro", "Erro de conexao: " + e.message);
  }
}

function renderModalMensagem(classe, texto) {
  modalDocsCorpo.innerHTML = "";
  const div = document.createElement("div");
  div.className = classe;
  div.textContent = texto;
  modalDocsCorpo.appendChild(div);
}

function renderModalDocumentos(docs) {
  modalDocsCorpo.innerHTML = "";
  if (docs.length === 0) {
    renderModalMensagem("modal-vazio", "Nenhum documento emitido para este projeto.");
    return;
  }
  for (const doc of docs) {
    const item = document.createElement("div");
    item.className = "doc-item";

    const info = document.createElement("div");
    info.className = "doc-info";
    const desc = document.createElement("div");
    desc.className = "doc-desc";
    desc.textContent = doc.descricao || "Documento";
    info.appendChild(desc);
    if (doc.arquivo) {
      const arq = document.createElement("div");
      arq.className = "doc-arquivo";
      arq.textContent = doc.arquivo;
      info.appendChild(arq);
    }
    item.appendChild(info);

    if (doc.link) {
      const a = document.createElement("a");
      a.className = "doc-abrir";
      a.href = "/api/documento?path=" + encodeURIComponent(doc.link);
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "abrir";
      item.appendChild(a);
    }
    modalDocsCorpo.appendChild(item);
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
      cookieStatus.textContent = "Cookie salvo. Atualizando lista...";
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
