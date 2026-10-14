import { describe, expect, it } from 'vitest'
import { createAI } from '../../src/core/ai'
import { planContact } from '../../src/core/contact'
import { createMatch, DT, IDLE, type MatchEvent, type MatchState, matchConfig, step, type TeamInput } from '../../src/core/match'
import { createRng } from '../../src/core/rng'
import { incomingBall, stateWithAttackPlan } from './helpers'

type Toque = Extract<MatchEvent, { type: 'toque' }>

/** Bola descendo em x no lado do time 0, modo solo: o jogador controla o atleta 0. */
function solo(x: number): MatchState {
  const s = incomingBall(x, { humanTeam: 0 })
  s.config.control = 'solo'
  s.controlled = 0
  return s
}

const run = (s: MatchState, human: (s: MatchState) => TeamInput, partner: (s: MatchState) => TeamInput, n: number, stop: MatchEvent['type']) => {
  const ev: MatchEvent[] = []
  for (let i = 0; i < n; i++) {
    const e = step(s, [human(s), IDLE], DT, partner(s))
    ev.push(...e)
    if (e.some((x) => x.type === stop)) break
  }
  return ev
}

describe('modo solo: só o meu atleta, parceiro IA', () => {
  it('o 1º toque vai para quem está mais perto, e o controle não muda', () => {
    const s = solo(-4)
    s.athletes[0].x = -8
    s.athletes[1].x = -4
    s.plan = planContact(s)
    expect(s.plan?.athleteId).toBe(1)
    step(s, [IDLE, IDLE], DT, IDLE)
    expect(s.controlled).toBe(0)
  })

  it('Q (troca) não faz nada', () => {
    const s = solo(-4)
    step(s, [{ ...IDLE, troca: true }, IDLE], DT, IDLE)
    expect(s.controlled).toBe(0)
  })

  it('a minha entrada move só o atleta 0; o parceiro designado anda pela entrada da IA', () => {
    const s = solo(-4)
    s.athletes[0].x = -8
    s.athletes[1].x = -5
    s.plan = planContact(s)
    const x0 = s.athletes[0].x
    const x1 = s.athletes[1].x
    for (let i = 0; i < 10; i++) step(s, [{ ...IDLE, move: 1 }, IDLE], DT, { ...IDLE, move: -1 })
    expect(s.athletes[0].x).toBeGreaterThan(x0 + 0.2)
    expect(s.athletes[1].x).toBeLessThan(x1 - 0.2)
  })

  it('a IA do parceiro recebe a bola que é dele', () => {
    const s = solo(-4)
    s.athletes[0].x = -8.5
    s.athletes[1].x = -5
    s.plan = planContact(s)
    const ai = createAI(0, 1, 'equilibrado', createRng(3), { shark: false })
    const ev = run(s, () => IDLE, (st) => ai.think(st), 400, 'toque')
    expect(ev.find((e): e is Toque => e.type === 'toque')).toMatchObject({ athleteId: 1, action: 'passe' })
  })

  it('quando o saque é do parceiro, o meu botão não saca e a IA dele saca', () => {
    const s = createMatch(matchConfig({ humanTeam: 0, control: 'solo' }))
    s.score = { ...s.score, server: 1 }
    let ev = run(s, (st) => ({ ...IDLE, forte: st.phaseT < 0.2 }), () => IDLE, 60, 'saque')
    expect(ev.some((e) => e.type === 'saque')).toBe(false)
    ev = run(s, () => IDLE, (st) => ({ ...IDLE, forte: st.phaseT < 1.2 }), 120, 'saque')
    expect(ev).toContainEqual({ type: 'saque', athleteId: 1 })
    expect(s.controlled).toBe(0)
  })

  it('a IA do parceiro não gasta o Sharkataque (fica para o jogador)', () => {
    const s = stateWithAttackPlan(0, [10.5, 11], 0)
    s.config.control = 'solo'
    s.controlled = 0
    s.meter[0] = 100
    expect(s.plan?.athleteId).toBe(1)
    const ai = createAI(0, 1, 'equilibrado', createRng(1), { shark: false })
    const ev = run(s, () => IDLE, (st) => ai.think(st), 400, 'toque')
    const t = ev.find((e): e is Toque => e.type === 'toque')
    expect(t?.athleteId).toBe(1)
    expect(t?.action).not.toBe('sharkataque')
    expect(s.meter[0]).toBeGreaterThan(0)
  })
})

it('controle do teste acima: sem a opção, a mesma IA usaria o Shark', () => {
  const s = stateWithAttackPlan(0, [10.5, 11], 0)
  s.config.control = 'solo'
  s.controlled = 0
  s.meter[0] = 100
  const ai = createAI(0, 1, 'equilibrado', createRng(1))
  const ev = run(s, () => IDLE, (st) => ai.think(st), 400, 'toque')
  expect(ev.find((e): e is Toque => e.type === 'toque')?.action).toBe('sharkataque')
})
