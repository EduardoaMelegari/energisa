"""
Consulta status de Projetos Eletricos no portal da Energisa.

Le `entrada.xlsx` (coluna NUM_PE com os IDs) e gera `saida.xlsx`
com o status de cada projeto consultando o endpoint:
  /ProjetoEletrico/GetListaProjetoEletrico

O cookie de sessao fica em `cookie.txt` (atualize quando expirar).
"""

import sys
import json
from datetime import datetime
from pathlib import Path

import requests
import pandas as pd


CPF = "5736193108"
URL = "https://projetoseletricos.energisa.com.br/ProjetoEletrico/GetListaProjetoEletrico"

SCRIPT_DIR = Path(__file__).parent
COOKIE_FILE = SCRIPT_DIR / "cookie.txt"
ENTRADA = SCRIPT_DIR / "entrada.xlsx"
SAIDA = SCRIPT_DIR / "saida.xlsx"


def carregar_cookie() -> str:
    if not COOKIE_FILE.exists():
        sys.exit(
            f"[ERRO] Arquivo nao encontrado: {COOKIE_FILE}\n"
            "Cole o header Cookie inteiro (copiado do DevTools) dentro dele."
        )
    cookie = COOKIE_FILE.read_text(encoding="utf-8").strip()
    if not cookie:
        sys.exit(f"[ERRO] {COOKIE_FILE} esta vazio.")
    if cookie.lower().startswith("cookie:"):
        cookie = cookie[len("cookie:"):].strip()
    return cookie


def carregar_ids() -> list[str]:
    if not ENTRADA.exists():
        sys.exit(
            f"[ERRO] Arquivo nao encontrado: {ENTRADA}\n"
            "Crie um Excel com uma coluna chamada NUM_PE contendo os IDs dos projetos."
        )
    df = pd.read_excel(ENTRADA, dtype=str)
    if df.empty:
        sys.exit(f"[ERRO] {ENTRADA} esta vazio.")
    if "NUM_PE" in df.columns:
        col = "NUM_PE"
    else:
        col = df.columns[0]
        print(f"[AVISO] Coluna 'NUM_PE' nao encontrada. Usando a primeira coluna: '{col}'")
    ids = (
        df[col]
        .dropna()
        .astype(str)
        .str.strip()
        .replace("", pd.NA)
        .dropna()
        .tolist()
    )
    if not ids:
        sys.exit(f"[ERRO] Nenhum ID valido encontrado em '{col}'.")
    return ids


def buscar_projetos(cookie: str) -> list[dict]:
    headers = {
        "Cookie": cookie,
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
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

    r = requests.get(URL, headers=headers, params=params, timeout=60)

    if r.status_code != 200:
        sys.exit(
            f"[ERRO] HTTP {r.status_code} ao consultar a API.\n"
            "Provavelmente o cookie expirou. Faca login novamente no portal, "
            "copie o cookie atualizado e cole em cookie.txt.\n"
            f"Inicio da resposta: {r.text[:300]}"
        )

    try:
        data = r.json()
    except json.JSONDecodeError:
        sys.exit(
            "[ERRO] Resposta nao e JSON. Provavelmente foi redirecionado para tela de login.\n"
            "Atualize o cookie.txt e tente novamente.\n"
            f"Inicio da resposta: {r.text[:300]}"
        )

    if isinstance(data, dict):
        for k in ("rows", "data", "Data", "Items"):
            if k in data and isinstance(data[k], list):
                return data[k]
        sys.exit(f"[ERRO] Formato inesperado de resposta: chaves = {list(data.keys())}")

    if isinstance(data, list):
        return data

    sys.exit(f"[ERRO] Tipo inesperado de resposta: {type(data).__name__}")


def main() -> None:
    print("[1/4] Carregando cookie e lista de IDs...")
    cookie = carregar_cookie()
    ids_solicitados = carregar_ids()
    print(f"      {len(ids_solicitados)} IDs lidos de {ENTRADA.name}")

    print("[2/4] Consultando a API da Energisa...")
    projetos = buscar_projetos(cookie)
    print(f"      {len(projetos)} projetos recebidos para o CPF {CPF}")

    print("[3/4] Cruzando com os IDs solicitados...")
    lookup = {str(p.get("NUM_PE", "")).strip(): p for p in projetos}

    linhas = []
    for pid in ids_solicitados:
        p = lookup.get(pid)
        if p is None:
            linhas.append({
                "NUM_PE": pid,
                "Encontrado": "Nao",
                "Status": "",
                "CodStatus": "",
                "Tipo": "",
                "Proprietario": "",
                "Logradouro": "",
            })
        else:
            linhas.append({
                "NUM_PE": pid,
                "Encontrado": "Sim",
                "Status": p.get("DSC_SITUACAO_PE") or "",
                "CodStatus": p.get("COD_SITUACAO_PE") or "",
                "Tipo": p.get("DSC_TIPO_PE") or "",
                "Proprietario": p.get("NOM_PROPRIETARIO_OBRA") or "",
                "Logradouro": p.get("DSC_LOGRADOURO") or "",
            })

    df_saida = pd.DataFrame(linhas)
    destino = SAIDA
    try:
        df_saida.to_excel(destino, index=False)
    except PermissionError:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        destino = SAIDA.with_name(f"{SAIDA.stem}_{timestamp}.xlsx")
        print(
            f"[AVISO] '{SAIDA.name}' parece estar aberto no Excel (sem permissao de escrita).\n"
            f"        Feche o arquivo e rode de novo para sobrescreve-lo.\n"
            f"        Por enquanto, salvando em: {destino.name}"
        )
        df_saida.to_excel(destino, index=False)

    encontrados = sum(1 for l in linhas if l["Encontrado"] == "Sim")
    print(f"[4/4] Pronto! {encontrados}/{len(linhas)} encontrados.")
    print(f"      Arquivo gerado: {destino}")


if __name__ == "__main__":
    main()
