import { BALANCE } from '../data/balance'
import { replan, setAction, updatePositions } from './contact'
import { type Ball, bounceDead, launchVelocity, stepBall } from './physics'
import { type Edges, resolveContact, touchStillPossible } from './resolve'
import { createRng, type Rng } from './rng'
import {
  awardPoint,
  initialScore,
  type PointReason,
  partner,
  resolveLanding,
  type ScoreState,
  type Side,
  setWinner,
  sideSign,
  type TouchState,
} from './rules'
import { type Aim, aimFromMove, type Quality, type TouchAction } from './touch'

export { setAction }

export const DT = 1 / 60

export type TeamInput = {
  /** Direção na tela: −1 esquerda, +1 direita. */
  move: -1 | 0 | 1
  /** Botão esquerdo (saque, ataque forte, peixinho), segurado. */
  forte: boolean
  /** Botão direito (Pingo), segurado. */
  pingo: boolean
  /** Sharkataque, segurado. */
  shark: boolean
}
export const IDLE: TeamInput = { move: 0, forte: false, pingo: false, shark: false }

export type MatchConfig = {
  seed: number
  targetPoints: number
  /** Time controlado por humano, ou null para IA × IA. */
  humanTeam: Side | null
  /** Alcance do toque automático do atleta controlado (m). */
  humanReach: number
  /** Duração real da câmera lenta do ataque do jogador (s). */
  slowMoSec: number
}

export function matchConfig(p: Partial<MatchConfig> = {}): MatchConfig {
  return { seed: 1, targetPoints: 12, humanTeam: 0, humanReach: BALANCE.reach, slowMoSec: 1.5, ...p }
}

export type AthleteAction =
  | 'parado'
  | 'correndo'
  | 'chapa'
  | 'peito'
  | 'cabeca'
  | 'pingo'
  | 'sharkataque'
  | 'saque'
  | 'comemorando'
  | 'peixinho'

export type Athlete = {
  id: number
  team: Side
  x: number
  /** Velocidade horizontal (m/s). */
  vx: number
  /** Altura do pulo (0 no chão). */
  y: number
  targetX: number
  action: AthleteAction
  /** Tempo desde o início da ação atual (segundos). */
  actionT: number
}

export type ButtonTrack = {
  forte: boolean
  pingo: boolean
  shark: boolean
  /** Último aperto do botão esquerdo (tempo da partida). */
  fortePressAt: number | null
  /** Quando o botão esquerdo foi apertado e segue segurado; null se o aperto não vale (veio de antes). */
  forteDownAt: number | null
}

export type ContactPlan = {
  athleteId: number
  team: Side
  touchIndex: 1 | 2 | 3
  kind: 'chapa' | 'peito' | 'cabeca'
  x: number
  y: number
  /** Tempo absoluto da partida em que a bola chega ao ponto de contato. */
  tIdeal: number
  createdAt: number
  /** Ataque que vem do outro time (para o bônus de defesa). */
  incoming: 'forte' | null
  /** Já passou do contato e está esperando um peixinho atrasado. */
  resolving: boolean
  /** Escolha de ataque do 3º toque (a última borda de botão). */
  choice: 'forte' | 'pingo' | 'sharkataque' | null
  /** Já conferiu se o jogador pula para a câmera lenta. */
  jumpChecked: boolean
}

export type MatchPhase = 'saque' | 'rally' | 'ponto' | 'fim'

export type MatchState = {
  config: MatchConfig
  rng: Rng
  time: number
  phase: MatchPhase
  phaseT: number
  ball: Ball
  athletes: Athlete[]
  score: ScoreState
  touch: TouchState
  meter: [number, number]
  buttons: [ButtonTrack, ButtonTrack]
  lastAttack: { team: Side; kind: 'forte' | 'shark' } | null
  plan: ContactPlan | null
  /** Câmera lenta do ataque do jogador. */
  slowMo: { athleteId: number; aim: Aim } | null
  /** Atleta sob controle do humano (marcador amarelo). */
  controlled: number | null
  winner: Side | null
}

export type MatchEvent =
  | { type: 'saque'; athleteId: number }
  | { type: 'toque'; athleteId: number; action: TouchAction; quality: Quality }
  | { type: 'perdeu'; athleteId: number }
  | { type: 'rede' }
  | { type: 'sharkataque'; athleteId: number }
  | { type: 'ponto'; winner: Side; reason: PointReason }
  | { type: 'fimDeSet'; winner: Side }

const freshButtons = (): ButtonTrack => ({ forte: false, pingo: false, shark: false, fortePressAt: null, forteDownAt: null })

export function createMatch(config: MatchConfig): MatchState {
  const athletes: Athlete[] = [0, 1, 2, 3].map((id) => ({
    id,
    team: (id < 2 ? 0 : 1) as Side,
    x: 0,
    vx: 0,
    y: 0,
    targetX: 0,
    action: 'parado' as AthleteAction,
    actionT: 0,
  }))
  const s: MatchState = {
    config,
    rng: createRng(config.seed),
    time: 0,
    phase: 'saque',
    phaseT: 0,
    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    athletes,
    score: initialScore(),
    touch: { team: null, count: 0, lastAthlete: null },
    meter: [0, 0],
    buttons: [freshButtons(), freshButtons()],
    lastAttack: null,
    plan: null,
    slowMo: null,
    controlled: config.humanTeam === null ? null : config.humanTeam * 2,
    winner: null,
  }
  setupServe(s)
  return s
}

/** Coloca atletas e bola nas posições de saque. */
function setupServe(s: MatchState): void {
  const server = s.score.server
  for (const a of s.athletes) {
    const sign = sideSign(a.team)
    const isFront = a.id % 2 === 0
    a.x = sign * (isFront ? BALANCE.basePos.front : BALANCE.basePos.back)
    if (a.id === server) a.x = sign * BALANCE.serveX
    else if (a.id === partner(server)) a.x = sign * BALANCE.basePos.front
    a.targetX = a.x
    a.vx = 0
    a.y = 0
    setAction(a, 'parado')
  }
  const sign = sideSign(s.score.servingTeam)
  s.ball = { x: sign * (BALANCE.serveX - 0.3), y: 0.3, vx: 0, vy: 0 }
  s.touch = { team: null, count: 0, lastAthlete: null }
  s.lastAttack = null
  s.plan = null
  s.slowMo = null
  if (s.config.humanTeam === s.score.servingTeam) s.controlled = server
  // Botão já segurado (desde a pausa do ponto) não vale para o saque: precisa soltar e apertar de novo.
  for (const b of s.buttons) b.forteDownAt = null
  setPhase(s, 'saque')
}

function setPhase(s: MatchState, phase: MatchPhase): void {
  s.phase = phase
  s.phaseT = 0
  s.slowMo = null
}

/** Esquece os botões segurados sem gerar borda (pausa, perda de foco). */
export function cancelButtons(s: MatchState, team: Side): void {
  s.buttons[team] = freshButtons()
}

/** Atualiza os botões e devolve as bordas deste passo. */
function trackButtons(s: MatchState, inputs: [TeamInput, TeamInput]): [Edges, Edges] {
  return ([0, 1] as const).map((team) => {
    const b = s.buttons[team]
    const i = inputs[team]
    const e: Edges = {
      forteDown: i.forte && !b.forte,
      forteUp: !i.forte && b.forte,
      pingoDown: i.pingo && !b.pingo,
      sharkDown: i.shark && !b.shark,
    }
    if (e.forteDown) {
      b.fortePressAt = s.time
      b.forteDownAt = s.time
    }
    b.forte = i.forte
    b.pingo = i.pingo
    b.shark = i.shark
    return e
  }) as [Edges, Edges]
}

function serve(s: MatchState, aim: Aim, events: MatchEvent[]): void {
  const team = s.score.servingTeam
  const sign = sideSign(team)
  const target = -sign * BALANCE.serveDepth[aim]
  const v = launchVelocity(s.ball, { x: target, y: BALANCE.ballRadius }, { apex: BALANCE.serve.apex })
  s.ball = { ...s.ball, ...v }
  const server = s.score.server
  // O saque conta como 3 toques: bola que não passa é falta de quem sacou.
  s.touch = { team, count: 3, lastAthlete: server }
  setAction(s.athletes[server], 'saque')
  events.push({ type: 'saque', athleteId: server })
  setPhase(s, 'rally')
  replan(s)
}

function endRally(s: MatchState, events: MatchEvent[]): void {
  const { winner, reason } = resolveLanding(s.ball.x, s.touch)
  s.score = awardPoint(s.score, winner)
  s.meter[winner] = Math.min(BALANCE.meter.max, s.meter[winner] + BALANCE.meter.ponto)
  s.plan = null
  events.push({ type: 'ponto', winner, reason })
  for (const a of s.athletes) if (a.team === winner) setAction(a, 'comemorando')
  const setWin = setWinner(s.score.points, s.config.targetPoints)
  if (setWin !== null) {
    s.winner = setWin
    setPhase(s, 'fim')
    events.push({ type: 'fimDeSet', winner: setWin })
    return
  }
  setPhase(s, 'ponto')
  s.ball = bounceDead(s.ball)
}

/** Avança a partida um passo fixo. Altera o estado recebido e devolve os eventos do passo. */
export function step(s: MatchState, inputs: [TeamInput, TeamInput], dt = DT): MatchEvent[] {
  const events: MatchEvent[] = []
  if (s.phase === 'fim') return events
  const gdt = s.slowMo ? dt * BALANCE.slowMo.scale : dt
  s.time += gdt
  s.phaseT += gdt
  for (const a of s.athletes) a.actionT += gdt
  const edges = trackButtons(s, inputs)

  switch (s.phase) {
    case 'saque': {
      const team = s.score.servingTeam
      const b = s.buttons[team]
      if (edges[team].forteUp && b.forteDownAt !== null) serve(s, aimFromMove(team, inputs[team].move), events)
      else if (s.phaseT >= BALANCE.autoServeSec) serve(s, 'meio', events)
      break
    }
    case 'rally': {
      const r = stepBall(s.ball, gdt)
      s.ball = r.ball
      if (r.hitNet) {
        events.push({ type: 'rede' })
        replan(s)
      }
      resolveContact(s, inputs, edges, events)
      updatePositions(s, inputs, gdt)
      if (r.landed && !touchStillPossible(s)) endRally(s, events)
      break
    }
    case 'ponto': {
      const r = stepBall(s.ball, gdt)
      s.ball = r.landed ? (Math.abs(r.ball.vy) > 0.5 ? bounceDead(r.ball) : { ...r.ball, vx: 0, vy: 0 }) : r.ball
      if (s.phaseT >= BALANCE.pointPauseSec) setupServe(s)
      break
    }
  }
  return events
}
