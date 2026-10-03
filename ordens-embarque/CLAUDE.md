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
