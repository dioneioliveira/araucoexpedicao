# Quality Vision — Arauco Piên

Verificador visual da qualidade da carga a partir de uma foto (veículo carregado ou área de separação). Devolve **a mesma foto** com:

- **pontos de atenção destacados** sobre a foto: cantos em mira na cor da gravidade (leve, moderado, alto, crítico), rótulo curto com o tipo e o resto da foto escurecido para dar foco;
- **lista detalhada** com miniatura ampliada de cada ponto, gravidade, descrição e ação recomendada (clique para destacar na foto; *Descartar* remove a marcação);
- **nota geral** (0–100) e classificação (Aprovado / Atenção / Reprovar / Crítico);
- botão para baixar o PNG com o resultado.

## Várias fotos e o que é ignorado

- Aceita até 6 fotos por inspeção, cada uma rotulada (lateral esquerda, lateral direita, traseira, frontal, superior, outra). O app pede as **duas laterais** e sugere fotos extras quando a IA vê parte da carga encoberta. A nota geral combina as fotos (pior foto pesa mais).
- **Cintas de amarração** e **réguas já sobrepostas** na carga não são defeito (podem ser desligadas em *Não avaliar*).
- **Lona do sider** e qualquer área encoberta viram *área não avaliável*: hachurada, sem pontos de atenção e fora da nota.
- Cada ponto de atenção pode ser **descartado** (ou restaurado); o mapa e a nota se ajustam.

## Análise detalhada

Com *Análise detalhada* ligada (padrão), além da foto inteira o app recorta a foto em 4 a 6 trechos com sobreposição, amplia cada um e pede ao modelo só os defeitos pequenos (furos de garfo, barrote faltando, etiqueta caindo). Os resultados são mesclados sem duplicar e descartados se caírem numa área não avaliável. Custa de 5 a 7 chamadas por foto.

Áreas não avaliáveis aparecem como badge numerado (⊘1) sobre a foto, com o motivo na lateral, sem texto cobrindo o material.

## Contagem de fitas e calços

Na análise geral o modelo conta, lote a lote, as fitas e os calços do vão abaixo. O app compara os lotes entre si: lote sem fita ou com 2 fitas a menos que o normal vira *fita faltando*; lote apoiado direto (sem calços) ou com 2 calços a menos vira *calço faltando*. Cada ponto mostra os números usados, para conferir ou descartar.

Lotes só com stretch e calços (sem papelão) são embalagem válida e não geram alerta.

## O que é verificado

Calço/barrote faltando em relação ao padrão da pilha, **furo de garfo (sempre crítico: gravidade mínima 80 e nota máxima 35)**, filme stretch aberto ou solto, etiquetas rasgadas/caídas/rasuradas, fitas soltas, danos e batidas (marcas escuras), empilhamento/posicionamento e embalagem fora do padrão.

## Como funciona

HTML estático, sem build. A foto é reduzida (até 1568 px) e enviada à API de mensagens da Anthropic (visão), que devolve JSON com lotes, defeitos, áreas não avaliáveis e fotos adicionais pedidas (caixas normalizadas e gravidade). As marcações são desenhadas no navegador sobre a própria foto.

## Rodar

```bash
cd quality-vision
python3 -m http.server 8080   # abrir http://localhost:8080/
```

Em *Configuração da IA* informe a chave da API (fica só no `localStorage` do navegador) e o modelo. Para uso em produção, aponte o campo **Endpoint** para um proxy da empresa que guarde a chave no servidor. O botão **Exemplo** mostra a interface sem chamar a IA.

## Limitações

A análise é uma triagem assistida: depende da qualidade da foto (luz, distância, foco) e as localizações são aproximadas. Não substitui a conferência presencial.

## Uso em campo (celular no embarque)

Fluxo: o operador preenche embarque, placa e nome, toca em **Tirar foto** (câmera traseira) de cada lateral, a análise roda sozinha e a barra fixa **Enviar** abre o compartilhamento do celular com as fotos analisadas (marcações + faixa com embarque, placa, nota, data e operador) e um resumo em texto, para escolher WhatsApp ou e-mail. **Nova inspeção** limpa as fotos, o embarque e a placa (o operador fica salvo).

### 1. Servidor de análise (a chave da Anthropic não fica no celular)

A função `supabase/functions/analisar/index.ts` recebe a foto, confere um código de acesso e chama a API da Anthropic. Secrets no Supabase (Edge Functions > Secrets):

| Secret | Para quê |
|---|---|
| `ANTHROPIC_API_KEY` | chave da API da Anthropic |
| `APP_TOKEN` | código de acesso que os celulares enviam (invente uma senha longa) |
| `ALLOWED_ORIGIN` | opcional: endereço do app, ex.: `https://usuario.github.io` |

Função já publicada em `https://njgsexaamsjdmcngxvjs.supabase.co/functions/v1/analisar` (sem JWT; a autenticação é o `APP_TOKEN`). Para publicar de novo:

```bash
supabase functions deploy analisar --no-verify-jwt --project-ref <ref-do-projeto>
```

### 2. Hospedar e instalar

Publique a pasta `quality-vision/` em HTTPS (GitHub Pages serve). No Android (Chrome): menu > *Instalar app*. No iPhone (Safari): Compartilhar > *Adicionar à Tela de Início*. O app abre em tela cheia e, sem internet, abre mas não analisa.

### 3. Configurar cada celular por link

Gere um link que já traz o servidor e o código de acesso (o app aplica e limpa o endereço):

```bash
printf '%s' '{"endpoint":"https://<ref>.supabase.co/functions/v1/analisar","token":"<APP_TOKEN>","mailTo":"expedicao@empresa.com"}' \
  | base64 -w0 | tr '+/' '-_' | tr -d '='
# link final: https://<endereço-do-app>/quality-vision/#cfg=<saída acima>
```

Mande o link por mensagem ao operador. Trate-o como senha: quem tem o link usa a análise.

### Limites desta versão

- O envio usa o compartilhamento do aparelho: cabe ao operador escolher o destinatário (ou o grupo do WhatsApp). Envio automático sem toque exigiria um serviço de e-mail/WhatsApp Business.
- Em navegadores sem compartilhamento de arquivos, o app salva as imagens e oferece atalhos de WhatsApp e e-mail só com o texto: as fotos precisam ser anexadas à mão.
- O código de acesso é único e compartilhado; para revogar um aparelho, troque o `APP_TOKEN` e reenvie o link aos demais.
