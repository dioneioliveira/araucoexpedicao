# Arauco Warehouse Vision — Manual de uso e passagem do sistema

Versão do documento: novembro/2026 · Arquivo do sistema: `warehouse-vision/index.html` (revisão `rev-2026-10-08a`, commit `3a6ed39`)
Repositório: `dioneioliveira/araucoexpedicao` · Branch publicada: `claude/estoque-3d-chat-view-89v1k8`

---

## 1. O que o sistema faz

Mostra **em 3D o estoque de cada unidade, posição a posição (Box)**, a partir de planilhas Excel exportadas do SAP. Unidades atendidas:

| Unidade | Local | Boxes no layout |
|---|---|---|
| PB22 | Ponta Grossa | 318 |
| PB23 | Monte Negro | 229 |
| PB25 | Jaguariaíva | 278 |
| PB26 | Piên | 298 |

O que se vê e se faz no sistema:

- **Planta 3D** com a ocupação de cada Box (cor por % da capacidade), **Curva ABC** (cor por classe A/B/C) e **Estoque por Idade** (dias desde a data de produção).
- **Filtros** por classe e por família; **busca** por posição ou código de material; clique no Box para ver itens, lotes, classe, família e data.
- **Importar**: lê a planilha da unidade e atualiza capacidade, estoque, classe e família.
- **Exportar**: baixa um Excel com o estoque Box a Box, lote a lote.
- **Botão vermelho "N correções"**: baixa o **Relatório de divergências** (tudo que não fecha na base, com onde e como corrigir).
- Tema claro/escuro, botão **i** (instruções dentro do próprio sistema) e seletor de planta (a dica do seletor mostra o tamanho da planta e a versão).

> Os **layouts estão fechados**. Só mudam sob solicitação, junto com uma amostra do novo layout (regra do dono do sistema). O Importar nunca altera geometria.

---

## 2. Como abrir e passar para outra pessoa

O sistema é **um único arquivo HTML** (`warehouse-vision/index.html`, ~1 MB), sem instalação e sem servidor próprio.

**Formas de usar**

1. **Link publicado** (GitHub Pages do repositório): `https://dioneioliveira.github.io/araucoexpedicao/warehouse-vision/` — funciona se o Pages estiver ativo (Settings → Pages → branch `claude/estoque-3d-chat-view-89v1k8`, pasta raiz).
2. **Arquivo**: enviar o `index.html` e a pessoa abre com duplo clique no Chrome/Edge.
3. **Passar a manutenção**: dar acesso ao repositório e entregar este manual. Quem for alterar o sistema edita o `index.html` (arquivo único) e publica na mesma branch.

**Requisitos e limites (importante)**

- **Precisa de internet** para carregar duas bibliotecas de um CDN: Three.js 0.160 (3D) e SheetJS 0.18.5 (leitura/escrita de Excel). Sem acesso a `cdn.jsdelivr.net` e `cdnjs.cloudflare.com`, o 3D e o Importar não funcionam. Para ambientes fechados é preciso gerar uma versão autocontida (bibliotecas embutidas) — ver seção 9.
- **Os dados importados ficam no navegador de cada pessoa** (armazenamento local). Quem recebe o arquivo **vê a planta vazia** (ou com o estoque antigo gravado de PB25/PB26) até importar a base da unidade. Não há compartilhamento automático de dados entre usuários.
- Limpar os dados do navegador apaga a importação; basta importar de novo.
- Usar **Chrome ou Edge atualizados**.

---

## 3. Como atualizar o estoque (passo a passo)

1. Abra o sistema e escolha a **planta** no seletor (topo, ao lado do nome).
2. Clique em **Importar** e escolha a planilha da unidade (`.xlsx`).
3. Leia o **relatório de importação** que abre à direita (resumo, detalhes e avisos).
4. Confira o botão vermelho **"N correções"**. Se aparecer, baixe o relatório e corrija a base (seção 6).
5. Use **Exportar** para ter o estoque Box a Box em Excel.
6. Depois de corrigir a planilha, **importe de novo**: o sistema recalcula tudo (a importação substitui a anterior da mesma planta).

### 3.1 Estrutura da planilha (base padrão de todas as unidades)

A planilha precisa ter estas guias (o nome é reconhecido sem diferenciar maiúsculas/acentos):

| Guia | Colunas reconhecidas | Para que serve |
|---|---|---|
| **Capacidade** (ou "Capacidade por Box") | `Box` (código) e a coluna de volume `M3` / `Capacidade (m³)` | m³ de cada Box. Célula em branco = capacidade ainda não informada. |
| **Cadastro** (ou `Cadastros`, `Classe`, `ABC`) | `Material` (ou `Item`/`SKU`), `Descrição` (ou `Texto breve material`), `Classe` / `ABC` / `Curva`, `Família` | **Define quais materiais são válidos**; traz a curva A/B/C e a família. |
| **LX02** | `Material`, `Lote`, `Posição no depósito` (ou `PosDepósit`), `Estoque disponível` (ou `Est.disp.`), `Texto breve material`, `Data da entrada de mercadorias` (ou `Data EM`) | Estoque por lote, posição e data de produção. |
| MB52 (opcional) | `Material`, `Lote`, `Utilização livre`, `Controle qualidade`, `Texto breve material` | Se existir, é ela que dá a quantidade (livre + qualidade) e a LX02 só dá posição e data. |

A LX02 pode ser a lista bruta do SAP (cabeçalho na linha 7, com linhas negativas de transferência) ou uma versão limpa — o sistema trata as duas.

---

## 4. Regras de cálculo (o que conta e o que não conta)

1. **Volume do lote = chapas × m³ da chapa**. O m³ da chapa vem das dimensões escritas na **descrição** do material (`comprimento x largura x espessura`, ex.: `2750x1850x15MM`; moldura `MOL…` também). Se a descrição não tiver as medidas, usa a descrição do Cadastro; sem medidas em nenhum lugar o volume do lote **não é calculado** (vira divergência).
2. **LX02 pelo saldo líquido por lote** (quando não há MB52): somam-se todas as linhas do lote, **positivas e negativas** (as transferências são abatidas). O saldo é alocado nas posições com saldo positivo, **Box real primeiro**, depois as demais posições. Linhas sem lote contam como itens próprios (só linhas positivas).
3. **O Cadastro define o que é estoque válido.** Material que **não consta no Cadastro não conta em nenhum total nem aparece no 3D** — aparece só nos relatórios para ser cadastrado.
4. **Depósito 0072**: posições `0072_BP1/2/3` (e qualquer `0072_…`) **não são Box**; são **desconsideradas em todos os dados** (3D e totais). O dep. 0072 só vale quando o material está em posição de Box do 3D.
5. **No 3D só entra volume que está em Box do layout com capacidade.** O que está em posição sem Box (ALMOX, docas, bins, OVERFLOW…) ou em produção **soma no "estoque total" do topo**, mas **não é desenhado**.
6. **Material inutilizado** (família "Inutilizado" ou descrição terminada em `I/--/---`) ocupa o Box fisicamente, mas **fica fora dos totais da empresa**.
7. **Capacidade em branco**: o estoque aparece nos Boxes, mas a ocupação % e o alerta de "acima da capacidade" ficam indisponíveis até a capacidade chegar.
8. **Box acima da capacidade** (>100%) fica em vermelho.
9. **Cor do Box na Curva ABC** = classe do material de **maior volume** do Box; o painel do Box lista todos os materiais.
10. **Idade** = dias desde a data de produção do lote (a mais antiga do Box, no 3D).

---

## 5. O que o Excel "Exportar" contém

Arquivo `PBxx_estoque_por_box_AAAA-MM-DD.xlsx`, com cinco abas:

| Aba | Conteúdo |
|---|---|
| **Estoque por Box** | Uma linha por lote: Box, item, descrição, família, classe, lote, volume, chapas, m³/chapa, data de produção, dias, inutilizado, **Conferência** (OK ou o problema do lote), observação, corredor, capacidade e volume do Box. Boxes vazios aparecem com uma linha. |
| **Resumo por Box** | Uma linha por Box (itens, lotes, chapas, volume, ocupação %, classe/item/família dominantes, data mais antiga, lotes a conferir) e o **bloco de reconciliação**. |
| **Conferência da base** | Verificações com contagem, m³, status (Corrigir/Informativo/OK) e onde corrigir. |
| **Cadastro para completar** | Todos os materiais em estoque no formato da guia Cadastro (Material, Descrição, Classe, Família) com o que falta; os fora do Cadastro primeiro. |
| **Fora do 3D** | Cada lote que não está num Box, com o motivo (posição fora do layout, Box sem capacidade, em produção, sem posição na LX02, material fora do Cadastro, 0072). |

Sem importar nada (por exemplo, PB25/PB26 com estoque gravado), o Excel sai **por Box**, sem detalhe de lote, e avisa isso.

---

## 6. Relatório de divergências (botão vermelho "N correções")

Arquivo `PBxx_divergencias_AAAA-MM-DD.xlsx`. Reúne **tudo que não fecha nas visões**, para corrigir a base e reimportar. Abas:

- **Resumo** — por tipo de divergência: gravidade, itens, lotes, m³, onde corrigir e o que fazer.
- **Divergências** — uma linha por coisa a corrigir (material, posição/Box ou lote), com *o que está errado, como corrigir, onde corrigir* e o peso em lotes e m³; a coluna **Status** é para preenchimento manual. Tem filtro.
- **Fechamento** — prova de que nada sumiu: linhas lidas → lotes com saldo → destino (Box 3D, fora do layout, produção, desconsiderados, ignorados) e comparação com o total do topo. A linha **"Diferença não explicada" deve ser 0**; se não for, a linha diz `DIVERGE`.
- **Cadastro para completar** — igual ao do Exportar.
- **Capacidade para completar** — Boxes sem capacidade e códigos da guia Capacidade que não existem no layout, com coluna para preencher.

**Gravidade**

- **Corrigir** — a base está incompleta/errada (conta no número "N correções").
- **Conferir** — precisa de um olhar humano.
- **Informativo** — só explica um número (sem ação).

**Tipos de divergência**

| Tipo | Onde corrigir |
|---|---|
| Material fora do Cadastro (desconsiderado) | Cadastro: incluir a linha do material |
| Material sem classe / classe fora de A-B-C | Cadastro: coluna Classe/ABC/Curva |
| Material sem família | Cadastro: coluna Família |
| Material repetido no Cadastro com dados diferentes | Cadastro: deixar uma linha (vale a última) |
| Material sem dimensões na descrição | Descrição do material (comprimento x largura x espessura) |
| Lote sem data de produção | LX02: Data EM / data da entrada de mercadorias |
| **Posição sem Box no layout (falta posição real)** | LX02: informar o Box real; se for área nova, enviar amostra do layout |
| Box do layout sem capacidade / estoque em Box sem capacidade | Guia Capacidade: coluna m³ |
| Código da Capacidade sem Box no layout | Conferir o nome do Box (layout só muda sob solicitação) |
| Lote sem posição na LX02 | LX02: lote ausente |
| Box acima da capacidade | Capacidade ou excesso/duplicidade de estoque |
| LX02 diferente da MB52 | Conferir linhas duplicadas/transferências (só com MB52) |
| Lote com saldo zerado (linha positiva no Box anulada) | LX02: linhas do lote |
| Lote em 2+ Boxes, Box com vários materiais, 0072, em produção | Informativo |

---

## 7. Resultado de referência (bases "Vision 3D" de 09/10/2026)

Use para conferir se o sistema está funcionando igual ao validado. Valores em m³ (total que conta / dentro dos Boxes do 3D):

| Unidade | Total válido | Em Box (3D) | Descartado 0072 | Fora do Cadastro | Correções |
|---|---|---|---|---|---|
| PB22 | 17.592 | 13.800 | 730 | 13.829 | 359 |
| PB23 | 39.033 | 38.252 | 0 | 1.205 | 12 |
| PB25 | 28.622 | 23.124 | 431 | 15.905 | 147 |
| PB26 | 22.270 | 21.243 | 291 | 2.175 | 44 |

Em todas, o Fechamento do relatório de divergências dá **diferença 0**.

**Pontos de atenção conhecidos dessas bases**

- **PB22 e PB25**: o Cadastro enviado **não traz os substratos (MDF ST…)**; por isso a regra do Cadastro tira ~45% (PB22) e ~36% (PB25) do estoque dos totais. Completar o Cadastro (aba "Cadastro para completar") e reimportar.
- **PB23**: a guia Capacidade está **vazia** e lista nomes do layout antigo (21 códigos que não existem hoje e 10 Boxes do layout ausentes). Enquanto isso o estoque aparece e a ocupação % fica indisponível.
- **PB25**: capacidade real agora informada (antes havia 23 m³ provisório); 19 códigos da Capacidade sem Box no layout (ALMOX1-3, E00, F10, G00, J07, L01–L12…).
- **PB26**: posição `OVERFLOW` (≈1.257 m³) não é Box; a guia Planilha2 traz 63 rótulos de Box que o layout do sistema não tem (A16–A26, D11–D18, F09–F17, G01–G05, H13–H28, P14–P26) — **layout não foi alterado**.
- PB25 e PB26 trazem estoque **gravado de uma data antiga** no arquivo; só passam a refletir a base nova depois de importar.

---

## 8. Perguntas frequentes

**Abri e a planta está vazia.** Normal: os dados ficam no navegador de cada pessoa. Importe a planilha da unidade.

**O Importar não faz nada / dá erro.** Confira se a internet está liberada para `cdnjs.cloudflare.com` e `cdn.jsdelivr.net` (bibliotecas) e se a planilha tem as guias Capacidade, Cadastro e LX02. Veja as mensagens de erro no relatório de importação.

**O total do topo caiu muito depois de importar.** Provavelmente muitos materiais estão fora do Cadastro (regra 3). Veja "Material fora do Cadastro" no relatório de divergências e complete o Cadastro.

**Aparece "N correções" mesmo sem importar.** Em PB25/PB26 o sistema já traz estoque gravado e o relatório sai por Box (sem curva, sem família, acima da capacidade).

**A posição "0072_BP…" sumiu.** É regra: dep. 0072 só vale em Box do 3D; o m³ aparece no relatório como "Desconsiderado".

**Um Box novo apareceu na planilha mas não no 3D.** O layout é fechado. Envie a amostra do novo layout ao responsável pelo sistema.

**A cor do Box não bate com um item.** O Box mostra a classe do material de maior volume; clique no Box para ver todos os materiais.

---

## 9. Para quem vai manter o sistema

- **Arquivo único**: `warehouse-vision/index.html` (HTML + CSS + JavaScript). Não há build.
- **Bibliotecas** (por CDN): Three.js `0.160.0` e SheetJS `0.18.5`. Para uso sem internet, é preciso trocar por cópias embutidas no arquivo.
- **Dados por planta**: blocos `SEED_DATA_PB22/PB23/PB25/PB26` (layout; **não alterar sem pedido e amostra**). A constante `SEED_BUILD` invalida dados antigos do navegador quando o layout muda.
- **Dados do usuário**: ficam no `localStorage` (`warehouseVision.plantData.<planta>` para a planta; `warehouseVision.lotExport.<planta>` para o detalhe de lotes do Excel).
- **Funções principais**: `runImport` (leitura da planilha), `computeEstoqueFromSAP` (estoque, saldo por lote, regras 3 e 4), `computeCapacidadeFromRows`, `computeCadastrosFromRows`, `buildStockExportWorkbook` (Exportar), `computeDivergences` / `buildDivergenceWorkbook` (relatório).
- **Publicação**: commit e push na branch `claude/estoque-3d-chat-view-89v1k8`; se o GitHub Pages estiver ativo, atualiza sozinho em 1–2 minutos. Na raiz do repositório há um `index.html` que redireciona para `warehouse-vision/`.
- **Teams/SharePoint**: uma biblioteca de documentos do SharePoint **não abre `.html` no navegador** (apenas baixa). Para exibir o 3D dentro do Teams/SharePoint é preciso hospedar o arquivo em um endereço aprovado pela TI e embuti-lo (aba de site do Teams ou web part "Incorporar"). Excel/Power BI não fazem esse 3D.

---

## 10. Checklist de passagem

- [ ] Receber o `index.html` (e este manual) e abrir no Chrome/Edge com internet.
- [ ] Selecionar cada planta e importar a planilha da unidade.
- [ ] Conferir o Fechamento do relatório de divergências (diferença 0) e os valores da seção 7.
- [ ] Completar Cadastro (substratos de PB22/PB25) e Capacidade (PB23) e reimportar.
- [ ] Definir quem recebe a amostra de layout para futuras mudanças.
- [ ] Combinar onde o arquivo ficará hospedado (link, repositório ou TI).
