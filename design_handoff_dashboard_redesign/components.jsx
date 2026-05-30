/* global React */
const { useState, useRef, useEffect } = React;

/* ---------- Icons (stroke, currentColor) ---------------------------------- */
const Ic = {
  search: (p) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>),
  refresh: (p) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/></svg>),
  bolt: (p) => (<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" {...p}><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z"/></svg>),
  pin: (p) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>),
  doc: (p) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/></svg>),
  upload: (p) => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>),
  check: (p) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>),
  eye: (p) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>),
  x: (p) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>),
  table: (p) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>),
  grid: (p) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>),
  clock: (p) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>),
  inbox: (p) => (<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>),
  spark: (p) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>),
};

/* ---------- small helpers ------------------------------------------------- */
function StatusTag({ p }) {
  return (
    <div className="status-wrap">
      {p.diff === "alterado" && p.status_anterior && (
        <span className="status-prev">{p.status_anterior}</span>
      )}
      <span className="status">
        <span className="sd" style={{ background: p.statusDot }} />
        {p.Status}
      </span>
    </div>
  );
}

function fmtShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("pt-BR") + " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* ---------- Observation cell ---------------------------------------------- */
function ObsCell({ p, onFetch }) {
  if (p.precisa_buscar_obs && !p.Observacao) {
    return (
      <div className="obs">
        <span className="obs-loading">
          <span className="skeleton" style={{ width: 150 }} /> buscando…
        </span>
      </div>
    );
  }
  if (p.Observacao) {
    return (
      <div className="obs">
        <div className="obs-text" style={p.obs_erro ? { color: "var(--st-reprovado)", fontStyle: "italic" } : null}>
          {p.Observacao}
        </div>
        <button className="mini-btn" onClick={() => onFetch(p.NUM_PE)}>
          <Ic.refresh width="11" height="11" /> rebuscar
        </button>
      </div>
    );
  }
  if (p.obs_fetched) {
    return (
      <div className="obs">
        <span className="obs-empty">(sem observação) </span>
        <button className="mini-btn" onClick={() => onFetch(p.NUM_PE)}>rebuscar</button>
      </div>
    );
  }
  return (
    <div className="obs">
      <button className="mini-btn" onClick={() => onFetch(p.NUM_PE)}>buscar observação</button>
    </div>
  );
}

/* ---------- Vistoria cell ------------------------------------------------- */
function VistCell({ p, onRequest }) {
  if (p.vistoria_solicitada) {
    return (
      <div className="vist vist-done">
        <span className="vist-label"><span className="vd" /> Vistoria solicitada</span>
        {p.vistoria_data && <span className="vist-sub">em {fmtShort(p.vistoria_data)}</span>}
        {p.vistoria_origem === "externo" && <span className="vist-sub">(detectada pelo portal)</span>}
        {p.vistoria_arquivo && <span className="vist-file">{p.vistoria_arquivo}</span>}
      </div>
    );
  }
  if (p.vistoria_disponivel) {
    return (
      <div className="vist">
        <button className="btn-vist" onClick={() => onRequest(p)}>Solicitar vistoria</button>
      </div>
    );
  }
  return (
    <div className="vist">
      <button className="btn-vist" disabled title={"Disponível apenas com status “Projeto Aprovado” (atual: " + p.Status + ")"}>
        Solicitar vistoria
      </button>
    </div>
  );
}

/* ---------- Table row ----------------------------------------------------- */
function TableRow({ p, idx, onSeen, onDocs, onFetch, onRequest }) {
  const cls = p.diff === "novo" ? "row-new" : p.diff === "alterado" ? "row-chg" : "normal";
  return (
    <tr className={cls}>
      <td className="cell-idx">{idx}</td>
      <td className="cell-data">{p.Data}</td>
      <td>
        <div className="numpe-row">
          {p.diff === "novo" && <span className="row-badge new"><Ic.spark width="10" height="10" /> Novo</span>}
          <span className="numpe">{p.NUM_PE}</span>
          <button className="mini-btn docs" onClick={() => onDocs(p)}>
            <Ic.doc width="11" height="11" /> documentos
          </button>
        </div>
      </td>
      <td><span className="owner">{p.Proprietario}</span></td>
      <td><span className="tipo-tag">{p.Tipo}</span></td>
      <td><span className="addr">{p.Logradouro}</span></td>
      <td className="status-cell">
        {p.diff === "alterado" && <span className="row-badge chg" style={{ marginBottom: 6, display: "inline-flex" }}>Status mudou</span>}
        <StatusTag p={p} />
        {p.diff && (
          <div style={{ marginTop: 7 }}>
            <button className="mini-btn seen" onClick={() => onSeen(p.NUM_PE)}>
              <Ic.check width="11" height="11" /> marcar como visto
            </button>
          </div>
        )}
      </td>
      <td className="vistoria-cell"><VistCell p={p} onRequest={onRequest} /></td>
      <td><ObsCell p={p} onFetch={onFetch} /></td>
    </tr>
  );
}

/* ---------- Card ---------------------------------------------------------- */
function ProjectCard({ p, onSeen, onDocs, onFetch, onRequest }) {
  const cls = p.diff === "novo" ? "card row-new" : p.diff === "alterado" ? "card row-chg" : "card";
  return (
    <div className={cls}>
      <span className="topline" />
      <div className="card-head">
        <div>
          <div className="card-numpe">{p.NUM_PE}</div>
          <div className="card-date">{p.Data}</div>
        </div>
        {p.diff === "novo" && <span className="row-badge new"><Ic.spark width="10" height="10" /> Novo</span>}
        {p.diff === "alterado" && <span className="row-badge chg">Status mudou</span>}
      </div>

      <div>
        <div className="card-owner">{p.Proprietario}</div>
        <div className="card-meta" style={{ marginTop: 6 }}>
          <span className="tipo-tag">{p.Tipo}</span>
        </div>
        <div className="card-addr" style={{ marginTop: 8 }}>
          <Ic.pin /> {p.Logradouro}
        </div>
      </div>

      <div className="card-divider" />

      <div className="card-row">
        <StatusTag p={p} />
        {p.diff && (
          <button className="mini-btn seen" onClick={() => onSeen(p.NUM_PE)}>
            <Ic.check width="11" height="11" /> visto
          </button>
        )}
      </div>

      <div className="card-row" style={{ alignItems: "flex-start" }}>
        <VistCell p={p} onRequest={onRequest} />
      </div>

      {(p.Observacao || p.precisa_buscar_obs || p.obs_fetched) && (
        <>
          <div className="card-divider" />
          <ObsCell p={p} onFetch={onFetch} />
        </>
      )}

      <div className="card-foot">
        <button className="mini-btn docs" onClick={() => onDocs(p)}>
          <Ic.doc width="11" height="11" /> documentos
        </button>
      </div>
    </div>
  );
}

/* ---------- Progress bar -------------------------------------------------- */
function ProgressBar({ feito, total, atual, done }) {
  const pct = total ? Math.round((feito / total) * 100) : 0;
  return (
    <div className={"progress" + (done ? " done" : "")}>
      <div className="progress-info">
        <span className="t">
          {done ? "Observações atualizadas" : "Atualizando observação — projeto " + (atual || "")}
        </span>
        <span className="c">
          {done ? total + " / " + total + " concluídos" : feito + " / " + total + " (faltam " + (total - feito) + ")"}
        </span>
      </div>
      <div className="progress-track"><div className="progress-bar" style={{ width: pct + "%" }} /></div>
    </div>
  );
}

/* ---------- Documents modal ----------------------------------------------- */
function DocsModal({ p, onClose }) {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState([]);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => { setDocs(p.documentos || []); setLoading(false); }, 650);
    return () => clearTimeout(t);
  }, [p]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h2>Documentos emitidos</h2>
            <div className="sub">{p.NUM_PE} · {[p.Proprietario, p.Logradouro].filter(Boolean).join(" — ")}</div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Fechar"><Ic.x /></button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="modal-loading"><Ic.refresh className="spin" /> Carregando documentos…</div>
          ) : docs.length === 0 ? (
            <div className="empty-state" style={{ padding: "26px 10px" }}>
              <Ic.doc width="30" height="30" style={{ color: "var(--text-3)" }} />
              <div className="es-t" style={{ marginTop: 8 }}>Nenhum documento emitido</div>
              <div className="es-s">Documentos aparecem aqui após a aprovação do projeto.</div>
            </div>
          ) : docs.map((d, i) => (
            <div className="doc-item" key={i}>
              <div className="doc-info">
                <span className="doc-ico"><Ic.doc /></span>
                <div>
                  <div className="doc-desc">{d.descricao}</div>
                  <div className="doc-file">{d.arquivo}</div>
                </div>
              </div>
              <a className="doc-open" href="#" onClick={(e) => e.preventDefault()}>abrir</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Vistoria modal ------------------------------------------------ */
function VistoriaModal({ p, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState(null); // {type, msg}
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !sending) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  function pick(f) {
    if (!f) return;
    const n = f.name.toLowerCase();
    if (!(n.endsWith(".zip") || n.endsWith(".rar"))) {
      setStatus({ type: "err", msg: "Apenas arquivos .zip ou .rar." });
      return;
    }
    setStatus(null);
    setFile(f);
  }
  function fmtSize(b) {
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    return (b / 1048576).toFixed(1) + " MB";
  }
  function submit(e) {
    e.preventDefault();
    if (!file) { setStatus({ type: "err", msg: "Selecione um arquivo .zip ou .rar." }); return; }
    setSending(true);
    setStatus({ type: "info", msg: "Enviando arquivo (" + fmtSize(file.size) + ")…" });
    setTimeout(() => {
      setStatus({ type: "ok", msg: "Vistoria solicitada com sucesso." });
      setTimeout(() => { onDone(p.NUM_PE, file.name); }, 1100);
    }, 1500);
  }

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h2>Solicitar vistoria</h2>
            <div className="sub">{p.NUM_PE} · {[p.Proprietario, p.Logradouro].filter(Boolean).join(" — ")}</div>
          </div>
          <button className="modal-x" onClick={() => !sending && onClose()} aria-label="Fechar"><Ic.x /></button>
        </div>
        <div className="modal-body">
          <form className="vform" onSubmit={submit}>
            <label className="lbl">Anexo (.zip ou .rar) com a documentação</label>
            <input ref={inputRef} type="file" accept=".zip,.rar" hidden
              onChange={(e) => pick(e.target.files && e.target.files[0])} />
            <div
              className={"dropzone" + (drag ? " drag" : "") + (file ? " has-file" : "")}
              onClick={() => inputRef.current && inputRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files && e.dataTransfer.files[0]); }}
            >
              {file ? (
                <div className="dz-file">
                  <Ic.check width="16" height="16" /> {file.name}
                  <span className="fsz">{fmtSize(file.size)}</span>
                </div>
              ) : (
                <>
                  <div className="dz-ico"><Ic.upload /></div>
                  <div className="dz-t">Arraste o arquivo aqui ou clique para selecionar</div>
                  <div className="dz-s">Zipe toda a documentação em um único arquivo</div>
                </>
              )}
            </div>
            <p className="vhint">
              O envio replica o que o portal faz ao clicar em <em>Solicitar Vistoria</em>.
              Inclua ART de execução, fotos do padrão e demais documentos exigidos.
            </p>
            {status && <div className={"vstatus " + status.type}>{status.msg}</div>}
            <div className="vactions">
              <button type="button" className="btn btn-ghost" disabled={sending} onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={sending}>
                {sending ? <><Ic.refresh className="spin" /> Enviando…</> : "Enviar solicitação"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  Ic, StatusTag, ObsCell, VistCell, TableRow, ProjectCard,
  ProgressBar, DocsModal, VistoriaModal, fmtShort,
});
