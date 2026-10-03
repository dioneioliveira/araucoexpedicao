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

### Guia OTs (tela de OTs do SAP)

1. Copie a tela de OTs do SAP (Remessa · Material · Texto breve · Tp.dep.origem ·
   Posição dep.origem · **OT** · Qtd.teórica, as mesmas colunas da guia `lt22`) com
   **Ctrl+A**, **Ctrl+C** e pressione **Ctrl+V** no app. Funciona com a tabela
   copiada do navegador e com a lista do SAP GUI (colunas separadas por `|`).
2. A OT entra sozinha no **Controle OT** e no check-list do transporte que tem a
   mesma **entrega** (remessa). No painel aparece a origem "tela de OTs". Se
   houver mais de uma OT, saem separadas por "/" e o QR code usa a primeira.
3. **Memória:** cada colagem acrescenta. A OT que some da tela do SAP continua
   guardada (marcada "não aparece mais").
4. **Ao faturar** a ordem, a OT fica gravada no transporte e é retirada da memória.
   Se ela ainda vier numa colagem seguinte, é ignorada.
5. OT que chega depois de a ordem ter sido impressa deixa a ordem "Com alterações",
   porque o check-list impresso saiu sem ela. Imprima de novo.

### Ordens faturadas

No painel, **Marcar como faturada** (ou selecione várias linhas e use **Marcar
faturadas**). A lista diária fica sempre em ordem de horário, mas as faturadas
vão para o fim, esmaecidas. Dá para desmarcar no mesmo botão.

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
