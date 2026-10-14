# Futevôlei 2x2 — Design (v1)

Data: 2026-10-14
Nome provisório do jogo: **FTV — Sharkataque**

## 1. Objetivo e contexto

Jogo simples de futevôlei 2x2 para navegador e celular, projeto pessoal para jogar com amigos. Inspirado no jogo de vôlei da Mobirix (`com.mobirix.scvb`): visão lateral 2D, dois botões de ação, troca automática de controle e um ataque especial com barra.

Diferenças em relação à referência:
- Futevôlei, 2x2, sempre na areia (praia e quadras de areia).
- Regras do futevôlei: até 3 toques por lado, mesmo atleta não toca duas vezes seguidas, proibido usar braços/mãos.
- O especial é o **Sharkataque**: bicicleta invertida por cima da rede, batendo na bola de cima para baixo com a sola do pé.

**Critério de sucesso da v1:** um jogador consegue, no celular ou no PC, jogar um campeonato completo (quartas → semi → final) contra a IA, numa dificuldade escolhida, usando só 2 botões, e o jogo é divertido e "parece futevôlei".

### Fora do escopo da v1 (futuro)
- Multiplayer local (mesmo teclado) e online.
- Defesa do Sharkataque com chance justa ("opção B"), a ser revista junto com o multiplayer.
- Bloqueio na rede, mira de direção do ataque, evolução de atributos, moedas, desbloqueio de personagens.
- Outros idiomas além do português.

## 2. Plataforma e tecnologia

- **Phaser 3 + TypeScript + Vite.**
- **PWA:** instalável pelo navegador, funciona offline depois do primeiro acesso.
- Hospedagem estática (GitHub Pages, Netlify ou similar). Sem servidor.
- Tela sempre na horizontal. No celular em pé, aparece o aviso "gire o aparelho". A tela se ajusta a qualquer resolução mantendo a proporção.
- Testes automáticos com **Vitest** para a lógica (`src/core`).

## 3. Arquitetura

A lógica do jogo (`core`) é TypeScript puro, sem dependência do Phaser. O Phaser só desenha o estado e lê os controles.

```
src/
  core/                 lógica pura, testável
    physics.ts          gravidade, quique na areia, colisão com rede e com o corpo dos atletas
    rules.ts            contagem de toques, mesmo atleta, ponto, fora, saque, fim do set
    match.ts            estado da partida e passo da simulação (step)
    touch.ts            tipos de toque e cálculo do resultado de cada toque
    specialMeter.ts     barra do Sharkataque
    ai.ts               decisões da IA (posição, toque, timing com erro)
    tournament.ts       chaveamento de 8 duplas, avanço, simulação das outras partidas
  game/                 Phaser
    scenes/             Boot, Menu, Campeonato (config), Chaveamento, Partida, Resultado, ComoJogar, Opcoes
    render/             atleta articulado, bola, cenários em camadas, efeitos
    input/              botões de toque + teclado → comandos
  data/                 cenários, duplas adversárias, parâmetros de dificuldade e balanceamento
  save/                 leitura/gravação do progresso no localStorage
```

### Fluxo de dados na partida
1. A cena `Partida` lê os comandos do jogador: `recepcao` (pressionar) e `ataque` (pressionar / soltar).
2. A cada passo de tempo fixo (1/60 s), ela chama `match.step(estado, comandosJogador, comandosIA)`.
3. `match.step` devolve o novo estado e uma lista de **eventos** (`toque`, `ponto`, `falta`, `sharkataque`, `fimDeSet`...).
4. A cena desenha o estado e reage aos eventos com som, efeito visual e texto ("PERFEITO!").

O passo fixo deixa a física igual em qualquer aparelho e prepara a lógica para rodar num servidor no futuro (online).

## 4. Mecânicas da partida

### 4.1 Princípio
O jogo é de **timing**, não de movimento. O atleta controlado corre sozinho até o ponto previsto de queda da bola. O jogador aperta o botão certo na hora certa.

### 4.2 Controles
| Ação | Celular | Teclado |
|---|---|---|
| Recepção / Levantada | botão esquerdo | J (ou seta ↓) |
| Ataque / Saque | botão direito | K (ou seta ↑) |
| Pausa | ícone no canto | Esc |

### 4.3 Troca automática de controle
O jogador controla sempre o atleta da sua dupla que deve fazer o próximo toque. Depois do 1º toque, o controle passa para o parceiro. Depois do 2º, volta ao primeiro. Um marcador amarelo fica sobre o atleta controlado. O atleta que não está controlado é posicionado pela IA.

### 4.4 Toques
Cada toque tem uma janela de timing em volta do momento ideal e recebe uma nota:
- **Perfeito:** a bola vai exatamente para o alvo previsto.
- **Bom:** desvio pequeno.
- **Ruim:** desvio grande, podendo ir para fora ou cair na areia.
- **Não apertou ou saiu da janela:** a bola cai e é ponto do adversário.

| Toque | Botão | Parte do corpo | Resultado |
|---|---|---|---|
| 1º: recepção | Recepção | chapa (bola baixa) ou peito (bola alta), escolhido automaticamente pela altura | bola para o parceiro |
| 2º: levantada | Recepção | chapa | bola alta perto da rede; a qualidade define altura/posição |
| 3º: ataque | Ataque | cabeça (ou pé no Sharkataque) | ver 4.5 |

O botão **Ataque** também funciona no 2º toque (atacar de segunda). Também pode ser usado no 1º, mas longe da rede o ataque perde força e precisão.

### 4.5 Ataque
- **Toque rápido** (soltar em até ~150 ms): **Pingo**. Bola fraca e curta que cai logo atrás da rede.
- **Segurar e soltar:** **ataque de cabeça**. A força cresce com o tempo segurado, dentro de uma janela. Mais força significa bola mais rápida e mais funda. Segurar além do limite manda a bola para fora.
- **Barra cheia + segurar e soltar:** **Sharkataque**. Animação de bicicleta invertida por cima da rede, câmera lenta curta no contato, rastro de tubarão/barbatana e bola descendo muito rápida e funda. Consome a barra inteira.
- O ponto exato do contato (o atleta no alto do pulo) também conta: soltar fora do pico reduz a precisão.

### 4.6 Defesa contra ataques
- Ataque forte: janela de timing de recepção menor que a normal, proporcional à força.
- Pingo: o atleta precisa correr até a rede. A IA de posicionamento só consegue se não estiver muito recuada.
- **Sharkataque:** para o jogador, só dá para defender com timing Perfeito, numa janela minúscula. A IA defende com chance baixa (ver 5).

### 4.7 Regras
- Até 3 toques por lado. O 4º toque é falta: ponto do adversário.
- O mesmo atleta não pode tocar duas vezes seguidas. A troca automática respeita isso e `rules.ts` confere.
- Bola na areia dentro da quadra: ponto de quem mandou. Bola fora: ponto do outro lado.
- Bola na rede: volta e continua em jogo se ainda houver toques.
- **Saque:** chutado da areia, atrás da linha de fundo. Segura Ataque para dar força e solta. Saque na rede ou fora é ponto do adversário.
- Ponto direto (rally point). Quem faz o ponto saca, alternando o sacador da dupla a cada vez que recupera o saque.
- **Set único de 12 pontos, com 2 de vantagem.**

### 4.8 Barra do Sharkataque
Cada dupla tem a sua, de 0 a 100. Ganhos (valores iniciais, ajustáveis em `data/`):
- toque Perfeito: +8
- defender um ataque forte: +12
- fazer um ponto: +10

Fica cheia em 100. Usar o Sharkataque zera a barra. A barra não zera entre os pontos.

### 4.9 HUD
- Placar no topo, com o nome das duplas.
- Barra do Sharkataque de cada dupla. A barra cheia brilha.
- Contador de toques (1/2/3) do lado que está com a bola.
- Marcador amarelo sobre o atleta controlado.
- Nota do toque em texto flutuante ("PERFEITO!", "BOM", "RUIM").
- Botões de ação no canto inferior direito (celular).

## 5. IA e dificuldade

A IA usa as mesmas regras e emite os mesmos comandos que o jogador. O que muda é o erro de timing e a qualidade das decisões.

### 5.1 Comportamentos
- **Posicionamento:** move o atleta não controlado (nas duas duplas). Recua para defender; vai para a rede para levantar.
- **Toques do adversário:** prevê o ponto de queda, corre até lá e "aperta" com um timing sorteado em volta do ideal (dispersão conforme a habilidade).
- **Decisão de ataque:** analisa a posição dos defensores. Defesa recuada favorece o Pingo; defesa adiantada favorece o ataque forte e fundo. Com habilidade baixa, a decisão é quase aleatória.
- **Sharkataque:** usa quando a barra estiver cheia. Com habilidade alta, prefere guardar para momentos decisivos (ponto de set, placar apertado).

### 5.2 Habilidade (0 a 1)
Um único número `habilidade` interpola todos os parâmetros entre "IA fraca" e "IA forte":

| Parâmetro | habilidade 0 | habilidade 1 |
|---|---|---|
| Dispersão do timing | grande | pequena |
| Tempo de reação | lento | rápido |
| Leitura da defesa no ataque | aleatória | ótima |
| Precisão da força do ataque | baixa (muita bola fora) | alta |
| Chance de defender Sharkataque | ~2% | ~15% |

Os valores concretos ficam em `data/difficulty.ts`.

### 5.3 Dificuldade × campeonato
| Dificuldade | Quartas | Semi | Final |
|---|---|---|---|
| Fácil | 0,20 | 0,30 | 0,40 |
| Médio | 0,45 | 0,55 | 0,65 |
| Difícil | 0,70 | 0,80 | 0,90 |

- No **Fácil**, as janelas de timing do jogador ficam mais largas.
- **Partida rápida:** o adversário usa o valor da semi da dificuldade escolhida.

### 5.4 Personalidade das duplas
Cada dupla adversária tem um estilo nos dados (ex.: "Gosta de Pingo", "Bate Forte", "Paredão"), que ajusta os pesos de decisão da IA sem código extra.

## 6. Campeonato

- **Configuração:** dificuldade, nome da dupla do jogador e cor do uniforme.
- **8 duplas:** a do jogador + 7 fictícias (nome, cores, estilo), sorteadas no chaveamento.
- **Rodadas:** quartas → semi → final. As partidas que não envolvem o jogador são simuladas na hora (vencedor sorteado com peso pelo nível) e mostradas na chave.
- **Derrota:** eliminado. Opções: tentar de novo (mesma dificuldade) ou voltar ao menu.
- **Título:** tela de campeão com troféu. O título é registrado no histórico por dificuldade.

## 7. Cenários

| Cenário | Rodada | Elementos |
|---|---|---|
| Praia de dia | Quartas | céu, mar com ondas animadas, coqueiros, guarda-sóis, gaivotas |
| Quadra de areia do clube | Semi | muro, árvores, rede de proteção ao fundo, cadeiras de plástico |
| Arena noturna | Final | arquibancada com torcida, refletores, faixas |

Cenários em camadas (parallax leve), desenhados por código no mesmo estilo cartoon dos atletas.

**Liberação para a Partida Rápida:** a Praia começa liberada, o Clube libera ao chegar à semi e a Arena ao chegar à final.

## 8. Arte e animação

- Estilo **cartoon desenhado por código**. Atletas articulados (cabeça, tronco, braços, coxas, canelas, pés) com animações por interpolação de ângulos: correr, chapa, peito, cabeça, pingo, saque, comemoração e **bicicleta do Sharkataque**.
- Cores do uniforme parametrizadas por dupla.
- A estrutura deve permitir trocar por sprites ilustrados no futuro sem mexer no `core`.
- Efeitos: areia levantando no pulo e no quique, rastro da bola em ataques fortes e efeito de tubarão/barbatana no Sharkataque.

## 9. Telas

```
Boot (carregando) → Menu
Menu: Campeonato | Partida Rápida | Como Jogar | Opções
Campeonato: config → Chaveamento → Partida → Resultado → Chaveamento … → Campeão
Partida Rápida: cenário + dificuldade → Partida → Resultado → Menu
Partida: Pausa (continuar, reiniciar, sair)
```

- **Como Jogar:** tela ilustrada curta com os 2 botões, os 3 toques, Pingo × ataque forte e a barra do Sharkataque.
- **Dicas na primeira partida:** mensagens contextuais no primeiro rally ("Aperte Recepção agora!", "Segure Ataque para bater forte").
- **Opções:** som liga/desliga, música liga/desliga, reiniciar progresso (com confirmação).

## 10. Persistência

`localStorage` guarda:
- campeonato em andamento (chaveamento, rodada atual, dupla do jogador, dificuldade);
- cenários liberados;
- títulos por dificuldade;
- opções de som e música;
- se o tutorial de dicas já foi mostrado.

Dados ausentes ou corrompidos fazem o jogo voltar ao estado inicial, sem travar.

## 11. Som

Efeitos de toque na bola, apito, torcida, pulo/areia e Sharkataque, mais uma música leve em loop. Todos de bancos com licença livre (CC0). O áudio só começa depois da primeira interação, como exigem os navegadores.

## 12. Tratamento de erros

- Áudio bloqueado ou indisponível: o jogo continua sem som.
- `localStorage` indisponível (modo privado): o jogo funciona sem salvar e avisa uma vez.
- Aba em segundo plano: a partida pausa automaticamente ao perder o foco.
- Queda de desempenho: o passo fixo usa um acumulador com limite de passos por quadro, para não travar em aparelhos lentos.

## 13. Testes

Vitest em `src/core`:
- **physics:** trajetória, quique, colisão com a rede, previsão do ponto de queda.
- **rules:** limite de 3 toques, mesmo atleta, dentro/fora, rede, saque, fim do set com 2 de vantagem (12-10, 13-11).
- **touch:** notas de timing, Pingo × ataque forte pelo tempo segurado, excesso de força manda a bola para fora.
- **specialMeter:** ganhos, limite de 100, consumo pelo Sharkataque.
- **ai:** dispersão do timing proporcional à habilidade (estatística com semente fixa), decisão de Pingo contra defesa recuada.
- **tournament:** geração do chaveamento, avanço, eliminação, nível por rodada e dificuldade.
- **save:** ida e volta dos dados, recuperação de dados corrompidos.

A parte visual (Phaser) é verificada jogando no navegador do PC e do celular.
