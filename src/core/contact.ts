import { BALANCE } from '../data/balance'
import type { Athlete, AthleteAction, ContactPlan, MatchState, TeamInput } from './match'
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
  if (Math.abs(landing.x) > BALANCE.halfCourt + BALANCE.outMargin) return null
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

  const incoming = s.lastAttack && s.lastAttack.team !== team && s.lastAttack.kind === 'forte' ? 'forte' : null
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
    resolving: false,
    choice: null,
    jumpChecked: false,
  }
}

/** Replaneja depois de qualquer mudança de trajetória e troca o atleta controlado. */
export function replan(s: MatchState): void {
  s.plan = planContact(s)
  if (s.plan && s.plan.team === s.config.humanTeam) s.controlled = s.plan.athleteId
}

const MIN_X = 0.3
const MAX_X = 11

function moveToward(a: Athlete, team: Side, targetX: number, speed: number, dt: number): void {
  const sign = sideSign(team)
  const tx = sign * Math.min(MAX_X, Math.max(MIN_X, Math.abs(targetX)))
  const d = tx - a.x
  const maxStep = speed * dt
  a.x += Math.abs(d) <= maxStep ? d : Math.sign(d) * maxStep
}

function clampToSide(a: Athlete): void {
  const sign = sideSign(a.team)
  a.x = sign * Math.min(MAX_X, Math.max(MIN_X, Math.abs(a.x)))
}

/** Move os atletas: controlado (manual/ajuda), designado da IA (pela entrada) e o resto para a posição base. */
export function updatePositions(s: MatchState, inputs: [TeamInput, TeamInput], dt: number): void {
  const plan = s.plan
  const slow = s.slowMo !== null
  for (const team of [0, 1] as Side[]) {
    const sign = sideSign(team)
    const mates = s.athletes.filter((a) => a.team === team)
    const hasBall = plan?.team === team
    const [a, b] = mates
    const aFront = Math.abs(a.x) <= Math.abs(b.x)
    const baseOf = (x: Athlete) =>
      sign * (hasBall ? BALANCE.basePos.support : (x === a) === aFront ? BALANCE.basePos.front : BALANCE.basePos.back)
    const move = inputs[team].move
    const human = team === s.config.humanTeam

    for (const ath of mates) {
      if (slow && s.slowMo?.athleteId === ath.id) continue // o atacante está no ar
      const designated = hasBall && plan.athleteId === ath.id
      if (human && ath.id === s.controlled) {
        if (move !== 0 && !slow) {
          ath.x += move * BALANCE.move.manual * dt
          clampToSide(ath)
        } else if (designated) moveToward(ath, team, plan.x + sign * 0.3, BALANCE.move.assist, dt)
        else moveToward(ath, team, baseOf(ath), BALANCE.move.base, dt)
        ath.targetX = ath.x
        continue
      }
      if (!human && designated) {
        if (move !== 0 && !slow) {
          ath.x += move * BALANCE.move.manual * dt
          clampToSide(ath)
        }
        continue
      }
      moveToward(ath, team, baseOf(ath), BALANCE.move.base, dt)
    }
  }
}

/** Alcance do toque automático do atleta (o controlado usa o da dificuldade). */
export function reachOf(s: MatchState, athleteId: number): number {
  return teamOf(athleteId) === s.config.humanTeam && athleteId === s.controlled ? s.config.humanReach : BALANCE.reach
}
