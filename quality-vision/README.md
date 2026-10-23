# Quality Vision — Arauco Piên

Verificador visual da qualidade da carga a partir de uma foto (veículo carregado ou área de separação). Devolve **a mesma foto** com:

- **mapa de calor** verde → vermelho sobre os lotes (verde = perfeito, vermelho = crítico);
- **pontos de atenção** numerados, com tipo, gravidade (1–100) e ação recomendada;
- **nota geral** (0–100) e classificação (Aprovado / Atenção / Reprovar / Crítico);
- botão para baixar o PNG com o resultado.

## O que é verificado

Calço/barrote faltando (desalinhamento da distribuição), filme stretch aberto ou solto, etiquetas rasgadas/caídas/rasuradas, fitas soltas, danos e batidas (marcas escuras), empilhamento/posicionamento e embalagem fora do padrão.

## Como funciona

HTML estático, sem build. A foto é reduzida (até 1568 px) e enviada à API de mensagens da Anthropic (visão), que devolve lotes e defeitos com caixas normalizadas e gravidade via *tool use* (JSON estruturado). O mapa de calor é desenhado no navegador: risco base por lote (100 − qualidade) somado a manchas gaussianas em cada defeito.

## Rodar

```bash
cd quality-vision
python3 -m http.server 8080   # abrir http://localhost:8080/
```

Em *Configuração da IA* informe a chave da API (fica só no `localStorage` do navegador) e o modelo. Para uso em produção, aponte o campo **Endpoint** para um proxy da empresa que guarde a chave no servidor. O botão **Exemplo** mostra a interface sem chamar a IA.

## Limitações

A análise é uma triagem assistida: depende da qualidade da foto (luz, distância, foco) e as localizações são aproximadas. Não substitui a conferência presencial.
