import { type MatchEvent, type MatchState, IDLE, step, type TeamInput } from '../../src/core/match'
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
