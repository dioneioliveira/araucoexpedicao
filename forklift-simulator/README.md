# Simulador de Empilhadeira — Treinamento

Simulador 3D, estilo jogo, para treinar operadores de empilhadeira contrabalançada. O foco não é o realismo do
veículo em si, e sim os conceitos que mais causam acidentes reais: **centro de carga**, **capacidade nominal (plaqueta
de identificação)**, **triângulo de estabilidade** e os riscos de elevar, inclinar, acelerar, frear e curvar com carga
no alto.

## Como rodar localmente

Página HTML estática, sem build:

```bash
cd forklift-simulator
python3 -m http.server 8080
# depois abrir http://localhost:8080/index.html
```

## Stack

- Three.js (via CDN, `three@0.160.0`) para a cena 3D — sem dependências de build, HTML/CSS/JS puro em um único arquivo.
- HUD e telas em HTML/CSS sobrepostos ao `<canvas>`; gráficos (mini-mapa e curva de capacidade) desenhados em `<canvas 2d="">`.

## Comandos

| Ação | Tecla |
|---|---|
| Andar / Ré | `W`/`S` ou `↑`/`↓` |
| Virar (roda traseira, de direção) | `A`/`D` ou `←`/`→` |
| Elevar / abaixar garfos | `R` / `F` |
| Inclinar mastro para trás / frente | `T` / `G` |
| Pegar / soltar carga | `E` |
| Buzina | `H` |
| Alternar câmera (segue / topo / orbital) | `C` |
| Freio | `Espaço` |

## Modelo físico (simplificado, para fins didáticos)

- **Capacidade x centro de carga**: a capacidade nominal na plaqueta só vale para o centro de carga de fábrica
  (ex.: 500 mm). Para outros centros de carga, a capacidade real é recalculada por equilíbrio de momentos em torno do
  eixo dianteiro (`capacidade ∝ 1 / distância do centro de gravidade da carga até o eixo dianteiro`), com um fator de
  segurança entre a capacidade nominal e o ponto real de tombamento estático — assim como em uma plaqueta real.
- **Triângulo de estabilidade**: formado pelas duas rodas dianteiras (motrizes, fixas) e o pino do eixo traseiro
  (direção). A empilhadeira tomba quando a projeção do centro de gravidade combinado (empilhadeira + carga) sai desse
  triângulo — para frente (sobre o eixo dianteiro) ou lateralmente (sobre uma das rodas dianteiras).
- **Altura, inclinação e dinâmica**: com o mastro na vertical e a empilhadeira parada, a altura de elevação por si só
  não reduz a capacidade estática. Mas ela **amplifica** o efeito de qualquer inclinação para frente, frenagem,
  aceleração ou curva — o centro de gravidade elevado gera um braço de alavanca maior para essas forças, o que é
  modelado como um deslocamento adicional do centro de gravidade combinado. Esse é o mecanismo por trás da recomendação
  real de sempre inclinar o mastro para trás e reduzir a velocidade ao transportar carga elevada.
- Um derating estrutural adicional acima de 3 m de elevação pode ser ativado na configuração, para simular mastros
  longos cuja capacidade também é limitada por resistência estrutural, além do efeito de estabilidade.

Os números (capacidade, peso próprio, entre-eixos, balanço dianteiro, ângulos de inclinação) são valores típicos de
mercado por classe de empilhadeira, usados apenas para fins de treinamento — **não substituem a plaqueta de
identificação e o manual do fabricante de uma empilhadeira real**.

## Funcionalidades

- Condução livre em um depósito com racks (níveis de elevação marcados) e paletes com pesos variados para praticar
  coleta e armazenagem.
- Painel de configuração: modelo de empilhadeira (predefinições ou personalizado), peso da carga, centro de carga,
  deslocamento lateral do centro de gravidade e altura da carga — tudo ajustável em tempo real, com ou sem a
  empilhadeira em movimento.
- HUD com velocidade, altura dos garfos, ângulo de inclinação, carga atual, capacidade no centro de carga vigente e
  margem de estabilidade.
- Mini-mapa do triângulo de estabilidade (vista de cima) e gráfico interativo de capacidade x centro de carga,
  atualizados a cada quadro.
- Alertas de sobrecarga e de risco de tombamento, e uma tela de "tombamento" que explica, em texto, qual limite foi
  ultrapassado (sobrecarga, tombamento para frente ou lateral).
