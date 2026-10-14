# Visão 3D (estilo Super Volley Blast) — design

Mudança sobre a v2 arcade (branch `feat/arcade-v2`). Referência de estilo: prints do Super Volley Blast
enviados pelo usuário. Só o estilo é referência; arte e código são nossos (desenho por código).

## Objetivo

Trocar a visão lateral por uma câmera alta e fixa em perspectiva, com os atletas andando pela quadra
inteira (2 eixos), mantendo todas as mecânicas arcade da v2. Corrigir o atleta que sai correndo no saque.

## Mundo

- `x`: comprimento (rede em x = 0, meia-quadra 9 m, time 0 à esquerda). `z`: largura, quadra de
  z = −4,5 (fundo da tela) a z = +4,5 (perto da câmera). `y`: altura.
- Bola balística 3D: `{x, y, z, vx, vy, vz}`; `vz` constante; gravidade só em `y`. A rede ocupa toda a
  largura em x = 0 (sem antenas).
- Atletas: `{x, z, vx, vz, y}`, aceleração 33 / frenagem 50 m/s² por eixo, velocidade 5 m/s
  (diagonal normalizada). Limites: o próprio lado em x (0,3 a 11 m da rede) e |z| ≤ 6,5.
- Fora: pouso com |x| > 9 ou |z| > 4,5 é fora (perde quem tocou por último).

## Entrada e mira

- `TeamInput` ganha `moveZ: −1 | 0 | 1` (−1 = para o fundo da tela). `move` continua sendo o eixo x.
- Mira = profundidade (curto/meio/fundo, pelo eixo x como hoje) + faixa (`lane`: −1, 0, +1 pelo
  `moveZ`). Faixa vira z = lane × 2,8 m. Mesmo erro aleatório de ±0,4 m nos dois eixos.
- Saque usa a mesma mira 2D.
- **Trava de movimento (bug do saque):** depois do saque e do ataque em câmera lenta do jogador, a
  direção segurada é ignorada até o jogador soltar todas as direções.

## Toques

- Toque automático, defesa e pulo da câmera lenta usam a distância no plano (x, z).
- Alcance base 0,9 m; ajuda do jogador: fácil 1,1, médio 0,9, difícil 0,8. Defesa 1,5 m.
- Passe e levantada vão para o z do parceiro (limitado a ±3,5 m); x como hoje.
- Posições base: sem a bola, os dois lado a lado em x = 5,0, z = ±2,2 (o parceiro do jogador fica na
  faixa oposta à do controlado). Com a bola, quem não toca vai para x = 1,5 mantendo o próprio z
  (limitado a ±2). Saque: sacador em x = 9,5, z = ±2; parceiro em x = 3,5 no z oposto.

## IA

- Anda nos dois eixos com a mesma lógica de frenagem, por eixo.
- Mira 2D: o alvo (profundidade × faixa) mais longe dos defensores, com a chance de "ler" de hoje.

## Controles

- Teclado: WASD / setas andam; J forte/DEFENDER/saque, K Pingo, Espaço Shark, **Q troca o atleta**,
  Esc pausa.
- Celular: joystick virtual à esquerda (8 direções); botões FORTE/DEFENDER, PINGO, 🦈 e ⇄ à direita.

## Visual

- `project(x, y, z)` com perspectiva real: foco f = 2000 px, profundidade da câmera
  d = 36 + (4,5 − z) m, altura 30 m. Quadra vira trapézio; desenho ordenado por z.
- Bonecos chibi (cabeça grande, corpo pequeno), contorno fino, escala pela profundidade. Mesma
  interface `AthleteRenderer` (pronto para sprites).
- Sombra da bola no chão, círculo de alcance do controlado, mira 2D, rede quase de perfil (como nos
  prints), torcida atrás da quadra. Um cenário por fase.

## Testes

Core adaptado para 3D; novos testes: mira 2D (faixas), fora pela lateral, movimento em z, trava do
saque, alcance no plano. IA × IA continua terminando a partida.
