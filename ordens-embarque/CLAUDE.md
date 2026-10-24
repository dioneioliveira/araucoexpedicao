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
- Texto grande da célula A41 (carga), em `destaque()`: cliente ARAUCO MADERAS ou MADERAS ARAUCO => "EXPORTAÇÃO TERRESTRE";
  todos os textos de A41 ficam sobre o desenho da carreta com opacidade 0.7 (30% transparentes); material com "EB/" => "BREAKBULK"; container na janela de mercado interno => "CABOTAGEM"
  (`isCabotagem`, também marca os N/A); janela container => "CONTAINER". Nessa ordem de prioridade.
- Cópia "Dados EXP terrestre" (`copyText('expterr')`, botão `#d-expterr` só quando `isAraucoMaderas`): formato exato
  `EXP 1000000123-Motorista NOME-CPF 123456789-89- Placas AAA1234PR/BBB7894PR` (CPF 9 dígitos-2 dígitos; truck só uma placa).
- Cópia "Placa p/ nota": `0001` + quebra de linha + placa da carreta com UF (Controle OT T3:T4).
- Tela inicial: 4 botões `data-colar` (ordem | MI | CONTAINER | ots) → `colarPorBotao` lê a área de
  transferência (ou abre `#paste-dialog`) → `processarColagem(text, html, tipo)`; Ctrl+V solto usa tipo null
  (detecção). Solicitação de Embarque sempre vira "ordem".
- Peças por pallet só do padrão da descrição (`matInfo`: P/xx/NNN, ou moldura `/HCnnnn` = nnnn chapas por lote); **sem fallback** (antes pegava os 3 últimos caracteres:
  "HC1144" → 144, "14,5" → 4). Item sem o padrão: `pallets` nulo, `T.verificarQtd`, total de lotes não calculado; chip
  "verificar quantidade" no painel/lista, aviso no painel e "VERIFICAR QUANTIDADE" (tarja) na C23 do check-list.
- "carga fracionada" (`isFracionada`): qtd ÷ peças por lote quebrado em qualquer item (moldura ou outro) ou no total;
  sai na C23 em tarja preta com letras brancas (`.tarja`), também no total da separação.
- "amostra" na carga (`isAmostra`: descrição, texto comercial ou observação) => "Amostra-conferir cliente"
  na célula C23 (ao lado dos lotes), junto de "carga fracionada" se houver.
- Compartilhamento entre usuários (`js/sync.js`, `OESync`): arquivo .json na pasta de rede via File System
  Access API (Chrome/Edge); atalho do arquivo no IndexedDB. Estado achatado em registros com horário
  (`item:`, `man:<t>|<campo>`, `printed:`, `snap:`, `fat:`, `fatnf:`, `ot:`, `sew:`, `fsc`) + exclusões
  (`tomb`); `mergeDocs` = mais recente vence. Dados reais ficam nesse arquivo da rede, nunca no repositório.
- Uso simultâneo (2–3 pessoas, Chrome, pasta no servidor): modo **pasta** (`openFolder` → `showDirectoryPicker`, atalho
  `sharedDir` no IndexedDB). Na pasta: `ordens-embarque-dados.json` (mesmo formato), `fotos/<id>.jpg` (fotos dos
  containers; `OEF.setRemoto(sync.fotos)`: grava local + pasta, busca na pasta o que não tem). **Perfis fixos** (não se criam
  usuários): `OESync.PERFIS` = Faturamento ADM, Faturamento EXP, Controladores, ADM; um por computador
  (`arauco.ordensEmbarque.usuario`, select `#sync-user`, "Trocar perfil…" com confirmação). Cada perfil tem um arquivo fixo
  na pasta (`Faturamento ADM.json`…) com a presença (ordem aberta, a cada ≤10 s; vale por 30 s): o app **só atualiza** esses
  arquivos (criados uma única vez em `garantirPerfis` ao configurar/conectar a pasta oficial; não existe mais `presenca/`).
  Sem perfil (`logado()` falso) o computador só lê: não grava arquivo mãe, fotos nem relatórios. Verificação a cada 4 s.
  Cada registro guarda `by` (o perfil): alterações de outros geram aviso "Fulano atualizou o transporte X". Antes de gravar,
  confere se o arquivo mudou desde a leitura e junta de novo (não apaga a gravação do colega). `renderSemAtrapalhar`
  redesenha com os dados dos colegas mantendo foco, cursor e rolagem de quem digita (o digitado já está no estado).
  Presença: chip amarelo com o nome na lista, aviso no painel (`#d-presenca`) e "n online" no topo.
- **Pasta oficial** (a fonte dos dados é a pasta, não o computador): identificação `ordens-embarque-pasta.json` (id, caminho,
  quem criou). `escolherPasta` → `conectarPasta`: pasta sem identificação e sem dados é recusada (`PASTA_NAO_OFICIAL`, nada é
  gravado nela); criar a oficial só pelo detalhe "Primeira configuração" (opção `nova`); pasta antiga com dados ganha a
  identificação; pasta oficial diferente da que o computador usava pede confirmação (`PASTA_KEY`). Ao conectar, vale o que
  está na pasta (`adotar`: os dados locais são descartados). Época no arquivo (`epoca`): mudou → o computador adota a pasta.
  A cópia de controle do sync fica no IndexedDB (`syncMeta`), não no localStorage. Aviso vermelho fixo `#aviso-pasta` quando
  não está gravando na pasta oficial; a configuração abre sozinha sem pasta ou sem nome. Modo arquivo solto removido da tela.
- FSC (célula V23:X23, ao lado da OT): planilha FSC importada (`parseFSC`, arquivo via SheetJS ou colagem) →
  `state.fsc` + `state.fscInfo` (sincronizados), salvos na hora ao ler o arquivo/colagem (`salvarFSC`, sem botão Importar). `fscOf` relaciona pelo nome do cliente (exato → `nomeChave`
  sem acentos/pontuação/LTDA/S.A. → prefixo 12+ → 85% das palavras); exclusão sem reingresso = inativo.
  Override por transporte: `manual.fscSel` = SIM | NAO.
- LT22 real = lista SAP em colunas fixas: `parseLT22Lista` (OT=1º token, material=2º, remessa = número de 8–10
  dígitos após "qtd UMA tpDest", zeros à esquerda removidos; Tp./posição de origem guardados).
- Exportação (`isExport`): container | Arauco Maderas | breakbulk | material P/E → `pagesFor` acrescenta
  `buildSeparacao` (A4 em pé, linhas da LT22; só se `comSeparacao`: exportação terrestre/Arauco Maderas e breakbulk
  NÃO levam romaneio de separação; no topo, faixa `.sp-key` com OT(s) + QR code, transporte e container) e
  `buildIdentificador` (só container: `comIdentificador` = janela CONTAINER) (A4 deitado, `@page ident`, textos
  `data-fit` ajustados por `fitBig`). Botões no painel imprimem só um deles (`imprimirAvulso`).
- Painel da ordem: meia tela (`.drawer` max(50vw, 860px)); ações na coluna `#d-actions` (imprimir, separação,
  identificador, cópias "Dados de texto (VL02N/texto)", "Placa p/ nota (VL02N/placa)", "Dados do motorista (VT02N)",
  balança, faturar, excluir).
- Visual da tela inicial: campo Transporte compacto (coluna 330–430px, fonte 30px), 5 botões de colagem numa linha
  alinhados com o campo (3 colunas abaixo de 1500px); ícones: lista com bandeira verde (ordem), caminhão grade baixa
  (botão MERCADO INTERNO), container (botão CONTAINER), lista (LT22), árvore (FSC); contadores
  em etiquetas pequenas (`.kpi` em linha); lista diária em destaque com legenda; linha impressa verde com
  "Impressa hh:mm", alterada vermelha, faturada esmaecida. Rodapé `.credit` com o crédito do autor.
- Lista diária inclui agendamentos sem ordem (`agendamentosSemOrdem` → `linhaAgendamento`, `tr.ghost`, chip
  "Não impressa"): agendamentos SEW do dia não ligados a nenhum transporte pela placa da carreta (um agendamento
  por transporte, horário mais próximo). Não entram em seleção, impressão, contadores nem relatório.
- Guia Pesos (`renderPesos`/`analisePesos`): base importada (`parsePesos`, títulos flexíveis; chave NF) em
  `state.pesos` (sync `peso:`); NF liga à carga via `manual.nf` (`nfParaTransporte`). kg/pç = peso / qtd
  (média ponderada por material e mês), comparação com o mês anterior e tolerância ±% (`pesoUI.tol`).
- Balança (guia Pesos, card `#bl`): tabela diária colada com **Ticket** + peso entrada/saída/líquido (`parseTickets`,
  títulos flexíveis, toneladas → kg) → `state.tickets` (sync `tk:`; colar de novo o mesmo ticket substitui). Ligação
  ticket → ordem por `manual.ticket` (Controle OT), senão transporte/NF/placa+data da tabela (`transporteDoTicket`).
  Itens e lotes (qtd ÷ peças por lote do texto do material) vêm da ordem (ou da tabela, se tiver material). Carga mista:
  rateio do peso por NF da carga → média da base de pesos → volume da chapa → quantidade (`registrosBalanca`).
  Cada carga de um item é um ponto do gráfico SVG (`svgBalanca`): kg/lote (ou kg/peça) no tempo, média, faixa ±tol,
  pontos fora em vermelho com a diferença na carga inteira em kg (desvio × lotes).
  Planilha do **Guardian** (Relatório de Permanências: título repetido antes de cada pesagem — Veículo, Carreta, Ticket,
  Cod., Data/Hora, Bruto, Tara, Líquido, Permanência; ticket com zero à esquerda e espaços): lida por `parseTickets`
  (Carreta = placa, Veículo = cavalo; títulos repetidos são ignorados). "Importar arquivo"/colar na guia Pesos tenta
  primeiro a tabela da balança e só depois a base de pesos por NF. Ligação pelo ticket informado na ordem; placa+data
  só com uma única ordem possível e sem ticket. **Só entram cargas com uma entrega e um único material**
  (sem mistura de itens; as demais vão para `variasEntregas`, listadas nas pendências com o motivo).
- Fotos do container (`js/fotos.js` = `OEF`; UI em `fotosHTML`/`bindFotos`): carga com container (`temContainer` = janela
  CONTAINER ou cabotagem) tem 6 posições (`OEF.SLOTS`: porta, ric, lacre, f4–f6). Imagens comprimidas (JPEG) no
  IndexedDB `arauco-ordens-fotos` deste computador; em `state.fotos[t]` (sync `foto:`) só nomes e dados lidos
  (`lido[slot][campo]`). Importação de várias fotos sem renomear (`importarFotos`): ignora fotos já guardadas
  (`sig` = nome|tamanho|data), não troca posições preenchidas (importar aos poucos); posição pelo nome, senão pelo
  conteúdo (OCR + `OEF.classificar`: porta = TARE/MAX GROSS, RIC = folha com container + lacre, lacre = só o código);
  sem OCR, a foto mais "folha branca" (`papelBranco`) vai para o RIC; o resto vai para f4–f6 e depois às vagas.
  Fotos faltando: chip "n/6 faltam x" (lista e Agendamentos), contagem no cabeçalho da janela de containers,
  KPI "Fotos faltando" e nomes das posições vazias na conferência (`faltandoFotos`). Leitura automática opcional
  (Tesseract.js via CDN, `OEF.ocr`): um único worker reaproveitado (`carregarOCR`), fontes jsDelivr e, se bloqueado,
  unpkg; estado em `OEF.estadoOCR()` mostrado na seção (`.ft-ocr`: disponível / indisponível com o motivo). Na importação,
  TODA foto que fica em Porta/RIC/Lacre é lida (também as posicionadas pelo nome do arquivo); sem prazo curto no
  carregamento (1ª vez baixa ~6 MB). **Nunca adivinhar**: só vale o que foi lido exatamente (container = 4 letras +
  7 dígitos com dígito verificador ISO 6346 certo, sem trocar letras parecidas; lacre igual ao escrito; peso na linha do
  rótulo, em KG — LBS não é convertido —, dentro da faixa: tara 1–10 t, max gross 10–40 t; mais de um nº possível =
  não escolhe). Placa da porta (`pesosPorta`): MAX GROSS = TARE + PAYLOAD; três valores em KG que fecham a soma (única
  combinação) definem tara e max gross mesmo com rótulo mal lido; leitura que contradiz a soma = ILEGÍVEL. Campo esperado e não lido com certeza = `ILEGÍVEL`
  (`OEF.ILEGIVEL`), que não entra na comparação mas impede o "confere" (status `ileg`, chip amarelo "ilegível"). A foto do RIC (modelo real: comprovante "Gate Out" em inglês sobre a
  Solicitação de Embarque Arauco, com o lacre físico na mesma foto) tem os campos container ("Container No"),
  contOrdem ("Número Container" da ordem; OCR lê "Nidmero"), lacre ("Seal No"), lacreFis (código repetido na foto),
  tara ("Tare/Gross Weight", 1º número) e mwg ("Max Gross Weight"). OCR no arquivo original (até 3200 px); imagens
  guardadas a 2400 px e reduzidas a 1280 px no e-mail. `validarFotos`: container (Controle OT/agendado × porta × RIC ×
  ordem na foto, aviso se o SEW difere), lacre (Controle OT × RIC × lacre físico × foto do lacre), tara e MWG
  (Controle OT × RIC × porta); confere com o agendado + ao menos uma foto, qualquer diferença = divergente → `fotoChip`.
  Fotos com dados (decisão do usuário): só **Porta fechada** (container, tara, mwg) e **RIC + lacre** (RIC sobre a
  ordem, lacre ao lado, foto de perto); "Lacre (detalhe)", "Interior vazio", "Carga amarrada" e "Foto 6" não têm campos.
  Rótulos tolerantes (`M[AO0][XKH] G[RP][AO0@Q][S5$]` = "Mox Grass", "MAK.GROSS"; `T[AE]R[EA]`; `S[EC][AE]L`; "K6" = KG;
  rótulo numa linha e número sozinho na de baixo); o número continua exato. `PADRAO_MWG` = 32500: "32.500 KG" na porta é
  o max gross, e valor diferente gera aviso na conferência. Leitura em 2 passadas (`dadosJuntos`: normal psm 3 + canal
  azul invertido psm 11 para pintura clara em porta escura; leituras que discordam = ILEGÍVEL). Fotos inteiras de
  WhatsApp (1600 px) quase não são legíveis: o caminho confiável é **"Ler área"** (`#zoom-dialog`, clique na foto):
  zoom, retângulo sobre o texto, `OEF.recortar` amplia o recorte (até 4×) e lê só ele; valores lidos substituem
  vazio/ILEGÍVEL/"auto", nunca o digitado.
  E-mail do container (`#mail-dialog`): EXP, container e lacre em destaque + fotos; `.eml` com `X-Unsent: 1` e imagens
  `cid:` (abre como rascunho no Outlook), ou copiar HTML com as fotos.
- Semana (`#btn-mes` "Semana", `#mes-dialog`, `dadosPeriodo`/`excelMes`/`fecharSemana`/`verificarFechamento`): **fechamento
  semanal automático todo domingo às 22:40** (`ultimoCorte`; se nenhum computador estiver aberto, no primeiro que abrir depois,
  com a pasta oficial conectada e sincronizada). Fecha tudo com data até o domingo: grava Excel (abas Resumo, Transportes,
  Itens, Por dia, Agendamentos, OTs, Pesagens) e backup JSON em `arquivo/` da pasta oficial (sem gravar na pasta = não fecha),
  baixa o Excel, guarda as pesagens em `state.histBalanca` e zera o app (ficam cargas/agendamentos/tickets com data depois do
  domingo, FSC e histórico; base de pesos sai). `state.fechamentos` (sync `fech`) registra o último corte; na primeira vez só
  marca o corte atual. `sync.resetar()` grava o estado novo com **época** nova; os outros computadores adotam a época sem
  tombstones. Botões: relatório da semana em andamento (sem zerar) e "Fechar a semana agora". Sem SheetJS não fecha.
- Controle OT depois da OT (`pendenciasOT`, `OT_MIN`): com OT informada, Doc (mín. 6), NF-e (mín. 5) e Ticket (mín. 5)
  sempre; container/cabotagem também EXP, Nº container, Lacre (mín. 5), Tara (mín. 4) e MWG. Padrões calculados em
  `makeTransport` (`T.otPadrao`, não gravados): mercado interno "-" em EXP, container, lacre, tara e MWG; container MWG
  32500. `semValor` ("-" = vazio) em `isCabotagem`. Painel: aviso vermelho `#ot-pend` e campos `.f.ot-falta`. Não bloqueia:
  ordem já impressa com pendências mostra popup (`avisoPendOT`) ao fechar o painel (X, fundo, Esc), ao "Marcar como
  faturada" e ao lançar a NF-e ("Preencher agora" mantém o painel aberto).
- Lista diária: coluna Container (após OT), filtro `#cont-filter` (todos / com nº / sem) e busca por container e lacre.
- Redução de carga (bloco Materiais do painel, `#red-flag`): `manual.reducao` = { ativo, qtd: {itemKey: qtd nova}, motivo,
  em, por }. `makeTransport` aplica: `qtd` = nova, `qtdOriginal`, `palletsOriginal`, `reduzido`; pallets e peso = total
  antigo ÷ qtd antiga × qtd nova (`regra3`). Vale para lista, check-list (ordem impressa antes vira "Com alterações"),
  relatórios, Excel semanal (coluna "Redução de carga") e análise de peso da balança. Quantidade nova maior que a da ordem
  é recusada. "E-mail da redução" (`htmlReducao`/`emailReducao`): copia HTML ("Prezados, segue informação de redução de
  carga." + Motivo + dados da carga + tabela antes → nova) e abre o e-mail.
- Lotes à mão: item sem peças por lote na descrição ganha o campo `input[data-lotes]` no painel → `manual.lotes[itemKey]`;
  `makeTransport` usa como pallets (`lotesManual`), some o "verificar quantidade". A balança também usa esses lotes.
- Guia **Exportar tickets** (`data-view="expo"`, `dadosTickets`/`linhaTicket`/`exportarTickets`, período `exUI`): uma linha por
  ticket do Controle OT com agendamento (`T.sew`), transporte, material, qtd, lotes, peso da balança (`state.tickets`) e ticket com
  7 dígitos; só cargas com 1 entrega e 1 material (resto em "Desconsiderados" com motivo). Também vai como aba "Tickets 1 material"
  no Excel semanal. A importação do Guardian/análise da balança continua (o usuário pediu para não remover ainda).
