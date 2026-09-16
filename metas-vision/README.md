# Metas Vision — Arauco Piên

Dashboard de metas de vendas (vendedores e gerentes regionais), separado por
canal (Indústria / Revenda), planta e tipo de material. A cada nova
importação, compara automaticamente com a última planilha importada no mesmo
mês e destaca o que mudou — útil porque a meta inicial (planejada) costuma
ser ajustada ao longo do mês.

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
  removidas entre as duas últimas importações do mês.
- **Histórico de importações**: todas as versões importadas por mês, com
  data/hora, arquivo de origem e meta total.
- **Filtros**: planta, canal, gerente e busca por vendedor/material.
