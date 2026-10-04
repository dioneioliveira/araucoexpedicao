# Ordens de Embarque: regras do processo

- Toda impressão de ordem de embarque imprime **os dois check-lists**, nesta
  ordem: `veiculo` (Check list visual do veículo, FOR.BR.0016) e `carga`
  (Check List de Expedição, FOR.BR.017). Ver `pagesFor()` em `js/app.js`.
- Os formulários são documentos registrados: **nunca** editar à mão
  `templates/*.png`, `templates/*-modelo-oficial.pdf` nem `js/templates.js`.
  Eles são gerados a partir dos `.xlsm` oficiais com `tools/build_templates.py`.
  Dados só entram por cima, nas células de dados (mesmas da guia CKL / Check Vc).
- Entrada principal: Ctrl+C da página SEW "Solicitação de Embarque" e Ctrl+V no
  app (`parseSolicitacoes` em `js/parsers.js`). A coluna **Carga** da tabela de
  itens é o nº do transporte; `Origem` define a janela (PIEN CONTAINERS = container).
- Os dados de tabela seguem a guia `LOG` da planilha LOG-AGENDAMENTO (colunas
  A..Y) e a chave de ligação é o **Transporte** (LOG col. A).
- Janela de agendamento: `CONTAINER` quando a placa da carreta (7 primeiros
  caracteres) aparece na janela PIÊN CONTAINERS do SEW. Caso contrário,
  mercado interno.
- Repositório público: não versionar dados reais (CPF, nomes, placas, lista FSC).
  Eles ficam só no localStorage do navegador. Use apenas dados fictícios em exemplos.
- `ordens-embarque.html` (arquivo único) é gerado por `tools/build_single_html.py`:
  depois de mudar `index.html`, `css/`, `js/` ou `templates/`, gere de novo e versione junto.
- Guia Agendamentos: cada colagem da tela SEW é comparada com a anterior (chave janela|dia|senha,
  `mergeSew`); ao imprimir guarda-se um retrato dos dados impressos (`state.snap`). Ordem impressa
  com diferença => "Com alterações" (vermelho). Faturadas (`state.faturado`) vão para o fim da lista.
- Cópias: "Dados do motorista" sem rótulos (CPF, placas); "Dados de balança" = 13 colunas sem
  título, com Peso entrada/saída, Conferência 7%, Peso total e Status em branco.
- Guia OTs (3ª): colagem da tela de OTs do SAP (layout da guia `lt22`), ligada pela entrega
  (remessa). `state.ots` só acrescenta; ao faturar, a OT vai para `state.manual[t].ot` e a
  remessa sai da memória (colagens posteriores dessa remessa são ignoradas).
- NF-e informada (Controle OT do painel ou da planilha importada) => faturada (`aplicarNF`, `state.fatNf`).
  A lista diária não tem campo de NF-e.
  Exclusão de transportes direto na lista (`excluirTransportes`), sempre com confirmação.
- OTs: sem títulos, `parseOTs(grid, knownSets())` lê linha a linha (remessa conhecida/8xxxxxxx +
  número de 6–12 dígitos que não é material). Várias OTs => `T.otList`, impressas uma por linha.
- Relatório do dia (`relatorio()`): Excel (SheetJS; CSV sem internet), PDF (página nomeada
  `relatorio`, A4 paisagem) e e-mail (copia HTML com estilos inline + abre mailto).
- Texto grande da célula A41 (carga), em `destaque()`: cliente ARAUCO MADERAS => "EXPORTAÇÃO TERRESTRE"
  (opacidade 0.75); material com "EB/" => "BREAKBULK"; container na janela de mercado interno => "CABOTAGEM"
  (`isCabotagem`, também marca os N/A); janela container => "CONTAINER". Nessa ordem de prioridade.
- Cópia "Placa p/ nota": `0001` + quebra de linha + placa da carreta com UF (Controle OT T3:T4).
- Tela inicial: 4 botões `data-colar` (ordem | MI | CONTAINER | ots) → `colarPorBotao` lê a área de
  transferência (ou abre `#paste-dialog`) → `processarColagem(text, html, tipo)`; Ctrl+V solto usa tipo null
  (detecção). Solicitação de Embarque sempre vira "ordem".
