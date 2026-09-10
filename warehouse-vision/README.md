# Warehouse Vision — Arauco Piên (PB26)

Visão 3D do estoque do armazém PB26, com posições reais (ruas/boxes), ocupação, classificação por Curva ABC (Pareto sobre faturamento dos últimos 12 meses) e visualização por idade de estoque.

Portado a partir dos Artifacts do Claude:
- Desktop: `index.html`
- Mobile (com joystick de navegação por toque): `mobile.html`

## Como rodar localmente

São páginas HTML estáticas, sem build. Basta servir a pasta:

```bash
cd warehouse-vision
python3 -m http.server 8080
# depois abrir http://localhost:8080/index.html (desktop)
# ou       http://localhost:8080/mobile.html  (mobile)
```

## Stack

- Three.js (via CDN, `three@0.160.0`) para a cena 3D.
- SheetJS/xlsx (via CDN) para importar planilhas `.xlsx` com as guias `layout`, `capacidade`, `faturamento` e `estoque`.
- Sem dependências de build — HTML/CSS/JS puro em um único arquivo cada.

## Funcionalidades

- Modos: Planta 3D, Curva ABC, Estoque por Idade, Dashboard de KPIs.
- Importação de planilha `.xlsx` para atualizar layout, capacidade, faturamento e posições de estoque.
- Modo "Demo" para carregar dados de exemplo sem alterar a planta real.
- Busca por posição ou SKU, painel de detalhe por box, controles de câmera (livre/topo/isométrica).
- `mobile.html` adiciona um joystick on-screen e sheets deslizantes para navegação por toque.

## Dados atuais

Os dois arquivos já trazem os dados de layout e estoque da planta PB26 embutidos (`const DATA = {...}` no início do `<script type="module">`). Para atualizar, use o botão **Importar** dentro da própria aplicação.
