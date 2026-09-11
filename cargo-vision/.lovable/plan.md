## Visão geral

Aplicativo web em português (BR) para simular o carregamento de cubos (materiais) dentro de um container 40HC, com visualização 3D semitransparente do container e dos itens posicionados — similar ao EasyCargo. Os usuários cadastram materiais (dimensões + peso), criam simulações selecionando itens e quantidades, e o sistema calcula automaticamente a disposição via algoritmo de bin packing 3D, indicando se cabe (volume) e se respeita o limite de peso. O usuário pode ajustar manualmente a disposição após a sugestão automática.

## Stack e infraestrutura

- TanStack Start (já configurado)
- Lovable Cloud para autenticação (email/senha + Google) e persistência
- Three.js + @react-three/fiber + @react-three/drei para a cena 3D
- shadcn/ui (já instalado) para a interface
- Algoritmo de bin packing 3D próprio (heurística "Extreme Points" / First-Fit-Decreasing por volume e maior face)

## Container padrão

- 40HC: 12,00 m (comprimento) × 2,30 m (largura) × 2,69 m (altura interna típica)
- Campo editável de "capacidade máxima de peso (kg)" informado na simulação (padrão sugerido: 26.500 kg)

## Modelo de dados (Lovable Cloud)

- `profiles` — id (FK auth.users), nome, criado_em
- `materiais` — id, user_id, nome, sku (opcional), comprimento_mm, largura_mm, altura_mm, peso_kg, cor (hex para render 3D), criado_em
- `simulacoes` — id, user_id, nome, capacidade_peso_kg, container_tipo, criada_em, atualizada_em
- `simulacao_itens` — id, simulacao_id, material_id, quantidade
- `simulacao_posicoes` — id, simulacao_id, material_id, indice (1..N), x_cm, y_cm, z_cm, rot (0–5 para orientação do cubo), encaixado (bool)

Todas as tabelas com RLS por `user_id` e GRANTs para `authenticated`/`service_role`.

## Telas

1. **/auth** — login/cadastro (email+senha e Google)
2. **/** (landing simples com CTA para o app, fora do `_authenticated`)
3. **/\_authenticated/materiais** — CRUD de materiais (tabela com nome, dimensões cm, peso kg, cor)
4. **/\_authenticated/simulacoes** — lista de simulações salvas
5. **/\_authenticated/simulacoes/nova** e **/\_authenticated/simulacoes/$id** — editor da simulação:
   - Painel esquerdo: seleção de materiais e quantidade, campo de peso máximo do veículo
   - Botão "Calcular carga" → roda bin packing
   - Painel central: cena 3D (container transparente, eixos, cubos coloridos, controles orbit/zoom)
   - Painel direito: resultado (volume usado %, peso total/limite, itens encaixados vs. sobrando, lista por item)
   - Ajuste manual: clicar num cubo → arrastar/snap para nova posição válida (sem colisão e dentro do container)

## Algoritmo de empacotamento

- Ordenar instâncias por volume decrescente
- Estratégia "Extreme Points" em 3D: manter lista de pontos candidatos (cantos livres), começando em (0,0,0)
- Para cada item, testar as 6 orientações, escolher a posição/orientação válida (sem colisão, dentro do container) que minimiza desperdício no canto
- Marcar como `encaixado=false` os itens que não couberem; mostrá-los em painel "Não carregado"
- Validação de peso separada da geometria: peso_total = Σ qty × peso; comparar contra capacidade

## Visualização 3D

- Container como `<Box>` wireframe + faces com `transparent`, `opacity: 0.15`
- Eixos e grade no piso para referência
- Cada item: `<Box>` com cor do material, label flutuante com nome/índice ao passar o mouse
- OrbitControls para rotação/zoom/pan
- Modo de edição manual: clique seleciona, setas/drag move em incrementos do grid (ex: 10 cm)

## Detalhamento técnico

- Server functions (`createServerFn` + `requireSupabaseAuth`) para CRUD de materiais e simulações
- Algoritmo de packing rodando 100% no cliente (rápido, sem custo de servidor) em `src/lib/packing.ts`
- Tipos compartilhados em `src/types/logistica.ts`
- Componente 3D em `src/components/cena-container.tsx` (client-only via dynamic import para evitar SSR de Three.js)
- Idioma: todas as strings em pt-BR

## Entregáveis desta primeira iteração

1. Habilitar Lovable Cloud + auth (email/senha + Google)
2. Migrations com tabelas, RLS e grants
3. Cadastro de materiais (CRUD completo)
4. Editor de simulação com cálculo automático + cena 3D transparente
5. Cálculo de peso com alerta visual quando excede a capacidade
6. Lista de itens não encaixados quando a carga não cabe
7. Salvar/abrir simulações
8. (V2, fora do escopo desta iteração) ajuste manual com drag — fica como próximo passo após validar a base

Confirma esse escopo para eu começar a construir?
