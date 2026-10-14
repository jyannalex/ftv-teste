import { BALANCE } from '../data/balance'
import { type Ball, bounceDead, launchVelocity, stepBall } from './physics'
import { createRng, type Rng } from './rng'
import {
  awardPoint,
  initialScore,
  type PointReason,
  partner,
  registerTouch,
  resolveLanding,
  type ScoreState,
  type Side,
  setWinner,
  sideSign,
  type TouchState,
} from './rules'
import { planContact, updatePositions } from './contact'
import { addMeter, isMeterFull } from './specialMeter'
import { classifyHold, type Grade, gradeTiming, outgoing, type TouchAction, type Windows, windowsFor } from './touch'

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
  // Botão já segurado (desde a pausa do ponto): o saque conta a partir de agora.
  for (const h of s.hold) if (h.down) h.startT = s.time
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

/** Esquece o botão segurado sem contar como soltar (pausa, perda de foco). */
export function cancelHold(s: MatchState, team: Side): void {
  s.hold[team].down = false
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

/** Chamado sempre que a trajetória da bola muda: replaneja o próximo toque. */
function onBallLaunched(s: MatchState): void {
  s.pending = null
  s.plan = planContact(s)
  if (s.plan && s.plan.team === s.config.humanTeam) s.controlled = s.plan.athleteId
}

function windowsOf(s: MatchState, plan: ContactPlan): Windows {
  return windowsFor({
    incomingForce: plan.incomingForce,
    incomingShark: plan.incomingShark,
    easyAssist: s.config.easyAssist && plan.team === s.config.humanTeam,
  })
}

/** Antes da janela, apertar até este tempo (s) antes dela conta como furada; antes disso é ignorado. */
const WHIFF_SPAN = 0.35

const TOUCH_ACTIONS: Record<1 | 2 | 3, TouchAction> = { 1: 'passe', 2: 'levantada', 3: 'devolucao' }

/** Lê a entrada do time do plano e, se estiver na janela, agenda o toque. */
function readTouchInput(
  s: MatchState,
  inputs: [TeamInput, TeamInput],
  released: [number | null, number | null],
  events: MatchEvent[],
): void {
  const plan = s.plan
  if (!plan || s.pending || !plan.reachable) return
  const pressed = inputs[plan.team].recepcao
  const holdMs = released[plan.team]
  if (!pressed && holdMs === null) return
  const w = windowsOf(s, plan)
  const offset = s.time - plan.tIdeal
  const grade = gradeTiming(offset, w)
  if (grade === null) {
    // Cedo demais (mas perto): furou. Apertar sem parar não garante mais um toque.
    if (offset < 0 && offset > -(w.ruim + WHIFF_SPAN)) {
      events.push({ type: 'erroTiming', athleteId: plan.athleteId })
      s.plan = null
    }
    return
  }
  const executeAt = Math.max(s.time, plan.tIdeal)
  if (pressed) {
    s.pending = { action: TOUCH_ACTIONS[plan.touchIndex], grade, executeAt }
    return
  }
  const hold = classifyHold(holdMs!)
  if (hold.kind === 'pingo') {
    s.pending = { action: 'pingo', grade, executeAt }
    return
  }
  const shark = isMeterFull(s.meter[plan.team]) && Math.abs(plan.x) <= BALANCE.sharkMaxNetDist
  s.pending = { action: shark ? 'sharkataque' : 'forte', grade, executeAt, force: hold.force, overpower: hold.overpower }
}

const ATHLETE_ACTION: Partial<Record<TouchAction, AthleteAction>> = { pingo: 'pingo', sharkataque: 'sharkataque' }

function executeTouch(s: MatchState, plan: ContactPlan, p: PendingTouch, events: MatchEvent[]): void {
  const team = plan.team
  const shark = p.action === 'sharkataque'
  const from = { x: plan.x, y: plan.y + (shark ? BALANCE.sharkExtraHeight : 0) }
  const v = outgoing({ action: p.action, team, from, grade: p.grade, force: p.force, overpower: p.overpower }, s.rng)
  s.ball = { ...from, vx: v.vx, vy: v.vy }
  s.touch = registerTouch(s.touch, plan.athleteId)

  if (p.grade === 'perfeito') s.meter[team] = addMeter(s.meter[team], BALANCE.meter.perfeito)
  if (plan.incomingForce >= 0.5 || plan.incomingShark) s.meter[team] = addMeter(s.meter[team], BALANCE.meter.defesaForte)

  events.push({ type: 'toque', athleteId: plan.athleteId, action: p.action, grade: p.grade })
  if (shark) {
    s.meter[team] = 0
    events.push({ type: 'sharkataque', athleteId: plan.athleteId })
  }
  s.lastAttack =
    p.action === 'forte' || shark ? { team, force: shark ? 1 : (p.force ?? 0), shark } : null
  setAction(s.athletes[plan.athleteId], ATHLETE_ACTION[p.action] ?? plan.kind)
  onBallLaunched(s)
}

/** Toques e erros de timing durante o rally. */
function stepContacts(s: MatchState, inputs: [TeamInput, TeamInput], released: [number | null, number | null], events: MatchEvent[]): void {
  readTouchInput(s, inputs, released, events)
  const plan = s.plan
  if (plan && s.pending && s.time >= s.pending.executeAt) {
    executeTouch(s, plan, s.pending, events)
  } else if (plan && !s.pending && s.time > plan.tIdeal + windowsOf(s, plan).ruim) {
    events.push({ type: 'erroTiming', athleteId: plan.athleteId })
    s.plan = null
  }
}

/** Enquanto um toque ainda pode acontecer, a bola não "cai" (o toque sai do ponto planejado). */
function touchStillPossible(s: MatchState): boolean {
  const plan = s.plan
  if (!plan || !plan.reachable) return false
  return s.pending !== null || s.time <= plan.tIdeal + windowsOf(s, plan).ruim
}

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
      stepContacts(s, inputs, released, events)
      updatePositions(s, dt)
      if (r.landed && !touchStillPossible(s)) endRally(s, events)
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
