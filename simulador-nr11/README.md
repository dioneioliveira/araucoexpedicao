# Simulador NR-11 — Empilhadeira

Página estática (HTML/CSS/JS, sem servidor) para formação e reciclagem de operadores. O arquivo `index.html` é **único e funciona offline** (o Three.js vai embutido).

## Abas
**Teste de carga** — peso, dimensões e posição da carga, elevação, inclinação do mastro, curva, frenagem e rampa deslocam o CG combinado dentro do triângulo de estabilidade.
- Vista lateral 2D ou **Vista 3D giratória** (arraste para girar, roda do mouse aproxima): triângulo de estabilidade no piso, CG da máquina/da carga/combinado, projeção no chão, rampa e tombamento.
- Vista superior (arraste a carga), vista traseira, tabela de elevação, instrutor e pop-up didático de perigo/tombamento.

**Montagem da empilhadeira** — linha de montagem didática com 17 peças (chassi, eixos e rodas, motor, contrapeso, carenagem, cockpit, protetor de cabeça, sinalização, mastro, cilindros, carro, garfos, espaldar).
- Clique numa peça da bandeja (ou no contorno turquesa na máquina): ela voa até o lugar e encaixa.
- Vista 3D giratória, **vista explodida**, **raio-X**, rótulos numerados e **Projeto 2D** (desenho técnico ortogonal com cotas).
- Ficha de cada peça: função, posição e o que o operador deve checar (NR-11); botão "Testar funções" (rodas, ventoinha e mastro em movimento).

**Treinamento NR-11** — a apresentação do curso em HTML (51 slides em 7 seções: contexto, a empilhadeira, estabilidade, operação segura, inspeção e manutenção, gerenciamento de riscos e encerramento), com transições entre slides e animações de entrada.
- Menu lateral (ícone de capelo ou ☰): abre o treinamento direto na seção escolhida.
- Setas ← → (ou clique/arraste), tecla F para tela cheia e modo Auto.
- Telas interativas ligadas ao simulador: gangorra, centro de carga, curva capacidade × elevação, garfo de 75%, base de 3 pontos, casos de tombamento e cena de análise de risco. Botões levam ao Teste de carga e à Montagem.
- Conteúdo extraído dos PPTs do curso (Drive); imagens, vídeos e fotos dos slides originais não foram incluídos.

Uso didático. Vale sempre a placa de capacidade do fabricante.

## Desenvolvimento
Código-fonte em `src/` (`index.src.html`, `f3d.js`, `load3d.js`, `asm.js`, `training.js`) e `vendor/three.min.js` (Three.js r158).
Para regenerar o arquivo único: `python3 build.py`.
