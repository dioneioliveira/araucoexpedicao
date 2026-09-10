# Warehouse Vision — Arauco Piên

Visão 3D do estoque das unidades Arauco Piên, com posições reais (ruas/boxes), ocupação, classificação por Curva ABC (Pareto sobre faturamento dos últimos 12 meses) e visualização por idade de estoque.

## Plantas (multi-unidade)

Um menu suspenso no topo (`Selecionar planta`) alterna entre **PB26, PB25, PB23 e PB22**. Cada planta importa e guarda seus próprios dados de forma isolada (capacidade, faturamento, estoque), salvos no `localStorage` do navegador — trocar de planta nunca mistura dados entre unidades.

- **PB26** já vem com a geometria real (ruas e boxes) e o estoque carregados.
- **PB25, PB23 e PB22** começam como um pátio vazio (sem ruas/boxes cadastrados) até que a planta baixa de cada unidade seja gerada e embutida no arquivo — o importador da própria aplicação só atualiza capacidade/faturamento/estoque de posições que já existem, ele não cria geometria nova. Para habilitar uma dessas plantas de verdade, envie a planilha de layout (ruas e boxes) dessa unidade.
- Trocar de planta recarrega a página lendo os dados salvos daquela unidade (ou o pátio vazio, se ainda não houver nada importado).

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

Os dois arquivos já trazem os dados de layout e estoque da planta PB26 embutidos (`const SEED_DATA_PB26 = {...}` no início do `<script type="module">`), usados como base para a unidade PB26. Para atualizar qualquer planta, selecione-a no menu suspenso e use o botão **Importar** dentro da própria aplicação — a importação fica salva no navegador e é restaurada automaticamente da próxima vez que essa planta for aberta.
