/* global React, useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakRadio,
   Ic, TableRow, ProjectCard, ProgressBar, DocsModal, VistoriaModal */
const { useState, useEffect, useRef, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "density": "comfortable",
  "highlight": "bold"
}/*EDITMODE-END*/;

/* ordering: novos first, then alterados, then by NUM_PE (ano desc, prefixo desc) */
function sortKey(numpe) {
  const s = String(numpe || "");
  const ano = parseInt(s.slice(-2), 10);
  const pre = parseInt(s.slice(0, -2), 10);
  return { ano: isNaN(ano) ? -1 : ano, pre: isNaN(pre) ? -1 : pre };
}
function ordenar(list) {
  const w = { novo: 0, alterado: 1, "": 2 };
  return [...list].sort((a, b) => {
    const pa = w[a.diff] ?? 2, pb = w[b.diff] ?? 2;
    if (pa !== pb) return pa - pb;
    const ka = sortKey(a.NUM_PE), kb = sortKey(b.NUM_PE);
    if (ka.ano !== kb.ano) return kb.ano - ka.ano;
    return kb.pre - ka.pre;
  });
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [projetos, setProjetos] = useState(() => ordenar(window.MOCK_PROJETOS.map(p => ({ ...p }))));
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fDest, setFDest] = useState("");
  const [fVist, setFVist] = useState("");
  const [layout, setLayout] = useState("table");
  const [docsP, setDocsP] = useState(null);
  const [vistP, setVistP] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [prog, setProg] = useState(null); // {feito,total,atual,done}
  const [lastUpdate, setLastUpdate] = useState(window.LAST_UPDATE);
  const loaderRef = useRef(0);

  /* theme + tweak attributes */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", t.dark ? "dark" : "light");
  }, [t.dark]);

  /* responsive default: cards on narrow screens (first load only) */
  useEffect(() => {
    if (window.matchMedia("(max-width: 600px)").matches) setLayout("cards");
  }, []);

  /* observation background loader (simulated) */
  function loadObs() {
    const pend = projetosRef.current.filter(p => p.precisa_buscar_obs);
    if (pend.length === 0) { setProg(null); return; }
    const myId = ++loaderRef.current;
    let feito = 0;
    setProg({ feito: 0, total: pend.length, atual: pend[0].NUM_PE, done: false });
    const step = () => {
      if (myId !== loaderRef.current) return;
      const p = pend[feito];
      setProg({ feito, total: pend.length, atual: p.NUM_PE, done: false });
      setTimeout(() => {
        if (myId !== loaderRef.current) return;
        setProjetos(prev => prev.map(x => x.NUM_PE === p.NUM_PE
          ? { ...x, precisa_buscar_obs: false, obs_fetched: true,
              Observacao: OBS_ON_DEMAND[x.statusKey] || "Sem observações registradas para este projeto no momento." }
          : x));
        feito++;
        if (feito < pend.length) step();
        else {
          setProg({ feito, total: pend.length, atual: null, done: true });
          setTimeout(() => { if (myId === loaderRef.current) setProg(null); }, 2600);
        }
      }, 850);
    };
    step();
  }

  const projetosRef = useRef(projetos);
  useEffect(() => { projetosRef.current = projetos; }, [projetos]);

  useEffect(() => { loadObs(); /* on mount */ }, []); // eslint-disable-line

  function refresh() {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setLastUpdate(new Date().toISOString());
    }, 1000);
  }

  function fetchObs(numpe) {
    setProjetos(prev => prev.map(x => x.NUM_PE === numpe
      ? { ...x, precisa_buscar_obs: true, Observacao: "", obs_fetched: false } : x));
    setTimeout(() => {
      setProjetos(prev => prev.map(x => x.NUM_PE === numpe
        ? { ...x, precisa_buscar_obs: false, obs_fetched: true,
            Observacao: OBS_ON_DEMAND[x.statusKey] || x.Observacao || "Sem observações registradas para este projeto no momento." }
        : x));
    }, 900);
  }

  function markSeen(numpe) {
    setProjetos(prev => ordenar(prev.map(x => x.NUM_PE === numpe
      ? { ...x, diff: "", status_anterior: null } : x)));
  }

  function vistoriaDone(numpe, fname) {
    setProjetos(prev => prev.map(x => x.NUM_PE === numpe
      ? { ...x, vistoria_solicitada: true, vistoria_disponivel: false, vistoria_origem: "app",
          vistoria_data: new Date().toISOString(), vistoria_arquivo: fname } : x));
    setVistP(null);
  }

  /* derived: status options */
  const statusOpts = useMemo(
    () => [...new Set(projetos.map(p => p.Status).filter(Boolean))].sort(),
    [projetos]);

  /* derived: filtered list */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projetos.filter(p => {
      if (fDest === "novo" && p.diff !== "novo") return false;
      if (fDest === "alterado" && p.diff !== "alterado") return false;
      if (fDest === "destaque" && !p.diff) return false;
      if (fStatus && p.Status !== fStatus) return false;
      if (fVist === "pendente" && p.vistoria_solicitada) return false;
      if (fVist === "solicitada" && !p.vistoria_solicitada) return false;
      if (q) {
        const hay = [p.NUM_PE, p.Proprietario, p.Tipo, p.Logradouro, p.Status, p.status_anterior || ""]
          .join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [projetos, search, fStatus, fDest, fVist]);

  const novos = projetos.filter(p => p.diff === "novo").length;
  const alterados = projetos.filter(p => p.diff === "alterado").length;
  const vistPend = projetos.filter(p => p.vistoria_disponivel && !p.vistoria_solicitada).length;
  const hasFilters = search || fStatus || fDest || fVist;

  return (
    <div className="app" data-hl={t.highlight}>
      {/* top bar */}
      <div className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><Ic.bolt /></span>
          <span className="brand-text">
            <span className="brand-name">energisa</span>
            <span className="brand-sub">Projetos Elétricos</span>
          </span>
        </div>
        <div className="topbar-actions">
          <span className="session">
            <span className="dot" /> Sessão ativa
            <span style={{ color: "var(--text-3)", fontWeight: 600 }}>· verificada 09:13</span>
          </span>
          <button className="btn btn-primary" onClick={refresh} disabled={refreshing}>
            {refreshing ? <Ic.refresh className="spin" /> : <Ic.refresh />}
            {refreshing ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {/* stat strip */}
      <div className="stats">
        <div className="stat">
          <div className="k">Projetos</div>
          <div className="v">{projetos.length}</div>
        </div>
        <div className="stat accent-new">
          <span className="corner" />
          <div className="k"><Ic.spark width="11" height="11" /> Novos</div>
          <div className="v">{novos}</div>
        </div>
        <div className="stat accent-chg">
          <span className="corner" />
          <div className="k">Status mudou</div>
          <div className="v">{alterados}</div>
        </div>
        <div className="stat">
          <div className="k">Vistorias a solicitar</div>
          <div className="v">{vistPend}</div>
        </div>
      </div>

      {/* toolbar */}
      <div className="toolbar">
        <div className="search">
          <Ic.search />
          <input placeholder="Filtrar por proprietário, NUM_PE, rua, status…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="select">
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {statusOpts.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="select">
          <select value={fDest} onChange={(e) => setFDest(e.target.value)}>
            <option value="">Todos os destaques</option>
            <option value="novo">Somente novos</option>
            <option value="alterado">Somente alterados</option>
            <option value="destaque">Novos + alterados</option>
          </select>
        </div>
        <div className="select">
          <select value={fVist} onChange={(e) => setFVist(e.target.value)}>
            <option value="">Vistoria: todas</option>
            <option value="pendente">Não solicitadas</option>
            <option value="solicitada">Já solicitadas</option>
          </select>
        </div>
        {hasFilters && (
          <button className="chip-clear" onClick={() => { setSearch(""); setFStatus(""); setFDest(""); setFVist(""); }}>
            Limpar filtros
          </button>
        )}
        <div className="seg" style={{ marginLeft: "auto" }}>
          <button className={layout === "table" ? "on" : ""} onClick={() => setLayout("table")}>
            <Ic.table /> Tabela
          </button>
          <button className={layout === "cards" ? "on" : ""} onClick={() => setLayout("cards")}>
            <Ic.grid /> Cards
          </button>
        </div>
      </div>

      {/* legend */}
      <div className="legend">
        <span className="lg new"><i /> Novo (protocolado recentemente)</span>
        <span className="lg chg"><i /> Status mudou</span>
        <span className="lg vp"><i /> Vistoria não solicitada</span>
        <span className="lg vs"><i /> Vistoria solicitada</span>
        <span className="note">Novos e alterados ficam fixados no topo até você marcar como visto.</span>
      </div>

      {/* progress */}
      {prog && <ProgressBar feito={prog.feito} total={prog.total} atual={prog.atual} done={prog.done} />}

      {/* content */}
      {filtered.length === 0 ? (
        <div className="table-wrap">
          <div className="empty-state">
            <Ic.inbox style={{ color: "var(--text-3)" }} />
            <div className="es-t">Nenhum projeto encontrado</div>
            <div className="es-s">Ajuste os filtros para ver mais resultados.</div>
          </div>
        </div>
      ) : layout === "table" ? (
        <div className={"table-wrap" + (t.density === "compact" ? " density-compact" : "")}>
          <div className="table-scroll">
            <table className="grid">
              <thead>
                <tr>
                  <th>#</th><th>Data</th><th>NUM_PE</th><th>Proprietário</th>
                  <th>Tipo</th><th>Logradouro</th><th>Status</th><th>Vistoria</th><th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <TableRow key={p.NUM_PE} p={p} idx={i + 1}
                    onSeen={markSeen} onDocs={setDocsP} onFetch={fetchObs} onRequest={setVistP} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="cards">
          {filtered.map(p => (
            <ProjectCard key={p.NUM_PE} p={p}
              onSeen={markSeen} onDocs={setDocsP} onFetch={fetchObs} onRequest={setVistP} />
          ))}
        </div>
      )}

      <div className="footnote">
        Última atualização: <b>{new Date(lastUpdate).toLocaleString("pt-BR")}</b> · {filtered.length} de {projetos.length} projetos
      </div>

      {/* modals */}
      {docsP && <DocsModal p={docsP} onClose={() => setDocsP(null)} />}
      {vistP && <VistoriaModal p={vistP} onClose={() => setVistP(null)} onDone={vistoriaDone} />}

      {/* tweaks */}
      <TweaksPanel>
        <TweakSection label="Aparência" />
        <TweakToggle label="Modo escuro" value={t.dark} onChange={(v) => setTweak("dark", v)} />
        <TweakRadio label="Densidade" value={t.density}
          options={["comfortable", "compact"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakRadio label="Destaques" value={t.highlight}
          options={["bold", "subtle"]}
          onChange={(v) => setTweak("highlight", v)} />
      </TweaksPanel>
    </div>
  );
}

/* on-demand observation text by status (used when "buscar" is clicked) */
const OBS_ON_DEMAND = {
  ANALISE: "Em análise técnica pela engenharia da distribuidora. Aguardando parecer dentro do prazo regulatório.",
  PENDENCIA: "Pendência registrada. Verifique a carta de exigências no portal e reenvie a documentação ajustada.",
  APROVADO: "Projeto aprovado. Liberado para solicitação de vistoria após a conclusão da obra.",
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
