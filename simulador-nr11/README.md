# Simulador NR-11 — Estabilidade de empilhadeira

Página estática (HTML/CSS/JS puro, sem build) para treinamento de operadores: mostra como peso, dimensões e posição da carga, altura de elevação, inclinação do mastro, curva, frenagem e rampa deslocam o centro de gravidade combinado dentro do **triângulo de estabilidade**.

- **Vista lateral**: empilhadeira, mastro/garfos/carga, CG da máquina, da carga e combinado, cotas (centro de carga C, braços de momento, altura).
- **Vista superior**: triângulo de estabilidade (rodas dianteiras + pivô traseiro), faixa de risco, rastro do CG. A carga pode ser arrastada para a ponta dos garfos ou para os lados.
- **Vista traseira**: estabilidade lateral e rolagem em caso de tombamento.
- **Tabela de elevação**: capacidade por altura do garfo × centro de carga (verde = a carga atual cabe).
- **Instrutor**: alertas em tempo real (capacidade, centro de carga, apoio nos garfos, curva, rampa, etc.) e cenários prontos.

Uso didático: o modelo é simplificado. Vale sempre a placa de capacidade do fabricante.

```bash
cd simulador-nr11 && python3 -m http.server 8080   # http://localhost:8080
```
