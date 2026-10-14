import { BALANCE } from '../data/balance'
import type { ContactPlan, MatchState } from './match'
import { positionAt, predictLanding, timeToHeight } from './physics'
import { partner, type Side, sideOf, sideSign } from './rules'

type Kind = ContactPlan['kind']

/** Decide quem faz o próximo toque, onde e quando. null se ninguém pode tocar. */
export function planContact(s: MatchState): ContactPlan | null {
  const landing = predictLanding(s.ball)
  const team = sideOf(landing.x)
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
  const delay = s.config.reactionDelay[team]
  const contactAt = (kind: Kind) => {
    const dt = timeToHeight(s.ball, BALANCE.contact[kind])
    if (dt === null) return null
    const p = positionAt(s.ball, dt)
    if (sideOf(p.x) !== team) return null
    const reachable = Math.abs(athlete.x - p.x) / BALANCE.runSpeed + delay <= dt
    return { kind, x: p.x, y: p.y, dt, reachable }
  }

  const order: Kind[] = touchIndex === 3 ? ['cabeca', 'peito', 'chapa'] : ['peito', 'chapa']
  const options = order.map(contactAt).filter((c) => c !== null)
  if (options.length === 0) return null
  // No 3º toque a cabeça vem primeiro se der; nos outros, peito se alcança, senão chapa.
  const chosen =
    touchIndex === 3 && options[0].kind === 'cabeca' ? options[0] : (options.find((c) => c.reachable) ?? options[options.length - 1])

  const incoming = s.lastAttack && s.lastAttack.team !== team ? s.lastAttack : null
  return {
    athleteId,
    team,
    touchIndex,
    kind: chosen.kind,
    x: chosen.x,
    y: chosen.y,
    tIdeal: s.time + chosen.dt,
    createdAt: s.time,
    reachable: chosen.reachable,
    incomingForce: incoming ? incoming.force : 0,
    incomingShark: incoming ? incoming.shark : false,
  }
}

const MIN_X = 0.3
const MAX_X = 11

/** Move os atletas: o do plano vai para a bola; os outros para as posições base. */
export function updatePositions(s: MatchState, dt: number): void {
  const plan = s.plan
  for (const team of [0, 1] as Side[]) {
    const sign = sideSign(team)
    const mates = s.athletes.filter((a) => a.team === team)
    const hasBall = plan?.team === team
    if (hasBall) {
      for (const a of mates) a.targetX = a.id === plan.athleteId ? plan.x + sign * 0.3 : sign * BALANCE.basePos.support
    } else {
      const [a, b] = mates
      const aFront = Math.abs(a.x) <= Math.abs(b.x)
      a.targetX = sign * (aFront ? BALANCE.basePos.front : BALANCE.basePos.back)
      b.targetX = sign * (aFront ? BALANCE.basePos.back : BALANCE.basePos.front)
    }
    for (const a of mates) {
      const waiting = hasBall && a.id === plan.athleteId && s.time - plan.createdAt < s.config.reactionDelay[team]
      if (waiting) continue
      const tx = sign * Math.min(MAX_X, Math.max(MIN_X, Math.abs(a.targetX)))
      const d = tx - a.x
      const maxStep = BALANCE.runSpeed * dt
      a.x += Math.abs(d) <= maxStep ? d : Math.sign(d) * maxStep
    }
  }
}
