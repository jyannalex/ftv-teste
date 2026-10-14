# FTV - Teste

Jogo de futevôlei 2x2 para navegador e celular. Você joga contra o computador num campeonato mata-mata (quartas, semi e final) ou numa partida rápida, em três cenários de areia. São só dois botões, e o especial é o **Sharkataque**.

## Como jogar

| Ação | Celular | Teclado |
|---|---|---|
| Mover | ◀ ▶ (canto esquerdo) | A/D ou ← → |
| Trocar o atleta controlado | botão ⇄ | W |
| Saque, ataque forte e DEFENDER (quando vem ataque) | botão esquerdo (FORTE/DEFENDER) | J |
| Pingo | botão PINGO | K |
| Sharkataque (barra cheia) | botão 🦈 | Espaço |
| Pausa | botão ‖ | Esc |

- **Corra até a sombra da bola.** No lugar certo, o atleta recebe e levanta sozinho. Longe da bola, ela cai: no futevôlei não tem mergulho.
- **Defesa:** quando o adversário ataca (forte ou Pingo), o botão esquerdo vira **DEFENDER**. Fique a até 1,5 m da bola e aperte na hora em que ela chega. Bem no tempo sai **DEFESAÇA!**, com passe perfeito e bônus na barra. O Sharkataque não tem defesa.
- **Saque:** segure FORTE e solte. ◀ ▶ mira curto ou fundo, e o anel amarelo mostra onde a bola vai cair.
- **Ataque em câmera lenta:** no 3º toque o atleta pula e o tempo desacelera. **FORTE** bate forte, **PINGO** cai logo atrás da rede e ◀ ▶ mira. Com a barra cheia, **🦈** solta o **Sharkataque**, que é imparável.
- Toques, defesas e pontos enchem a barra do Sharkataque, que fica embaixo da tela.
- **Você move os dois atletas, um de cada vez.** Aperte **W** (⇄) para trocar quem você controla. Na recepção e na defesa, quem vai na bola é quem você está controlando; no 2º e no 3º toque o jogo troca sozinho, porque o mesmo atleta não pode tocar duas vezes seguidas. Quando ela vai para o outro lado, o controle continua com quem você estava movendo. Quem não está sob controle vai sozinho para a posição padrão: perto da rede quando o seu time está com a bola e, na defesa, na posição (frente ou fundo) que o seu atleta deixou livre.

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
  pingo.png   sharkataque.png  saque.png  comemorando.png
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
