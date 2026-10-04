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

Abra pelo campo **Transporte** (topo) ou clicando na linha da lista.

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

## Dados

Tudo fica salvo **somente no navegador** (localStorage): nenhum CPF, nome ou
placa vai para o repositório ou para servidores. Use **Importar dados → Backup**
para exportar e restaurar, ou para apagar dias anteriores.

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
