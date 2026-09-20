# Simulador de Estabilidade da Empilhadeira (2D) — Apoio à NR-11

Versão plana (não 3D), com três vistas técnicas — **lateral**, **frontal** e **superior** — pensada para uso em sala
de treinamento de NR-11 (Anexo II — Empilhadeiras). O foco é mostrar com clareza, num formato de diagrama técnico,
por que uma empilhadeira tomba: o **triângulo de estabilidade**, o **centro de carga** e os efeitos de elevar,
inclinar, acelerar, frear e fazer curvas.

Complementa o [simulador 3D em `forklift-simulator/`](../forklift-simulator) — aquele é um "jogo" de condução livre;
este é uma ferramenta de bancada, mais adequada para projeção em sala de aula, discussão de cenários e leitura de
plaqueta de capacidade.

## Como rodar localmente

Página HTML estática, **sem dependências externas** (nenhuma biblioteca via CDN — tudo é canvas 2D nativo, o que
também a torna confiável em salas de treinamento sem internet):

```bash
cd forklift-nr11-2d
python3 -m http.server 8080
# depois abrir http://localhost:8080/index.html
```

## Como usar

- **Configurar**: ajuste o modelo de empilhadeira (predefinições ou personalizado), o peso e centro de carga, a
  altura de elevação, a inclinação do mastro e uma condição dinâmica simulada (frenagem ou curva). As três vistas e
  a barra de status no topo reagem em tempo real.
- **Cenários**: sete situações prontas (uma operação segura de referência, sobrecarga na plaqueta, centro de carga
  deslocado, frenagem brusca com carga elevada, curva fechada, carga com centro de gravidade deslocado lateralmente,
  e o transporte correto) para carregar com um clique e discutir com a turma.
- **NR-11**: resumo de apoio didático dos pontos centrais da norma (Anexo II) relacionados à operação de
  empilhadeiras.
- **Plaqueta**: uma plaqueta de capacidade em estilo placa de metal escovado escura, modelada a partir de uma foto
  real de plaqueta (incluída na própria aba para comparação), com o clássico gráfico em leque — uma curva de
  capacidade x centro de carga para cada altura de mastro de referência —, além de tara, entre-eixos, ângulos de
  inclinação e pneus. Tudo calculado a partir da configuração atual, para treinar a leitura de uma plaqueta real.
- **Checklist**: simulação da inspeção pré-uso diária (não altera a simulação — reforço de hábito operacional).
- **🖥 Modo apresentação**: amplia toda a página para leitura à distância (projetor).
- **❓ Sobre / Como usar**: reabre a tela de instruções a qualquer momento.

## Desenho das vistas

As proporções da empilhadeira (entre-eixos, balanço dianteiro, bitola, diâmetro das rodas dianteiras/traseiras,
altura da guarda avançada, altura do banco, altura de elevação por estágio do mastro) foram calibradas a partir de
fichas técnicas reais de empilhadeiras contrabalançadas de 1,5/2,5/3,5 t (ex.: Crown FC5200 series), para que a
empilhadeira desenhada tenha proporções plausíveis em vez de arbitrárias — rodas dianteiras bem maiores que as
traseiras, guarda avançada na altura real, contrapeso robusto, mastro telescópico visível, garfos com calcanhar.

## Modelo físico (simplificado, para fins didáticos)

- **Capacidade x centro de carga**: assim como no simulador 3D, a capacidade nominal da plaqueta só vale no centro
  de carga de fábrica; para outros centros de carga, a capacidade real é recalculada por equilíbrio de momentos em
  torno do eixo dianteiro, com um fator de segurança entre a capacidade nominal e o ponto real de tombamento.
- **Triângulo de estabilidade**: formado pelas duas rodas dianteiras (motrizes) e o pino do eixo traseiro (direção).
  A vista superior mostra o triângulo completo (o teste real, em duas dimensões); as vistas lateral e frontal
  mostram as suas "fatias" — o segmento entre-eixos (tombamento para frente/trás) e o segmento entre rodas
  dianteiras (tombamento lateral) — para ajudar a entender visualmente o que cada uma representa.
- **Sobrecarga x tombamento são conceitos diferentes**: uma carga acima da capacidade da plaqueta pode, em alguns
  casos, ainda estar geometricamente dentro do triângulo (ainda não vai tombar naquele instante) — mas já é uma
  operação irregular, proibida pela NR-11. O painel mostra os dois indicadores separadamente para deixar essa
  distinção clara (veja o cenário "Sobrecarga na plaqueta").
- **Altura, inclinação e dinâmica**: com o mastro na vertical e a empilhadeira parada, a altura de elevação não
  reduz, por si só, a capacidade estática — mas amplifica o efeito de qualquer inclinação para frente, frenagem ou
  curva, pois eleva o braço de alavanca dessas forças. A condição dinâmica simulada (sliders de frenagem/aceleração
  e força de curva) modela esse efeito de forma simplificada.

Os números (capacidade, peso próprio, entre-eixos, balanço dianteiro, ângulos de inclinação) são valores típicos de
mercado por classe de empilhadeira, usados apenas para fins de treinamento — **não substituem a plaqueta de
identificação e o manual do fabricante de uma empilhadeira real**. O resumo da NR-11 na aba correspondente é
conteúdo de apoio didático; consulte sempre o texto oficial vigente da norma.

## Stack

- HTML/CSS/JS puro, sem build e sem bibliotecas externas — todo o desenho é feito em `<canvas>` 2D e SVG inline.
- `index.html` + uma pasta `assets/` com duas imagens de referência (uma foto ilustrativa de empilhadeira, exibida
  na tela inicial, e a foto de uma plaqueta real, usada como modelo do gráfico em leque e exibida para comparação na
  aba Plaqueta) — únicos arquivos externos ao HTML, ambos locais (nenhuma dependência de internet).
