# Quality Vision — Arauco Piên

Verificador visual da qualidade da carga a partir de uma foto (veículo carregado ou área de separação). Devolve **a mesma foto** com:

- **mapa de calor** verde → vermelho sobre os lotes (verde = perfeito, vermelho = crítico);
- **pontos de atenção** numerados, com tipo, gravidade (1–100) e ação recomendada;
- **nota geral** (0–100) e classificação (Aprovado / Atenção / Reprovar / Crítico);
- botão para baixar o PNG com o resultado.

## Várias fotos e o que é ignorado

- Aceita até 6 fotos por inspeção, cada uma rotulada (lateral esquerda, lateral direita, traseira, frontal, superior, outra). O app pede as **duas laterais** e sugere fotos extras quando a IA vê parte da carga encoberta. A nota geral combina as fotos (pior foto pesa mais).
- **Cintas de amarração** e **réguas já sobrepostas** na carga não são defeito (podem ser desligadas em *Não avaliar*).
- **Lona do sider** e qualquer área encoberta viram *área não avaliável*: hachurada, sem cor no mapa de calor e fora da nota.
- Cada ponto de atenção pode ser **descartado** (ou restaurado); o mapa e a nota se ajustam.

## O que é verificado

Calço/barrote faltando em relação ao padrão da pilha, **furo de garfo (sempre crítico: gravidade mínima 80 e nota máxima 35)**, filme stretch aberto ou solto, etiquetas rasgadas/caídas/rasuradas, fitas soltas, danos e batidas (marcas escuras), empilhamento/posicionamento e embalagem fora do padrão.

## Como funciona

HTML estático, sem build. A foto é reduzida (até 1568 px) e enviada à API de mensagens da Anthropic (visão), que devolve JSON com lotes, defeitos, áreas não avaliáveis e fotos adicionais pedidas (caixas normalizadas e gravidade). O mapa de calor é desenhado no navegador: risco base por lote (100 − qualidade) somado a manchas gaussianas em cada defeito.

## Rodar

```bash
cd quality-vision
python3 -m http.server 8080   # abrir http://localhost:8080/
```

Em *Configuração da IA* informe a chave da API (fica só no `localStorage` do navegador) e o modelo. Para uso em produção, aponte o campo **Endpoint** para um proxy da empresa que guarde a chave no servidor. O botão **Exemplo** mostra a interface sem chamar a IA.

## Limitações

A análise é uma triagem assistida: depende da qualidade da foto (luz, distância, foco) e as localizações são aproximadas. Não substitui a conferência presencial.
