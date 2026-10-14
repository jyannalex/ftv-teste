import { BALANCE } from '../data/balance'
import { type Ball, bounceDead, launchVelocity, stepBall } from './physics'
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
import type { Grade, TouchAction } from './touch'

export const DT = 1 / 60

export type TeamInput = {
  /** true só no passo em que o botão foi apertado. */
  recepcao: boolean
  /** true enquanto o botão está segurado. */
  ataque: boolean
}
export const IDLE: TeamInput = { recepcao: false, ataque: false }

export type MatchConfig = {
  seed: number
  targetPoints: number
  easyAssist: boolean
  /** Time controlado por humano, ou null para IA × IA. */
  humanTeam: Side | null
  /** Atraso de reação de cada time ao correr para a bola (segundos). */
  reactionDelay: [number, number]
}

export function matchConfig(p: Partial<MatchConfig> = {}): MatchConfig {
  return { seed: 1, targetPoints: 12, easyAssist: false, humanTeam: 0, reactionDelay: [0, 0.2], ...p }
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

export type Athlete = {
  id: number
  team: Side
  x: number
  /** Altura do pulo (0 no chão). */
  y: number
  targetX: number
  action: AthleteAction
  /** Tempo desde o início da ação atual (segundos). */
  actionT: number
}

export type HoldTrack = { down: boolean; startT: number }

export type ContactPlan = {
  athleteId: number
  team: Side
  touchIndex: 1 | 2 | 3
  kind: 'chapa' | 'peito' | 'cabeca'
  x: number
  y: number
  /** Tempo absoluto da partida em que a bola chega ao ponto de contato. */
  tIdeal: number
  /** Momento em que o plano foi criado (para o atraso de reação). */
  createdAt: number
  reachable: boolean
  incomingForce: number
  incomingShark: boolean
}

export type PendingTouch = {
  action: TouchAction
  grade: Grade
  executeAt: number
  force?: number
  overpower?: boolean
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
  hold: [HoldTrack, HoldTrack]
  lastAttack: { team: Side; force: number; shark: boolean } | null
  plan: ContactPlan | null
  pending: PendingTouch | null
  /** Atleta sob controle do humano (marcador amarelo). */
  controlled: number | null
  winner: Side | null
}

export type MatchEvent =
  | { type: 'saque'; athleteId: number }
  | { type: 'toque'; athleteId: number; action: TouchAction; grade: Grade }
  | { type: 'erroTiming'; athleteId: number }
  | { type: 'rede' }
  | { type: 'sharkataque'; athleteId: number }
  | { type: 'ponto'; winner: Side; reason: PointReason }
  | { type: 'fimDeSet'; winner: Side }

const FRONT = 3.5
const BACK = 6.5

export function createMatch(config: MatchConfig): MatchState {
  const athletes: Athlete[] = [0, 1, 2, 3].map((id) => ({
    id,
    team: (id < 2 ? 0 : 1) as Side,
    x: 0,
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
    hold: [
      { down: false, startT: 0 },
      { down: false, startT: 0 },
    ],
    lastAttack: null,
    plan: null,
    pending: null,
    controlled: null,
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
    a.x = sign * (isFront ? FRONT : BACK)
    if (a.id === server) a.x = sign * BALANCE.serveX
    else if (a.id === partner(server)) a.x = sign * FRONT
    a.targetX = a.x
    a.y = 0
    setAction(a, 'parado')
  }
  const sign = sideSign(s.score.servingTeam)
  s.ball = { x: sign * (BALANCE.serveX - 0.3), y: 0.3, vx: 0, vy: 0 }
  s.touch = { team: null, count: 0, lastAthlete: null }
  s.lastAttack = null
  s.plan = null
  s.pending = null
  s.controlled = s.config.humanTeam === s.score.servingTeam ? server : s.controlled
  setPhase(s, 'saque')
}

function setPhase(s: MatchState, phase: MatchPhase): void {
  s.phase = phase
  s.phaseT = 0
}

export function setAction(a: Athlete, action: AthleteAction): void {
  a.action = action
  a.actionT = 0
}

/** Atualiza o rastreio do segurar e devolve quanto tempo (ms) cada time segurou, se soltou neste passo. */
function trackHolds(s: MatchState, inputs: [TeamInput, TeamInput]): [number | null, number | null] {
  const released: [number | null, number | null] = [null, null]
  for (const team of [0, 1] as const) {
    const h = s.hold[team]
    const down = inputs[team].ataque
    if (down && !h.down) h.startT = s.time
    if (!down && h.down) released[team] = (s.time - h.startT) * 1000
    h.down = down
  }
  return released
}

function serve(s: MatchState, holdMs: number, events: MatchEvent[]): void {
  const team = s.score.servingTeam
  const sign = sideSign(team)
  const { fullMs, overMs, apex } = BALANCE.serve
  const f = Math.min(holdMs / fullMs, 1)
  const target = holdMs > overMs ? -sign * (BALANCE.halfCourt + 2) : -sign * (2 + 6.5 * f)
  const v = launchVelocity(s.ball, { x: target, y: BALANCE.ballRadius }, { apex })
  s.ball = { ...s.ball, ...v }
  const server = s.score.server
  // O saque conta como 3 toques: bola que não passa é falta de quem sacou.
  s.touch = { team, count: 3, lastAthlete: server }
  setAction(s.athletes[server], 'saque')
  events.push({ type: 'saque', athleteId: server })
  setPhase(s, 'rally')
  onBallLaunched(s)
}

/** Ponto de extensão: chamado sempre que a trajetória da bola muda. */
function onBallLaunched(_s: MatchState): void {}

function endRally(s: MatchState, events: MatchEvent[]): void {
  const { winner, reason } = resolveLanding(s.ball.x, s.touch)
  s.score = awardPoint(s.score, winner)
  s.meter[winner] = Math.min(BALANCE.meter.max, s.meter[winner] + BALANCE.meter.ponto)
  s.plan = null
  s.pending = null
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
  s.time += dt
  s.phaseT += dt
  for (const a of s.athletes) a.actionT += dt
  const released = trackHolds(s, inputs)

  switch (s.phase) {
    case 'saque': {
      const holdMs = released[s.score.servingTeam]
      if (holdMs !== null) serve(s, holdMs, events)
      else if (s.phaseT >= BALANCE.autoServeSec) serve(s, BALANCE.serve.fullMs * 0.5, events)
      break
    }
    case 'rally': {
      const r = stepBall(s.ball, dt)
      s.ball = r.ball
      if (r.hitNet) {
        events.push({ type: 'rede' })
        onBallLaunched(s)
      }
      if (r.landed) endRally(s, events)
      break
    }
    case 'ponto': {
      const r = stepBall(s.ball, dt)
      s.ball = r.landed ? (Math.abs(r.ball.vy) > 0.5 ? bounceDead(r.ball) : { ...r.ball, vx: 0, vy: 0 }) : r.ball
      if (s.phaseT >= BALANCE.pointPauseSec) setupServe(s)
      break
    }
  }
  return events
}
