# Quality Vision — Arauco Piên

Verificador visual da qualidade da carga a partir de uma foto (veículo carregado ou área de separação). Devolve **a mesma foto** com:

- **pontos de atenção destacados** sobre a foto: cantos em mira na cor da gravidade (leve, moderado, alto, crítico), rótulo curto com o tipo e o resto da foto escurecido para dar foco;
- **lista detalhada** com miniatura ampliada de cada ponto, gravidade, descrição e ação recomendada (clique para destacar na foto; *Descartar* remove a marcação);
- **nota geral** (0–100) e classificação (Aprovado / Atenção / Reprovar / Crítico);
- botão para baixar o PNG com o resultado.

## Várias fotos e o que é ignorado

- Aceita até 6 fotos por inspeção, cada uma rotulada (lateral esquerda, lateral direita, traseira, frontal, superior, outra). O app pede as **duas laterais** e sugere fotos extras quando a IA vê parte da carga encoberta. A nota geral combina as fotos (pior foto pesa mais).
- **Cintas de amarração** e **réguas já sobrepostas** na carga não são defeito (podem ser desligadas em *Não avaliar*).
- **Lona do sider** e qualquer área encoberta viram *área não avaliável*: hachurada, sem cor no mapa de calor e fora da nota.
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
