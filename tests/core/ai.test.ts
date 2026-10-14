import { describe, expect, it } from 'vitest'
import { bestAim, createAI, skillParams } from '../../src/core/ai'
import { createMatch, IDLE, type MatchEvent, matchConfig, step } from '../../src/core/match'
import { createRng } from '../../src/core/rng'
import { setWinner } from '../../src/core/rules'
import { incomingBall, stateWithAttackPlan } from './helpers'

const aiMatch = (seed: number, s0: number, s1: number) => {
  const st = createMatch(matchConfig({ seed, humanTeam: null }))
  const a = createAI(0, s0, 'equilibrado', createRng(seed + 100))
  const b = createAI(1, s1, 'equilibrado', createRng(seed + 200))
  const events: MatchEvent[] = []
  for (let i = 0; i < 60 * 60 * 20 && st.phase !== 'fim'; i++) events.push(...step(st, [a.think(st), b.think(st)]))
  return { st, events }
}

/** Primeiro toque do time 1 numa situação montada, com a IA do time 1 jogando. */
const firstTouchOf = (s: ReturnType<typeof incomingBall>, ai: ReturnType<typeof createAI>) => {
  for (let i = 0; i < 400; i++) {
    const ev = step(s, [IDLE, ai.think(s)])
    const t = ev.find((e) => e.type === 'toque')
    if (t) return t
    if (ev.some((e) => e.type === 'ponto')) return null
  }
  return null
}

describe('IA arcade', () => {
  it('extremos de skillParams', () => {
    expect(skillParams(0)).toEqual({ reactionDelay: 0.35, posError: 1.0, diveChance: 0.3, readChance: 0 })
    expect(skillParams(1)).toEqual({ reactionDelay: 0.08, posError: 0.1, diveChance: 0.9, readChance: 1 })
  })

  it.each([
    [0, 0],
    [0.5, 0.5],
    [1, 1],
  ])('IA × IA (%s × %s) sempre termina com placar válido (Review Focus)', (a, b) => {
    const { st } = aiMatch(1, a, b)
    expect(st.phase).toBe('fim')
    expect(setWinner(st.score.points, 12)).toBe(st.winner)
  })

  it('IA forte (0,9) vence a fraca (0,1) em ≥ 8 de 10', () => {
    let wins = 0
    for (let seed = 1; seed <= 10; seed++) if (aiMatch(seed, 0.1, 0.9).st.winner === 1) wins++
    expect(wins).toBeGreaterThanOrEqual(8)
  })

  it('IA com skill 1 escolhe Pingo contra defesa recuada e forte contra defesa adiantada', () => {
    const deep = stateWithAttackPlan(1, [-7, -6.5], 0) // time 0 humano parado: a defesa fica onde está
    expect(firstTouchOf(deep, createAI(1, 1, 'equilibrado', createRng(1)))).toMatchObject({ action: 'pingo' })
    const close = stateWithAttackPlan(1, [-1.5, -2.5], 0)
    expect(firstTouchOf(close, createAI(1, 1, 'equilibrado', createRng(1)))).toMatchObject({ action: 'forte' })
  })

  it('IA corre até a bola e recebe (skill 1)', () => {
    const s = incomingBall(6)
    const t = firstTouchOf(s, createAI(1, 1, 'equilibrado', createRng(2)))
    expect(t).toMatchObject({ action: 'passe', quality: 'normal' })
  })

  it('IA dá peixinho quando não dá tempo de chegar (skill 1)', () => {
    const s = incomingBall(4)
    const p = s.plan!
    // Longe demais para correr a tempo, perto o bastante para o mergulho.
    s.athletes[p.athleteId].x = p.x + 2.0
    s.plan!.tIdeal = s.time + 0.1
    const t = firstTouchOf(s, createAI(1, 1, 'equilibrado', createRng(3)))
    expect(t).toMatchObject({ quality: 'peixinho' })
  })

  it('bestAim escolhe fundo quando os defensores estão na frente e curto quando estão no fundo', () => {
    expect(bestAim([1.5, 3])).toBe('fundo')
    expect(bestAim([6.5, 8])).toBe('curto')
  })
})
