import { describe, expect, it } from 'vitest'
import { createAI, skillParams } from '../../src/core/ai'
import { createMatch, type MatchEvent, matchConfig, step } from '../../src/core/match'
import { createRng } from '../../src/core/rng'
import { setWinner } from '../../src/core/rules'
import { stateWithAttackPlan } from './helpers'

const aiMatch = (seed: number, s0: number, s1: number) => {
  const st = createMatch(
    matchConfig({ seed, humanTeam: null, reactionDelay: [skillParams(s0).reactionDelay, skillParams(s1).reactionDelay] }),
  )
  const a = createAI(0, s0, 'equilibrado', createRng(seed + 100))
  const b = createAI(1, s1, 'equilibrado', createRng(seed + 200))
  const events: MatchEvent[] = []
  for (let i = 0; i < 60 * 60 * 20 && st.phase !== 'fim'; i++) events.push(...step(st, [a.think(st), b.think(st)]))
  return { st, events }
}

type Toque = Extract<MatchEvent, { type: 'toque' }>

describe('IA', () => {
  it('extremos de skillParams', () => {
    expect(skillParams(0)).toEqual({ timingSigma: 0.16, reactionDelay: 0.35, readChance: 0, forceSigma: 0.35, sharkDefenseChance: 0.02 })
    expect(skillParams(1).timingSigma).toBeCloseTo(0.03)
    expect(skillParams(1).sharkDefenseChance).toBeCloseTo(0.15)
  })

  it.each([
    [0, 0],
    [0.5, 0.5],
    [1, 1],
  ])('IA × IA (%s × %s) sempre termina com placar válido (Review Focus 5)', (a, b) => {
    const { st } = aiMatch(1, a, b)
    expect(st.phase).toBe('fim')
    expect(setWinner(st.score.points, 12)).toBe(st.winner)
  })

  it('IA forte vence a fraca na maioria', () => {
    let wins = 0
    for (let seed = 1; seed <= 10; seed++) if (aiMatch(seed, 0.1, 0.9).st.winner === 1) wins++
    expect(wins).toBeGreaterThanOrEqual(8)
  })

  it('IA forte tira mais Perfeito', () => {
    const rate = (sk: number) => {
      const t = aiMatch(3, sk, sk).events.filter((e): e is Toque => e.type === 'toque')
      return t.filter((e) => e.grade === 'perfeito').length / t.length
    }
    expect(rate(0.9)).toBeGreaterThan(rate(0.1))
  })

  it('IA com skill 1 dá Pingo contra defesa recuada', () => {
    const ai = createAI(1, 1, 'equilibrado', createRng(1))
    const s = stateWithAttackPlan(1, [-7, -6.5])
    let maxHold = 0
    let held = 0
    for (let i = 0; i < 120; i++) {
      const inp = ai.think(s)
      held = inp.ataque ? held + 1 : 0
      maxHold = Math.max(maxHold, held)
      s.time += 1 / 60
    }
    expect(maxHold).toBeGreaterThan(0)
    expect(maxHold * (1000 / 60)).toBeLessThan(150)
  })

  it('IA com skill 1 bate forte contra defesa adiantada', () => {
    const ai = createAI(1, 1, 'equilibrado', createRng(1))
    const s = stateWithAttackPlan(1, [-1.5, -2.5])
    let maxHold = 0
    let held = 0
    for (let i = 0; i < 120; i++) {
      const inp = ai.think(s)
      held = inp.ataque ? held + 1 : 0
      maxHold = Math.max(maxHold, held)
      s.time += 1 / 60
    }
    expect(maxHold * (1000 / 60)).toBeGreaterThan(300)
  })
})
