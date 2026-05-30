# Prompt pronto para o Claude Code

Cole o texto abaixo no Claude Code, **na raiz do repositório `energisa`**, com a
pasta `design_handoff_dashboard_redesign/` presente no projeto.

---

> Quero aplicar um redesign visual no dashboard de Projetos Elétricos deste
> repositório (Flask + JS puro). A referência de design está em
> `design_handoff_dashboard_redesign/` — leia o `README.md` dele primeiro, ele
> explica tudo em detalhe.
>
> **Importante:** os arquivos `.jsx` e o `Energisa Dashboard.html` da pasta são
> apenas REFERÊNCIA (protótipo em React). NÃO migre o app para React. Mantenha a
> arquitetura atual: Flask + `templates/index.html` + `static/style.css` +
> `static/app.js`, e preserve TODA a lógica e os endpoints `/api/...` que já
> funcionam (atualizar, observação, documentos, vistoria, marcar visto, sessão).
> O `data.js` da pasta é mock — ignore.
>
> Faça o seguinte:
>
> 1. **Substitua o `static/style.css`** pelo conteúdo de
>    `design_handoff_dashboard_redesign/styles.css` (tokens + componentes). Ele é
>    agnóstico de framework. Adicione no `templates/index.html` o import das
>    fontes Hanken Grotesk + JetBrains Mono (link do Google Fonts está no README).
>
> 2. **Atualize o markup de `templates/index.html`** para a nova estrutura:
>    top bar com lockup da marca + pill de sessão + botão Atualizar; faixa de 4
>    cards de estatística; toolbar com busca + 3 selects + toggle Tabela/Cards;
>    legenda; bloco de progresso; e o container de conteúdo. Aplique as classes
>    novas (`.topbar`, `.stats`, `.toolbar`, `.seg`, `.legend`, `.progress`,
>    `.table-wrap`, etc.) conforme o README.
>
> 3. **Ajuste as funções de renderização em `static/app.js`** para gerar o HTML
>    com as novas classes:
>    - `renderizarTabela()` → linhas com `.row-new`/`.row-chg`, badges
>      `.row-badge`, células `.numpe-row`, `.status-wrap`, `.mini-btn` etc.
>    - `pintarVistoria()` → estados `.vist`/`.btn-vist` (3 estados do README).
>    - `pintarObservacao()` → `.obs-text`, `.skeleton`, `.mini-btn`.
>    - Modais de documentos e vistoria → classes `.modal*`, `.doc-*`, `.vform`,
>      `.dropzone` (inclua o drag-and-drop no input de arquivo da vistoria).
>    - Bloco de progresso → classes `.progress*`.
>    - Preencha os 4 cards de estatística a partir do array `projetos`.
>
> 4. **Adicione as duas novidades:**
>    - **Toggle Tabela ⇄ Cards:** um segmented control na toolbar; crie uma
>      função `renderizarCards()` (layout de card descrito no README) e alterne
>      entre as views; persista a escolha em `localStorage` (`energisa_layout`).
>      Em telas ≤600px, default = cards.
>    - **Modo claro/escuro:** botão sol/lua no header que faz
>      `document.documentElement.setAttribute('data-theme', ...)` e salva em
>      `localStorage` (`energisa_theme`). O CSS já tem o bloco
>      `[data-theme="dark"]` completo — não duplique estilos.
>
> 5. **Não toque no backend** (`app.py`, rotas, cookie, vistoria, keep-alive).
>
> Mantenha tudo em pt-BR. Ao final, rode o app localmente e confira: lista
> carrega, filtros funcionam, novos/alterados destacados e fixados no topo,
> marcar como visto, modais de documentos e vistoria, barra de progresso de
> observações, toggle de layout e dark mode. Me mostre um diff por arquivo.

---

## Dica de fluxo
- Comece pedindo só o **passo 1 + 2** (CSS + markup do `index.html`) e rode o app
  para ver a base já com a cara nova. Depois peça **3**, depois **4**. Fazer em
  blocos deixa cada diff menor e mais fácil de revisar.
- Se algo do visual não bater, abra o `Energisa Dashboard.html` da pasta no
  navegador lado a lado e aponte a diferença para o Claude Code.
