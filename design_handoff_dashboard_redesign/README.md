# Handoff: Redesign do Dashboard — Projetos Elétricos (Energisa)

## Visão geral
Este pacote contém o **redesign visual** do dashboard de Projetos Elétricos
(o `templates/index.html` + `static/style.css` + `static/app.js` do repositório
`EduardoaMelegari/energisa`). O objetivo é deixar a interface mais polida e
"corporate-clean" na identidade da Energisa (verde + navy), adicionar **dois
layouts** (tabela densa ⇄ cards) e **modo claro/escuro**, mantendo a **mesma
estrutura de dados e o mesmo comportamento** que o app já tem hoje.

## ⚠️ Sobre os arquivos deste pacote (leia primeiro)
Os arquivos aqui são uma **referência de design feita em HTML/React** — um
protótipo que mostra a aparência e o comportamento desejados. **Não é para
copiar e colar no projeto.** O teu app real é **Flask + JavaScript puro** (sem
React), com a lógica toda em `static/app.js` (fetch para `/api/...`,
ordenação, filtros, modais, barra de progresso de observações etc.).

**A tarefa é recriar este visual dentro do ambiente que já existe**, ou seja:
- Reaproveitar a lógica e os endpoints que já estão em `static/app.js`.
- Trocar o **CSS** (`static/style.css`) pelos tokens e componentes deste design.
- Ajustar o **markup** gerado em `templates/index.html` e nas funções de
  renderização do `app.js` (`renderizarTabela`, `pintarVistoria`,
  `pintarObservacao`, modais) para casar com as novas classes CSS.
- Adicionar as **novidades**: toggle Tabela/Cards, modo claro/escuro, faixa de
  estatísticas, e os "badges" fortes de Novo / Status mudou.

Nada do backend (`app.py`, rotas, cookie de sessão, vistoria) precisa mudar.

## Fidelidade
**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamentos e estados estão
definitivos. Use os valores exatos da seção *Design Tokens* e do arquivo
`styles.css` deste pacote. O `styles.css` é **agnóstico de framework** — pode
ser portado quase 1:1 para o `static/style.css`, só trocando os nomes de classe
quando necessário.

---

## Mapeamento: protótipo (React) → app real (Flask + JS puro)

| No protótipo (referência) | No teu projeto |
|---|---|
| `styles.css` (tokens + componentes) | vira o novo `static/style.css` |
| `components.jsx` `TableRow` | guia para o HTML que `renderizarTabela()` cria por linha |
| `components.jsx` `ProjectCard` | nova função `renderizarCards()` em `app.js` |
| `components.jsx` `VistCell` / `ObsCell` | guia para `pintarVistoria()` / `pintarObservacao()` |
| `components.jsx` `DocsModal` / `VistoriaModal` | aplicar as classes `.modal*`, `.doc-*`, `.vform`, `.dropzone` aos modais que já existem no `index.html` |
| `components.jsx` `ProgressBar` | aplicar classes `.progress*` ao bloco `#progresso` existente |
| `app.jsx` faixa de stats / toolbar / toggle | HTML novo no `index.html` + listeners no `app.js` |
| `data.js` | **descartar** — é só mock; os dados reais vêm de `/api/atualizar` |
| Tweaks panel (dark/densidade/destaque) | virar um botão simples de tema no header (ver "Modo escuro") |

---

## Telas / Views

### 1. Dashboard (tela principal)
**Propósito:** listar todos os projetos elétricos, destacar novos e mudanças de
status, permitir filtrar, ver documentos, solicitar vistoria e ler observações.

**Layout (container):** centralizado, `max-width: 1320px`, padding
`22px 26px 80px` (em telas ≤640px: `14px 12px 90px`).

Estrutura vertical, nesta ordem:
1. **Top bar** — lockup da marca à esquerda + (pill de sessão · botão Atualizar) à direita.
2. **Faixa de estatísticas** — 4 cards (Projetos / Novos / Status mudou / Vistorias a solicitar).
3. **Toolbar** — busca + 3 selects de filtro + (à direita) toggle Tabela/Cards.
4. **Legenda** — pills explicando as cores.
5. **Barra de progresso** (só visível durante o carregamento de observações).
6. **Conteúdo** — tabela OU grade de cards.
7. **Rodapé** — "Última atualização… · X de Y projetos".

#### Top bar
- **Brand mark:** quadrado `38×38px`, `border-radius: 10px`, fundo verde
  `--brand`, ícone de raio branco centralizado, sombra
  `0 4px 12px rgba(87,168,43,.35)`.
- **Brand text:** "energisa" (peso 800, 19px, `letter-spacing:-.02em`) +
  subtítulo "Projetos Elétricos" (12.5px, peso 600, `--text-2`).
- **Pill de sessão:** `border-radius: 999px`, fundo `--surface`, borda
  `--border`, bolinha verde com halo. Texto "Sessão ativa · verificada HH:MM".
  Estado de erro: classe `.err` → bolinha e texto vermelhos (`--st-reprovado`).
  → Ligar isto ao `/api/sessao` que o app já consulta a cada 60s.
- **Botão Atualizar:** `.btn .btn-primary` (fundo `--brand`, texto branco; no
  dark o texto fica `#06210a`). Com ícone de refresh; durante o fetch, ícone
  gira (classe `.spin`) e texto vira "Atualizando…".

#### Faixa de estatísticas (`.stats`)
Grid de 4 colunas (`repeat(4,1fr)`, gap 12px; em ≤760px vira `repeat(2,1fr)`).
Cada `.stat`: fundo `--surface`, borda `--border`, `border-radius:12px`,
padding `14px 16px`, sombra `--shadow-sm`.
- `.k` (rótulo): 12px, peso 700, uppercase, `letter-spacing:.04em`, `--text-2`.
- `.v` (valor): 30px, peso 800, `letter-spacing:-.03em`, `font-variant-numeric:tabular-nums`.
- Card "Novos": classe `.accent-new` → valor em `--brand-ink`, barra vertical
  de 4px (`.corner`) em `--new-bar` na borda direita.
- Card "Status mudou": classe `.accent-chg` → valor em `--chg-badge`, barra
  `--chg-bar`.
- Valores vêm de: total = `projetos.length`; novos = `diff==="novo"`;
  alterados = `diff==="alterado"`; vistorias a solicitar =
  `vistoria_disponivel && !vistoria_solicitada`.

#### Toolbar (`.toolbar`)
Flex com `gap:10px`, `flex-wrap:wrap`, fundo `--surface`, borda, raio 12px,
padding 12px.
- **Busca** (`.search`): input com ícone de lupa absoluto à esquerda (12px).
  Input: padding `10px 12px 10px 38px`, fundo `--surface-2`, borda
  `--border-strong`, raio 8px. Foco: borda `--brand` + halo
  `0 0 0 3px color-mix(in srgb, var(--brand) 22%, transparent)`. `flex:1`,
  `min-width:220px`. Filtra por NUM_PE, proprietário, tipo, rua, status e
  status anterior (mesma lógica do `renderizarTabela` atual).
- **3 selects** (`.select`, seta custom via `::after`): "Todos os status"
  (preenchido dinâmico), "Todos os destaques" (novo/alterado/destaque),
  "Vistoria: todas" (pendente/solicitada). Mesma lógica dos filtros atuais.
- **Botão "Limpar filtros"** (`.chip-clear`): aparece só quando há filtro ativo.
- **Toggle Tabela/Cards** (`.seg`, com `margin-left:auto`): segmented control,
  2 botões com ícone; o ativo recebe classe `.on` (fundo `--surface` + sombra).

#### Legenda (`.legend`)
Pills (`.lg`) com quadradinho/bolinha colorido: Novo (verde), Status mudou
(âmbar), Vistoria não solicitada (roxo, bolinha), Vistoria solicitada (cinza,
bolinha) + nota em `--text-3`.

#### Barra de progresso (`.progress`)
Reaproveitar o `#progresso` atual. Card com `border-left:4px solid --brand`;
ao concluir recebe `.done` (borda e barra ficam verdes `--st-aprovado`).
Trilha `.progress-track` (8px, raio 999, fundo `--surface-3`) + `.progress-bar`
(largura = % com `transition: width .3s`).

### 2. View de Tabela (`.table-wrap` > `.table-scroll` > `table.grid`)
- Wrapper: fundo `--surface`, borda, raio 12px, `overflow:hidden`; `.table-scroll`
  com `overflow-x:auto` para telas estreitas.
- **thead th:** uppercase 11.5px, peso 700, `--text-2`, fundo `--surface-2`,
  `position:sticky; top:0`. Colunas: # · Data · NUM_PE · Proprietário · Tipo ·
  Logradouro · Status · Vistoria · Observação.
- **tbody td:** padding `13px 14px`, borda inferior `--border`,
  `vertical-align:top`. Densidade compacta (opcional): classe `.density-compact`
  no wrapper reduz padding para `8px 14px`.
- **Linha normal:** classe `.normal`, hover → fundo `--surface-2`.
- **Linha NOVA:** classe `.row-new` → fundo `--new-bg`, barra esquerda
  `box-shadow: inset 4px 0 0 var(--new-bar)`. Badge `.row-badge.new` ("✦ Novo",
  fundo `--new-badge`) na célula NUM_PE.
- **Linha ALTERADA:** classe `.row-chg` → fundo `--chg-bg`, barra
  `--chg-bar`. Badge `.row-badge.chg` ("Status mudou") acima do status, e o
  status anterior aparece riscado (`.status-prev`).
- **Célula NUM_PE** (`.numpe-row`): badge (se houver) + número em fonte mono
  (`.numpe`) + botão `.mini-btn.docs` ("documentos").
- **Célula Status** (`.status-wrap`): badge de mudança (se alterado) + `.status`
  (bolinha colorida `.sd` por status + label) + botão `.mini-btn.seen`
  ("marcar como visto") quando `diff` existe.
- **Célula Vistoria** → ver componente VistCell abaixo.
- **Célula Observação** → ver componente ObsCell abaixo.
- **Estado vazio** (`.empty-state`): ícone + "Nenhum projeto encontrado" +
  "Ajuste os filtros…".

### 3. View de Cards (`.cards` > `.card`)
- Grade responsiva: `repeat(auto-fill, minmax(330px, 1fr))`, gap 14px; 1 coluna
  em ≤480px. **Default = cards quando a tela é ≤600px** (mobile).
- `.card`: fundo `--surface`, borda, raio 12px, padding 16px, `display:flex`
  coluna com `gap:12px`. Hover → `--shadow-md`. Faixa superior de 4px
  (`.topline`) colorida quando novo/alterado. Variантes `.row-new`/`.row-chg`
  (fundo tonalizado + borda colorida).
- Conteúdo: cabeçalho (NUM_PE mono + data, e badge à direita) → nome do
  proprietário (peso 800, 16px) → tag de tipo → endereço com ícone de pin →
  divisor → status + botão "visto" → vistoria → divisor → observação →
  rodapé com botão "documentos".

### Componente: VistCell (célula/bloco de vistoria)
Três estados (a regra já existe no backend; replicar a apresentação):
1. **Solicitada** (`vistoria_solicitada`): `.vist.vist-done` → "Vistoria
   solicitada" (bolinha cinza), sub "em DD/MM/AAAA HH:MM" (ou "(detectada pelo
   portal)" se `vistoria_origem==="externo"`), e nome do arquivo em mono
   (`.vist-file`).
2. **Disponível** (`vistoria_disponivel`): botão `.btn-vist` (roxo
   `--st-vistoria`, branco) "Solicitar vistoria" → abre o modal de vistoria.
3. **Bloqueada** (demais status): botão `.btn-vist[disabled]` (cinza), com
   `title` "Disponível apenas com status 'Projeto Aprovado' (atual: …)".

### Componente: ObsCell (observação)
- Carregando (`precisa_buscar_obs` e sem texto): `.obs-loading` com skeleton
  animado (`.skeleton`) + "buscando…".
- Com texto: `.obs-text` (`white-space:pre-wrap`, `max-height:5.2em`, scroll) +
  botão `.mini-btn` "rebuscar". Em erro: texto vermelho.
- Buscado e vazio: "(sem observação)" + "rebuscar".
- Nunca buscado: botão "buscar observação".
→ Liga aos POST `/api/observacao` que o app já faz (incl. a fila com
`carregarObservacoesPendentes` e a barra de progresso).

---

## Interações & comportamento (manter o que já existe)
- **Atualizar:** POST `/api/atualizar` → reordena, popula filtro de status,
  dispara carga de observações pendentes com a barra de progresso (lotes de
  ~500ms, igual hoje). Trata 401 → redireciona para `/login`.
- **Marcar como visto:** POST `/api/marcar_visto` → zera `diff` e
  `status_anterior`, reordena (novos→alterados→resto) e re-renderiza.
- **Ordenação:** novos primeiro, depois alterados, depois por NUM_PE
  (ano de 2 dígitos desc, prefixo desc). Função `chaveOrdenacao`/`ordenarProjetos`
  já implementada — manter.
- **Documentos:** POST `/api/documentos` → preencher o modal com `.doc-item`
  (ícone + descrição + arquivo em mono + botão "abrir" que aponta para
  `/api/documento?path=…`).
- **Solicitar vistoria:** modal com **dropzone** (`.dropzone`) que aceita
  arrastar-soltar OU clique; valida `.zip`/`.rar`; envia `FormData` para
  `/api/vistoria/solicitar`; mostra status (info/ok/erro) e, no sucesso, marca a
  linha como solicitada. Bloquear fechar enquanto envia.
- **Toggle Tabela/Cards:** só troca a renderização no cliente; guardar a escolha
  em `localStorage` (ex.: `energisa_layout`).
- **Transições:** modais entram com `pop` (0.2s), overlay com `fade` (0.18s),
  progresso com `slidedown`. Botão refresh gira (`.spin`, 0.8s linear).
- **Responsivo:** stats 4→2 colunas; cards 1 coluna no celular; tabela rola
  horizontalmente dentro de `.table-scroll`.

## Modo escuro
O CSS já traz o tema escuro completo via atributo no `<html>`:
`document.documentElement.setAttribute("data-theme", "dark" | "light")`.
Sugestão: um botão de sol/lua no header que alterna o atributo e salva em
`localStorage` (ex.: `energisa_theme`). Todas as cores são variáveis CSS, então
basta alternar o atributo — nenhum estilo precisa ser duplicado.

## Estado (no cliente, igual hoje)
- `projetos` (array vindo de `/api/atualizar`), e por projeto: `NUM_PE`,
  `CodEmp`, `Data`, `Proprietario`, `Tipo`, `Logradouro`, `Status`,
  `status_anterior`, `diff` (`"novo"|"alterado"|""`), `vistoria_solicitada`,
  `vistoria_disponivel`, `vistoria_origem`, `vistoria_data`, `vistoria_arquivo`,
  `Observacao`, `precisa_buscar_obs`, `obs_fetched`, `obs_erro`, `documentos`.
- Novos no front: `layout` ("table"|"cards") e `theme` ("light"|"dark"),
  ambos persistidos em `localStorage`.

## Design Tokens
Ver `styles.css` (bloco `:root` e `[data-theme="dark"]`). Resumo (tema claro):

**Marca**
- `--brand: #57a82b` · `--brand-ink: #356b18` · `--brand-soft: #eaf4e0`
- `--navy: #0e2c44` · `--navy-soft: #16344d`

**Neutros (claro)**
- `--bg: #eef1f3` · `--surface: #ffffff` · `--surface-2: #f6f8f9`
- `--surface-3: #eef2f4` · `--border: #e1e7ea` · `--border-strong: #cdd6da`
- `--text: #11242f` · `--text-2: #5c6b75` · `--text-3: #85939c`

**Destaques (fills fortes)**
- Novo: `--new-bg: #e3f3d6` · `--new-bar: #57a82b` · `--new-badge: #2f7d12`
- Alterado: `--chg-bg: #fdeecb` · `--chg-bar: #e0a100` · `--chg-badge: #946100`

**Bolinhas de status**
- Aprovado `#2f9e44` · Análise `#2f7fd1` · Pendência `#d97706` ·
  Vistoria `#7c5cff` · Reprovado `#d64545` · Concluído `#0e9a8a`

**Tema escuro:** ver bloco `[data-theme="dark"]` (bg `#0a1620`, surface
`#102230`, brand `#6fc23a` etc.).

**Forma & sombra**
- Raio: `--radius:12px` · `--radius-sm:8px` · `--radius-lg:16px`
- `--shadow-sm: 0 1px 2px rgba(14,44,68,.06), 0 1px 3px rgba(14,44,68,.05)`
- `--shadow-md: 0 4px 14px rgba(14,44,68,.08)` ·
  `--shadow-lg: 0 18px 50px rgba(8,24,38,.28)`

**Tipografia**
- UI: **Hanken Grotesk** (Google Fonts), pesos 400–800.
- Mono (NUM_PE, nomes de arquivo): **JetBrains Mono**, pesos 500–700.
- Import: `https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap`

## Ícones
Conjunto de SVGs inline (stroke, `currentColor`) em `components.jsx` (objeto
`Ic`): search, refresh, bolt (marca), pin, doc, upload, check, eye, x, table,
grid, clock, inbox, spark. São pequenos e podem ser copiados direto como SVG no
HTML/JS. Não dependem de nenhuma biblioteca.

## Assets
Nenhum asset binário. A "logo" é um quadrado verde com um ícone de raio em SVG
(placeholder simples) — se houver o logo oficial da Energisa, substituir o
`.brand-mark` por uma `<img>`.

## Arquivos deste pacote
- `Energisa Dashboard.html` — protótipo navegável (abra no navegador para ver tudo funcionando).
- `styles.css` — **tokens + CSS de todos os componentes** (a peça mais reaproveitável).
- `components.jsx` — referência de markup por componente (tabela, card, células, modais, progresso, ícones).
- `app.jsx` — referência de composição da página (stats, toolbar, filtros, ordenação, toggle, tema).
- `data.js` — apenas dados mock (descartar na implementação real).
- `PROMPT_PARA_CLAUDE_CODE.md` — prompt pronto para colar no Claude Code.
