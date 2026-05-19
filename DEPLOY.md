# Deploy — Docker + Cloudflare Tunnel

App de Projetos Eletricos rodando em container, exposto pela internet com
login/senha e atras de um Cloudflare Tunnel.

## Visao geral da seguranca

- **Login obrigatorio**: toda pagina e API exigem sessao autenticada.
- **Sem porta exposta na maquina**: o container do app usa `expose` (rede
  interna do Docker), nao `ports`. O unico caminho de entrada e o tunnel.
- **HTTPS**: fornecido pelo Cloudflare na borda; o cookie de sessao usa as
  flags `Secure`, `HttpOnly` e `SameSite=Lax`.
- **Anti-forca-bruta**: 5 tentativas de login erradas por IP bloqueiam por 5 min.
- **Segredos fora do codigo**: credenciais e chaves ficam no `.env` (ignorado
  pelo git e pela imagem).

## Passo a passo

### 1. Pre-requisitos
- Docker e Docker Compose instalados.
- Uma conta Cloudflare com um dominio.

### 2. Configurar o `.env`
Copie o modelo e preencha:

```
copy .env.example .env        (Windows)
cp .env.example .env          (Linux/Mac)
```

- `APP_USERNAME` / `APP_PASSWORD`: o login e a senha de acesso. Use uma senha forte.
- `SECRET_KEY`: gere uma com `python -c "import secrets; print(secrets.token_hex(32))"`.
- `COOKIE_SECURE`: deixe `true` (so muda para `false` em teste local sem HTTPS).
- `TUNNEL_TOKEN`: preenchido no passo 4.

### 3. Preparar os dados
A pasta `data/` guarda o `cookie.txt` e o `snapshot.json` (persistem entre
reinicios do container). Garanta que `data/cookie.txt` exista com um cookie
valido — ou cole-o depois pela tela de Configuracao do app.

### 4. Criar o Cloudflare Tunnel
1. Painel **Cloudflare Zero Trust** > **Networks** > **Tunnels** > **Create a tunnel**.
2. Tipo **Cloudflared**. De um nome e copie o **token** exibido para `TUNNEL_TOKEN` no `.env`.
3. Em **Public Hostname**, adicione:
   - Subdominio/dominio: o endereco publico desejado (ex.: `projetos.seudominio.com`).
   - **Service**: `HTTP` -> `app:1289`  (nome do servico do compose, na rede interna).

### 5. Subir
```
docker compose up -d --build
```

Acompanhe os logs:
```
docker compose logs -f
```

Acesse pela URL do tunnel, faca login e pronto.

### Atualizar o app depois de mudancas
```
docker compose up -d --build
```

## Recomendado: Cloudflare Access (camada extra)
Para blindar ainda mais, ative **Cloudflare Access** no mesmo hostname (Zero
Trust > Access > Applications). Ele exige autenticacao **na borda da Cloudflare**
(e-mail com codigo, Google, etc.) antes mesmo de a requisicao chegar ao app —
o login/senha do app continua valendo como segunda camada.

## Observacoes
- Rode com **1 worker** (a imagem ja usa `waitress` com 1 processo + threads):
  o app mantem o cookie da sessao e a thread de keep-alive em memoria.
- O `consultar_status.py` (gerador de Excel) e um utilitario separado, nao
  faz parte do container.
