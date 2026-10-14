# FTV - Teste

Jogo de futevôlei 2x2 para navegador e celular. Você joga contra o computador num campeonato mata-mata (quartas, semi e final) ou numa partida rápida, em três cenários de areia. São só dois botões, e o especial é o **Sharkataque**.

## Como jogar

| Ação | Celular | Teclado |
|---|---|---|
| Mover | ◀ ▶ (canto esquerdo) | A/D ou ← → |
| Saque, ataque forte, peixinho | botão FORTE | J |
| Pingo | botão PINGO | K |
| Sharkataque (barra cheia) | botão 🦈 | Espaço |
| Pausa | botão ‖ | Esc |

- **Corra até a sombra da bola.** No lugar certo, o atleta recebe e levanta sozinho. Se a bola estiver um pouco longe, **FORTE** faz o **peixinho**.
- **Saque:** segure FORTE e solte. ◀ ▶ mira curto ou fundo, e o anel amarelo mostra onde a bola vai cair.
- **Ataque em câmera lenta:** no 3º toque o atleta pula e o tempo desacelera. **FORTE** bate forte, **PINGO** cai logo atrás da rede e ◀ ▶ mira. Com a barra cheia, **🦈** solta o **Sharkataque**, que é imparável.
- Toques, defesas e pontos enchem a barra do Sharkataque, que fica embaixo da tela.
- **Você move os dois atletas, um de cada vez.** Quando a bola vem para o seu lado, o controle vai para quem vai tocar. Quando ela vai para o outro lado, o controle vai para quem estiver mais perto de onde ela vai cair. Quem não está sob controle fica onde você deixou.

## Desenvolvimento

Requer Node 22+.

```bash
npm install
npm run dev        # abre em http://localhost:5173
npm run dev -- --host   # para abrir no celular pela rede local
npm test           # testes da lógica (Vitest)
npm run build      # gera a pasta dist/
npm run preview    # serve a dist/ localmente
```

Estrutura:
- `src/core/`: lógica pura do jogo (física, regras, toques, partida, IA e campeonato). Não depende do Phaser e tem testes.
- `src/game/`: Phaser (cenas, desenho, controles, som).
- `src/data/`: balanceamento (`balance.ts`), duplas, cenários e dificuldades.
- `src/save/`: progresso salvo no navegador.
- `docs/superpowers/`: spec e plano de implementação.

## Trocar os atletas por sprites (arte ilustrada)

Hoje os atletas são desenhados por código (`src/game/render/AthleteView.ts`). A cena usa só a interface `AthleteRenderer` (`draw(atleta, pose)` e `topOf(atleta, pose)`). Para usar arte ilustrada, crie outra classe com essa interface e troque a criação em `MatchScene`.

Formato sugerido da arte:

```
public/sprites/<personagem>/
  parado.png  correndo.png  chapa.png  peito.png  cabeca.png
  pingo.png   peixinho.png  sharkataque.png  saque.png  comemorando.png
```

- Cada arquivo é uma tira horizontal de quadros (*spritesheet*) com o mesmo tamanho de quadro, por exemplo 256×256.
- O personagem fica de pé com os pés no centro de baixo do quadro e virado para a **direita**. O time da direita é espelhado pelo jogo.
- As ações e as durações são as de `ACTION_DURATION` em `src/game/render/poses.ts`.
- O jogo calcula em que ponto de cada ação o atleta está (de 0 a 1), e a classe de sprites só precisa escolher o quadro correspondente.

## Publicar

A pasta `dist/` é estática e funciona em qualquer subpasta (`base: './'`).

- **GitHub Pages:** publique o conteúdo de `dist/` (por exemplo, com a action `actions/deploy-pages`) ou numa branch `gh-pages`.
- **Netlify:** arraste a pasta `dist/` em app.netlify.com/drop.

Depois de publicado, no celular use **"Adicionar à tela inicial"** para instalar o jogo como app. Ele funciona offline.

## Créditos

Veja [CREDITS.md](CREDITS.md).
