# Deploy — Docker + Cloudflare Tunnel

App de Projetos Eletricos rodando em container, exposto pela internet com
login/senha, atraves de um Cloudflare Tunnel ja existente na maquina.

> Este setup assume que voce **ja tem um `cloudflared` rodando no host** (para
> outros containers/servicos). Ele NAO sobe um `cloudflared` proprio — voce
> apenas adiciona um novo hostname ao tunnel que ja usa.

## Visao geral da seguranca

- **Login obrigatorio**: toda pagina e API exigem sessao autenticada.
- **Porta so no localhost**: o container publica a porta em `127.0.0.1:1289` —
  alcancavel pelo `cloudflared` do host, mas NAO pela rede local nem pela
  internet. O unico caminho de entrada externo e o tunnel.
- **HTTPS**: fornecido pelo Cloudflare na borda; o cookie de sessao usa as
  flags `Secure`, `HttpOnly` e `SameSite=Lax`.
- **Anti-forca-bruta**: 5 tentativas de login erradas por IP bloqueiam por 5 min.
- **Segredos fora do codigo**: credenciais e chaves ficam no `.env` (ignorado
  pelo git e pela imagem).

## Passo a passo

### 1. Pre-requisitos
- Docker e Docker Compose instalados.
- Um `cloudflared` ja rodando no host, ligado a um tunnel da sua conta Cloudflare.

### 2. Configurar o `.env`
Copie o modelo e preencha:

```
copy .env.example .env        (Windows)
cp .env.example .env          (Linux/Mac)
```

- `APP_USERNAME` / `APP_PASSWORD`: o login e a senha de acesso. Use uma senha forte.
- `SECRET_KEY`: gere uma com `python -c "import secrets; print(secrets.token_hex(32))"`.
- `COOKIE_SECURE`: deixe `true` (so mude para `false` em teste local sem HTTPS).

### 3. Preparar os dados
A pasta `data/` guarda o `cookie.txt` e o `snapshot.json` (persistem entre
reinicios do container). Garanta que `data/cookie.txt` exista com um cookie
valido — ou cole-o depois pela tela de Configuracao do app.

### 4. Subir o container
```
docker compose up -d --build
```

O app fica disponivel para a maquina em `http://localhost:1289`.

### 5. Apontar o tunnel existente para o app
No tunnel que voce ja usa, adicione um novo **Public Hostname**:

- **Pelo painel** (Zero Trust > Networks > Tunnels > seu tunnel > Public Hostname):
  - Subdominio/dominio: o endereco publico desejado (ex.: `projetos.seudominio.com`).
  - **Service**: `HTTP` -> `localhost:1289`.

- **Ou por arquivo de config** (`config.yml` do cloudflared), em `ingress`:
  ```yaml
  ingress:
    - hostname: projetos.seudominio.com
      service: http://localhost:1289
    # ... suas outras regras ...
    - service: http_status:404
  ```
  Depois recarregue o cloudflared.

Acesse pela URL publica, faca login e pronto.

### Atualizar o app depois de mudancas
```
docker compose up -d --build
```

## Recomendado: Cloudflare Access (camada extra)
Para blindar ainda mais, ative **Cloudflare Access** no hostname (Zero Trust >
Access > Applications). Ele exige autenticacao **na borda da Cloudflare** antes
de a requisicao chegar ao app — o login/senha do app continua valendo como
segunda camada.

## Observacoes
- A imagem usa `waitress` com **1 processo + threads**: o app mantem estado em
  memoria (cookie da sessao, thread de keep-alive), entao NAO use multiplos
  processos/workers.
- Se algum dia quiser que o proprio compose suba o `cloudflared` (em vez de usar
  o do host), basta adicionar um servico `cloudflared` com o token do tunnel.
- O `consultar_status.py` (gerador de Excel) e um utilitario separado, nao faz
  parte do container.
