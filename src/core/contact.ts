import { BALANCE } from '../data/balance'
import type { Athlete, AthleteAction, ContactPlan, MatchState, TeamInput } from './match'
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
  } else if (team === s.config.humanTeam && s.controlled !== null && teamOf(s.controlled) === team) {
    // 1º toque do jogador: vai quem ele está controlando (troca com W).
    athleteId = s.controlled
    touchIndex = 1
  } else {
    const [a, b] = s.athletes.filter((x) => x.team === team)
    athleteId = Math.abs(a.x - landing.x) <= Math.abs(b.x - landing.x) ? a.id : b.id
    touchIndex = 1
  }

  const athlete = s.athletes[athleteId]
  const contactAt = (kind: Kind) => {
    const dt = timeToHeight(s.ball, BALANCE.contact[kind])
    if (dt === null) return null
    const p = positionAt(s.ball, dt)
    if (sideOf(p.x) !== team) return null
    const reachable = Math.abs(athlete.x - p.x) / BALANCE.move.manual <= dt
    return { kind, x: p.x, y: p.y, dt, reachable }
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
  if (team === null || !edges[team].trocaDown || s.slowMo || s.controlled === null) return
  const plan = s.plan
  // 2º e 3º toque: o atleta é obrigatório pela regra.
  if (plan && plan.team === team && plan.touchIndex > 1) return
  if (s.phase === 'saque' && s.score.servingTeam === team) return
  s.controlled = partner(s.controlled)
  if (plan && plan.team === team) plan.athleteId = s.controlled
}

/** Replaneja depois de qualquer mudança de trajetória e troca o atleta controlado. */
export function replan(s: MatchState): void {
  s.plan = planContact(s)
  if (s.plan && s.plan.team === s.config.humanTeam) s.controlled = s.plan.athleteId
}

const MIN_X = 0.3
const MAX_X = 11
/** Ganho do "vai até o alvo e freia" (1/s). */
const SEEK_GAIN = 6

function clampToSide(a: Athlete): void {
  const sign = sideSign(a.team)
  const d = Math.abs(a.x)
  if (d < MIN_X || d > MAX_X) {
    a.x = sign * Math.min(MAX_X, Math.max(MIN_X, d))
    a.vx = 0
  }
}

/** Leva a velocidade até a desejada com aceleração/frenagem e anda. */
function drive(a: Athlete, desiredVx: number, dt: number): void {
  const m = BALANCE.move
  const speedingUp = Math.abs(desiredVx) > Math.abs(a.vx) && (a.vx === 0 || Math.sign(desiredVx) === Math.sign(a.vx))
  const rate = speedingUp ? m.accel : m.decel
  const dv = desiredVx - a.vx
  a.vx += Math.sign(dv) * Math.min(Math.abs(dv), rate * dt)
  a.x += a.vx * dt
  clampToSide(a)
}

/** Vai até um ponto do próprio lado, freando ao chegar. */
function seek(a: Athlete, team: Side, targetX: number, speed: number, dt: number): void {
  const tx = sideSign(team) * Math.min(MAX_X, Math.max(MIN_X, Math.abs(targetX)))
  const gap = tx - a.x
  if (Math.abs(gap) < 0.02 && Math.abs(a.vx) < 0.3) {
    a.x = tx
    a.vx = 0
    return
  }
  drive(a, Math.max(-speed, Math.min(speed, gap * SEEK_GAIN)), dt)
}

/**
 * Move os atletas. Time humano: o controlado anda pela entrada; o parceiro vai sozinho para a posição base.
 * Time da IA: o designado anda pela entrada da IA; os demais vão para a posição base.
 */
export function updatePositions(s: MatchState, inputs: [TeamInput, TeamInput], dt: number): void {
  const plan = s.plan
  const slow = s.slowMo !== null
  for (const team of [0, 1] as Side[]) {
    const sign = sideSign(team)
    const mates = s.athletes.filter((a) => a.team === team)
    const hasBall = plan?.team === team
    const [a, b] = mates
    const aFront = Math.abs(a.x) <= Math.abs(b.x)
    const human = team === s.config.humanTeam
    // Defendendo, o parceiro do jogador ocupa a posição que o controlado deixou livre.
    const ctrl = human && s.controlled !== null ? s.athletes[s.controlled] : null
    const ctrlFront = ctrl ? Math.abs(ctrl.x) <= (BALANCE.basePos.front + BALANCE.basePos.back) / 2 : false
    const baseOf = (x: Athlete) => {
      if (hasBall) return sign * BALANCE.basePos.support
      const front = ctrl ? !ctrlFront : (x === a) === aFront
      return sign * (front ? BALANCE.basePos.front : BALANCE.basePos.back)
    }
    const move = slow ? 0 : inputs[team].move

    for (const ath of mates) {
      if (slow && s.slowMo?.athleteId === ath.id) continue // o atacante está no ar
      if (human && ath.id === s.controlled) {
        drive(ath, move * BALANCE.move.manual, dt)
      } else if (human) {
        seek(ath, team, baseOf(ath), BALANCE.move.base, dt)
      } else if (hasBall && plan.athleteId === ath.id) {
        drive(ath, move * BALANCE.move.manual, dt)
      } else {
        seek(ath, team, baseOf(ath), BALANCE.move.base, dt)
      }
      ath.targetX = ath.x
    }
  }
}

/** Alcance do toque automático do atleta (o controlado usa o da dificuldade). */
export function reachOf(s: MatchState, athleteId: number): number {
  return teamOf(athleteId) === s.config.humanTeam && athleteId === s.controlled ? s.config.humanReach : BALANCE.reach
}
