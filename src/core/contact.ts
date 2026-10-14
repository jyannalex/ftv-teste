import { BALANCE } from '../data/balance'
import { type Athlete, type AthleteAction, type ContactPlan, IDLE, type MatchState, type TeamInput } from './match'
import type { Edges } from './resolve'
import { positionAt, predictLanding, timeToHeight } from './physics'
import { partner, type Side, sideOf, sideSign, teamOf } from './rules'

type Kind = ContactPlan['kind']

export function setAction(a: Athlete, action: AthleteAction): void {
  a.action = action
  a.actionT = 0
}

/** Decide quem faz o próximo toque, onde e quando. null se ninguém deve tocar. */
export function planContact(s: MatchState): ContactPlan | null {
  const landing = predictLanding(s.ball)
  // Bola indo para fora: ninguém toca.
  if (Math.abs(landing.x) > BALANCE.halfCourt + BALANCE.outMargin || Math.abs(landing.z) > BALANCE.halfWidth + BALANCE.outMargin) return null
  const team = sideOf(landing.x)
  // Sharkataque não é defendido.
  if (s.lastAttack?.kind === 'shark' && s.lastAttack.team !== team) return null
  const t = s.touch
  const continuing = t.team === team
  if (continuing && t.count >= 3) return null

  let athleteId: number
  let touchIndex: 1 | 2 | 3
  if (continuing && t.lastAthlete !== null) {
    athleteId = partner(t.lastAthlete)
    touchIndex = (t.count + 1) as 2 | 3
  } else if (team === s.config.humanTeam && s.config.control === 'dupla' && s.controlled !== null && teamOf(s.controlled) === team) {
    // 1º toque do jogador: vai quem ele está controlando (troca com Q).
    athleteId = s.controlled
    touchIndex = 1
  } else {
    const [a, b] = s.athletes.filter((x) => x.team === team)
    athleteId = planeDist(a, landing) <= planeDist(b, landing) ? a.id : b.id
    touchIndex = 1
  }

  const athlete = s.athletes[athleteId]
  const contactAt = (kind: Kind) => {
    const dt = timeToHeight(s.ball, BALANCE.contact[kind])
    if (dt === null) return null
    const p = positionAt(s.ball, dt)
    if (sideOf(p.x) !== team) return null
    const reachable = planeDist(athlete, p) / BALANCE.move.manual <= dt
    return { kind, x: p.x, y: p.y, z: p.z, dt, reachable }
  }

  const order: Kind[] = touchIndex === 3 ? ['cabeca', 'peito', 'chapa'] : ['peito', 'chapa']
  const options = order.map(contactAt).filter((c) => c !== null)
  if (options.length === 0) return null
  // No 3º toque a cabeça vem primeiro se der; nos outros, peito se dá tempo de chegar, senão chapa.
  const chosen =
    touchIndex === 3 && options[0].kind === 'cabeca' ? options[0] : (options.find((c) => c.reachable) ?? options[options.length - 1])

  const la = s.lastAttack
  const incoming = la && la.team !== team && (la.kind === 'forte' || la.kind === 'pingo') ? la.kind : null
  return {
    athleteId,
    team,
    touchIndex,
    kind: chosen.kind,
    x: chosen.x,
    y: chosen.y,
    z: chosen.z,
    landX: landing.x,
    landZ: landing.z,
    tIdeal: s.time + chosen.dt,
    createdAt: s.time,
    incoming,
    choice: null,
    jumpChecked: false,
  }
}

/** Botão W: troca o atleta controlado; se a bola vem para o 1º toque, quem vai é o novo controlado. */
export function switchControlled(s: MatchState, edges: [Edges, Edges]): void {
  const team = s.config.humanTeam
  if (team === null || s.config.control === 'solo' || !edges[team].trocaDown || s.slowMo || s.controlled === null) return
  const plan = s.plan
  // 2º e 3º toque: o atleta é obrigatório pela regra.
  if (plan && plan.team === team && plan.touchIndex > 1) return
  if (s.phase === 'saque' && s.score.servingTeam === team) return
  s.controlled = partner(s.controlled)
  if (plan && plan.team === team) plan.athleteId = s.controlled
}

/** Modo solo: o atleta é o parceiro do jogador, movido pela IA dele. */
export function isPartnerAI(s: MatchState, athleteId: number): boolean {
  return s.config.control === 'solo' && teamOf(athleteId) === s.config.humanTeam && athleteId !== s.controlled
}

/** Replaneja depois de qualquer mudança de trajetória e troca o atleta controlado. */
export function replan(s: MatchState): void {
  s.plan = planContact(s)
  if (s.plan && s.plan.team === s.config.humanTeam && s.config.control === 'dupla') s.controlled = s.plan.athleteId
}

const MIN_X = 0.3
const MAX_X = 11
/** Ganho do "vai até o alvo e freia" (1/s). */
const SEEK_GAIN = 6

/** Distância no chão (plano x, z). */
export const planeDist = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z)

/**
 * Distância do atleta à trajetória da bola no chão, do ponto de contato até o pouso: quem está
 * embaixo da bola (inclusive sobre a marca de queda) alcança, não só quem está no ponto exato.
 */
export function reachDist(a: { x: number; z: number }, p: ContactPlan): number {
  const dx = p.landX - p.x
  const dz = p.landZ - p.z
  const len2 = dx * dx + dz * dz
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((a.x - p.x) * dx + (a.z - p.z) * dz) / len2))
  return Math.hypot(a.x - (p.x + t * dx), a.z - (p.z + t * dz))
}

function clampToSide(a: Athlete): void {
  const sign = sideSign(a.team)
  const d = Math.abs(a.x)
  if (d < MIN_X || d > MAX_X) {
    a.x = sign * Math.min(MAX_X, Math.max(MIN_X, d))
    a.vx = 0
  }
  const zMax = BALANCE.athleteMaxZ
  if (Math.abs(a.z) > zMax) {
    a.z = Math.sign(a.z) * zMax
    a.vz = 0
  }
}

/** Aproxima uma velocidade da desejada com aceleração/frenagem. */
function approach(v: number, desired: number, dt: number): number {
  const m = BALANCE.move
  const speedingUp = Math.abs(desired) > Math.abs(v) && (v === 0 || Math.sign(desired) === Math.sign(v))
  const rate = speedingUp ? m.accel : m.decel
  const dv = desired - v
  return v + Math.sign(dv) * Math.min(Math.abs(dv), rate * dt)
}

/** Leva a velocidade até a desejada (por eixo) e anda. */
function drive(a: Athlete, desiredVx: number, desiredVz: number, dt: number): void {
  a.vx = approach(a.vx, desiredVx, dt)
  a.vz = approach(a.vz, desiredVz, dt)
  a.x += a.vx * dt
  a.z += a.vz * dt
  clampToSide(a)
}

/** Direção da entrada → velocidade desejada (diagonal com a mesma velocidade máxima). */
function inputVelocity(move: number, moveZ: number, speed: number): [number, number] {
  const len = Math.hypot(move, moveZ)
  return len === 0 ? [0, 0] : [(move / len) * speed, (moveZ / len) * speed]
}

/** Vai até um ponto do próprio lado, freando ao chegar. */
function seek(a: Athlete, team: Side, target: { x: number; z: number }, speed: number, dt: number): void {
  const tx = sideSign(team) * Math.min(MAX_X, Math.max(MIN_X, Math.abs(target.x)))
  const tz = target.z
  const gx = tx - a.x
  const gz = tz - a.z
  if (Math.hypot(gx, gz) < 0.02 && Math.hypot(a.vx, a.vz) < 0.3) {
    a.x = tx
    a.z = tz
    a.vx = 0
    a.vz = 0
    return
  }
  // Velocidade proporcional à distância, limitada à máxima (na diagonal também).
  let vx = gx * SEEK_GAIN
  let vz = gz * SEEK_GAIN
  const v = Math.hypot(vx, vz)
  if (v > speed) {
    vx *= speed / v
    vz *= speed / v
  }
  drive(a, vx, vz, dt)
}

/**
 * Move os atletas. Time humano: o controlado anda pela entrada; o parceiro vai sozinho para a posição base.
 * Time da IA: o designado anda pela entrada da IA; os demais vão para a posição base.
 */
export function updatePositions(s: MatchState, inputs: [TeamInput, TeamInput], dt: number, partner: TeamInput = IDLE): void {
  const plan = s.plan
  const slow = s.slowMo !== null
  const bp = BALANCE.basePos
  for (const team of [0, 1] as Side[]) {
    const sign = sideSign(team)
    const mates = s.athletes.filter((a) => a.team === team)
    const hasBall = plan?.team === team
    const [a, b] = mates
    const human = team === s.config.humanTeam
    const ctrl = human && s.controlled !== null ? s.athletes[s.controlled] : null
    const baseOf = (x: Athlete) => {
      // Com a bola, quem não toca vai para perto da rede, na própria faixa.
      if (hasBall) return { x: sign * bp.support, z: Math.max(-bp.supportZ, Math.min(bp.supportZ, x.z)) }
      // Sem a bola, lado a lado. Modo solo: o parceiro IA fica no lado dele (oposto ao escolhido pelo jogador).
      if (human && s.config.control === 'solo') return { x: sign * bp.defense, z: -s.config.humanLane * bp.laneZ }
      // Modo dupla: o parceiro do jogador fica na faixa oposta à do controlado.
      const near = ctrl ? ctrl.z < 0 : x === (a.z <= b.z ? b : a)
      return { x: sign * bp.defense, z: (near ? 1 : -1) * bp.laneZ }
    }
    const i = inputs[team]
    const locked = s.buttons[team].moveLock !== null
    const [vx, vz] = slow || locked ? [0, 0] : inputVelocity(i.move, i.moveZ, BALANCE.move.manual)
    const partnerLocked = s.partnerButtons.moveLock !== null
    const [pvx, pvz] = slow || partnerLocked ? [0, 0] : inputVelocity(partner.move, partner.moveZ, BALANCE.move.manual)

    for (const ath of mates) {
      if (slow && s.slowMo?.athleteId === ath.id) continue // o atacante está no ar
      const driven = human ? ath.id === s.controlled : hasBall && plan.athleteId === ath.id
      if (driven) drive(ath, vx, vz, dt)
      else if (isPartnerAI(s, ath.id) && hasBall && plan.athleteId === ath.id) drive(ath, pvx, pvz, dt)
      else seek(ath, team, baseOf(ath), BALANCE.move.base, dt)
    }
  }
}

/** Alcance do toque automático do atleta (o controlado usa o da dificuldade). */
export function reachOf(s: MatchState, athleteId: number): number {
  return teamOf(athleteId) === s.config.humanTeam && athleteId === s.controlled ? s.config.humanReach : BALANCE.reach
}
