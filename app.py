"""
Servidor Flask local para consultar projetos eletricos no portal da Energisa.

Acesso protegido por login (usuario/senha vindos das variaveis de ambiente
APP_USERNAME / APP_PASSWORD). Toda rota exige sessao autenticada, exceto
/login e os arquivos estaticos.

Endpoints:
  GET  /                  -> pagina principal (exige login)
  GET/POST /login         -> tela de login
  GET  /logout            -> encerra a sessao
  POST /api/atualizar     -> busca projetos na API da Energisa e compara com snapshot
  GET  /api/cookie        -> retorna o cookie salvo (para exibir no formulario)
  POST /api/cookie        -> atualiza o cookie em disco
  POST /api/observacao    -> busca o detalhe/observacao de um projeto
  POST /api/marcar_visto  -> tira um projeto da lista de destaques
  POST /api/documentos    -> lista os documentos emitidos de um projeto
  GET  /api/documento     -> exibe/baixa um documento emitido (proxy autenticado)
  GET  /api/sessao        -> estado do keep-alive da sessao

Snapshot dos projetos fica em snapshot.json, usado para detectar:
  - projetos novos (presentes agora, ausentes antes)
  - status alterado (mesmo NUM_PE mas DSC_SITUACAO_PE diferente)

Projetos novos/alterados viram "destaques" e ficam fixados no topo em todas
as atualizacoes ate o usuario marca-los como vistos.

Sessao auto-renovavel: o portal reemite o cookie de login (.ASPXAUTH) via
Set-Cookie a cada resposta. Toda requisicao passa por portal_get(), que absorve
esses cookies renovados e regrava cookie.txt. Uma thread de keep-alive faz um
ping periodico para a sessao nao expirar por inatividade.
"""

import hmac
import json
import os
import secrets
import shutil
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

import requests
from flask import (
    Flask, Response, jsonify, redirect, render_template, request,
    session, stream_with_context, url_for,
)

try:  # .env e opcional — util para rodar localmente fora do Docker
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


CPF = "5736193108"
URL_API = "https://projetoseletricos.energisa.com.br/ProjetoEletrico/GetListaProjetoEletrico"
URL_DETALHE = "https://projetoseletricos.energisa.com.br/AcompanharPE/GetAcompanhamento"
URL_DOCUMENTOS = "https://projetoseletricos.energisa.com.br/AcompanharPE/GetDocumentosEmitidos"
URL_PORTAL = "https://projetoseletricos.energisa.com.br"

# Pasta de anexos do portal. O proxy /api/documento so serve arquivos abaixo
# deste prefixo — assim o endpoint nao vira um proxy aberto para qualquer URL.
ARQUIVOS_PREFIXO = "/arquivos_awgpe/"

# Status de projetos "em andamento". Enquanto o projeto esta em uma destas
# situacoes a observacao pode mudar sem o status mudar, entao a observacao e
# rebuscada a cada atualizacao (nao so quando o projeto vira destaque). Qualquer
# mudanca detectada na rebusca segue o mesmo processo de destaque no topo.
STATUS_ACOMPANHAR = {
    "Projeto em Análise",
    "Parecer de Acesso em Aberto",
    "Relacionamento Operacional em Aberto",
    "Etapa de Obra",
}

SCRIPT_DIR = Path(__file__).parent
# Dados persistentes (cookie e snapshot). Em Docker aponta para um volume
# montado (DATA_DIR=/data); localmente, fica na pasta do script.
DATA_DIR = Path(os.environ.get("DATA_DIR") or SCRIPT_DIR)
DATA_DIR.mkdir(parents=True, exist_ok=True)
COOKIE_FILE = DATA_DIR / "cookie.txt"
SNAPSHOT_FILE = DATA_DIR / "snapshot.json"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# ---- Autenticacao e seguranca ----------------------------------------------
# Credenciais e segredos vem de variaveis de ambiente (.env / Docker), nunca
# do codigo-fonte.
APP_USERNAME = os.environ.get("APP_USERNAME", "").strip()
APP_PASSWORD = os.environ.get("APP_PASSWORD", "")

if not (APP_USERNAME and APP_PASSWORD):
    raise RuntimeError(
        "APP_USERNAME e APP_PASSWORD precisam estar definidos (arquivo .env — "
        "veja .env.example). O app nao inicia sem credenciais de acesso."
    )


def _obter_secret_key() -> bytes:
    """Chave que assina o cookie de sessao. Usa SECRET_KEY do ambiente ou, na
    falta dela, gera uma e guarda em DATA_DIR/.secret_key (para as sessoes
    sobreviverem a reinicios)."""
    env = os.environ.get("SECRET_KEY", "").strip()
    if env:
        return env.encode("utf-8")
    arq = DATA_DIR / ".secret_key"
    try:
        if arq.exists():
            return arq.read_bytes()
        chave = secrets.token_bytes(32)
        arq.write_bytes(chave)
        return chave
    except OSError:
        return secrets.token_bytes(32)  # efemera: sessoes caem a cada reinicio


app = Flask(__name__)
app.secret_key = _obter_secret_key()
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    # cookie de sessao so trafega em HTTPS (desligue com COOKIE_SECURE=false
    # apenas para testar local em http://).
    SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "true").lower() != "false",
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),
    MAX_CONTENT_LENGTH=1 * 1024 * 1024,  # limite de 1 MB no corpo da requisicao
)

# Limite de tentativas de login por IP — protecao simples contra forca bruta.
LOGIN_MAX_TENTATIVAS = 5
LOGIN_JANELA_S = 300
_login_falhas: dict[str, list[float]] = {}
_login_lock = threading.Lock()


def _ip_cliente() -> str:
    # Atras do Cloudflare Tunnel o IP real do visitante vem em CF-Connecting-IP.
    return (request.headers.get("CF-Connecting-IP")
            or request.remote_addr or "desconhecido")


def _login_bloqueado(ip: str) -> bool:
    with _login_lock:
        recentes = [t for t in _login_falhas.get(ip, [])
                    if time.time() - t < LOGIN_JANELA_S]
        _login_falhas[ip] = recentes
        return len(recentes) >= LOGIN_MAX_TENTATIVAS


def _login_registrar_falha(ip: str) -> None:
    with _login_lock:
        _login_falhas.setdefault(ip, []).append(time.time())


def _login_limpar(ip: str) -> None:
    with _login_lock:
        _login_falhas.pop(ip, None)


def _credenciais_ok(usuario: str, senha: str) -> bool:
    """Compara usuario e senha em tempo constante (evita timing attack)."""
    ok_user = hmac.compare_digest(usuario.encode("utf-8"),
                                  APP_USERNAME.encode("utf-8"))
    ok_pass = hmac.compare_digest(senha.encode("utf-8"),
                                  APP_PASSWORD.encode("utf-8"))
    return ok_user and ok_pass


def ler_cookie() -> str:
    if not COOKIE_FILE.exists():
        return ""
    cookie = COOKIE_FILE.read_text(encoding="utf-8").strip()
    if cookie.lower().startswith("cookie:"):
        cookie = cookie[len("cookie:"):].strip()
    return cookie


# ---- Sessao auto-renovavel --------------------------------------------------
# O .ASPXAUTH (e cookies do Akamai) sao reemitidos pelo portal via Set-Cookie a
# cada resposta. Guardamos o cookie em memoria, absorvemos o que volta em cada
# requisicao e regravamos cookie.txt — assim a sessao se renova sozinha.

KEEPALIVE_MIN = 30  # intervalo do ping de keep-alive, em minutos

_cookie_lock = threading.Lock()
_cookie_atual: dict[str, str] = {}

# Estado da sessao, exposto em /api/sessao. Atualizado pelo keep-alive e por
# toda atualizacao de projetos bem-sucedida.
_sessao_status: dict = {"ts": None, "ok": None, "msg": "ainda nao verificada"}

COOKIE_TMP = COOKIE_FILE.with_name(COOKIE_FILE.name + ".tmp")


def _marcar_sessao(ok: bool, msg: str) -> None:
    """Atualiza o estado da sessao exibido em /api/sessao."""
    _sessao_status.update(
        ts=datetime.now().isoformat(timespec="seconds"), ok=ok, msg=msg)


def _parse_cookie_str(texto: str) -> dict[str, str]:
    """Quebra 'a=1; b=2; ...' em {'a': '1', 'b': '2'}. Valores podem conter
    '=' (ex.: UserInfo), por isso o split e feito so no primeiro '='."""
    d: dict[str, str] = {}
    for parte in texto.split(";"):
        parte = parte.strip()
        if "=" in parte:
            nome, valor = parte.split("=", 1)
            nome = nome.strip()
            if nome:
                d[nome] = valor.strip()
    return d


def _montar_cookie_str(d: dict[str, str]) -> str:
    return "; ".join(f"{k}={v}" for k, v in d.items())


def carregar_cookie_memoria() -> None:
    """Le cookie.txt para a memoria. Chamado no inicio e apos colar um cookie."""
    global _cookie_atual
    _cookie_atual = _parse_cookie_str(ler_cookie())


def cookie_header() -> str:
    """String do header Cookie a partir do estado atual em memoria."""
    return _montar_cookie_str(_cookie_atual)


def _gravar_cookie_txt() -> None:
    """Regrava cookie.txt de forma atomica (tmp + os.replace)."""
    COOKIE_TMP.write_text(_montar_cookie_str(_cookie_atual), encoding="utf-8")
    os.replace(COOKIE_TMP, COOKIE_FILE)


def _absorver_cookies(r: requests.Response) -> None:
    """Captura os cookies renovados na resposta e persiste se algo mudou.
    Deve ser chamado com _cookie_lock ja adquirido."""
    novos = {c.name: c.value for c in r.cookies}
    if not novos:
        return
    if all(_cookie_atual.get(k) == v for k, v in novos.items()):
        return  # nada novo — evita regravar cookie.txt a toa
    _cookie_atual.update(novos)
    try:
        _gravar_cookie_txt()
    except OSError as e:
        # Persistir e best-effort; a sessao em memoria continua valida.
        print(f"[AVISO] nao consegui regravar cookie.txt: {e}")


def portal_get(url, *, params=None, headers=None, stream=False, timeout=60):
    """GET autenticado no portal: injeta o cookie atual e absorve o Set-Cookie
    da resposta. Serializado por _cookie_lock para que o keep-alive e as
    requisicoes da interface nao mexam no cookie ao mesmo tempo."""
    h = {"User-Agent": USER_AGENT}
    if headers:
        h.update(headers)
    with _cookie_lock:
        h["Cookie"] = cookie_header()
        r = requests.get(url, params=params, headers=h, stream=stream, timeout=timeout)
        _absorver_cookies(r)
    return r


SNAPSHOT_TMP = SNAPSHOT_FILE.with_name(SNAPSHOT_FILE.name + ".tmp")
SNAPSHOT_BAK = SNAPSHOT_FILE.with_name(SNAPSHOT_FILE.name + ".bak")


def _normalizar_snapshot(data: dict) -> dict:
    return {
        "projects": data.get("projects", {}) or {},
        "observacoes": data.get("observacoes", {}) or {},
        "datas": data.get("datas", {}) or {},
        "destaques": data.get("destaques", {}) or {},
    }


def carregar_snapshot() -> dict:
    """Retorna {'projects', 'observacoes', 'datas', 'destaques'} (todos dicts por num_pe).

    'destaques' guarda os projetos novos/alterados que ainda nao foram marcados
    como vistos pelo usuario — eles permanecem no topo entre as atualizacoes.

    Se snapshot.json estiver ilegivel, tenta o backup (snapshot.json.bak) antes
    de desistir, e preserva o arquivo ruim como .corrompido. Assim um arquivo
    corrompido nunca e sobrescrito silenciosamente com dados vazios.
    """
    vazio = {"projects": {}, "observacoes": {}, "datas": {}, "destaques": {}}
    if not SNAPSHOT_FILE.exists():
        return dict(vazio)
    try:
        return _normalizar_snapshot(json.loads(SNAPSHOT_FILE.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, OSError):
        pass

    # snapshot.json ilegivel — tenta recuperar do backup.
    if SNAPSHOT_BAK.exists():
        try:
            recuperado = _normalizar_snapshot(
                json.loads(SNAPSHOT_BAK.read_text(encoding="utf-8"))
            )
            print("[AVISO] snapshot.json corrompido — recuperado de snapshot.json.bak")
            _preservar_corrompido()
            return recuperado
        except (json.JSONDecodeError, OSError):
            pass

    print("[AVISO] snapshot.json e .bak ilegiveis — comecando snapshot do zero")
    _preservar_corrompido()
    return dict(vazio)


def _preservar_corrompido() -> None:
    """Renomeia o snapshot ilegivel em vez de deixa-lo ser sobrescrito."""
    try:
        carimbo = datetime.now().strftime("%Y%m%d_%H%M%S")
        SNAPSHOT_FILE.rename(SNAPSHOT_FILE.with_name(f"{SNAPSHOT_FILE.name}.corrompido_{carimbo}"))
    except OSError:
        pass


def salvar_snapshot(
    projetos: list[dict],
    observacoes: dict,
    datas: dict | None = None,
    destaques: dict | None = None,
) -> None:
    by_id = {str(p.get("NUM_PE", "")).strip(): p for p in projetos if p.get("NUM_PE")}
    payload = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "projects": by_id,
        "observacoes": observacoes,
        "datas": datas or {},
        "destaques": destaques or {},
    }
    texto = json.dumps(payload, ensure_ascii=False, indent=2)

    # Escrita atomica: grava num arquivo .tmp e troca de uma vez so com
    # os.replace(). Se a escrita falhar no meio (arquivo travado pelo editor
    # ou antivirus no Windows), snapshot.json continua intacto — ele so e
    # substituido depois que o .tmp ficou completo.
    SNAPSHOT_TMP.write_text(texto, encoding="utf-8")

    if SNAPSHOT_FILE.exists():
        try:
            shutil.copy2(SNAPSHOT_FILE, SNAPSHOT_BAK)
        except OSError:
            pass  # backup e best-effort; nao impede salvar

    ultimo_erro = None
    for _ in range(5):
        try:
            os.replace(SNAPSHOT_TMP, SNAPSHOT_FILE)
            return
        except PermissionError as e:  # arquivo momentaneamente travado no Windows
            ultimo_erro = e
            time.sleep(0.2)
    raise RuntimeError(
        f"Nao foi possivel salvar o snapshot (arquivo travado): {ultimo_erro}. "
        "Feche o snapshot.json se estiver aberto em algum editor. "
        "O snapshot anterior foi preservado."
    )


def buscar_api() -> list[dict]:
    headers = {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://projetoseletricos.energisa.com.br/ProjetoEletrico",
    }
    params = {
        "cpf": CPF,
        "valorDig": "",
        "_search": "false",
        "nd": "1778789025126",
        "rows": "100000",
        "page": "1",
        "sidx": "",
        "sord": "desc",
    }
    r = portal_get(URL_API, params=params, headers=headers, timeout=60)

    if r.status_code != 200:
        raise RuntimeError(
            f"HTTP {r.status_code} ao consultar a API. "
            "O cookie pode ter expirado — faca login no portal, copie o cookie atualizado "
            "no DevTools e cole na secao Configuracao."
        )

    try:
        data = r.json()
    except json.JSONDecodeError:
        raise RuntimeError(
            "A resposta da API nao e JSON. Provavelmente o cookie expirou e a Energisa "
            "redirecionou para a tela de login. Atualize o cookie na secao Configuracao."
        )

    if isinstance(data, dict):
        for k in ("rows", "data", "Data", "Items"):
            if isinstance(data.get(k), list):
                return data[k]
        raise RuntimeError(f"Formato inesperado de resposta. Chaves: {list(data.keys())}")

    if isinstance(data, list):
        return data

    raise RuntimeError(f"Tipo inesperado de resposta: {type(data).__name__}")


def buscar_detalhe(num_pe: str, cod_emp) -> dict:
    headers = {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": (
            f"https://projetoseletricos.energisa.com.br/AcompanharPE/Index"
            f"?id={num_pe}&idEmp={cod_emp}"
        ),
    }
    params = {"id": num_pe, "idEmp": cod_emp}
    r = portal_get(URL_DETALHE, params=params, headers=headers, timeout=60)

    if r.status_code != 200:
        raise RuntimeError(
            f"HTTP {r.status_code} ao consultar detalhe do projeto {num_pe}. "
            "Cookie pode ter expirado — atualize na secao Configuracao."
        )

    try:
        return r.json()
    except json.JSONDecodeError:
        raise RuntimeError(
            f"Resposta do detalhe nao e JSON (projeto {num_pe}). "
            "Provavelmente o cookie expirou."
        )


def extrair_status_detalhe(detalhe: dict) -> str:
    """Tenta achar o status atual na resposta de detalhe do projeto.

    A API de detalhe pode usar nomes de campo diferentes da lista (ou nao
    trazer o status). Se nao encontrar, retorna "" e a deteccao de mudanca
    de status simplesmente nao roda nesse clique.
    """
    if not isinstance(detalhe, dict):
        return ""
    for chave in (
        "DSC_SITUACAO_PE", "DSC_SITUACAO", "DSC_SITUACAO_ATUAL",
        "SITUACAO", "STATUS", "DSC_STATUS",
    ):
        valor = detalhe.get(chave)
        if valor:
            return str(valor).strip()
    return ""


def buscar_documentos(num_pe: str, cod_emp) -> list[dict]:
    """Lista os documentos emitidos de um projeto (GetDocumentosEmitidos).

    A resposta e uma lista de dicts com DSC_DOCUMENTO (descricao),
    NOM_ARQUIVO_ANEXO (nome do arquivo) e linkName (caminho do anexo no portal).
    """
    headers = {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": (
            f"{URL_PORTAL}/AcompanharPE/Index?id={num_pe}&idEmp={cod_emp}"
        ),
    }
    params = {"id": num_pe, "idEmp": cod_emp}
    r = portal_get(URL_DOCUMENTOS, params=params, headers=headers, timeout=60)

    if r.status_code != 200:
        raise RuntimeError(
            f"HTTP {r.status_code} ao consultar documentos do projeto {num_pe}. "
            "Cookie pode ter expirado — atualize na secao Configuracao."
        )

    try:
        data = r.json()
    except json.JSONDecodeError:
        raise RuntimeError(
            f"Resposta de documentos nao e JSON (projeto {num_pe}). "
            "Provavelmente o cookie expirou."
        )

    return data if isinstance(data, list) else []


@app.before_request
def _exigir_login():
    """Bloqueia tudo que nao seja a tela de login ou arquivos estaticos."""
    if request.endpoint in ("login", "static"):
        return None
    if session.get("logado"):
        return None
    if request.path.startswith("/api/"):
        return jsonify({"erro": "Sessao expirada. Faca login novamente."}), 401
    return redirect(url_for("login"))


@app.after_request
def _cabecalhos_seguranca(resp):
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    return resp


@app.route("/login", methods=["GET", "POST"])
def login():
    if session.get("logado"):
        return redirect(url_for("index"))
    erro = None
    if request.method == "POST":
        ip = _ip_cliente()
        if _login_bloqueado(ip):
            erro = "Muitas tentativas. Aguarde alguns minutos e tente de novo."
        elif _credenciais_ok(request.form.get("usuario", ""),
                             request.form.get("senha", "")):
            session.clear()
            session["logado"] = True
            session.permanent = True
            _login_limpar(ip)
            return redirect(url_for("index"))
        else:
            _login_registrar_falha(ip)
            erro = "Usuario ou senha incorretos."
    return render_template("login.html", erro=erro)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/cookie", methods=["GET"])
def obter_cookie():
    return jsonify({"cookie": cookie_header()})


@app.route("/api/cookie", methods=["POST"])
def salvar_cookie():
    global _cookie_atual
    payload = request.get_json(silent=True) or {}
    cookie = (payload.get("cookie") or "").strip()
    if not cookie:
        return jsonify({"erro": "Cookie vazio."}), 400
    if cookie.lower().startswith("cookie:"):
        cookie = cookie[len("cookie:"):].strip()
    with _cookie_lock:
        _cookie_atual = _parse_cookie_str(cookie)
        try:
            _gravar_cookie_txt()
        except OSError as e:
            return jsonify({"erro": f"Nao consegui gravar cookie.txt: {e}"}), 500
    return jsonify({"ok": True})


@app.route("/api/atualizar", methods=["POST"])
def atualizar():
    if not cookie_header():
        return jsonify({"erro": "Cookie nao configurado. Defina em Configuracao."}), 400

    try:
        projetos_api = buscar_api()
    except RuntimeError as e:
        _marcar_sessao(False, "cookie expirou — atualize em Configuracao")
        return jsonify({"erro": str(e)}), 400
    except requests.RequestException as e:
        return jsonify({"erro": f"Falha de rede: {e}"}), 502
    _marcar_sessao(True, "sessao ativa")

    snapshot = carregar_snapshot()
    snapshot_anterior = snapshot["projects"]
    observacoes_cache = dict(snapshot["observacoes"])
    datas_cache = dict(snapshot["datas"])
    destaques_cache = dict(snapshot["destaques"])
    primeira_vez = len(snapshot_anterior) == 0

    # Salvaguarda: a API retornar 0 projetos quase sempre significa cookie
    # expirado. Nesse caso nao sobrescreve o snapshot bom com uma lista vazia.
    if not projetos_api and not primeira_vez:
        return jsonify({
            "erro": "A API retornou 0 projetos — provavelmente o cookie expirou. "
                    "O snapshot anterior foi mantido. Atualize o cookie em Configuracao.",
        }), 400

    resultado = []
    for p in projetos_api:
        pid = str(p.get("NUM_PE", "")).strip()
        if not pid:
            continue
        anterior = snapshot_anterior.get(pid)
        status_atual = p.get("DSC_SITUACAO_PE") or ""

        # Registra mudancas em destaques_cache. Um destaque so sai dessa lista
        # quando o usuario clica em "marcar como visto" (endpoint /api/marcar_visto),
        # entao projetos novos/alterados continuam no topo entre as atualizacoes.
        if not primeira_vez:
            if anterior is None:
                destaques_cache.setdefault(pid, {"tipo": "novo", "status_anterior": None})
            elif (anterior.get("DSC_SITUACAO_PE") or "") != status_atual:
                if pid not in destaques_cache:
                    destaques_cache[pid] = {
                        "tipo": "alterado",
                        "status_anterior": anterior.get("DSC_SITUACAO_PE") or "",
                    }
                # Status mudou desde a ultima atualizacao -> rebuscar observacao.
                observacoes_cache.pop(pid, None)

        destaque = destaques_cache.get(pid)
        diff = destaque["tipo"] if destaque else ""
        status_anterior = destaque.get("status_anterior") if destaque else None

        obs_cached = observacoes_cache.get(pid, "")
        obs_fetched = pid in observacoes_cache
        # Projetos novos/alterados rebuscam a observacao uma vez. Projetos em
        # andamento (STATUS_ACOMPANHAR) rebuscam a observacao a cada atualizacao:
        # assim uma observacao que muda sem o status mudar tambem e detectada e
        # o projeto vira destaque no topo via /api/observacao.
        precisa_buscar_obs = (
            (diff in ("novo", "alterado") and not obs_fetched)
            or status_atual.strip() in STATUS_ACOMPANHAR
        )

        resultado.append({
            "NUM_PE": pid,
            "CodEmp": p.get("COD_EMP_PE") or "",
            "Data": datas_cache.get(pid, ""),
            "Proprietario": p.get("NOM_PROPRIETARIO_OBRA") or "",
            "Tipo": p.get("DSC_TIPO_PE") or "",
            "Logradouro": p.get("DSC_LOGRADOURO") or "",
            "Status": status_atual,
            "CodStatus": p.get("COD_SITUACAO_PE") or "",
            "diff": diff,
            "status_anterior": status_anterior,
            "Observacao": obs_cached,
            "obs_fetched": obs_fetched,
            "precisa_buscar_obs": precisa_buscar_obs,
        })

    # Descarta destaques de projetos que sairam da lista da API.
    ids_atuais = {str(p.get("NUM_PE", "")).strip() for p in projetos_api}
    destaques_cache = {k: v for k, v in destaques_cache.items() if k in ids_atuais}

    try:
        salvar_snapshot(projetos_api, observacoes_cache, datas_cache, destaques_cache)
    except RuntimeError as e:
        return jsonify({"erro": str(e)}), 500

    novos = sum(1 for r in resultado if r["diff"] == "novo")
    alterados = sum(1 for r in resultado if r["diff"] == "alterado")

    return jsonify({
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "primeira_vez": primeira_vez,
        "total": len(resultado),
        "novos": novos,
        "alterados": alterados,
        "projetos": resultado,
    })


@app.route("/api/observacao", methods=["POST"])
def obter_observacao():
    if not cookie_header():
        return jsonify({"erro": "Cookie nao configurado."}), 400

    payload = request.get_json(silent=True) or {}
    num_pe = str(payload.get("NUM_PE") or "").strip()
    cod_emp = payload.get("CodEmp")
    if not num_pe or cod_emp in (None, ""):
        return jsonify({"erro": "NUM_PE e CodEmp sao obrigatorios."}), 400

    try:
        detalhe = buscar_detalhe(num_pe, cod_emp)
    except RuntimeError as e:
        return jsonify({"erro": str(e)}), 400
    except requests.RequestException as e:
        return jsonify({"erro": f"Falha de rede: {e}"}), 502

    observacao = (detalhe.get("DSC_OBSERVACAO_EXECUCAO") or "").strip()
    data_abertura = str(detalhe.get("DATA_ABERTURA") or "").strip()
    status_detalhe = extrair_status_detalhe(detalhe)

    snapshot = carregar_snapshot()

    # Se o projeto ja e um destaque ele ja esta no topo — nao precisa redetectar
    # (e evita falso positivo caso o detalhe formate o status diferente da lista).
    ja_destaque = num_pe in snapshot["destaques"]

    # Observacao mudou em relacao a ultima vez que foi buscada.
    obs_anterior = snapshot["observacoes"].get(num_pe)
    obs_mudou = (
        not ja_destaque and obs_anterior is not None and obs_anterior != observacao
    )

    # Status mudou em relacao ao que estava salvo para o projeto.
    status_anterior = None
    status_mudou = False
    projeto = snapshot["projects"].get(num_pe)
    if not ja_destaque and status_detalhe and projeto:
        status_salvo = (projeto.get("DSC_SITUACAO_PE") or "").strip()
        if status_salvo and status_salvo != status_detalhe:
            status_mudou = True
            status_anterior = status_salvo
            projeto["DSC_SITUACAO_PE"] = status_detalhe

    # Mudou algo -> vira destaque e sobe pro topo, igual a logica do /api/atualizar.
    diff = ""
    if obs_mudou or status_mudou:
        snapshot["destaques"][num_pe] = {
            "tipo": "alterado",
            "status_anterior": status_anterior,
        }
        diff = "alterado"

    snapshot["observacoes"][num_pe] = observacao
    if data_abertura:
        snapshot["datas"][num_pe] = data_abertura
    projetos_list = list(snapshot["projects"].values())
    try:
        salvar_snapshot(
            projetos_list, snapshot["observacoes"], snapshot["datas"], snapshot["destaques"]
        )
    except RuntimeError as e:
        return jsonify({"erro": str(e)}), 500

    return jsonify({
        "observacao": observacao,
        "data": data_abertura,
        "diff": diff,
        "obs_mudou": obs_mudou,
        "status_mudou": status_mudou,
        "status": status_detalhe if status_mudou else "",
        "status_anterior": status_anterior,
    })


@app.route("/api/marcar_visto", methods=["POST"])
def marcar_visto():
    """Remove um projeto da lista de destaques — deixa de ficar fixado no topo."""
    payload = request.get_json(silent=True) or {}
    num_pe = str(payload.get("NUM_PE") or "").strip()
    if not num_pe:
        return jsonify({"erro": "NUM_PE e obrigatorio."}), 400

    snapshot = carregar_snapshot()
    snapshot["destaques"].pop(num_pe, None)
    projetos_list = list(snapshot["projects"].values())
    try:
        salvar_snapshot(
            projetos_list, snapshot["observacoes"], snapshot["datas"], snapshot["destaques"]
        )
    except RuntimeError as e:
        return jsonify({"erro": str(e)}), 500

    return jsonify({"ok": True})


@app.route("/api/documentos", methods=["POST"])
def listar_documentos():
    """Retorna os documentos emitidos de um projeto para exibir no modal."""
    if not cookie_header():
        return jsonify({"erro": "Cookie nao configurado."}), 400

    payload = request.get_json(silent=True) or {}
    num_pe = str(payload.get("NUM_PE") or "").strip()
    cod_emp = payload.get("CodEmp")
    if not num_pe or cod_emp in (None, ""):
        return jsonify({"erro": "NUM_PE e CodEmp sao obrigatorios."}), 400

    try:
        docs = buscar_documentos(num_pe, cod_emp)
    except RuntimeError as e:
        return jsonify({"erro": str(e)}), 400
    except requests.RequestException as e:
        return jsonify({"erro": f"Falha de rede: {e}"}), 502

    resultado = []
    for d in docs:
        if not isinstance(d, dict):
            continue
        resultado.append({
            "descricao": (d.get("DSC_DOCUMENTO") or "").strip(),
            "arquivo": (d.get("NOM_ARQUIVO_ANEXO") or "").strip(),
            "link": (d.get("linkName") or "").strip(),
        })
    return jsonify({"documentos": resultado})


@app.route("/api/documento", methods=["GET"])
def baixar_documento():
    """Proxy autenticado: busca um anexo do portal com o cookie salvo e o
    devolve ao navegador. Assim o documento abre mesmo sem o usuario ter uma
    sessao ativa do portal no proprio navegador."""
    if not cookie_header():
        return "Cookie nao configurado.", 400

    caminho = request.args.get("path", "")
    if not caminho.startswith(ARQUIVOS_PREFIXO):
        return "Caminho de documento invalido.", 400

    # quote() converte espacos/acentos do nome do arquivo em %XX, mantendo as
    # barras. O caminho chega aqui ja decodificado pelo Flask.
    url = URL_PORTAL + quote(caminho, safe="/")
    try:
        r = portal_get(
            url, headers={"Referer": f"{URL_PORTAL}/AcompanharPE/Index"},
            stream=True, timeout=120,
        )
    except requests.RequestException as e:
        return f"Falha de rede ao baixar o documento: {e}", 502

    if r.status_code != 200:
        return (
            f"HTTP {r.status_code} ao baixar o documento. "
            "O cookie pode ter expirado — atualize na secao Configuracao."
        ), 400

    content_type = r.headers.get("Content-Type", "application/octet-stream")
    # Cookie expirado costuma redirecionar para a tela de login (HTML).
    if content_type.startswith("text/html"):
        return (
            "O portal retornou uma pagina HTML em vez do arquivo — "
            "provavelmente o cookie expirou. Atualize na secao Configuracao."
        ), 400

    nome = caminho.rsplit("/", 1)[-1] or "documento"
    nome_ascii = nome.encode("ascii", "ignore").decode("ascii") or "documento"
    resp = Response(
        stream_with_context(r.iter_content(chunk_size=8192)),
        content_type=content_type,
    )
    resp.headers["Content-Disposition"] = (
        f'inline; filename="{nome_ascii}"; filename*=UTF-8\'\'{quote(nome)}'
    )
    return resp


@app.route("/api/sessao", methods=["GET"])
def status_sessao():
    """Estado do ultimo keep-alive — a interface usa para mostrar se a
    sessao continua ativa."""
    return jsonify(_sessao_status)


def ping_sessao() -> None:
    """Requisicao minima so para renovar o .ASPXAUTH. Atualiza _sessao_status."""
    headers = {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://projetoseletricos.energisa.com.br/ProjetoEletrico",
    }
    params = {
        "cpf": CPF, "valorDig": "", "_search": "false", "nd": "1",
        "rows": "1", "page": "1", "sidx": "", "sord": "desc",
    }
    try:
        r = portal_get(URL_API, params=params, headers=headers, timeout=30)
        ok = r.status_code == 200 and \
            r.headers.get("Content-Type", "").startswith("application/json")
        if ok:
            _marcar_sessao(True, "sessao ativa")
        else:
            _marcar_sessao(False, "cookie expirou — atualize em Configuracao")
    except requests.RequestException as e:
        _marcar_sessao(False, f"falha de rede: {e}")


def keepalive_loop() -> None:
    """Thread em segundo plano: pinga o portal periodicamente para manter o
    .ASPXAUTH vivo (a janela e deslizante de ~4h). Faz um ping imediato no
    inicio e depois um a cada KEEPALIVE_MIN minutos."""
    while True:
        if cookie_header().strip():
            ping_sessao()
            estado = "ok" if _sessao_status["ok"] else "FALHOU"
            print(f"[keep-alive] {datetime.now():%H:%M:%S} - {estado}: "
                  f"{_sessao_status['msg']}", flush=True)
        time.sleep(KEEPALIVE_MIN * 60)


def main() -> None:
    print("Servidor rodando em http://localhost:1289")
    print(f"Keep-alive da sessao ativo (ping a cada {KEEPALIVE_MIN} min).")
    print("Pressione Ctrl+C para encerrar.")
    app.run(host="127.0.0.1", port=1289, debug=False)


# Inicializacao — roda tanto em 'python app.py' quanto sob o waitress (que
# importa este modulo). Carrega o cookie e liga o keep-alive uma unica vez.
carregar_cookie_memoria()
threading.Thread(target=keepalive_loop, daemon=True, name="keep-alive").start()


if __name__ == "__main__":
    main()
