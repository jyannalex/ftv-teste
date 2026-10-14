import { planContact } from '../../src/core/contact'
import { createMatch, type MatchEvent, type MatchState, matchConfig, IDLE, step, type TeamInput } from '../../src/core/match'
import type { Side } from '../../src/core/rules'
import type { Aim } from '../../src/core/touch'

export type InputsFn = (s: MatchState, i: number) => [TeamInput, TeamInput]

/** Roda a partida até `maxSteps` passos ou até sair um evento do tipo `stopOn`. */
export function simulate(s: MatchState, inputsFn: InputsFn, maxSteps: number, stopOn?: MatchEvent['type']): MatchEvent[] {
  const events: MatchEvent[] = []
  for (let i = 0; i < maxSteps; i++) {
    const ev = step(s, inputsFn(s, i))
    events.push(...ev)
    if (stopOn && ev.some((e) => e.type === stopOn)) break
  }
  return events
}

export const standStill: InputsFn = () => [IDLE, IDLE]

export function teamInputs(team: Side, input: Partial<TeamInput>): [TeamInput, TeamInput] {
  const i = { ...IDLE, ...input }
  return team === 0 ? [i, IDLE] : [IDLE, i]
}

/** Direção na tela que dá a mira pedida para o time. */
export function moveFor(team: Side, aim: Aim): -1 | 0 | 1 {
  if (aim === 'meio') return 0
  const towardNet = team === 0 ? 1 : -1
  return (aim === 'curto' ? towardNet : -towardNet) as -1 | 1
}

/** Segura o botão esquerdo por 10 passos e solta com a direção da mira. */
export function serveWith(team: Side, aim: Aim = 'meio'): InputsFn {
  return (_s, i) => teamInputs(team, { forte: i < 10, move: i >= 10 && i < 12 ? moveFor(team, aim) : 0 })
}

/**
 * Partida IA × IA em rally, com a bola descendo perto da rede no lado de `team`
 * depois de 2 toques: o próximo é o 3º (ataque).
 */
export function stateWithAttackPlan(team: Side, defendersX: [number, number], humanTeam: Side | null = null): MatchState {
  const s = createMatch(matchConfig({ humanTeam }))
  const sign = team === 0 ? -1 : 1
  s.phase = 'rally'
  s.phaseT = 0
  const first = team * 2
  const attacker = first + 1
  s.touch = { team, count: 2, lastAthlete: first }
  s.ball = { x: sign * 1.0, y: 4, vx: 0, vy: 0 }
  s.athletes[first].x = sign * 3
  s.athletes[attacker].x = sign * 1.3
  const otherFirst = (1 - team) * 2
  s.athletes[otherFirst].x = defendersX[0]
  s.athletes[otherFirst + 1].x = defendersX[1]
  for (const a of s.athletes) a.targetX = a.x
  s.plan = planContact(s)
  if (humanTeam === team && s.plan) s.controlled = s.plan.athleteId
  return s
}

/** Bola em rally descendo em `x` (vinda do outro lado), com o time de `x` para receber. */
export function incomingBall(x: number, opts: { humanTeam?: Side | null; vx?: number } = {}): MatchState {
  const s = createMatch(matchConfig({ humanTeam: opts.humanTeam ?? null }))
  s.phase = 'rally'
  const team: Side = x < 0 ? 0 : 1
  s.touch = { team: team === 0 ? 1 : 0, count: 1, lastAthlete: team === 0 ? 2 : 0 }
  s.ball = { x, y: 5, vx: opts.vx ?? 0, vy: 0 }
  s.plan = planContact(s)
  if (opts.humanTeam === team && s.plan) s.controlled = s.plan.athleteId
  return s
}
