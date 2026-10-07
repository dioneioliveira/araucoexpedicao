# Ordens de Embarque — Arauco Piên

App de expedição para montar a **lista diária de carregamentos** e imprimir a
**ordem de embarque**: sempre os **dois check-lists oficiais**, já preenchidos.

| Ordem | Documento | Código |
|---|---|---|
| 1ª página | Check list visual do veículo | FOR.BR.0016 |
| 2ª página | Check List de Expedição (carga) | FOR.BR.017 |

A ordem das páginas é a mesma da macro `impress2026ordens` da planilha
LOG-AGENDAMENTO.

## Os documentos não são alterados

Os formulários são registrados e não podem mudar em nada. Por isso o app **não
redesenha** os check-lists:

1. `tools/render_template.py` abre a guia oficial do `.xlsm` no LibreOffice e
   exporta a página exatamente como ela é (mesma escala, margens, cabeçalho
   "For internal use only…", logos e imagens). Só as células de dados (as que
   no arquivo tinham fórmula e apareciam como `#REF!`) ficam vazias.
   Células vazias com texto girado (ex.: A54:D64 da carga) têm o giro zerado na
   renderização: no Excel o giro não aparece em célula vazia, mas o LibreOffice
   inclinava as bordas dos quadrinhos "Frontal".
2. Essa página vira o fundo da impressão (`templates/*.png`, 300 dpi). Uma
   cópia do PDF em branco fica em `templates/*-modelo-oficial.pdf`.
3. Os dados são escritos **por cima**, nas mesmas células que as guias `CKL` e
   `Check Vc` da planilha preenchem, com a fonte, o tamanho, a cor e o
   alinhamento da própria célula (`js/templates.js`, gerado automaticamente).

Se um formulário ganhar nova revisão, gere os modelos de novo:

```bash
soffice --headless --accept="socket,host=localhost,port=2002;urp;" &
pip install openpyxl pdfplumber pillow
python3 tools/build_templates.py check_list_da_carga.xlsm check_list_do_veiculo.xlsm /tmp
```

## Campos preenchidos

| Campo | Veículo | Carga | Origem (planilha) |
|---|---|---|---|
| Data | Data | DATA | LOG col. E |
| Motorista | Nome do Motorista | Nome do Motorista | LOG col. R |
| CPF | CPF | (Obs.) | LOG col. X / Y |
| Transportadora | Transportadora | Transportadora | LOG col. U |
| Placas | Carreta / Cavalo / Truck | Truck / Cavalo / Carreta 1 | LOG col. L e M (`-` em M = truck) |
| Pallets | — | Nº DOC (nº de pallets) | qtd ÷ peças por pallet (final da descrição, ex.: `P/EF/208`) |
| Carga fracionada | — | ao lado dos pallets | quando o total de pallets não é inteiro |
| OT + QR code | — | OT | Controle OT col. H (manual) |
| FSC | — | à direita da OT | lista de clientes FSC |
| CONTAINER e N/A | — | Disposição dos pallets, tipo de caminhão, lona | janela PIÊN CONTAINERS do SEW |
| Treinamento | — | Obs. | LOG col. S |
| Entrega / Transporte | — | abaixo de MAXGROSS/TARA | LOG col. F / A |

Campos obrigatórios para imprimir: **data, motorista, CPF, transportadora e placa**.
Se faltar algum, o app avisa antes de imprimir.

## Como usar

### Tela inicial

- **Transporte** (em destaque no topo): a referência de tudo. Digite o nº e pressione Enter.
- **Quatro botões de colagem**, sem precisar entrar nas guias: copie a tela no sistema
  (**Ctrl+A**, **Ctrl+C**) e clique no botão do processo:
  - **Importar ordem**: Solicitação de Embarque (SEW);
  - **Agendamento · Mercado interno**: Agendamento de Cargas, PIÊN PAINÉIS;
  - **Agendamento · Exportação**: Agendamento de Cargas, PIÊN CONTAINERS;
  - **LT22 · OTs**: tela de OTs por entrega.

  Na primeira vez, o navegador pede permissão para ler a área de transferência. Se não
  houver permissão, abre uma caixa: é só pressionar Ctrl+V nela. O botão define o
  processo. Exceção: a Solicitação de Embarque é sempre reconhecida e importada como ordem,
  mesmo se colada em outro botão. Ctrl+V solto na tela continua funcionando, e aí o
  processo é detectado pelo conteúdo.
- **Lista diária** compacta: texto menor e uma linha por carga (cliente, material,
  motorista e transportadora longos são cortados com "…"; o texto completo aparece ao
  parar o mouse e no painel da ordem).

### Exportação: separação + identificador da carga

Quando a ordem é de **exportação** (janela PIÊN CONTAINERS, ARAUCO MADERAS/exportação terrestre,
breakbulk ou material de exportação `P/E…`), **Imprimir ordem** imprime 4 páginas:

1. Check list visual do veículo (oficial)
2. Check List de Expedição (oficial)
3. **Separação de carga** (A4 em pé): transporte, data/hora, cliente/destino, entregas, OTs,
   container, lacre, tara, MWG, placas, motorista, transportadora, pallets, peso, incoterm, FSC;
   tabela de separação com as linhas da **LT22** (OT · material · descrição · tipo de depósito ·
   **posição** · quantidade · ☐ separado · ☐ conferido) e campos de separador, operador de
   empilhadeira, conferente, horários e observações. Sem LT22, a tabela traz os itens da ordem.
4. **Identificador da carga** (A4 deitado), para fixar em frente à carga: **nº do container** e
   **transporte** em letras gigantes, e placa da carreta, horário, OT, lacre e cliente/destino.

No painel da ordem há botões para imprimir só a separação ou só o identificador (qualquer
ordem, também mercado interno), sem marcar a ordem como impressa.

### Guia Pesos — análise mensal de variação de peso por item

1. Na guia **Pesos**, cole (**Ctrl+V**) ou use **Importar arquivo** (.xlsx/.csv) com a base de
   pesos. A linha de títulos precisa ter a **NF** e o **peso líquido** e/ou **peso bruto**; as
   demais colunas são opcionais e reconhecidas pelo nome: Data (emissão), Material, Descrição,
   Quantidade, Unidade, Volume, Cliente, Transporte, Entrega, Placa. Números no formato brasileiro
   (18.150,40) são aceitos. NF reimportada substitui a anterior; a base fica guardada (e
   compartilhada com a equipe).
2. **A NF é o dado mestre:** cada linha da base se liga à carga em que a NF foi lançada no
   **Controle OT → NF-e**. Da carga vêm transporte, cliente, data, materiais e quantidades. Se a
   base não tiver material/quantidade e a carga tiver um único material, ele é usado; carga com
   vários materiais e base sem material vai para "(vários materiais)" (soma o peso, mas não entra
   no kg/peça).
3. **Análise do mês** (seletor de mês), por material: NFs, quantidade, peso líquido e bruto totais,
   **kg/peça** líquido e bruto (média ponderada), faixa mín–máx, dispersão, **kg/peça do mês
   anterior e variação %**, e quantas NFs ficaram fora da **tolerância** (± %, ajustável). Clique no
   item para ver NF a NF (com desvio da média; fora da tolerância em vermelho).
4. Pendências: NFs da base sem carga com essa NF no app, e cargas do mês com NF-e lançada sem peso
   na base.
5. **Exportar Excel**: guias *Por item* e *Por NF*.

### Clientes FSC (campo ao lado da OT)

O espaço ao lado do número da OT no check-list da carga é o campo **FSC**. Ele é
preenchido pela **relação por cliente**:

1. Na tela inicial, botão **Clientes FSC** (ou Importar dados → Clientes FSC) → selecione a
   planilha FSC (.xlsx, .xls ou .csv), com as colunas da guia FSC: Data de ingresso · Data de
   exclusão · Data de reingresso · Cód. Cliente · **Nome Cliente** · Vendedor · Gerente · FSC ·
   claim. Também dá para copiar as linhas da planilha e colar.
2. A prévia mostra quantos clientes há, quantos estão ativos e quantas cargas do dia são FSC.
   Clique **Importar**: a lista substitui a anterior e fica **guardada** no app (e
   compartilhada com a equipe, se o arquivo compartilhado estiver conectado).
3. Quando o cliente da carga está na lista, o check-list imprime **FSC** ao lado da OT (e o
   claim, se houver, no campo à esquerda da OT). A lista diária mostra a etiqueta FSC.

- **Comparação dos nomes:** a Solicitação de Embarque não traz o código do cliente, então a
  relação é pelo nome. O app ignora acentos, pontuação e sufixos (LTDA, S.A., ME, EIRELI…),
  aceita nome cortado pelo SAP e nomes com as mesmas palavras.
- Cliente com **data de exclusão** e sem reingresso posterior não conta como FSC.
- No painel da ordem, o campo **FSC** mostra a origem e permite forçar *Sim* ou *Não*
  naquele transporte.

### Lista diária = agendamento completo do dia

A lista principal mostra **todos os agendamentos do dia** (janelas de mercado interno e
containers coladas na guia/botão de Agendamento), em ordem de horário:

- **Com a ordem importada** (Solicitação de Embarque ou LOG): a linha completa de sempre, com
  status Pronta p/ imprimir / Impressa / Com alterações / Faturada.
- **Ainda sem ordem importada:** linha com os dados do agendamento (hora, senha, janela,
  cliente, tipo de veículo, volume, placas, CPF, transportadora, container) **transparente, em
  cinza** e marcada **"Não impressa"**. Ao clicar, o app lembra de importar a Solicitação.
- A ligação é pela **placa da carreta no mesmo dia**. Se o mesmo caminhão tem vários horários,
  a ordem fica com o agendamento de horário mais próximo; os outros continuam como linhas de
  agendamento.
- Ordens sem agendamento colado continuam aparecendo normalmente.

### Processo principal: Ctrl+C no SEW, Ctrl+V no app

1. No SEW, abra a página **Solicitação de Embarque - Carregamento de Produto
   Terminado** do carregamento.
2. Copie a página inteira: **Ctrl+A** e depois **Ctrl+C**.
3. No app, pressione **Ctrl+V** em qualquer lugar da tela (fora de campos de texto).
4. O transporte entra na lista do dia e a ordem abre preenchida:

| Da página do SEW | Vai para |
|---|---|
| Carga (tabela de itens) | **Transporte** (chave da ordem) |
| Agendamento / Hora | Data e hora |
| Origem `PIEN PAINEIS` / `PIEN CONTAINERS` | Janela: mercado interno / **CONTAINER** |
| Placa Carreta / Placa Cavalo (sem cavalo = truck) | Placas |
| Nome / CPF / Transportadora | Motorista, CPF e transportadora |
| Últ. Treinamento + tabela de treinamentos | Treinamento; "expirado" se a validade for anterior ao agendamento |
| Pedido · Entrega · Cod.Mat · Material · Qtde · Cliente | Itens, pallets, entrega e cliente |
| Número Container | Nº container do Controle OT |
| Carregamento, Frete, Peso, Celular, Cidade/UF | Informações no painel |

5. Complete o que não vem do SEW (OT, NF-e, Tara, EXP, Lacre, Ticket) e clique
   **Imprimir ordem**.

Acentos quebrados da página (ex.: `SolicitaÃ§Ã£o`, `NÃƒO`) são corrigidos
automaticamente. Também é possível colar várias Solicitações de uma vez em
**Importar dados → Colar do sistema**.

### Campo Transporte (topo)

O campo **Transporte** fica em destaque no topo da tela: é a chave de tudo. Digite o
número e pressione Enter. A ordem abre com tudo o que está ligado a ele (Solicitação de
Embarque, agendamento, OTs, Controle OT). Se o transporte não existir, o app oferece
criar manualmente. Ao fechar a ordem, o cursor volta para o campo.

### Texto grande na "Disposição dos pallets" (check-list da carga)

| Situação | Texto impresso |
|---|---|
| Cliente **ARAUCO MADERAS** | **EXPORTAÇÃO TERRESTRE** (25% transparente) |
| Algum material com **`EB/`** na descrição | **BREAKBULK** |
| **Container agendado na janela de mercado interno** (PIÊN PAINÉIS): nº de container na Solicitação/agendamento/Controle OT ou tipo de veículo de container | **CABOTAGEM** (e os "N/A", como container) |
| Janela PIÊN CONTAINERS | **CONTAINER** (e os "N/A" de tipo de caminhão e lona) |

**Amostra:** se a palavra "amostra" aparece na carga (descrição ou texto comercial do
material, ou observação da Solicitação), o check-list da carga imprime
**"Amostra-conferir cliente"** ao lado da quantidade de lotes (mesmo campo de "carga
fracionada"; se as duas valerem, saem juntas). A lista mostra a etiqueta "Amostra" e o
painel, um aviso.

Prioridade quando mais de uma se aplica: Exportação terrestre → Breakbulk → Cabotagem → Container.
A lista diária mostra uma etiqueta "Exp. terrestre", "Breakbulk" ou "Cabotagem" ao lado da janela.

### Guia Agendamentos (as duas janelas do SEW)

1. No SEW, abra **Agendamento de Cargas** (PIÊN PAINÉIS e/ou PIÊN CONTAINERS) e
   copie a tela (**Ctrl+A**, **Ctrl+C**).
2. No app, pressione **Ctrl+V**. A guia **Agendamentos** mostra as duas janelas
   (mercado interno e containers) do dia, com o transporte e o status da ordem de
   cada placa. Se a janela não for reconhecida, escolha em *Ao colar, tratar como*.
3. **Durante o dia, cole de novo sempre que o agendamento mudar.** Cada colagem
   é comparada com a anterior (pela janela + dia + senha):
   - hora, carreta, cavalo, CPF, container, transportadora ou cliente alterados
     ficam registrados na linha (de → para, com o horário da colagem);
   - agendamento que sumiu fica riscado como *removido* (não é apagado).
4. **Ordem já impressa cujo agendamento mudou** fica **em vermelho, "Com
   alterações"** (na lista diária, na guia Agendamentos e no painel, com o que
   mudou). Também vale para mudanças nos dados impressos (placas, motorista, CPF,
   transportadora, OT…) vindas de uma nova Solicitação de Embarque. Ao imprimir
   de novo, a ordem volta a ficar normal.

### Guia OTs (tela de OTs do SAP / LT22)

**Formato da LT22 (lista do SAP):** copie a lista como ela aparece (Nº OT · Material · T · Texto
breve · Tp. · Pos.origem · UD origem · QtdTeó · UMA · Tp. · PosiçDest · UD destino · Dt.criação ·
Hora…) e use o botão **LT22 · OTs**. A **posição de destino** é a remessa/entrega com zeros à
esquerda (`0085714382` → entrega `85714382`) e a OT também vem com zeros (`0002202883` →
`2202883`). Tipo de depósito, posição de origem e quantidade de cada linha vão para a separação.

1. Na guia **OTs**, cole a tela de OTs (**Ctrl+A**, **Ctrl+C**, **Ctrl+V**).
   - Com a linha de títulos (Remessa · Material · Texto · Tp.dep · Posição · **OT** · Qtd),
     as colunas são lidas pelos títulos. Funciona com a tabela do navegador e com a lista do
     SAP GUI (colunas separadas por `|`).
   - **Sem títulos ou fora do padrão**, o app lê linha a linha: a remessa é uma entrega já
     conhecida no app (ou um número 8xxxxxxx) e a OT é o outro número de 6 a 12 dígitos na
     mesma linha que não é o material. Quantidades, posições e datas são ignoradas.
2. A OT entra sozinha no transporte que tem a mesma **entrega**.
3. **Várias OTs no mesmo transporte** (várias linhas da mesma entrega, ou várias entregas):
   todas aparecem na lista (uma por linha), no painel (Controle OT, separadas por "/") e
   no **check-list impresso**, uma por linha no campo OT. O QR code usa a primeira OT.
4. **Memória:** cada colagem acrescenta. A OT que some da tela continua guardada
   ("não aparece mais").
5. **Ao faturar**, as OTs ficam gravadas no transporte e saem da memória. Colagens
   seguintes dessa remessa são ignoradas.
6. OT que chega depois da impressão deixa a ordem "Com alterações". Imprima de novo.

### Relatório do dia

Botão **Relatório do dia** (barra da lista). Mostra o resumo (transportes, mercado
interno, containers, pallets, impressas, faturadas, com alterações, dados faltando) e a
tabela dos embarques da data selecionada.

- **Baixar Excel**: `embarques-AAAA-MM-DD.xlsx` com as guias *Embarques* (com filtro) e
  *Resumo*. Sem internet, sai um `.csv` que o Excel abre direto.
- **PDF / imprimir**: relatório em A4 deitado. No Chrome, escolha *Salvar como PDF*.
- **Copiar relatório**: copia o relatório já formatado para colar no corpo de um e-mail.
- **Enviar por e-mail**: informe os destinatários em **Para** (ficam salvos). O app copia o
  relatório e abre o e-mail (Outlook ou o programa padrão) com assunto e resumo. Clique no
  corpo e pressione **Ctrl+V** para colar a tabela. Para mandar a planilha anexa, use
  *Baixar Excel* e anexe o arquivo: o navegador não consegue anexar sozinho.

### Ordens faturadas e exclusão

- **Informou a NF-e, a ordem está faturada.** A NF-e é digitada dentro do transporte,
  no **Controle OT** (junto de lacre, container, tara…). Apagar a NF-e desfaz o
  faturamento que veio dela. NF-e que já vem na guia Controle OT da planilha
  importada também marca como faturada.
- Também dá para marcar sem NF: **Marcar como faturada** no painel, ou selecione
  linhas e **Marcar faturadas**.
- A lista fica sempre em ordem de horário; as faturadas vão para o fim, esmaecidas.
- **Excluir:** a lixeira no fim de cada linha tira o transporte da lista diária
  sem abrir a ordem. Para várias (ou o dia inteiro: marque a caixa do
  cabeçalho), use **Excluir selecionadas**. Sempre pede confirmação. Para trazer
  de volta, cole a Solicitação de Embarque de novo.
- As colunas **Status · Excluir** ficam fixas à direita da lista.

### Outras formas de entrada

- **Colar do sistema**: aceita também tabelas com as colunas da guia **LOG**. Com
   ou sem cabeçalho, e mesmo que as colunas venham fora de ordem: o app
   reconhece as colunas pelo cabeçalho, pela posição da guia LOG ou pelo conteúdo
   (placas, CPF, datas, horas, nº de transporte/entrega). Confira na
   pré-visualização e ajuste a coluna pelo seletor se precisar. Colar uma tabela
   com Ctrl+V na tela principal abre essa importação já preenchida.
- **Agendamento SEW**: a tela *Agendamento de Cargas* com as duas janelas
   (PIÊN PAINÉIS e PIÊN CONTAINERS), como na guia SEW ON LINE.
- **Planilha LOG-AGENDAMENTO (.xlsm)**: as guias LOG, SEW ON LINE, FSC e os campos
   manuais da Controle OT são lidos.

### Painel da ordem

Abra pelo campo **Transporte** (topo) ou clicando na linha da lista. O painel abre em **meia
tela**: à esquerda os dados para conferir e preencher; na **coluna lateral direita, todos os
botões de ação**:

- **Imprimir:** Imprimir ordem (2 check-lists, ou 4 páginas na exportação) · Separação ·
  Identificador da carga · Ver documentos
- **Copiar para SAP / planilhas:** Dados de texto (VL02N/texto) · Placa p/ nota (VL02N/placa) ·
  Dados do motorista (VT02N) · Dados de balança
- **Status:** Marcar como faturada · Excluir da lista

- corrija ou complete os dados do transporte (o valor alterado fica marcado
  em amarelo e pode ser desfeito);
- preencha o **Controle OT**: OT, Doc, NF-e, Tara, Peso máx. (MWG), EXP,
  Container, Lacre e Ticket da balança;
- botões de cópia para colar em planilhas e no SAP:
  - **Dados de texto**: `EXP …` / `TARA …` / `Container …` / `Lacre …` (texto da NF-e, Controle OT F1:F4)
  - **Dados de balança**: uma linha, sem títulos, para colar na planilha da balança:
    `Data · Placa · Nº Ticket · Tara container · Peso máximo container · Peso entrada · Peso saída · Conferência 7% · Peso total carga · Status · Nº container · Lacre · NF-e`.
    Peso entrada, Peso saída, Conferência 7%, Peso total e Status vão **em branco** (o balanceiro preenche).
  - **Placa p/ nota**: duas linhas: `0001` e a placa da carreta com UF, sem espaço (ex.: `AAA1234PR`) (Controle OT T3:T4)
  - **Dados do motorista**: só os valores, sem rótulos: CPF (só números) na 1ª linha e placas (`CAVALOUF/CARRETAUF`) na 2ª
- **Imprimir ordem**: imprime os dois check-lists.

Na lista, marque várias linhas e use **Imprimir selecionadas** para imprimir
as ordens em lote. **Copiar lista** copia a lista do dia para o Excel.
Transporte que não está em lugar nenhum: digite o número no campo Transporte e
confirme **Criar transporte manual**.

Impressão: A4 retrato. No Chrome, deixe *Margens: padrão* (o app define margem
zero) e *Escala: padrão (100%)*.

## Dados compartilhados entre usuários

Para todos abrirem o app **já com os dados preenchidos pelos outros**, o app grava num
**arquivo único na pasta de rede da expedição** (ou numa pasta sincronizada do
OneDrive/SharePoint). Não há servidor nem nuvem externa: os dados ficam na rede da Arauco.

1. **Primeiro computador:** clique no aviso do topo (*Dados só neste computador*) →
   **Criar arquivo compartilhado** → salve na pasta de rede, por exemplo
   `\\servidor\expedicao\ordens-embarque-dados.json`.
2. **Demais computadores:** mesmo aviso → **Conectar a arquivo existente** → escolha o
   mesmo arquivo. Os dados da equipe aparecem na hora.
3. Pronto: cada alteração (colagens, Controle OT, impressão, faturamento, exclusão) é
   gravada no arquivo em menos de 1 segundo, e cada computador busca as novidades a cada
   15 segundos (e ao voltar para a janela do app). O topo mostra
   *Compartilhado · hh:mm:ss* com a última sincronização.

- **Duas pessoas ao mesmo tempo:** o app junta as alterações registro por registro (cada
  transporte, cada campo do Controle OT, cada OT, cada agendamento), valendo a mais
  recente. Editar campos diferentes do mesmo transporte não apaga nada; exclusões também
  se propagam.
- **Ao abrir o app**, o Chrome/Edge pode pedir para liberar o acesso ao arquivo: o aviso
  do topo fica amarelo, *Reconectar dados compartilhados*. Basta clicar.
- Funciona no **Google Chrome** e no **Microsoft Edge** (no Firefox os dados ficam só no
  computador). Cada computador continua com uma cópia local, então o app funciona mesmo
  se a rede cair e sincroniza quando voltar.
- O primeiro computador a conectar com dados antigos não sobrescreve o que já está no
  arquivo: os dados locais antigos só entram se não existirem lá.
- **Backup** (Importar dados → Backup) continua disponível para guardar o histórico.

## Arquivo único (HTML)

**`ordens-embarque.html`** é o app inteiro em um só arquivo (estilos, código,
logo, modelos dos check-lists e gerador de QR embutidos). Basta copiar para o
computador e abrir com duplo clique no Chrome/Edge; não precisa de servidor nem
de internet. A internet só é usada para ler planilha `.xlsm` (biblioteca
SheetJS). Os dados ficam salvos no navegador daquele computador.

Depois de alterar `index.html`, `css/` ou `js/`, gere o arquivo de novo:

```bash
python3 tools/build_single_html.py
```

## Rodar a versão de desenvolvimento

Páginas estáticas, sem build:

```bash
cd ordens-embarque
python3 -m http.server 8080
# http://localhost:8080
```

Bibliotecas: `qrcode-generator` (QR da OT, em `vendor/`) e `SheetJS` (leitura do `.xlsm`, via CDN).
