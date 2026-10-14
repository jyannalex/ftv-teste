# FTV - Teste — v2 "Arcade" (design da mudança)

Data: 2026-10-14
Base: `docs/superpowers/specs/2026-10-14-futevolei-design.md` (v1). Esta spec só descreve **o que muda**. O resto da v1 continua valendo: regras de pontuação, set de 12 com 2 de vantagem, campeonato, cenários, save, menus e PWA.

## 1. Objetivo

A v1 ficou difícil, porque cada toque exigia timing preciso. A v2 deixa o jogo **arcade**, como o jogo de referência da Mobirix:
- o jogador **move** o atleta;
- **recepção e levantada são automáticas** quando o atleta está no lugar certo;
- o rally flui sozinho e é **decidido no ataque** (forte, Pingo ou Sharkataque), que acontece em **câmera lenta** para dar tempo de escolher.

**Critério de sucesso:** um jogador novo consegue manter rallies sem treino, e os pontos saem principalmente de ataques bem escolhidos e de defesa mal posicionada, não de erro de timing.

## 2. Controles

| Ação | Celular | Teclado |
|---|---|---|
| Mover | botões ◀ ▶ (canto inferior esquerdo) | A/D ou ← → |
| **Botão esquerdo:** saque, ataque forte, peixinho | botão do canto direito, o da esquerda | J |
| **Botão direito:** Pingo | botão do canto direito, o da direita | K |
| **Sharkataque** | botão 🦈, aparece acima dos dois quando a barra está cheia | Espaço |
| Pausa | ‖ | Esc |

`TeamInput` passa a ser `{ move: -1 | 0 | 1; forte: boolean; pingo: boolean; shark: boolean }`:
- `move` é a direção **na tela** (−1 esquerda, +1 direita);
- os três botões são **segurados** (true enquanto apertados), e o núcleo detecta as bordas (apertou/soltou).

O significado de "para a rede" depende do lado: no time 0 é `move = +1`; no time 1, `move = −1`.

## 3. Movimento

- O atleta **controlado** anda a **5 m/s** enquanto `move ≠ 0` (fora da câmera lenta). Fica limitado ao próprio lado, de 0,3 m a 11 m da rede.
- Com `move = 0` e o atleta designado para a bola, a **ajuda automática** o leva até o ponto de contato a **2,8 m/s**.
- O parceiro e os atletas da IA usam o posicionamento da v1 (4,5 m/s com atraso de reação), mais o erro de posicionamento da IA (seção 7).
- Continua a troca automática do atleta controlado e o marcador amarelo.

## 4. Toques automáticos (recepção e levantada)

No instante do contato planejado (`tIdeal`), seja `d = |x_atleta − x_contato|`:

| Situação | Resultado |
|---|---|
| `d ≤ alcance` | **toque automático** com qualidade normal (erro de alvo ±0,4 m) |
| `alcance < d ≤ 2,2 m` **e** o botão esquerdo foi apertado entre `tIdeal − 0,6 s` e `tIdeal + 0,05 s` | **peixinho**: o atleta mergulha até a bola; qualidade torta (erro ±1,2 m), ação visual `peixinho` |
| caso contrário | ninguém toca; a bola segue e cai |

- **Alcance:** 0,7 m para a IA e para o parceiro. Para o atleta controlado: Fácil 0,9 m, Médio 0,7 m, Difícil 0,6 m.
- **Bola indo para fora:** se o pouso previsto passa mais de 0,3 m da linha de fundo, ninguém toca automaticamente (nem dá peixinho), e é ponto de quem não mandou a bola.
- O 1º toque (passe) e o 2º (levantada) usam os alvos da v1: passe em `s·3,0` com ápice 3,8; levantada em `s·1,0` com ápice 3,6.
- **3º toque do time da IA:** o ataque é decidido pela IA no contato (seção 7).
- **3º toque do time humano:** entra a câmera lenta (seção 5).
- Somem da v1: janelas de timing, notas Perfeito/Bom/Ruim, "furada" e o ataque de segunda.

## 5. Ataque do jogador em câmera lenta

1. Quando o plano é o 3º toque do **time humano**, ao chegar `tIdeal − lead` o atleta controlado **pula**, desde que `d ≤ 1,2 m` naquele instante. O pulo o encaixa sob a bola, e a simulação inteira entra em **câmera lenta (×0,25)**.
2. `lead = duração_real × 0,25`, com duração real de **Fácil 2,0 s, Médio 1,5 s e Difícil 1,2 s**.
3. Durante a câmera lenta, `move` vira **mira** (não move o atleta):
   - **para a rede → curto**, a bola cai a 2,5 m da rede;
   - **neutro → meio**, a 5,0 m;
   - **para trás → fundo**, a 7,8 m.
4. Escolhas (a primeira borda de aperto vale e executa **na hora**, a partir da posição atual da bola):
   - **Botão esquerdo → ataque forte:** tempo de voo 0,45 s até o alvo da mira.
   - **Botão direito → Pingo:** alvo a 1,2 m da rede, ápice `max(rede + 0,5, y_bola + 0,2)`.
   - **Shark** (só com a barra cheia) **→ Sharkataque:** tempo de voo 0,32 s até o alvo da mira; zera a barra.
5. Se a bola chega a `tIdeal` sem escolha, sai um **ataque fraco automático**: alvo no meio, ápice 4,0. A câmera lenta acaba em qualquer toque, ponto ou pausa.
6. Ataques forte e Shark mantêm a regra da v1 de **abrir o arco** até passar a faixa com 10 cm de folga. O erro de alvo de qualquer ataque é ±0,4 m.
7. Se `d > 1,2 m` em `tIdeal − lead`, não há pulo nem câmera lenta. Vale a regra da seção 4 com ataque fraco automático, ou seja, a bola fica viva se o atleta chegar.
8. A IA não tem câmera lenta.

## 6. Defesa dos ataques e saque

- **Forte:** a defesa usa a regra da seção 4. Como o voo é curto, muitas vezes só o peixinho alcança.
- **Pingo:** a mesma regra; pega quem está recuado.
- **Sharkataque:** **não é defendido**. Ninguém toca, e a bola cai (ponto de quem atacou).
- **Saque:** o sacador segura o **botão esquerdo** e o saque sai **ao soltar**, com a mira pela direção no momento de soltar: curto a 3,0 m da rede, meio a 5,5 m, fundo a 8,0 m, ápice 4,3. Não existe mais saque fora por segurar demais. O saque na rede segue a regra da v1 (falta). O saque automático depois de 8 s vai no meio.
- **Botão segurado antes da fase de saque** não conta, e a pausa cancela o botão segurado (correções da v1 mantidas).

## 7. IA

Parâmetros por habilidade (de 0 a 1, interpolação linear):

| Parâmetro | 0 | 1 |
|---|---|---|
| Atraso de reação (s) | 0,35 | 0,08 |
| Erro de posicionamento (m, desvio) | 1,0 | 0,1 |
| Chance de dar peixinho quando precisa | 0,3 | 0,9 |
| Leitura da defesa no ataque | 0 | 1 |
| Erro de mira (m, desvio) | 1,5 | 0,2 |

- **Movimento:** a IA corre até `x_contato + erro`, sorteado uma vez por plano.
- **Peixinho:** decidido por sorteio quando, a 0,3 s do contato, a distância está entre o alcance e 2,2 m.
- **Ataque (3º toque, no contato):**
  - escolhe **Pingo** se o defensor adversário mais perto da rede estiver a mais de 4,5 m, com probabilidade igual à leitura (senão, Pingo com 30%);
  - senão, **forte** mirando a profundidade mais longe dos dois defensores, mais o erro de mira;
  - com a barra cheia usa o **Shark**, mas a IA com habilidade ≥ 0,5 guarda o especial até alguém ter 9 pontos.
- **Bola indo para fora:** a IA não toca, pela regra da seção 4.
- **Saque da IA:** espera 1 s, mira aleatória (curto/meio/fundo) e solta.
- A tabela de habilidade por dificuldade e rodada da v1 continua igual.

## 8. Barra do Sharkataque

| Evento | Ganho |
|---|---|
| Toque do time (qualquer toque) | +5 |
| Defender um ataque forte (incluindo de peixinho) | +12 |
| Ponto | +10 |

Máximo 100. O Sharkataque zera a barra. A barra fica embaixo, no centro da tela, como a "Finish Spike" da referência.

## 9. Tela e arte

**HUD e indicadores**
- **Sombra de pouso:** uma elipse escura na areia, no ponto previsto de queda, sempre visível durante o rally.
- **Marcador de mira:** um anel no lado adversário, no alvo atual, durante o saque (enquanto segura) e durante a câmera lenta.
- **Câmera lenta:** uma **bolha** translúcida em volta do atacante, um **anel branco** em volta da bola, a tela levemente escurecida nas bordas e o texto "ESCOLHA!" com os ícones dos botões.
- **Botões:** ◀ ▶ à esquerda; "FORTE" e "PINGO" à direita; o 🦈 aparece acima deles, piscando, com a barra cheia.
- **Textos flutuantes:** "PEIXINHO!", "PINGO!", "FORTE!" e "SHARKATAQUE!". Sai a nota de timing.

**Arte dos atletas**
- Mais **finos e altos**: altura visual de cerca de 1,9 m, membros com 5–7 px, tronco em trapézio (camisa) e short com forma.
- **Contorno escuro fino** (1,5–2 px) em tudo, tênis ou pés, e 4 estilos de cabelo diferentes.
- Novas poses: `peixinho` (mergulho horizontal na areia) e um pulo de ataque mais alto (até 1,4 m).

**Efeitos:** rastro brilhante (glow) na bola em forte e Shark, flash no contato, e a bolha do pulo. Os cenários continuam, com linhas mais finas e um pouco mais de detalhe onde couber.

## 10. Testes

Lógica (Vitest):
- parado no ponto: toque automático;
- longe sem botão: a bola cai;
- longe com o botão esquerdo dentro do intervalo: peixinho;
- bola indo para fora: ninguém toca;
- 3º toque humano: a câmera lenta começa no `lead` e escala o `dt` por 0,25;
- forte, Pingo e Shark caem nos alvos da mira (curto/meio/fundo);
- sem escolha: ataque fraco automático;
- Shark só com a barra cheia, zera a barra e não é defendido;
- saque ao soltar o botão esquerdo, com mira;
- partida IA × IA sempre termina;
- IA forte vence a fraca na maioria das partidas;
- ganhos da barra.

Visual: screenshots com Playwright (mesmo método da v1).

## 11. Fora do escopo

Bloqueio, multiplayer, evolução de personagens e personagens com atributos diferentes.
