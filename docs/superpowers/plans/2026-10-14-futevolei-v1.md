# FTV - Teste (Futevôlei 2x2) — Plano de Implementação v1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jogo de futevôlei 2x2 para navegador e celular, contra a IA, com campeonato mata-mata de 8 duplas, 3 cenários de areia, dois botões e o especial Sharkataque.

**Architecture:** `src/core` é TypeScript puro: física, regras, toques, partida, IA e campeonato, com testes no Vitest. `src/game` usa Phaser 3 só para desenhar o estado e ler os controles, e avança o `core` em passos fixos de 1/60 s. `src/data` guarda balanceamento e conteúdo. `src/save` guarda o progresso no `localStorage`.

**Tech Stack:** Node 22, TypeScript 5 (strict), Vite 6, Phaser 3.90, Vitest 3, vite-plugin-pwa 1.x.

**Spec:** `docs/superpowers/specs/2026-10-14-futevolei-design.md` (leia junto com este plano).

## Global Constraints

- Nome exibido do jogo: **"FTV - Teste"**. Todos os textos da interface em português do Brasil.
- `src/core/**` nunca importa `phaser` (há um teste que garante isso).
- Identificadores de código em inglês. Termos do domínio ficam em português: `recepcao`, `chapa`, `peito`, `cabeca`, `pingo`, `sharkataque`, `saque`, nomes dos eventos.
- Simulação em passo fixo `dt = 1/60` s, com no máximo 5 passos por quadro.
- Mundo em metros, visão lateral: rede em `x = 0` com altura 2,2; quadra de `x = -9` a `x = 9`; time 0 (jogador) na esquerda (`x < 0`), time 1 na direita. Atletas 0 e 1 são do time 0; atletas 2 e 3 são do time 1. O parceiro de um atleta é `id ^ 1`.
- Set único de **12 pontos com 2 de vantagem**. Ponto direto. Quem faz o ponto saca.
- Até 3 toques por lado; o mesmo atleta não toca duas vezes seguidas.
- Janelas de timing: Perfeito ≤ 0,05 s, Bom ≤ 0,11 s, Ruim ≤ 0,18 s. No Fácil, o time humano tem janelas ×1,5. Ataques fortes reduzem a janela por `(1 − 0,4·força)`. O Sharkataque só é defendido com Perfeito numa janela de 0,025 s.
- Ataque: soltar antes de 150 ms faz **Pingo**; força = (segurado − 150)/600, limitada a 1; segurar mais de 900 ms manda a bola para fora.
- Barra do Sharkataque: +8 por Perfeito, +12 por defender ataque forte (força ≥ 0,5) ou Sharkataque, +10 por ponto. Máximo 100. O Sharkataque zera a barra.
- Habilidade da IA por dificuldade (quartas/semi/final): Fácil 0,20/0,30/0,40 · Médio 0,45/0,55/0,65 · Difícil 0,70/0,80/0,90. A partida rápida usa o valor da semi.
- Tela em paisagem, resolução base 1280×720 com `Scale.FIT`.
- Áudio só de fontes CC0, com créditos em `public/audio/CREDITS.md`.

## Review Focus

1. **Celular: o dedo escorrega para fora do botão Ataque enquanto segura**, ou a pausa entra com o botão segurado. Isso precisa contar como soltar ou zerar, e nunca deixar o ataque "preso". Teste: Task 10, `controls.test.ts`.
2. **A aba volta do segundo plano ou um quadro demora muito.** A simulação roda no máximo 5 passos e descarta o resto, sem a bola "teleportar" ou travar. Teste: Task 10, `fixedStep.test.ts`.
3. **A bola cai exatamente sobre a faixa da rede, sem velocidade horizontal.** Ela precisa cair para um dos lados e nunca ficar parada. Teste: Task 2, `physics.test.ts`.
4. **Save antigo ou campeonato inconsistente** (por exemplo, 7 duplas ou rodada fora do intervalo). O jogo volta ao estado inicial sem travar. Teste: Task 9, `save.test.ts`.
5. **Partida que nunca acaba:** o jogador não saca (fica parado) ou a bola sai do mundo. Há saque automático depois de 8 s, a bola com `|x| > 30` conta como caída, e uma partida IA × IA sempre termina. Testes: Task 5 e Task 7.

---

## Estrutura de arquivos

```
package.json, tsconfig.json, vite.config.ts, index.html, .gitignore, .gitattributes, README.md
public/audio/…, public/icon.svg
src/main.ts                         config do Phaser e lista de cenas
src/core/rng.ts                     RNG com semente (mulberry32)
src/core/physics.ts                 bola, rede, previsão de trajetória, lançamento
src/core/rules.ts                   toques, quem faz o ponto, placar/saque, fim do set
src/core/touch.ts                   notas de timing, leitura do segurar, trajetória de saída
src/core/specialMeter.ts            barra do Sharkataque
src/core/match.ts                   estado da partida, createMatch, step
src/core/contact.ts                 planejamento do próximo toque e posicionamento dos atletas
src/core/ai.ts                      controlador da IA
src/core/tournament.ts              chaveamento e avanço
src/data/balance.ts                 constantes de jogo (BALANCE)
src/data/difficulty.ts              habilidade por dificuldade/rodada
src/data/teams.ts                   7 duplas adversárias
src/data/arenas.ts                  3 cenários
src/save/storage.ts                 SaveData, load/write, validação
src/game/loop/fixedStep.ts          acumulador de passo fixo
src/game/input/controls.ts          estado dos botões → TeamInput
src/game/render/poses.ts            poses (ângulos) por ação, incluindo a bicicleta
src/game/render/AthleteView.ts      atleta articulado
src/game/render/BallView.ts
src/game/render/Hud.ts
src/game/render/effects.ts          areia, rastro, tubarão, câmera lenta
src/game/render/arenas/{praia,clube,arena}.ts
src/game/audio/sound.ts
src/game/scenes/{Boot,Menu,TournamentSetup,Bracket,QuickMatchSetup,Match,Result,Champion,HowToPlay,Options}Scene.ts
tests/core/*.test.ts, tests/game/*.test.ts, tests/save/*.test.ts
```

---

### Task 1: Projeto base (Vite + TS + Phaser + Vitest) e RNG

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.gitattributes`, `src/main.ts`, `src/game/scenes/BootScene.ts`, `src/core/rng.ts`
- Test: `tests/core/rng.test.ts`, `tests/core/purity.test.ts`

**Interfaces:**
- Produces: `createRng(seed: number): Rng` com `Rng = { next(): number /* [0,1) */; range(min: number, max: number): number; normal(mean: number, sd: number): number }`.

- [ ] **Step 1: Criar o projeto.** Dependências: `phaser@3.90.0`. Dependências de desenvolvimento: `typescript@^5.8`, `vite@^6.3`, `vitest@^3.2`. Scripts: `dev` (`vite`), `build` (`tsc --noEmit && vite build`), `preview`, `test` (`vitest run`). No `tsconfig`, use `strict: true`, `target ES2022`, `moduleResolution bundler` e `include ["src","tests"]`. Em `vite.config.ts`, use `base: './'`. No `.gitattributes`, use `* text=auto eol=lf`. O `.gitignore` deve ter `node_modules`, `dist` e `dev-dist`.
- [ ] **Step 2: Escrever os testes que falham**

```ts
// tests/core/rng.test.ts
it('mesma semente gera a mesma sequência', () => {
  const a = createRng(42), b = createRng(42)
  expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()])
})
it('next fica em [0,1) e range respeita os limites', () => {
  const r = createRng(1)
  for (let i = 0; i < 1000; i++) { const v = r.next(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1)
    const x = r.range(-2, 3); expect(x).toBeGreaterThanOrEqual(-2); expect(x).toBeLessThan(3) }
})
it('normal tem média e desvio próximos do pedido', () => {
  const r = createRng(7); const xs = Array.from({ length: 5000 }, () => r.normal(0, 0.1))
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length)
  expect(Math.abs(mean)).toBeLessThan(0.01); expect(sd).toBeGreaterThan(0.09); expect(sd).toBeLessThan(0.11)
})

// tests/core/purity.test.ts — lê recursivamente src/core/**/*.ts com node:fs
it('src/core não importa phaser', () => {
  for (const file of coreFiles) expect(readFileSync(file, 'utf8')).not.toMatch(/from\s+['"]phaser/)
})
```

- [ ] **Step 3: Rodar `npm test`.** Esperado: FAIL (`createRng` não existe).
- [ ] **Step 4: Implementar `src/core/rng.ts`** (mulberry32; `normal` por Box-Muller). Em `src/main.ts`, crie o `Phaser.Game` 1280×720 com `Scale.FIT` e `CENTER_BOTH`, fundo `#87CEEB` e `BootScene`, que escreve "FTV - Teste" no centro.
- [ ] **Step 5: Verificar.** `npm test` passa. `npm run build` termina sem erro. `npm run dev` mostra "FTV - Teste" no navegador.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "chore: projeto base Vite + Phaser + Vitest e RNG"`

---

### Task 2: Balanceamento e física da bola

**Files:**
- Create: `src/data/balance.ts`, `src/core/physics.ts`
- Test: `tests/core/physics.test.ts`

**Interfaces:**
- Produces:
  - `BALANCE` (objeto `as const`) com o grupo inicial `{ gravity: 7.5, ballRadius: 0.11, netHeight: 2.2, halfCourt: 9, worldLimit: 30 }`. As próximas tasks acrescentam grupos.
  - `type Ball = { x: number; y: number; vx: number; vy: number }`
  - `stepBall(b: Ball, dt: number): { ball: Ball; hitNet: boolean; landed: boolean }`: pura, devolve uma bola nova.
  - `positionAt(b: Ball, t: number): { x: number; y: number }`
  - `timeToHeight(b: Ball, h: number): number | null`: tempo até a bola **descer** pela altura `h` (raiz maior), ou `null` se nunca chegar.
  - `predictLanding(b: Ball): { x: number; t: number }`: onde e quando o centro chega a `y = ballRadius`. **Ignora a rede.**
  - `launchVelocity(from: {x,y}, to: {x,y}, mode: { apex: number } | { time: number }): { vx: number; vy: number }`
  - `bounceDead(b: Ball): Ball`: quique da bola morta depois do ponto (`vy = −vy·0,4`, `vx·0,6`).

- [ ] **Step 1: Escrever os testes que falham**

```ts
const sim = (b: Ball) => { let hit = false, maxY = b.y
  for (let i = 0; i < 2000; i++) { const r = stepBall(b, 1/60); b = r.ball; hit ||= r.hitNet; maxY = Math.max(maxY, b.y); if (r.landed) return { b, hit, maxY, steps: i + 1 } }
  throw new Error('não caiu') }

it('lançamento por ápice cai no alvo e passa pelo ápice pedido', () => {
  const v = launchVelocity({ x: -5, y: 1 }, { x: 5, y: BALANCE.ballRadius }, { apex: 5 })
  const r = sim({ x: -5, y: 1, ...v })
  expect(Math.abs(r.b.x - 5)).toBeLessThan(0.15); expect(Math.abs(r.maxY - 5)).toBeLessThan(0.1); expect(r.hit).toBe(false)
})
it('lançamento por tempo cai no tempo pedido (±1 passo)', () => {
  const v = launchVelocity({ x: -1, y: 2.5 }, { x: 6, y: BALANCE.ballRadius }, { time: 0.6 })
  expect(Math.abs(sim({ x: -1, y: 2.5, ...v }).steps - 36)).toBeLessThanOrEqual(1)
})
it('bola baixa bate na rede e volta', () => {
  let b: Ball = { x: -0.5, y: 1, vx: 8, vy: 0 }, hit = false
  for (let i = 0; i < 10; i++) { const r = stepBall(b, 1/60); b = r.ball; hit ||= r.hitNet }
  expect(hit).toBe(true); expect(b.vx).toBeLessThan(0); expect(b.x).toBeLessThan(0)
})
it('bola caindo parada sobre a faixa da rede cai para um lado (Review Focus 3)', () => {
  const r = sim({ x: 0, y: 3, vx: 0, vy: 0 }); expect(Math.abs(r.b.x)).toBeGreaterThan(BALANCE.ballRadius)
})
it('predictLanding confere com a simulação', () => {
  const b = { x: 2, y: 3, vx: 3, vy: 4 }; expect(Math.abs(predictLanding(b).x - sim(b).b.x)).toBeLessThan(0.15)
})
it('timeToHeight é null quando a bola não alcança a altura', () => {
  expect(timeToHeight({ x: 0, y: 1, vx: 0, vy: 1 }, 3)).toBeNull()
})
```

- [ ] **Step 2: Rodar `npx vitest run tests/core/physics.test.ts`.** Esperado: FAIL.
- [ ] **Step 3: Implementar.** Integração por Euler semi-implícito. A rede é o segmento `x = 0`, `0 ≤ y ≤ netHeight`. Ao cruzar `x = 0` (ou com `|x| < r`), com `y − r < netHeight` e o centro anterior abaixo da faixa: `vx = −vx·0,35` e a bola é reposicionada em `x = sign(x_anterior)·r`. Se o centro anterior estava acima da faixa (contato por cima): `vy = |vy|·0,3`; se `|vx| < 0,5`, `vx = (sign(x) || 1)·0,8`. `landed` quando `y ≤ r` (com `y = r`) ou `|x| > worldLimit`.
- [ ] **Step 4: Rodar os testes.** Esperado: PASS.
- [ ] **Step 5: Commit** — `feat(core): física da bola, rede e lançamentos`

---

### Task 3: Regras (toques, ponto, saque, fim do set)

**Files:**
- Create: `src/core/rules.ts`
- Test: `tests/core/rules.test.ts`

**Interfaces:**
- Produces:
  - `type Side = 0 | 1`; `sideSign(s: Side): -1 | 1` (0 → −1); `sideOf(x: number): Side` (`x < 0` → 0); `partner(id: number): number` (`id ^ 1`); `teamOf(id: number): Side` (`id < 2` → 0).
  - `type TouchState = { team: Side | null; count: number; lastAthlete: number | null }`
  - `canTouch(t: TouchState, athleteId: number): boolean`
  - `registerTouch(t: TouchState, athleteId: number): TouchState`: time novo começa em 1; o mesmo time soma 1.
  - `type PointReason = 'chao' | 'fora' | 'falta'`
  - `resolveLanding(x: number, t: TouchState): { winner: Side; reason: PointReason }`
  - `type ScoreState = { points: [number, number]; servingTeam: Side; server: number; nextServer: [number, number] }`
  - `initialScore(): ScoreState` → `{ points: [0,0], servingTeam: 0, server: 0, nextServer: [1, 2] }`
  - `awardPoint(s: ScoreState, winner: Side): ScoreState`
  - `setWinner(points: [number, number], target: number): Side | null`

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('time novo começa com 1 toque; 4º toque e toque repetido são proibidos', () => {
  let t = registerTouch({ team: null, count: 0, lastAthlete: null }, 2)
  expect(t).toEqual({ team: 1, count: 1, lastAthlete: 2 })
  expect(canTouch(t, 2)).toBe(false); expect(canTouch(t, 3)).toBe(true)
  t = registerTouch(registerTouch(t, 3), 2); expect(t.count).toBe(3)
  expect(canTouch(t, 3)).toBe(false); expect(canTouch(t, 0)).toBe(true)
})
it('bola no chão dentro: ponto de quem não é dono do lado', () => {
  expect(resolveLanding(4, { team: 0, count: 3, lastAthlete: 1 })).toEqual({ winner: 0, reason: 'chao' })
})
it('bola no próprio lado depois de 3 toques é falta', () => {
  expect(resolveLanding(-2, { team: 0, count: 3, lastAthlete: 0 })).toEqual({ winner: 1, reason: 'falta' })
})
it('bola fora: ponto de quem não tocou por último', () => {
  expect(resolveLanding(10.5, { team: 0, count: 2, lastAthlete: 1 })).toEqual({ winner: 1, reason: 'fora' })
  expect(resolveLanding(-9.5, { team: 0, count: 1, lastAthlete: 0 })).toEqual({ winner: 1, reason: 'fora' })
})
it('quem saca mantém o saque; quem recupera alterna o sacador', () => {
  let s = awardPoint(initialScore(), 0); expect(s.server).toBe(0)
  s = awardPoint(s, 1); expect(s).toMatchObject({ servingTeam: 1, server: 2, points: [1, 1] })
  s = awardPoint(s, 0); expect(s.server).toBe(1)
  s = awardPoint(s, 1); expect(s.server).toBe(3)
})
it('set de 12 com 2 de vantagem', () => {
  expect(setWinner([12, 10], 12)).toBe(0); expect(setWinner([12, 11], 12)).toBeNull()
  expect(setWinner([11, 13], 12)).toBe(1); expect(setWinner([11, 11], 12)).toBeNull()
})
```

- [ ] **Step 2: Rodar os testes.** Esperado: FAIL.
- [ ] **Step 3: Implementar `src/core/rules.ts`.** Bola dentro quando `|x| ≤ halfCourt`.
- [ ] **Step 4: Rodar os testes.** Esperado: PASS.
- [ ] **Step 5: Commit** — `feat(core): regras de toques, pontuação e saque`

---

### Task 4: Toques (timing, segurar, trajetória de saída) e barra do Sharkataque

**Files:**
- Create: `src/core/touch.ts`, `src/core/specialMeter.ts`
- Modify: `src/data/balance.ts` (acrescentar grupos)
- Test: `tests/core/touch.test.ts`, `tests/core/specialMeter.test.ts`

**Interfaces:**
- Consumes: `Side`, `sideSign` (Task 3); `launchVelocity`, `BALANCE` (Task 2); `Rng` (Task 1).
- Produces:
  - Grupos novos em `BALANCE`: `windows: { perfeito: 0.05, bom: 0.11, ruim: 0.18 }`, `sharkWindow: 0.025`, `easyWindowScale: 1.5`, `forceWindowShrink: 0.4`, `hold: { pingoMaxMs: 150, forceRampMs: 600, overpowerMs: 900 }`, `meter: { perfeito: 8, defesaForte: 12, ponto: 10, max: 100 }`, `sharkMaxNetDist: 2.5`, `attackFarDist: 3`.
  - `type Grade = 'perfeito' | 'bom' | 'ruim'`; `type Windows = { perfeito: number; bom: number; ruim: number }`
  - `windowsFor(ctx: { incomingForce: number; incomingShark: boolean; easyAssist: boolean }): Windows`. Com Sharkataque, devolve `{ perfeito: 0.025·k, bom: 0, ruim: 0 }`, onde `k` é 1,5 com `easyAssist`.
  - `gradeTiming(offsetSec: number, w: Windows): Grade | null`
  - `classifyHold(holdMs: number): { kind: 'pingo' } | { kind: 'forte'; force: number; overpower: boolean }`
  - `type TouchAction = 'passe' | 'levantada' | 'devolucao' | 'pingo' | 'forte' | 'sharkataque'`
  - `outgoing(req: { action: TouchAction; team: Side; from: { x: number; y: number }; grade: Grade; force?: number; overpower?: boolean }, rng: Rng): { vx: number; vy: number; targetX: number }`
  - `addMeter(v: number, amount: number): number`; `isMeterFull(v: number): boolean`

**Alvos de `outgoing`** (`s = sideSign(team)`, alvo de pouso `y = ballRadius`):

| Ação | targetX base | Modo |
|---|---|---|
| passe | `s·3.0` | ápice 4,5 |
| levantada | `s·1.0` | ápice 4,0 |
| devolucao | `−s·5.0` | ápice 4,5 |
| pingo | `−s·1.2` | ápice `max(netHeight + 0.7, from.y + 0.4)` |
| forte | `−s·(1.5 + 6.5·force)`; com overpower, `−s·(halfCourt + rng.range(1.5, 3))` | tempo `0.85 − 0.4·force` |
| sharkataque | `−s·rng.range(5, 8)` | tempo 0,35 |

Erro no `targetX`: Perfeito 0; Bom `rng.range(−0.6, 0.6)`; Ruim `rng.range(−2.5, 2.5)`. Se `|from.x| > attackFarDist` e a ação é `forte`, o tempo vai ×1,3 e o erro ×2.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('notas de timing pelas janelas base', () => {
  const w = windowsFor({ incomingForce: 0, incomingShark: false, easyAssist: false })
  expect(gradeTiming(0.04, w)).toBe('perfeito'); expect(gradeTiming(-0.1, w)).toBe('bom')
  expect(gradeTiming(0.17, w)).toBe('ruim'); expect(gradeTiming(0.2, w)).toBeNull()
})
it('Fácil alarga a janela ×1,5; ataque forte encolhe', () => {
  expect(gradeTiming(0.07, windowsFor({ incomingForce: 0, incomingShark: false, easyAssist: true }))).toBe('perfeito')
  expect(windowsFor({ incomingForce: 1, incomingShark: false, easyAssist: false }).ruim).toBeCloseTo(0.108)
})
it('Sharkataque só aceita Perfeito na janela de 0,025', () => {
  const w = windowsFor({ incomingForce: 1, incomingShark: true, easyAssist: false })
  expect(gradeTiming(0.02, w)).toBe('perfeito'); expect(gradeTiming(0.04, w)).toBeNull()
})
it('classifyHold: pingo, força e exagero', () => {
  expect(classifyHold(100)).toEqual({ kind: 'pingo' })
  expect(classifyHold(450)).toEqual({ kind: 'forte', force: 0.5, overpower: false })
  expect(classifyHold(800)).toEqual({ kind: 'forte', force: 1, overpower: false })
  expect(classifyHold(950)).toMatchObject({ kind: 'forte', overpower: true })
})
it('pingo perfeito do time 1 cai a 1,2 m da rede no lado do time 0', () => {
  expect(outgoing({ action: 'pingo', team: 1, from: { x: 1, y: 2.5 }, grade: 'perfeito' }, createRng(1)).targetX).toBeCloseTo(-1.2)
})
it('forte com exagero cai fora', () => {
  expect(outgoing({ action: 'forte', team: 0, from: { x: -1, y: 2.5 }, grade: 'perfeito', force: 1, overpower: true }, createRng(1)).targetX).toBeGreaterThan(BALANCE.halfCourt)
})
it('ruim espalha mais que bom', () => {
  const spread = (g: Grade) => { const r = createRng(3); const xs = Array.from({ length: 200 }, () => outgoing({ action: 'passe', team: 0, from: { x: -4, y: 1 }, grade: g }, r).targetX); return Math.max(...xs) - Math.min(...xs) }
  expect(spread('ruim')).toBeGreaterThan(spread('bom') * 2)
})
// specialMeter.test.ts
it('barra soma e trava em 100', () => { expect(addMeter(95, 8)).toBe(100); expect(isMeterFull(100)).toBe(true); expect(isMeterFull(99)).toBe(false) })
```

- [ ] **Step 2: Rodar os testes.** Esperado: FAIL.
- [ ] **Step 3: Implementar `touch.ts` e `specialMeter.ts`** com os valores da tabela acima.
- [ ] **Step 4: Rodar os testes.** Esperado: PASS.
- [ ] **Step 5: Commit** — `feat(core): timing dos toques, pingo/força e barra do Sharkataque`

---

### Task 5: Partida, parte A (estado, saque, voo, ponto, fim do set)

**Files:**
- Create: `src/core/match.ts`, `tests/core/helpers.ts`
- Modify: `src/data/balance.ts` (`serveX: 9.5`, `runSpeed: 6`, `pointPauseSec: 1.5`, `autoServeSec: 8`, `serve: { fullMs: 800, overMs: 1000, apex: 5 }`)
- Test: `tests/core/match.serve.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces (todas em `match.ts`; `step` **altera** o estado recebido):
  - `type TeamInput = { recepcao: boolean /* true só no passo em que foi apertado */; ataque: boolean /* true enquanto segurado */ }`; `const IDLE: TeamInput`
  - `type MatchConfig = { seed: number; targetPoints: number; easyAssist: boolean; humanTeam: Side | null; reactionDelay: [number, number] }`
  - `matchConfig(p?: Partial<MatchConfig>): MatchConfig`. Padrão: `{ seed: 1, targetPoints: 12, easyAssist: false, humanTeam: 0, reactionDelay: [0, 0.2] }`.
  - `type AthleteAction = 'parado' | 'correndo' | 'chapa' | 'peito' | 'cabeca' | 'pingo' | 'sharkataque' | 'saque' | 'comemorando'`
  - `type Athlete = { id: number; team: Side; x: number; y: number; targetX: number; action: AthleteAction; actionT: number }`
  - `type HoldTrack = { down: boolean; startT: number }`
  - `type MatchState = { config; rng: Rng; time: number; phase: 'saque' | 'rally' | 'ponto' | 'fim'; phaseT: number; ball: Ball; athletes: Athlete[]; score: ScoreState; touch: TouchState; meter: [number, number]; hold: [HoldTrack, HoldTrack]; lastAttack: { team: Side; force: number; shark: boolean } | null; plan: ContactPlan | null; pending: PendingTouch | null; controlled: number | null; winner: Side | null }`. `ContactPlan` e `PendingTouch` são definidos na Task 6; nesta task ficam sempre `null`.
  - `type MatchEvent = { type: 'saque'; athleteId: number } | { type: 'toque'; athleteId: number; action: TouchAction; grade: Grade } | { type: 'erroTiming'; athleteId: number } | { type: 'rede' } | { type: 'sharkataque'; athleteId: number } | { type: 'ponto'; winner: Side; reason: PointReason } | { type: 'fimDeSet'; winner: Side }`
  - `createMatch(c: MatchConfig): MatchState`
  - `step(s: MatchState, inputs: [TeamInput, TeamInput], dt?: number): MatchEvent[]`
  - helpers de teste: `simulate(s, inputsFn: (s: MatchState, i: number) => [TeamInput, TeamInput], maxSteps: number, stopOn?: MatchEvent['type']): MatchEvent[]` e `holdThenRelease(team: Side, ms: number): inputsFn` (segura do passo 0 até `ms` e depois solta).

**Fluxo das fases:**
- **saque:** o sacador fica em `x = sideSign(team)·serveX`, com a bola no pé. Quando o time sacador solta o Ataque, com `f = min(hold/fullMs, 1)`: alvo `−s·(2 + 6.5f)`; com `hold > overMs`, alvo `−s·(halfCourt + 2)`. Lançamento com ápice 5. `touch = { team: sacador, count: 3, lastAthlete: sacador }`, ou seja, saque na rede vira falta. Emite `saque` e passa para `rally`. Sem soltar em `autoServeSec`, saca sozinho com `f = 0.5`.
- **rally:** `stepBall`; com `hitNet`, emite `rede`. Com `landed`: `resolveLanding`, `awardPoint`, `meter[winner] += 10`, emite `ponto`, passa para `ponto`. Se `setWinner(...)`, passa para `fim`, preenche `winner` e emite `fimDeSet`.
- **ponto:** depois de `pointPauseSec`, recoloca atletas e bola e volta para `saque`. A bola morta usa `bounceDead`.
- Posições iniciais: time `s`, atletas em `s·3.5` e `s·6.5`. O sacador vai para `s·serveX`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('começa 0×0 em fase de saque com o atleta 0 no fundo', () => {
  const s = createMatch(matchConfig())
  expect(s.phase).toBe('saque'); expect(s.score.points).toEqual([0, 0]); expect(s.athletes[0].x).toBeCloseTo(-9.5)
})
it('saque dentro sem recepção vira ponto do sacador', () => {
  const ev = simulate(createMatch(matchConfig()), holdThenRelease(0, 500), 3000, 'ponto')
  expect(ev).toContainEqual({ type: 'ponto', winner: 0, reason: 'chao' })
})
it('saque segurado demais sai', () => {
  expect(simulate(createMatch(matchConfig()), holdThenRelease(0, 1200), 3000, 'ponto')).toContainEqual({ type: 'ponto', winner: 1, reason: 'fora' })
})
it('depois do ponto volta ao saque com o sacador de quem pontuou', () => {
  const s = createMatch(matchConfig()); simulate(s, holdThenRelease(0, 1200), 3000, 'ponto')
  simulate(s, () => [IDLE, IDLE], 100)
  expect(s.phase).toBe('saque'); expect(s.score.servingTeam).toBe(1); expect(s.score.server).toBe(2)
})
it('saque automático depois de 8 s parado (Review Focus 5)', () => {
  expect(simulate(createMatch(matchConfig()), () => [IDLE, IDLE], 8.2 * 60, 'saque').some(e => e.type === 'saque')).toBe(true)
})
it('11×10 + ponto encerra o set', () => {
  const s = createMatch(matchConfig()); s.score.points = [11, 10]
  const ev = simulate(s, holdThenRelease(0, 500), 3000, 'fimDeSet')
  expect(ev).toContainEqual({ type: 'fimDeSet', winner: 0 }); expect(s.phase).toBe('fim')
})
it('ponto dá +10 na barra de quem pontuou', () => {
  const s = createMatch(matchConfig()); simulate(s, holdThenRelease(0, 500), 3000, 'ponto'); expect(s.meter[0]).toBe(10)
})
```

- [ ] **Step 2: Rodar os testes.** Esperado: FAIL.
- [ ] **Step 3: Implementar `createMatch`, `step` (fases, bordas do segurar em `hold[team]`) e os helpers.**
- [ ] **Step 4: Rodar `npm test`.** Esperado: PASS em tudo.
- [ ] **Step 5: Commit** — `feat(core): partida com saque, pontuação e fim de set`

---

### Task 6: Partida, parte B (planejamento do toque, movimento e execução)

**Files:**
- Create: `src/core/contact.ts`
- Modify: `src/core/match.ts`, `src/data/balance.ts` (`contact: { chapa: 0.45, peito: 1.3, cabeca: 2.5 }`, `basePos: { front: 3.5, back: 6.5, support: 1.5 }`)
- Test: `tests/core/match.touch.test.ts`; acrescentar `pressAt(...)` em `tests/core/helpers.ts`

**Interfaces:**
- Consumes: Task 5 (`MatchState`, `step`, `TeamInput`), Task 4 (`windowsFor`, `gradeTiming`, `classifyHold`, `outgoing`, `addMeter`, `isMeterFull`), Task 3 (`canTouch`, `registerTouch`).
- Produces:
  - `type ContactPlan = { athleteId: number; team: Side; touchIndex: 1 | 2 | 3; kind: 'chapa' | 'peito' | 'cabeca'; x: number; y: number; tIdeal: number /* tempo absoluto da partida */; reachable: boolean; incomingForce: number; incomingShark: boolean }`
  - `type PendingTouch = { action: TouchAction; grade: Grade; executeAt: number; force?: number; overpower?: boolean }`
  - `planContact(s: MatchState): ContactPlan | null` (em `contact.ts`)
  - `updatePositions(s: MatchState, dt: number): void` (em `contact.ts`)
  - helper de teste: `pressAt(team: Side, button: 'recepcao' | 'ataque', offsetSec: number, holdMs?: number): inputsFn`. Em cada novo `plan` do time, aperta Recepção no primeiro passo com `time ≥ tIdeal + offset`, ou segura o Ataque por `holdMs` terminando nesse instante.
  - helper de teste: `stateWithAttackPlan(team: Side, defendersX: [number, number]): MatchState`. Cria a partida (`humanTeam: null`) em `rally`, põe os atletas do outro time em `defendersX`, coloca a bola descendo perto da rede no lado de `team` (`x = s·1.0`, `y = 4`, `vx = 0`, `vy = 0`) com `touch = { team, count: 2, lastAthlete: <um atleta de team> }`, posiciona o parceiro sob a bola e define `plan = planContact(s)`, que dá `touchIndex 3`.

**Regras do planejamento** (chamado depois do saque, de cada toque e de cada `rede`):
1. `landing = predictLanding(ball)`; `team = sideOf(landing.x)`. Se `team === touch.team` e `count ≥ 3` → `null`.
2. Se `team === touch.team`, o atleta é `partner(lastAthlete)` e `touchIndex = count + 1`. Senão, é o atleta do time mais perto de `landing.x`, com `touchIndex = 1`.
3. Altura do contato: com `touchIndex === 3`, `cabeca`, se `timeToHeight(ball, 2.5)` existir. Senão, `peito` (1,3) se o atleta alcança: `|ax − px|/runSpeed + reactionDelay[team] ≤ tContato − agora`. Senão, `chapa` (0,45). `reachable` aplica o mesmo teste ao contato escolhido.
4. `incomingForce` e `incomingShark` vêm de `lastAttack`, quando ele é do outro time.

**Movimento:** o atleta do plano corre para `plan.x − s·0.3` a `runSpeed`, começando depois de `reactionDelay[team]` contado a partir da criação do plano. Os outros vão para `s·support` se o time tem a posse, ou para `front`/`back` (o mais perto pega o mais próximo) se está defendendo. `controlled` é o atleta do plano quando `plan.team === humanTeam`.

**Execução:**
- Só o time do plano tem a entrada lida. Recepção apertada ou Ataque solto em `tp`, com `offset = tp − tIdeal`: `grade = gradeTiming(offset, windowsFor({ incomingForce, incomingShark, easyAssist: config.easyAssist && team === humanTeam }))`. `grade === null` ou `!reachable` → ignora. Senão, `pending = { executeAt: max(tp, tIdeal), … }`.
- Ação: Recepção → `passe` / `levantada` / `devolucao` para os toques 1/2/3. Ataque → `classifyHold`: `pingo`, ou `forte`. `forte` com `isMeterFull(meter[team])` e `|plan.x| ≤ sharkMaxNetDist` vira `sharkataque`.
- Em `executeAt`: `outgoing` a partir da posição atual da bola, `registerTouch`, eventos `toque` (e `sharkataque`, zerando a barra), barra +8 se Perfeito e +12 se `incomingForce ≥ 0.5 || incomingShark`. `lastAttack` recebe `{team, force, shark}` para forte/sharkataque e `null` nos outros casos. Ação visual do atleta = a ação. Replaneja.
- Sem `pending` quando `time > tIdeal + windows.ruim` → emite `erroTiming`, `plan = null` e a bola segue até cair.

- [ ] **Step 1: Escrever os testes que falham**

```ts
const served = () => { const s = createMatch(matchConfig({ humanTeam: null })); simulate(s, holdThenRelease(0, 500), 200, 'saque'); return s }
it('depois do saque, um atleta do time 1 é designado para o 1º toque', () => {
  const s = served(); expect(s.plan).toMatchObject({ team: 1, touchIndex: 1 }); expect([2, 3]).toContain(s.plan!.athleteId)
})
it('recepção no tempo exato é Perfeito, passa ao parceiro e dá +8', () => {
  const s = served(); const first = s.plan!.athleteId
  const ev = simulate(s, pressAt(1, 'recepcao', 0), 400, 'toque')
  expect(ev).toContainEqual({ type: 'toque', athleteId: first, action: 'passe', grade: 'perfeito' })
  expect(s.plan).toMatchObject({ athleteId: first ^ 1, touchIndex: 2 }); expect(s.meter[1]).toBe(8)
})
it('três toques mandam a bola para o outro lado e nenhum atleta toca duas vezes seguidas', () => {
  const s = served(); const ev = simulate(s, (st, i) => st.plan?.touchIndex === 3 ? pressAt(1, 'ataque', 0, 600)(st, i) : pressAt(1, 'recepcao', 0)(st, i), 900, 'ponto')
  const toques = ev.filter(e => e.type === 'toque'); expect(toques.map(t => t.action)).toEqual(['passe', 'levantada', 'forte'])
  for (let k = 1; k < toques.length; k++) expect(toques[k].athleteId).not.toBe(toques[k - 1].athleteId)
  expect(ev).toContainEqual(expect.objectContaining({ type: 'ponto', winner: 1 }))
})
it('apertar fora da janela não toca e vira ponto', () => {
  const ev = simulate(served(), pressAt(1, 'recepcao', 0.3), 900, 'ponto')
  expect(ev.some(e => e.type === 'toque')).toBe(false); expect(ev).toContainEqual(expect.objectContaining({ type: 'erroTiming' }))
})
it('pingo cai perto da rede do outro lado', () => {
  const s = stateWithAttackPlan(1, [-3.5, -6.5])
  const ev = simulate(s, pressAt(1, 'ataque', 0, 100), 900, 'ponto')
  expect(ev).toContainEqual(expect.objectContaining({ type: 'toque', action: 'pingo' }))
  expect(Math.abs(s.ball.x)).toBeLessThan(3); expect(s.ball.x).toBeLessThan(0)
})
it('Sharkataque com barra cheia perto da rede zera a barra e emite evento', () => {
  const s = served(); s.meter[1] = 100
  const ev = simulate(s, (st, i) => st.plan?.touchIndex === 3 ? pressAt(1, 'ataque', 0, 600)(st, i) : pressAt(1, 'recepcao', 0)(st, i), 900, 'sharkataque')
  expect(ev.some(e => e.type === 'sharkataque')).toBe(true); expect(s.meter[1]).toBe(0)
})
it('Sharkataque só é defendido com Perfeito: atraso de 0,04 s não toca', () => {
  // montar estado: lastAttack = { team: 1, force: 1, shark: true }, bola descendo no lado 0, replanejar
  const s = served(); s.lastAttack = { team: 1, force: 1, shark: true }
  s.ball = { x: 1, y: 3.0, vx: -15, vy: -3 }; s.touch = { team: 1, count: 3, lastAthlete: 2 }; s.plan = planContact(s)
  expect(simulate(s, (st, i) => [pressAt(0, 'recepcao', 0.04)(st, i)[0], IDLE], 200, 'ponto').some(e => e.type === 'toque')).toBe(false)
})
it('no Fácil o humano tira Perfeito com 0,07 s de atraso', () => {
  const s = createMatch(matchConfig({ humanTeam: 1, easyAssist: true })); simulate(s, holdThenRelease(0, 500), 200, 'saque')
  expect(simulate(s, pressAt(1, 'recepcao', 0.07), 400, 'toque')).toContainEqual(expect.objectContaining({ grade: 'perfeito' }))
})
```

- [ ] **Step 2: Rodar os testes.** Esperado: FAIL.
- [ ] **Step 3: Implementar `contact.ts` e ligar planejamento, movimento e execução em `step`.**
- [ ] **Step 4: Rodar `npm test`.** Esperado: PASS em tudo, incluindo os testes da Task 5.
- [ ] **Step 5: Commit** — `feat(core): planejamento e execução dos toques, pingo, ataque e Sharkataque`

---

### Task 7: IA

**Files:**
- Create: `src/core/ai.ts`
- Test: `tests/core/ai.test.ts`

**Interfaces:**
- Consumes: `MatchState`, `TeamInput`, `ContactPlan`, `step`, `createMatch`, `matchConfig` (Tasks 5–6).
- Produces:
  - `type Personality = 'equilibrado' | 'gostaDePingo' | 'bateForte' | 'paredao'`
  - `skillParams(skill: number): { timingSigma: number; reactionDelay: number; readChance: number; forceSigma: number; sharkDefenseChance: number }`. Interpolação linear entre skill 0 e 1: `timingSigma` 0,16→0,03; `reactionDelay` 0,35→0,08; `readChance` 0→1; `forceSigma` 0,35→0,05; `sharkDefenseChance` 0,02→0,15.
  - `createAI(team: Side, skill: number, personality: Personality, rng: Rng): { think(s: MatchState): TeamInput }`
  - Quem chama passa `reactionDelay[team] = skillParams(skill).reactionDelay` no `MatchConfig`.

**Comportamento de `think`:**
- Uma decisão por plano novo do próprio time: `offset = normal(0, timingSigma)` (×0,85 no `paredao` quando `touchIndex === 1`). Com `incomingShark` e `rng.next() ≥ sharkDefenseChance`, não aperta.
- Toques 1 e 2 → Recepção. No toque 3 → ataque: "ótimo" é Pingo se a distância média dos defensores adversários até a rede for maior que 4, e forte nos outros casos. Com probabilidade `readChance` escolhe o ótimo; senão, Pingo com chance 0,3. Viés: `gostaDePingo` +0,25 na chance de Pingo, `bateForte` −0,2.
- Força desejada: 0,8 (0,9 no `bateForte`) + `normal(0, forceSigma)`; `holdMs = 150 + força·600`. Pingo: `holdMs = 90`.
- "Guardar" o Sharkataque: com barra cheia, `skill ≥ 0.5` e `max(points) < 9`, troca o forte por Pingo.
- Saque: espera 1 s na fase `saque` e segura `350 + rng.range(0, 400)` ms.
- Emissão: Recepção `true` num único passo, em `tIdeal + offset`. O Ataque fica `true` de `tIdeal + offset − holdMs/1000` até `tIdeal + offset`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
const aiMatch = (seed: number, s0: number, s1: number) => {
  const st = createMatch(matchConfig({ seed, humanTeam: null, reactionDelay: [skillParams(s0).reactionDelay, skillParams(s1).reactionDelay] }))
  const a = createAI(0, s0, 'equilibrado', createRng(seed + 100)), b = createAI(1, s1, 'equilibrado', createRng(seed + 200))
  const events: MatchEvent[] = []
  for (let i = 0; i < 60 * 60 * 20 && st.phase !== 'fim'; i++) events.push(...step(st, [a.think(st), b.think(st)]))
  return { st, events }
}
it('extremos de skillParams', () => {
  expect(skillParams(0)).toEqual({ timingSigma: 0.16, reactionDelay: 0.35, readChance: 0, forceSigma: 0.35, sharkDefenseChance: 0.02 })
  expect(skillParams(1).timingSigma).toBeCloseTo(0.03)
})
it.each([[0, 0], [0.5, 0.5], [1, 1]])('IA × IA (%s × %s) sempre termina com placar válido (Review Focus 5)', (a, b) => {
  const { st } = aiMatch(1, a, b); expect(st.phase).toBe('fim'); expect(setWinner(st.score.points, 12)).toBe(st.winner)
})
it('IA forte vence a fraca na maioria', () => {
  let wins = 0; for (let seed = 1; seed <= 10; seed++) if (aiMatch(seed, 0.1, 0.9).st.winner === 1) wins++
  expect(wins).toBeGreaterThanOrEqual(8)
})
it('IA forte tira mais Perfeito', () => {
  const rate = (sk: number) => { const t = aiMatch(3, sk, sk).events.filter(e => e.type === 'toque') as Extract<MatchEvent, { type: 'toque' }>[]; return t.filter(e => e.grade === 'perfeito').length / t.length }
  expect(rate(0.9)).toBeGreaterThan(rate(0.1))
})
it('IA com skill 1 dá Pingo contra defesa recuada', () => {
  // estado: plano do time 1 com touchIndex 3, atletas 0 e 1 em x = -7 e -6.5
  const ai = createAI(1, 1, 'equilibrado', createRng(1)); const s = stateWithAttackPlan(1, [-7, -6.5])
  let maxHold = 0, held = 0
  for (let i = 0; i < 120; i++) { const inp = ai.think(s); held = inp.ataque ? held + 1 : 0; maxHold = Math.max(maxHold, held); s.time += 1 / 60 }
  expect(maxHold * (1000 / 60)).toBeLessThan(150)
})
```

`stateWithAttackPlan` vem de `tests/core/helpers.ts` (Task 6).

- [ ] **Step 2: Rodar os testes.** Esperado: FAIL.
- [ ] **Step 3: Implementar `src/core/ai.ts`.**
- [ ] **Step 4: Rodar `npm test`.** Esperado: PASS. Se "IA forte vence" falhar, ajuste só os valores de `skillParams` dentro do espírito da spec e registre os novos valores no commit.
- [ ] **Step 5: Commit** — `feat(core): IA com habilidade e personalidade`

---

### Task 8: Dados de conteúdo e campeonato

**Files:**
- Create: `src/data/difficulty.ts`, `src/data/teams.ts`, `src/data/arenas.ts`, `src/core/tournament.ts`
- Test: `tests/core/tournament.test.ts`

**Interfaces:**
- Consumes: `Rng` (Task 1), `Personality` (Task 7).
- Produces:
  - `type Difficulty = 'facil' | 'medio' | 'dificil'`; `DIFFICULTY_SKILL: Record<Difficulty, [number, number, number]>` (valores das Global Constraints); `quickMatchSkill(d: Difficulty): number` (índice 1).
  - `type TeamDef = { id: string; name: string; shirt: number; shorts: number; personality: Personality }`; `AI_TEAMS: TeamDef[]` com 7 duplas fictícias: Tubarões do Leme (bateForte), Areia Quente (equilibrado), Pé de Ouro (gostaDePingo), Muralha do Posto 9 (paredao), Brisa Norte (gostaDePingo), Maré Alta (bateForte), Coqueiral FC (equilibrado), cada uma com cores distintas.
  - `type ArenaId = 'praia' | 'clube' | 'arena'`; `ARENAS: { id: ArenaId; name: string }[]` = Praia de dia, Quadra do Clube, Arena Noturna; `arenaForRound(round: 0 | 1 | 2): ArenaId`.
  - `type BracketMatch = { a: string; b: string; winner: string | null }`
  - `type Tournament = { difficulty: Difficulty; player: { name: string; shirt: number }; teamIds: string[] /* 8, inclui 'jogador' */; rounds: BracketMatch[][]; currentRound: 0 | 1 | 2; status: 'andamento' | 'eliminado' | 'campeao' }`
  - `createTournament(difficulty: Difficulty, player: { name: string; shirt: number }, rng: Rng): Tournament`
  - `playerMatch(t: Tournament): { opponentId: string; round: 0 | 1 | 2; skill: number; arena: ArenaId } | null`
  - `recordPlayerResult(t: Tournament, playerWon: boolean, rng: Rng): Tournament`: preenche o vencedor da partida do jogador e sorteia as outras da rodada (50%). Se o jogador venceu na rodada 2, `campeao`. Se venceu antes, monta a próxima rodada pareando os vencedores em ordem (0×1, 2×3). Se perdeu, `eliminado`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
const t0 = () => createTournament('medio', { name: 'Os Brabos', shirt: 0xff0000 }, createRng(1))
it('8 duplas distintas, uma é o jogador, 4 jogos nas quartas', () => {
  const t = t0(); expect(new Set(t.teamIds).size).toBe(8); expect(t.teamIds.filter(id => id === 'jogador')).toHaveLength(1)
  expect(t.rounds[0]).toHaveLength(4)
})
it('vencer avança com os vencedores da rodada anterior', () => {
  const t = recordPlayerResult(t0(), true, createRng(2)); expect(t.currentRound).toBe(1); expect(t.rounds[1]).toHaveLength(2)
  const winners = t.rounds[0].map(m => m.winner); expect(t.rounds[1].flatMap(m => [m.a, m.b]).sort()).toEqual([...winners].sort())
})
it('perder elimina', () => { expect(recordPlayerResult(t0(), false, createRng(2)).status).toBe('eliminado') })
it('três vitórias = campeão', () => {
  let t = t0(); for (let i = 0; i < 3; i++) t = recordPlayerResult(t, true, createRng(i)); expect(t.status).toBe('campeao')
})
it('habilidade e cenário por rodada', () => {
  let t = t0(); expect(playerMatch(t)).toMatchObject({ round: 0, skill: 0.45, arena: 'praia' })
  t = recordPlayerResult(recordPlayerResult(t, true, createRng(1)), true, createRng(2))
  expect(playerMatch(t)).toMatchObject({ round: 2, skill: 0.65, arena: 'arena' })
})
it('partida rápida usa o valor da semi', () => { expect(quickMatchSkill('dificil')).toBe(0.8) })
```

- [ ] **Step 2: Rodar os testes.** Esperado: FAIL.
- [ ] **Step 3: Implementar os quatro arquivos.**
- [ ] **Step 4: Rodar os testes.** Esperado: PASS.
- [ ] **Step 5: Commit** — `feat: campeonato mata-mata, duplas, cenários e dificuldades`

---

### Task 9: Save no aparelho

**Files:**
- Create: `src/save/storage.ts`
- Test: `tests/save/save.test.ts`

**Interfaces:**
- Consumes: `Tournament`, `Difficulty`, `ArenaId` (Task 8).
- Produces:
  - `type SaveData = { version: 1; tournament: Tournament | null; unlockedArenas: ArenaId[]; titles: Record<Difficulty, number>; options: { sound: boolean; music: boolean }; tipsShown: boolean }`
  - `DEFAULT_SAVE: SaveData`: `unlockedArenas: ['praia']`, títulos 0, som e música ligados, `tipsShown: false`.
  - `type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>`
  - `SAVE_KEY = 'ftv-teste-save'`
  - `getBrowserStore(): KeyValueStore | null`: testa gravar e apagar uma chave dentro de try/catch.
  - `loadSave(store: KeyValueStore | null): { data: SaveData; available: boolean }`
  - `writeSave(store: KeyValueStore | null, data: SaveData): boolean`
  - `unlockForRound(data: SaveData, round: 0 | 1 | 2): SaveData`: rodada 1 libera `clube` e rodada 2 libera `arena`, sem duplicar.
  - `resetSave(store): SaveData`

- [ ] **Step 1: Escrever os testes que falham**

```ts
const mem = (): KeyValueStore => { const m = new Map<string, string>(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k) } }
it('ida e volta', () => {
  const st = mem(); const d = { ...DEFAULT_SAVE, tipsShown: true, titles: { facil: 1, medio: 0, dificil: 0 } }
  expect(writeSave(st, d)).toBe(true); expect(loadSave(st).data).toEqual(d)
})
it('JSON quebrado volta ao padrão', () => { const st = mem(); st.setItem(SAVE_KEY, '{oops'); expect(loadSave(st).data).toEqual(DEFAULT_SAVE) })
it('campeonato inconsistente volta ao padrão (Review Focus 4)', () => {
  const st = mem(); const bad = { ...DEFAULT_SAVE, tournament: { ...createTournament('facil', { name: 'X', shirt: 0 }, createRng(1)), teamIds: ['a','b','c','d','e','f','g'] } }
  st.setItem(SAVE_KEY, JSON.stringify(bad)); expect(loadSave(st).data).toEqual(DEFAULT_SAVE)
  st.setItem(SAVE_KEY, JSON.stringify({ ...DEFAULT_SAVE, version: 99 })); expect(loadSave(st).data).toEqual(DEFAULT_SAVE)
})
it('armazenamento que lança erro: indisponível, sem travar', () => {
  const boom: KeyValueStore = { getItem: () => { throw new Error() }, setItem: () => { throw new Error() }, removeItem: () => {} }
  expect(loadSave(boom)).toEqual({ data: DEFAULT_SAVE, available: false }); expect(writeSave(boom, DEFAULT_SAVE)).toBe(false)
  expect(loadSave(null).available).toBe(false)
})
it('liberação de cenários por rodada', () => {
  expect(unlockForRound(DEFAULT_SAVE, 1).unlockedArenas).toEqual(['praia', 'clube'])
  expect(unlockForRound(unlockForRound(DEFAULT_SAVE, 1), 2).unlockedArenas).toEqual(['praia', 'clube', 'arena'])
})
```

- [ ] **Step 2: Rodar os testes.** Esperado: FAIL.
- [ ] **Step 3: Implementar `storage.ts`.** A validação confere tipos de todos os campos; no `tournament`, exige 8 `teamIds` únicos com `'jogador'`, `rounds[0]` com 4 jogos, `currentRound` em 0..2 e ids dos jogos presentes em `teamIds`. Qualquer falha devolve `DEFAULT_SAVE` inteiro.
- [ ] **Step 4: Rodar os testes.** Esperado: PASS.
- [ ] **Step 5: Commit** — `feat: save local com validação`

---

### Task 10: Partida jogável no Phaser (controles, passo fixo, atletas, HUD, pausa)

**Files:**
- Create: `src/game/loop/fixedStep.ts`, `src/game/input/controls.ts`, `src/game/render/poses.ts`, `src/game/render/AthleteView.ts`, `src/game/render/BallView.ts`, `src/game/render/Hud.ts`, `src/game/scenes/MatchScene.ts`
- Modify: `src/main.ts` (Boot → Match direto, provisório até a Task 12)
- Test: `tests/game/fixedStep.test.ts`, `tests/game/controls.test.ts`, `tests/game/poses.test.ts`

**Interfaces:**
- Consumes: `createMatch`, `step`, `MatchState`, `MatchEvent`, `TeamInput` (Tasks 5–6); `createAI`, `skillParams` (Task 7); `AI_TEAMS`, `ArenaId` (Task 8).
- Produces:
  - `createFixedStepper(stepFn: () => void, dt?: number /* 1/60 */, maxSteps?: number /* 5 */): { advance(elapsedSec: number): number; timeScale: number }`. Devolve quantos passos rodou; o excedente é descartado. `timeScale` multiplica o tempo decorrido (usado pela câmera lenta na Task 11).
  - `class Controls { pressRecepcao(): void; setAtaque(down: boolean): void; consume(): TeamInput; reset(): void }`. `recepcao` fica guardado até o próximo `consume`.
  - `type Pose = Record<'tronco' | 'cabeca' | 'bracoE' | 'bracoD' | 'coxaE' | 'canelaE' | 'coxaD' | 'canelaD', number> & { rootY: number; rootRot: number }`; `poseFor(action: AthleteAction, t: number /* 0..1 */): Pose`
  - `MatchSceneData = { mode: 'campeonato' | 'rapida'; arena: ArenaId; opponentId: string; skill: number; easyAssist: boolean; player: { name: string; shirt: number } }`. Ao terminar, faz `scene.start('Result', { winner, points, data })`. Até a Task 12, `Result` ainda não existe: termine com um texto "Fim — toque para jogar de novo".

- [ ] **Step 1: Escrever os testes que falham**

```ts
// fixedStep.test.ts (Review Focus 2)
it('1/60 s roda 1 passo; 1 s de atraso roda no máximo 5 e descarta o resto', () => {
  let n = 0; const fs = createFixedStepper(() => n++)
  expect(fs.advance(1 / 60)).toBe(1); expect(fs.advance(1)).toBe(5); expect(fs.advance(1 / 60)).toBe(1); expect(n).toBe(7)
})
it('timeScale 0,3 desacelera', () => { let n = 0; const fs = createFixedStepper(() => n++); fs.timeScale = 0.3; fs.advance(10 / 60); expect(n).toBe(3) })
// controls.test.ts (Review Focus 1)
it('recepção é entregue uma vez só', () => { const c = new Controls(); c.pressRecepcao(); expect(c.consume().recepcao).toBe(true); expect(c.consume().recepcao).toBe(false) })
it('segurar e soltar o ataque, junto com recepção', () => {
  const c = new Controls(); c.setAtaque(true); c.pressRecepcao(); expect(c.consume()).toEqual({ recepcao: true, ataque: true })
  c.setAtaque(false); expect(c.consume().ataque).toBe(false)
})
it('reset (pausa / dedo saiu do botão) solta o ataque', () => { const c = new Controls(); c.setAtaque(true); c.reset(); expect(c.consume()).toEqual({ recepcao: false, ataque: false }) })
// poses.test.ts
it('todas as ações dão poses finitas; sharkataque fica de cabeça para baixo no meio', () => {
  for (const a of ['parado','correndo','chapa','peito','cabeca','pingo','sharkataque','saque','comemorando'] as const)
    for (const t of [0, 0.5, 1]) for (const v of Object.values(poseFor(a, t))) expect(Number.isFinite(v)).toBe(true)
  expect(Math.abs(poseFor('sharkataque', 0.5).rootRot)).toBeGreaterThan(Math.PI * 0.7)
})
```

- [ ] **Step 2: Rodar os testes.** Esperado: FAIL.
- [ ] **Step 3: Implementar `fixedStep.ts`, `controls.ts` e `poses.ts`** (poses com keyframes interpolados; a bicicleta gira `rootRot` de 0 a ~π e volta, com a perna direita esticada acima da cabeça no contato).
- [ ] **Step 4: Rodar os testes.** Esperado: PASS.
- [ ] **Step 5: Implementar a cena.**
  - Mapa mundo→tela: `x ∈ [−12, 12]` → `[0, 1280]`, chão da areia em `y = 600 px`, 1 m ≈ 53 px.
  - `AthleteView`: um `Container` com segmentos desenhados por `Graphics` (cor da camisa e do short da dupla, pele, cabelo), aplicando `poseFor`.
  - Bola amarela e preta, como a das fotos, com sombra na areia.
  - `Hud`: placar com os nomes no topo, duas barras de Sharkataque (a cheia pisca), contador de toques 1/2/3, marcador amarelo sobre `controlled`, texto flutuante "PERFEITO!"/"BOM"/"RUIM"/"ERROU" nos eventos.
  - Botões redondos no canto inferior: Recepção à esquerda e Ataque à direita. `this.input.addPointer(2)`. `pointerdown` → `setAtaque(true)`; `pointerup`, `pointerout` e `pointerupoutside` → `setAtaque(false)`. Teclas J/↓ e K/↑.
  - Esc ou ícone de pausa abre um overlay com Continuar, Reiniciar e Sair. Entrar na pausa chama `controls.reset()`. `this.game.events.on('blur')` também pausa.
  - A IA do time 1 usa `createAI(1, skill, personality, rng)`, com `reactionDelay = [0, skillParams(skill).reactionDelay]` e `humanTeam: 0`.
- [ ] **Step 6: Verificar.** `npm test` passa e `npm run build` termina sem erro. Com `npm run dev`, confira no navegador: sacar segurando K, receber com J no tempo, levantar, dar um Pingo (toque rápido em K) e um ataque forte (segurar K), ver o ponto e o placar mudarem, pausar com Esc e voltar. Com `npm run dev -- --host`, abra no celular pela rede local e repita com os botões na tela.
- [ ] **Step 7: Commit** — `feat(game): partida jogável com controles, atletas articulados e HUD`

---

### Task 11: Cenários e efeitos

**Files:**
- Create: `src/game/render/arenas/praia.ts`, `src/game/render/arenas/clube.ts`, `src/game/render/arenas/arena.ts`, `src/game/render/effects.ts`
- Modify: `src/game/scenes/MatchScene.ts`

**Interfaces:**
- Consumes: `ArenaId` (Task 8), `MatchEvent` (Task 5), `createFixedStepper().timeScale` (Task 10).
- Produces: `drawArena(scene: Phaser.Scene, id: ArenaId): { update(time: number): void }`, que cria camadas de fundo com parallax leve e animações (ondas, gaivotas, torcida). Em `effects.ts`: `sandPuff(scene, x, y)`, `ballTrail(scene, ball)`, `sharkEffect(scene, x, y)`.

- [ ] **Step 1: Implementar os três cenários** conforme a tabela da spec (seção 7), todos desenhados por `Graphics`. Praia: céu, mar com ondas animadas, coqueiros, guarda-sóis, gaivotas. Clube: muro, árvores, rede de proteção, cadeiras de plástico brancas. Arena: céu noturno, arquibancada com torcida que balança, refletores, faixas. Areia e rede (postes, faixa) iguais nos três.
- [ ] **Step 2: Ligar os efeitos aos eventos.** Areia no pulo e quando a bola cai. Rastro na bola em `forte` com força ≥ 0,5. Em `sharkataque`: barbatana e boca de tubarão saindo do pé, flash, `timeScale = 0.3` por 250 ms de tempo real e tremida leve da câmera.
- [ ] **Step 3: Permitir `?arena=clube` / `?arena=arena` na URL** (só enquanto o menu da Task 12 não existe) para conferir cada cenário.
- [ ] **Step 4: Verificar.** `npm run build` sem erro. No navegador, abra os 3 cenários e confira que o desenho não cobre a bola, os atletas e o HUD. Use `pressAt` manual (barra cheia via console: `window.__match.meter[0] = 100`, exposto só em `import.meta.env.DEV`) para ver o Sharkataque com câmera lenta.
- [ ] **Step 5: Commit** — `feat(game): cenários praia, clube e arena noturna, e efeitos do Sharkataque`

---

### Task 12: Menus, campeonato e progresso

**Files:**
- Create: `src/game/scenes/MenuScene.ts`, `TournamentSetupScene.ts`, `BracketScene.ts`, `QuickMatchSetupScene.ts`, `ResultScene.ts`, `ChampionScene.ts`, `HowToPlayScene.ts`, `OptionsScene.ts`, `src/game/ui/button.ts`, `src/game/session.ts`
- Modify: `src/main.ts` (lista de cenas, `dom: { createContainer: true }`, Boot → Menu), `src/game/scenes/MatchScene.ts` (dicas, fim → Result)

**Interfaces:**
- Consumes: Tasks 8–10.
- Produces: `session.ts` guarda em memória `{ save: SaveData; storageAvailable: boolean; store: KeyValueStore | null }` e expõe `getSession()` e `persist(mutator: (d: SaveData) => SaveData): void`. A primeira chamada de `persist` com o armazenamento indisponível mostra um aviso uma vez por sessão: "Seu progresso não será salvo neste navegador". `button(scene, x, y, label, onClick)`.

- [ ] **Step 1: Escrever as telas** seguindo o fluxo da spec (seção 9):
  - **Menu:** Campeonato, Partida Rápida, Como Jogar, Opções. "Continuar campeonato" aparece se `save.tournament?.status === 'andamento'`.
  - **TournamentSetup:** 3 botões de dificuldade, campo de nome (DOM `<input maxlength=16>`, padrão "Minha Dupla"), 6 cores de camisa. "Começar" chama `createTournament` e `persist`, e abre o Bracket.
  - **Bracket:** desenha quartas, semi e final com os nomes, destacando a dupla do jogador. O botão "Jogar" abre a Match com `playerMatch`, `easyAssist: difficulty === 'facil'` e a personalidade da dupla adversária.
  - **Result:** placar final, vitória ou derrota. No campeonato: `recordPlayerResult`, `unlockForRound(novaRodada)` e `persist`. Depois: campeão → Champion (troféu, `titles[d] += 1`, `tournament = null`); eliminado → "Tentar de novo" (novo campeonato na mesma dificuldade) ou "Menu"; senão → Bracket. Na partida rápida: "Jogar de novo" ou "Menu".
  - **QuickMatchSetup:** cenários liberados (bloqueados aparecem com cadeado), dificuldade, adversário sorteado de `AI_TEAMS`, `skill = quickMatchSkill(d)`.
  - **HowToPlay:** 4 painéis ilustrados: os 2 botões, os 3 toques (chapa/peito → levantada → cabeça), Pingo × ataque forte, barra do Sharkataque.
  - **Options:** som e música liga/desliga, e "Reiniciar progresso" com confirmação "Tem certeza?", que chama `resetSave`.
- [ ] **Step 2: Dicas da primeira partida.** Se `!save.tipsShown`, a MatchScene mostra mensagens contextuais no primeiro rally: "Segure Ataque e solte para sacar", "Aperte Recepção agora!" (quando surge um plano do time 0 em `touchIndex` 1 ou 2), "Toque rápido = Pingo · Segure = ataque forte" (no `touchIndex` 3). Ao fim do primeiro rally, `persist(d => ({ ...d, tipsShown: true }))`.
- [ ] **Step 3: Verificar** no navegador:
  - campeonato completo no Fácil até o título (o contador de títulos sobe);
  - perder uma partida (deixando a bola cair) → eliminado → "Tentar de novo" funciona;
  - fechar a aba no meio do campeonato e reabrir → "Continuar campeonato" volta para a chave certa;
  - a Partida Rápida mostra o Clube só depois de chegar à semi;
  - "Reiniciar progresso" zera tudo;
  - numa janela anônima com armazenamento bloqueado, o jogo funciona e avisa uma vez.
  
  `npm test` e `npm run build` passam.
- [ ] **Step 4: Commit** — `feat(game): menus, campeonato, partida rápida, opções e dicas`

---

### Task 13: Som, PWA, orientação e publicação

**Files:**
- Create: `src/game/audio/sound.ts`, `public/audio/*.ogg` + `*.mp3`, `public/audio/CREDITS.md`, `public/icon.svg`, `README.md`
- Modify: `package.json` (`vite-plugin-pwa@^1.0`, `@vite-pwa/assets-generator@^1.0`), `vite.config.ts`, `index.html`, `src/game/scenes/BootScene.ts` (preload do áudio), `MatchScene.ts`, `MenuScene.ts`

**Interfaces:**
- Consumes: `session` (Task 12), `MatchEvent` (Task 5).
- Produces: `sound.ts` com `playSfx(scene, key: 'toque' | 'apito' | 'torcida' | 'areia' | 'sharkataque')` e `setMusic(scene, on: boolean)`. As duas respeitam `save.options` e capturam qualquer erro de áudio, deixando o jogo seguir sem som.

- [ ] **Step 1: Áudio.** Baixe efeitos CC0 dos pacotes da Kenney (kenney.nl: "Impact Sounds", "Interface Sounds") e uma música CC0 leve do OpenGameArt. Registre autor, link e licença de cada arquivo em `CREDITS.md`. Toque: `toque` em cada toque, `apito` no ponto e no fim do set, `torcida` no ponto, `sharkataque` no especial e `areia` no pulo. A música toca em loop no Menu e na Partida. O desbloqueio do áudio na primeira interação fica com o Phaser; confira que nada toca antes dela.
- [ ] **Step 2: Orientação e tela cheia.** Um overlay em CSS no `index.html` com "Gire o aparelho 📱↻" aparece em `@media (orientation: portrait) and (pointer: coarse)` e pausa a partida (escutando `resize` do Phaser). No primeiro toque no Menu em celular, `scale.startFullscreen()` dentro de try/catch.
- [ ] **Step 3: PWA.** `VitePWA({ registerType: 'autoUpdate', manifest: { name: 'FTV - Teste', short_name: 'FTV', orientation: 'landscape', display: 'fullscreen', background_color: '#f4d58d', theme_color: '#1e88e5' }, workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ogg,mp3}'] } })`. Gere os ícones 192 e 512 a partir de `public/icon.svg` (silhueta da bicicleta + bola) com o assets-generator.
- [ ] **Step 4: README.** Como rodar (`npm install`, `npm run dev`), testar (`npm test`), gerar (`npm run build`) e publicar a pasta `dist/` no GitHub Pages ou Netlify (funciona por causa do `base: './'`).
- [ ] **Step 5: Verificar.**
  - `npm test` e `npm run build` passam.
  - `npm run preview`: o Chrome DevTools → Application mostra manifest válido e service worker ativo.
  - Com a rede desligada, recarregar ainda abre o jogo.
  - No celular (via `--host` ou publicado), "Adicionar à tela inicial" instala o jogo; em pé aparece o aviso, deitado joga.
  - O som desliga pelas Opções.
- [ ] **Step 6: Commit** — `feat: som, PWA instalável, aviso de orientação e README`

---

## Cobertura da spec (conferência)

| Spec | Task |
|---|---|
| 2 Plataforma, PWA, paisagem, testes | 1, 10, 13 |
| 3 Arquitetura, passo fixo, eventos | 1, 5, 10 |
| 4.2–4.3 Controles, troca automática | 6, 10 |
| 4.4–4.6 Toques, ataque, defesa, Sharkataque | 4, 6 |
| 4.7 Regras, saque, set de 12 | 3, 5 |
| 4.8 Barra | 4, 5, 6 |
| 4.9 HUD | 10 |
| 5 IA e dificuldade | 7, 8 |
| 6 Campeonato | 8, 12 |
| 7 Cenários e liberação | 8, 9, 11, 12 |
| 8 Arte e animação | 10, 11 |
| 9 Telas, Como Jogar, dicas, Opções | 10, 12 |
| 10 Persistência | 9, 12 |
| 11 Som | 13 |
| 12 Tratamento de erros | 5, 9, 10, 12, 13 |
| 13 Testes | 1–10 |
