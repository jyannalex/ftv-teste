import { describe, expect, it } from 'vitest'
import { createMatch, IDLE, matchConfig } from '../../src/core/match'
import { holdThenRelease, simulate } from './helpers'

describe('partida: saque e pontuação', () => {
  it('começa 0×0 em fase de saque com o atleta 0 no fundo', () => {
    const s = createMatch(matchConfig())
    expect(s.phase).toBe('saque')
    expect(s.score.points).toEqual([0, 0])
    expect(s.athletes[0].x).toBeCloseTo(-9.5)
  })

  it('saque dentro sem recepção vira ponto do sacador', () => {
    const ev = simulate(createMatch(matchConfig()), holdThenRelease(0, 500), 3000, 'ponto')
    expect(ev).toContainEqual({ type: 'ponto', winner: 0, reason: 'chao' })
  })

  it('saque segurado demais sai', () => {
    const ev = simulate(createMatch(matchConfig()), holdThenRelease(0, 1200), 3000, 'ponto')
    expect(ev).toContainEqual({ type: 'ponto', winner: 1, reason: 'fora' })
  })

  it('depois do ponto volta ao saque com o sacador de quem pontuou', () => {
    const s = createMatch(matchConfig())
    simulate(s, holdThenRelease(0, 1200), 3000, 'ponto')
    simulate(s, () => [IDLE, IDLE], 100)
    expect(s.phase).toBe('saque')
    expect(s.score.servingTeam).toBe(1)
    expect(s.score.server).toBe(2)
    expect(s.athletes[2].x).toBeCloseTo(9.5)
  })

  it('saque automático depois de 8 s parado (Review Focus 5)', () => {
    const ev = simulate(createMatch(matchConfig()), () => [IDLE, IDLE], 8.2 * 60, 'saque')
    expect(ev.some((e) => e.type === 'saque')).toBe(true)
  })

  it('11×10 + ponto encerra o set', () => {
    const s = createMatch(matchConfig())
    s.score.points = [11, 10]
    const ev = simulate(s, holdThenRelease(0, 500), 3000, 'fimDeSet')
    expect(ev).toContainEqual({ type: 'fimDeSet', winner: 0 })
    expect(s.phase).toBe('fim')
    expect(s.winner).toBe(0)
  })

  it('ponto dá +10 na barra de quem pontuou', () => {
    const s = createMatch(matchConfig())
    simulate(s, holdThenRelease(0, 500), 3000, 'ponto')
    expect(s.meter[0]).toBe(10)
  })
})
