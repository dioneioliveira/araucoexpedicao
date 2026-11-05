# Arauco Quality Vision — o que o sistema faz

Documento de apresentação do sistema de inspeção visual de cargas no embarque. Atualizado em 05/11/2026.

## 1. Objetivo

Ao final do carregamento, o operador fotografa a carga no celular. O sistema analisa a foto com inteligência artificial (IA), devolve **a mesma foto com os pontos de atenção marcados**, uma nota de qualidade e uma lista dos problemas, e permite **enviar o resultado por WhatsApp ou e-mail**. Os defeitos encontrados formam uma **base de ocorrências com imagem** para análise posterior.

## 2. Como o operador usa (fluxo)

1. Abre o app pelo link (instalável na tela inicial do celular, como um aplicativo).
2. Informa embarque, placa e operador.
3. Tira a foto da **lateral esquerda** e da **lateral direita** da carga (quando possível), e fotos extras se necessário.
4. O sistema analisa automaticamente: primeiro uma **visão geral**; depois divide a carga em **partes (pilhas)** e analisa cada uma **ampliada (zoom)**.
5. Vê a foto com as marcações, a nota, a lista de pontos e, se quiser, aproxima cada parte.
6. Confirma ou descarta pontos, tira **fotos de perto** para esclarecer dúvidas.
7. Envia por WhatsApp/e-mail a foto analisada, a foto original e as partes ampliadas com pontos, mais um texto-resumo.

## 3. O que o sistema detecta

| Tipo | Exemplos | Gravidade |
|---|---|---|
| Furo de garfo | rupturas, lascas ou furos causados pela empilhadeira | **Crítico** |
| Calço / barrote faltando | bloco ausente no vão do garfo; lote apoiado direto; foge do padrão dos demais lotes | **Crítico** |
| Barrote quebrado | bloco partido, torto ou deslocado | **Crítico** |
| Falta de filme stretch | lote que deveria estar plastificado e está sem filme | **Crítico** |
| Canto batido / avaria no lote | canto amassado, esfarelado ou quebrado; lote quebrado ou tombado | **Crítico** |
| Material molhado | manchas de água, papelão encharcado ou ondulado | **Crítico** |
| Desalinhamento de carga (empilhamento) | chapas deslocadas ou salientes, carga torta, material encavalado | Moderado |
| Filme stretch solto ou pendurado | plástico aberto, rasgado ou pendurado | Moderado |
| Etiqueta rasurada, rasgada ou caída | fora de posição ou ilegível | Moderado |
| Manchas / diferença de cor | em relação a lotes do mesmo padrão (a verificar) | Moderado |
| Embalagem danificada | papelão rasgado ou solto | Moderado |
| Fita de fixação solta ou faltando | fita frouxa, rompida ou ausente | Moderado |

**O que não é defeito** (e o sistema ignora): reflexo de luz no plástico stretch; sombras e partes escuras por iluminação; o vão onde a empilhadeira coloca o garfo; cintas de amarração do veículo; réguas já posicionadas; lona do sider, veículo e fundo; lotes sem papelão que usam apenas filme stretch e calços (padrão válido).

## 4. Principais funções

- **Pontos de atenção com destaque:** caixas em mira com rótulo curto (tipo) e cor pela gravidade (leve, moderado, alto, crítico); o restante da imagem escurece ao selecionar um ponto.
- **Análise por partes com zoom:** a carga é dividida em pilhas e cada uma é inspecionada ampliada; barra "Partes da carga" para navegar; cada parte mostra quantos pontos tem.
- **Barrote faltando por comparação:** o sistema compara os vãos da mesma pilha (posição das fitas e dos blocos) e aponta onde falta bloco em relação ao padrão.
- **Dúvidas e foto de perto:** quando a IA não consegue decidir, pede uma foto mais próxima; a IA decide com a nova foto. Existe o botão para ignorar todas as dúvidas de uma vez.
- **Ignorar pontos:** qualquer ponto pode ser ignorado com um toque (X). **Pontos críticos exigem motivo e confirmação**, que ficam registrados no relatório, na foto enviada e na base. Pontos de advertência e dúvidas não exigem.
- **Nota e classificação:** nota de 0 a 100 (Aprovado, Atenção, Reprovar/retrabalhar, Crítico). Falhas críticas limitam a nota.
- **Envio:** compartilhamento nativo do celular com a foto analisada, a original e as partes ampliadas com pontos, mais um resumo em texto.
- **Base de defeitos:** cada defeito é registrado com recorte da imagem; o operador pode marcar "Correto" ou "Falso alarme" (retorno para medir e melhorar a IA). Página `ocorrencias.html` com filtros por tipo, período e situação, taxa de acerto da IA e exportação em CSV.
- **Base de padrões de defeito:** 26 exemplos fotográficos fornecidos pela operação (pasta `padroes/`) com tipo e gravidade; as regras de gravidade já estão incorporadas à análise.

## 5. Como funciona por dentro (resumo técnico)

- **Aplicativo:** página web única (HTML/JavaScript), instalável como PWA, funciona no navegador do celular.
- **Análise:** modelo de visão da Anthropic (Claude) chamado por uma **função no servidor** (Supabase Edge Function `analisar`). A chave da IA fica só no servidor; o celular guarda apenas o endereço da função e um código de acesso.
- **Fluxo de análise:** visão geral (identifica lotes, conta fitas e calços) → recorte e ampliação de cada pilha → inspeção detalhada → regras do sistema (comparação entre lotes e vãos, remoção de duplicados, gravidade).
- **Base de dados:** Supabase (Postgres + Storage privado), acessada somente pela função `registrar`. Tabelas `inspecoes` e `defeitos`. Recortes dos defeitos ficam guardados; **a foto inteira é apagada após 7 dias**.
- **Segurança:** código de acesso (`x-app-token`) em todas as funções; tabelas com RLS e sem acesso direto; fotos em bucket privado com link temporário; a configuração dos celulares é feita por link que deve ser tratado como senha.
- **Configuração dos aparelhos:** link com a configuração embutida (`#cfg=`), aplicado e removido do endereço ao abrir.

## 6. Situação atual e pendências

| Item | Situação |
|---|---|
| App de campo (foto, análise, marcações, envio) | Pronto e mesclado no repositório |
| Análise por partes, dúvidas, ignorar com motivo | Pronto no branch de desenvolvimento |
| Funções no Supabase (`analisar`, `registrar`) | Publicadas |
| Segredos `APP_TOKEN` e `ANTHROPIC_API_KEY` no Supabase | **Pendente** (criados pelo responsável no painel) |
| Tabelas da base de defeitos | **Pendente**: executar o SQL `supabase/migrations/20261030_base_defeitos.sql` |
| Endereço de hospedagem do app (ex.: GitHub Pages) | **A confirmar** |
| Precisão da IA em fotos reais | **Em validação**: testes feitos com modelo substituto e respostas simuladas; precisa de teste com a IA real e fotos da operação |

## 7. Limitações conhecidas

- A IA pode **deixar de ver defeitos pequenos** (furos de garfo, barrote faltando) ou **marcar falsos alarmes** (reflexo, sombra). Por isso existem a análise por partes, as dúvidas com foto de perto e o retorno "Correto / Falso alarme".
- Depende da qualidade da foto: boa luz, foto de frente, sem muita distância.
- Cada análise faz várias chamadas à IA (visão geral + uma por parte), o que aumenta tempo e custo por foto.
- Os exemplos de padrões servem como referência e regras; ainda não são enviados à IA junto de cada foto.

## 8. Pontos para adoção corporativa

- **Dados pessoais:** placa e nome do operador são registrados; definir quem acessa e por quanto tempo guardar.
- **Custo:** uso da API da Anthropic (por foto analisada) e do plano do Supabase (armazenamento e funções); estimar por volume de embarques.
- **Hospedagem e identidade:** avaliar hospedagem no ambiente da empresa e login por usuário no lugar de um código de acesso único.
- **Governança da base de padrões:** definir quem aprova novos exemplos e tipos de defeito.

## 9. Próximos passos sugeridos

1. Criar os segredos e as tabelas no Supabase; teste ponta a ponta com a IA real.
2. Validar com fotos reais da operação e medir o acerto por tipo de defeito (usando o retorno dos operadores).
3. Botão "Faltou marcar" para o operador desenhar defeitos que a IA não viu.
4. Usar os casos confirmados da base como exemplos para melhorar a IA.
5. Painel de indicadores (defeitos por tipo, por período e por origem).

## 10. Arquivos do projeto

- `index.html` — aplicativo
- `ocorrencias.html` — consulta da base de defeitos
- `supabase/functions/analisar` e `registrar` — funções do servidor
- `supabase/migrations/` — SQL da base de defeitos
- `padroes/` — exemplos fotográficos de defeitos e `padroes.json`
- `README.md` — instruções técnicas de instalação e configuração
