# Metas Vision — Arauco Piên

Dashboard de metas de vendas (vendedores e gerentes regionais), separado por
canal (Indústria / Revenda), planta e tipo de material. A cada nova
importação, compara automaticamente com a última planilha importada no mesmo
mês e destaca o que mudou — útil porque a meta inicial (planejada) costuma
ser ajustada ao longo do mês.

Tem duas telas (abas no topo):

- **Mês atual** — o dashboard operacional: KPIs, gráficos, ranking de
  vendedores e o detalhamento de alterações (o que mudou desde a última
  importação). O rastreamento de alterações só aparece aqui, e só quando o
  mês selecionado é o mês mais recente já importado — abrir um mês anterior
  mostra apenas os registros finais dele, sem indicar o que mudou.
- **Histórico** — um painel "control room" com a evolução mês a mês de todos
  os meses já importados (linhas com brilho/glow, filtros dinâmicos de
  planta/canal/gerente e agrupamento por canal/planta/gerente/material). Cada
  mês entra aqui só com seu registro final (a última importação daquele mês),
  nunca com o passo a passo de revisões.

Portado a partir dos Artifacts do Claude: `index.html`.

## Como rodar localmente

Página HTML estática, sem build:

```bash
cd metas-vision
python3 -m http.server 8080
# depois abrir http://localhost:8080/index.html
```

## Stack

- SheetJS/xlsx (via CDN) para importar a planilha `.xlsx`.
- ExcelJS (via CDN, carregado sob demanda só ao clicar em "Exportar Excel")
  para gerar o `.xlsx` de saída com cores e formatação — o SheetJS gratuito
  não grava estilo de célula, só lê.
- Sem dependências de build — HTML/CSS/JS puro em um único arquivo.
- Sem servidor/backend: todo o histórico de importações fica salvo no
  `localStorage` do navegador (nada sai do dispositivo).

## Dados de referência

O arquivo já traz embutida a primeira importação real (`Meta inicial
(planejada)`, guia "Meta Vendedor" de `Meta_Vendas_Setembro_2026_v2.xlsx`),
usada como ponto de partida. As importações seguintes ficam guardadas como
revisões desse mesmo mês.

## Planilha esperada

O importador procura uma guia cujo nome contenha "Meta" e "Vendedor" (ex.:
**Meta Vendedor**) com estas colunas (a ordem pode variar, os nomes não):

`AnoMes | Vendedor | Gerente Regional | Filial | Linha | Meta | Indústria (m³) | Revenda (m³) | ... | META (m³)`

- **AnoMes** define o mês (`2026/09`) — cada mês guarda seu próprio
  histórico de importações, isolado dos demais.
- **Vendedor** e **Filial** no formato `CÓDIGO - Nome` (ex.: `B15 - VILMAR
  BRUNONI`, `PB06 - PIEN`).
- O canal (Indústria/Revenda) de cada linha é inferido de qual das colunas
  **Indústria (m³)** / **Revenda (m³)** vem preenchida.
- Se a coluna **META (m³)** (ajuste manual) vier preenchida, ela substitui a
  **Meta** original naquela linha.

## Funcionalidades

- **Importar planilha**: compara a nova guia "Meta Vendedor" com a última
  importação do mesmo mês (por vendedor + gerente + planta + material +
  canal) e reporta o que mudou — metas alteradas, registros novos e
  removidos. Se a planilha for idêntica à última importação, nada é
  duplicado no histórico.
- **KPIs animados**: meta total, indústria, revenda, nº de vendedores,
  gerentes e plantas, com variação (▲/▼) desde a importação anterior.
- **Gráficos**: meta por planta (Indústria x Revenda empilhado), por gerente
  regional e por tipo de material.
- **Ranking de vendedores**: tabela ordenável com meta por canal e variação
  desde a última importação.
- **Painel "O que mudou"**: lista detalhada de metas alteradas, novas e
  removidas entre as duas últimas importações do mês — só no mês mais
  recente (veja "Duas telas" acima).
- **Importações deste mês**: todas as versões importadas do mês selecionado,
  com data/hora, arquivo de origem e meta total.
- **Filtros**: planta, canal, gerente e busca por vendedor/material.
- **Aba Histórico**: gráfico de linha com brilho mostrando a evolução da
  meta entre todos os meses já importados (cada mês conta com seu registro
  final), com os mesmos filtros de planta/canal/gerente e um seletor para
  agrupar as linhas por canal, planta, gerente regional ou tipo de material
  (com até 5–6 linhas coloridas + "Outros" quando há mais entidades).
- **Exportar Excel**: gera um `.xlsx` tabelado e colorido, com "dados
  completos do mês" ou só a "view atual" (respeitando os filtros aplicados
  na tela). Sai com várias guias:
  - **Resumo** — indicadores gerais e contagem de mudanças desde a última
    importação.
  - **Detalhado** — uma linha por vendedor/planta/material/canal, com a
    coluna Canal colorida (azul = Indústria, laranja = Revenda) e, quando há
    importação anterior, colunas de antes/variação também coloridas.
  - **Por Planta**, **Por Material**, **Por Gerente** — tabelas dinâmicas
    com Indústria/Revenda/Total, mesma coloração por canal.
  - **Comparação** — só aparece quando existe uma importação anterior no
    mesmo mês: lista o que foi alterado, criado ou removido, com cor por
    tipo (verde = aumentou, vermelho = diminuiu, roxo = novo, cinza =
    removido).
