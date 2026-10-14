import { createMatch, DT, type MatchEvent, type MatchState, matchConfig, IDLE, step, type TeamInput } from '../../src/core/match'
import { planContact } from '../../src/core/contact'
import type { Side } from '../../src/core/rules'

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

export function teamInputs(team: Side, input: TeamInput): [TeamInput, TeamInput] {
  return team === 0 ? [input, IDLE] : [IDLE, input]
}

/** Segura o Ataque do time do passo 0 até `ms` e depois solta. */
export function holdThenRelease(team: Side, ms: number): InputsFn {
  const steps = Math.round((ms / 1000) * 60)
  return (_s, i) => teamInputs(team, { recepcao: false, ataque: i < steps })
}

/**
 * Em cada plano novo do time, aperta Recepção (ou solta o Ataque segurado por `holdMs`)
 * no passo mais próximo de `tIdeal + offsetSec`.
 */
export function pressAt(team: Side, button: 'recepcao' | 'ataque', offsetSec: number, holdMs = 0): InputsFn {
  const done = new Set<string>()
  return (s) => {
    const p = s.plan
    if (!p || p.team !== team) return [IDLE, IDLE]
    const key = `${p.athleteId}:${p.tIdeal.toFixed(4)}`
    const now = s.time + DT // o step soma dt antes de ler a entrada
    const target = p.tIdeal + offsetSec
    if (done.has(key)) return [IDLE, IDLE]
    if (button === 'recepcao') {
      if (now >= target - DT / 2) {
        done.add(key)
        return teamInputs(team, { recepcao: true, ataque: false })
      }
      return [IDLE, IDLE]
    }
    const start = target - holdMs / 1000
    if (now >= target - DT / 2) {
      done.add(key)
      return [IDLE, IDLE] // solta
    }
    return teamInputs(team, { recepcao: false, ataque: now >= start - DT / 2 })
  }
}

/**
 * Partida IA × IA em rally, com a bola descendo perto da rede no lado de `team`
 * depois de 2 toques: o próximo é o 3º (ataque).
 */
export function stateWithAttackPlan(team: Side, defendersX: [number, number]): MatchState {
  const s = createMatch(matchConfig({ humanTeam: null }))
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
  return s
}
