# FTV - Teste

Jogo de futevôlei 2x2 para navegador e celular. Você joga contra o computador num campeonato mata-mata (quartas, semi e final) ou numa partida rápida, em três cenários de areia. São só dois botões, e o especial é o **Sharkataque**.

## Como jogar

| Ação | Celular | Teclado |
|---|---|---|
| Recepção / levantada | botão verde (esquerda) | J ou ↓ |
| Saque / ataque | botão vermelho (direita) | K ou ↑ |
| Pausa | botão ‖ | Esc |

- O seu atleta corre sozinho até a bola. O que conta é apertar **na hora certa** (Perfeito, Bom ou Ruim).
- São até 3 toques por lado, sem usar a mão: chapa ou peito → levantada → ataque de cabeça.
- No Ataque, um **toque rápido** faz o **Pingo**, e **segurar e soltar** faz o ataque forte. Se segurar demais, a bola vai para fora.
- Toques Perfeitos, defesas e pontos enchem a barra. Com ela cheia, um ataque forte perto da rede vira **Sharkataque**.

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

## Publicar

A pasta `dist/` é estática e funciona em qualquer subpasta (`base: './'`).

- **GitHub Pages:** publique o conteúdo de `dist/` (por exemplo, com a action `actions/deploy-pages`) ou numa branch `gh-pages`.
- **Netlify:** arraste a pasta `dist/` em app.netlify.com/drop.

Depois de publicado, no celular use **"Adicionar à tela inicial"** para instalar o jogo como app. Ele funciona offline.

## Créditos

Veja [CREDITS.md](CREDITS.md).
