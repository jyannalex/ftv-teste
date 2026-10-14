import { BALANCE } from '../data/balance'
import { isPartnerAI, replan, setAction, switchControlled, updatePositions } from './contact'
import { type Ball, bounceDead, launchVelocity, stepBall } from './physics'
import { type Edges, resolveContact } from './resolve'
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
import { type AimTarget, aimFromInput, type TouchAction } from './touch'

export { setAction }

export const DT = 1 / 60

export type TeamInput = {
  /** Direção na tela: −1 esquerda, +1 direita (eixo x). */
  move: -1 | 0 | 1
  /** Direção na tela: −1 para o fundo, +1 para perto da câmera (eixo z). */
  moveZ: -1 | 0 | 1
  /** Botão esquerdo (saque e ataque forte), segurado. */
  forte: boolean
  /** Botão direito (Pingo), segurado. */
  pingo: boolean
  /** Sharkataque, segurado. */
  shark: boolean
  /** Trocar o atleta controlado (W), segurado. */
  troca: boolean
}
export const IDLE: TeamInput = { move: 0, moveZ: 0, forte: false, pingo: false, shark: false, troca: false }

export type MatchConfig = {
  seed: number
  targetPoints: number
  /** Time controlado por humano, ou null para IA × IA. */
  humanTeam: Side | null
  /** Alcance do toque automático do atleta controlado (m). */
  humanReach: number
  /** Duração real da câmera lenta do ataque do jogador (s). */
  slowMoSec: number
  /**
   * 'dupla': o jogador move os dois atletas (troca com Q). 'solo': só o atleta 0; o parceiro é da IA
   * (entrada própria no step).
   */
  control: 'dupla' | 'solo'
  /** Faixa do atleta do jogador: −1 em cima na tela (esquerdo), +1 embaixo (direito). O parceiro fica na outra. */
  humanLane: -1 | 1
}

export function matchConfig(p: Partial<MatchConfig> = {}): MatchConfig {
  return { seed: 1, targetPoints: 12, humanTeam: 0, humanReach: BALANCE.reach, slowMoSec: 1.5, control: 'dupla', humanLane: -1, ...p }
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
  z: number
  /** Velocidade no chão (m/s). */
  vx: number
  vz: number
  /** Altura do pulo (0 no chão). */
  y: number
  action: AthleteAction
  /** Tempo desde o início da ação atual (segundos). */
  actionT: number
}

export type ButtonTrack = {
  forte: boolean
  pingo: boolean
  shark: boolean
  troca: boolean
  /** Último aperto do botão esquerdo (tempo da partida). */
  fortePressAt: number | null
  /** Quando o botão esquerdo foi apertado e segue segurado; null se o aperto não vale (veio de antes). */
  forteDownAt: number | null
  /** Direção segurada no saque/ataque (a mira): não move o atleta até o jogador mudar de direção. */
  moveLock: { move: number; moveZ: number } | null
}

export type ContactPlan = {
  athleteId: number
  team: Side
  touchIndex: 1 | 2 | 3
  kind: 'chapa' | 'peito' | 'cabeca'
  x: number
  y: number
  z: number
  /** Onde a bola cairia sem o toque: o atleta alcança em qualquer ponto entre o contato e o pouso. */
  landX: number
  landZ: number
  /** Tempo absoluto da partida em que a bola chega ao ponto de contato. */
  tIdeal: number
  createdAt: number
  /** Ataque que vem do outro time: DEFENDER dá mais alcance e a DEFESAÇA. */
  incoming: 'forte' | 'pingo' | null
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
  /** Botões da IA do parceiro do jogador (modo solo). */
  partnerButtons: ButtonTrack
  lastAttack: { team: Side; kind: 'forte' | 'pingo' | 'shark' } | null
  plan: ContactPlan | null
  /** Câmera lenta do ataque do jogador. */
  slowMo: { athleteId: number; aim: AimTarget } | null
  /** Atleta sob controle do humano (marcador amarelo). */
  controlled: number | null
  winner: Side | null
}

export type MatchEvent =
  | { type: 'saque'; athleteId: number }
  | { type: 'toque'; athleteId: number; action: TouchAction }
  | { type: 'perdeu'; athleteId: number }
  | { type: 'defesa'; athleteId: number; perfeita: boolean }
  | { type: 'rede' }
  | { type: 'sharkataque'; athleteId: number }
  | { type: 'ponto'; winner: Side; reason: PointReason }
  | { type: 'fimDeSet'; winner: Side }

const freshButtons = (): ButtonTrack => ({ forte: false, pingo: false, shark: false, troca: false, fortePressAt: null, forteDownAt: null, moveLock: null })

export function createMatch(config: MatchConfig): MatchState {
  const athletes: Athlete[] = [0, 1, 2, 3].map((id) => ({
    id,
    team: (id < 2 ? 0 : 1) as Side,
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    y: 0,
    action: 'parado' as AthleteAction,
    actionT: 0,
  }))
  const s: MatchState = {
    config,
    rng: createRng(config.seed),
    time: 0,
    phase: 'saque',
    phaseT: 0,
    ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
    athletes,
    score: initialScore(),
    touch: { team: null, count: 0, lastAthlete: null },
    meter: [0, 0],
    buttons: [freshButtons(), freshButtons()],
    partnerButtons: freshButtons(),
    lastAttack: null,
    plan: null,
    slowMo: null,
    controlled: config.humanTeam === null ? null : config.humanTeam * 2,
    winner: null,
  }
  setupServe(s)
  return s
}

/** Faixa (lado) de cada atleta: o do jogador é o escolhido, o parceiro fica no outro. */
function laneOf(s: MatchState, a: Athlete): -1 | 1 {
  const h = s.config.humanLane
  if (a.team === s.config.humanTeam) return a.id % 2 === 0 ? h : h === -1 ? 1 : -1
  return a.id % 2 === 0 ? -1 : 1
}

/** Coloca atletas e bola nas posições de saque. */
function setupServe(s: MatchState): void {
  const server = s.score.server
  for (const a of s.athletes) {
    const sign = sideSign(a.team)
    const bp = BALANCE.basePos
    const lane = laneOf(s, a)
    a.x = sign * bp.defense
    a.z = lane * bp.laneZ
    if (a.id === server) {
      a.x = sign * BALANCE.serveX
      a.z = lane * bp.serveZ
    } else if (a.id === partner(server)) {
      a.x = sign * bp.front
      a.z = lane * bp.laneZ
    }
    a.vx = 0
    a.vz = 0
    a.y = 0
    setAction(a, 'parado')
  }
  const sign = sideSign(s.score.servingTeam)
  const srv = s.athletes[server]
  s.ball = { x: sign * (BALANCE.serveX - 0.3), y: 0.3, z: srv.z, vx: 0, vy: 0, vz: 0 }
  s.touch = { team: null, count: 0, lastAthlete: null }
  s.lastAttack = null
  s.plan = null
  s.slowMo = null
  if (s.config.humanTeam === s.score.servingTeam && s.config.control === 'dupla') s.controlled = server
  // Botão já segurado (desde a pausa do ponto) não vale para o saque: precisa soltar e apertar de novo.
  for (const b of [...s.buttons, s.partnerButtons]) {
    b.forteDownAt = null
    b.moveLock = null
  }
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
  return ([0, 1] as const).map((team) => trackOne(s, s.buttons[team], inputs[team])) as [Edges, Edges]
}

/** Atualiza um conjunto de botões e devolve as bordas deste passo. */
function trackOne(s: MatchState, b: ButtonTrack, i: TeamInput): Edges {
  const e: Edges = {
    forteDown: i.forte && !b.forte,
    forteUp: !i.forte && b.forte,
    pingoDown: i.pingo && !b.pingo,
    sharkDown: i.shark && !b.shark,
    trocaDown: i.troca && !b.troca,
  }
  if (e.forteDown) {
    b.fortePressAt = s.time
    b.forteDownAt = s.time
  }
  b.forte = i.forte
  b.pingo = i.pingo
  b.shark = i.shark
  b.troca = i.troca
  if (b.moveLock && (i.move !== b.moveLock.move || i.moveZ !== b.moveLock.moveZ)) b.moveLock = null
  return e
}

function serve(
  s: MatchState,
  target: AimTarget,
  events: MatchEvent[],
  held: TeamInput = IDLE,
  track: ButtonTrack = s.buttons[s.score.servingTeam],
): void {
  const team = s.score.servingTeam
  const sign = sideSign(team)
  const to = { x: -sign * BALANCE.serveDepth[target.aim], y: BALANCE.ballRadius, z: target.lane * BALANCE.laneZ }
  const v = launchVelocity(s.ball, to, { apex: BALANCE.serve.apex })
  s.ball = { ...s.ball, ...v }
  const server = s.score.server
  // O saque conta como 3 toques: bola que não passa é falta de quem sacou.
  s.touch = { team, count: 3, lastAthlete: server }
  setAction(s.athletes[server], 'saque')
  track.moveLock = { move: held.move, moveZ: held.moveZ }
  events.push({ type: 'saque', athleteId: server })
  setPhase(s, 'rally')
  replan(s)
}

function endRally(s: MatchState, events: MatchEvent[]): void {
  const { winner, reason } = resolveLanding(s.ball.x, s.ball.z, s.touch)
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

/**
 * Avança a partida um passo fixo. Altera o estado recebido e devolve os eventos do passo.
 * `partner`: entrada da IA do parceiro do jogador (modo solo).
 */
export function step(s: MatchState, inputs: [TeamInput, TeamInput], dt = DT, partner: TeamInput = IDLE): MatchEvent[] {
  const events: MatchEvent[] = []
  if (s.phase === 'fim') return events
  const gdt = s.slowMo ? dt * BALANCE.slowMo.scale : dt
  s.time += gdt
  s.phaseT += gdt
  for (const a of s.athletes) a.actionT += gdt
  const edges = trackButtons(s, inputs)
  const partnerEdges = trackOne(s, s.partnerButtons, partner)

  switch (s.phase) {
    case 'saque': {
      const team = s.score.servingTeam
      // Modo solo: quando o saque é do parceiro, quem saca é a IA dele.
      const byPartner = isPartnerAI(s, s.score.server)
      const b = byPartner ? s.partnerButtons : s.buttons[team]
      const e = byPartner ? partnerEdges : edges[team]
      const input = byPartner ? partner : inputs[team]
      if (s.config.humanTeam !== team) switchControlled(s, edges)
      if (e.forteUp && b.forteDownAt !== null) serve(s, aimFromInput(team, input), events, input, b)
      else if (s.phaseT >= BALANCE.autoServeSec) serve(s, { aim: 'meio', lane: 0 }, events)
      break
    }
    case 'rally': {
      const r = stepBall(s.ball, gdt)
      s.ball = r.ball
      if (r.hitNet) {
        events.push({ type: 'rede' })
        replan(s)
      }
      switchControlled(s, edges)
      // Modo solo: no toque do parceiro valem a entrada e os botões da IA dele.
      const plan = s.plan
      if (plan && isPartnerAI(s, plan.athleteId)) {
        const acting: [TeamInput, TeamInput] = [...inputs]
        const actingEdges: [Edges, Edges] = [...edges]
        acting[plan.team] = partner
        actingEdges[plan.team] = partnerEdges
        resolveContact(s, acting, actingEdges, events)
      } else resolveContact(s, inputs, edges, events)
      updatePositions(s, inputs, gdt, partner)
      // Bola no chão é ponto na hora: o contato planejado (peito/chapa) é sempre antes do pouso.
      if (r.landed) endRally(s, events)
      break
    }
    case 'ponto': {
      const r = stepBall(s.ball, gdt)
      s.ball = r.landed ? (Math.abs(r.ball.vy) > 0.5 ? bounceDead(r.ball) : { ...r.ball, vx: 0, vy: 0, vz: 0 }) : r.ball
      if (s.phaseT >= BALANCE.pointPauseSec) setupServe(s)
      break
    }
  }
  return events
}
