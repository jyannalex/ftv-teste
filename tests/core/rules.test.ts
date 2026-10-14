import { describe, expect, it } from 'vitest'
import { awardPoint, canTouch, initialScore, registerTouch, resolveLanding, setWinner } from '../../src/core/rules'

describe('rules', () => {
  it('time novo começa com 1 toque; 4º toque e toque repetido são proibidos', () => {
    let t = registerTouch({ team: null, count: 0, lastAthlete: null }, 2)
    expect(t).toEqual({ team: 1, count: 1, lastAthlete: 2 })
    expect(canTouch(t, 2)).toBe(false)
    expect(canTouch(t, 3)).toBe(true)
    t = registerTouch(registerTouch(t, 3), 2)
    expect(t.count).toBe(3)
    expect(canTouch(t, 3)).toBe(false)
    expect(canTouch(t, 0)).toBe(true)
  })

  it('bola no chão dentro: ponto de quem não é dono do lado', () => {
    expect(resolveLanding(4, 0, { team: 0, count: 3, lastAthlete: 1 })).toEqual({ winner: 0, reason: 'chao' })
  })

  it('bola no próprio lado depois de 3 toques é falta', () => {
    expect(resolveLanding(-2, 0, { team: 0, count: 3, lastAthlete: 0 })).toEqual({ winner: 1, reason: 'falta' })
  })

  it('bola fora: ponto de quem não tocou por último', () => {
    expect(resolveLanding(10.5, 0, { team: 0, count: 2, lastAthlete: 1 })).toEqual({ winner: 1, reason: 'fora' })
    expect(resolveLanding(-9.5, 0, { team: 0, count: 1, lastAthlete: 0 })).toEqual({ winner: 1, reason: 'fora' })
  })

  it('bola fora pela lateral: ponto de quem não tocou por último', () => {
    expect(resolveLanding(-4, 4.8, { team: 1, count: 1, lastAthlete: 2 })).toEqual({ winner: 0, reason: 'fora' })
    expect(resolveLanding(3, -4.4, { team: 0, count: 1, lastAthlete: 0 })).toEqual({ winner: 0, reason: 'chao' })
  })

  it('quem saca mantém o saque; quem recupera alterna o sacador', () => {
    let s = awardPoint(initialScore(), 0)
    expect(s.server).toBe(0)
    s = awardPoint(s, 1)
    expect(s).toMatchObject({ servingTeam: 1, server: 2, points: [1, 1] })
    s = awardPoint(s, 0)
    expect(s.server).toBe(1)
    s = awardPoint(s, 1)
    expect(s.server).toBe(3)
  })

  it('set de 12 com 2 de vantagem', () => {
    expect(setWinner([12, 10], 12)).toBe(0)
    expect(setWinner([12, 11], 12)).toBeNull()
    expect(setWinner([11, 13], 12)).toBe(1)
    expect(setWinner([11, 11], 12)).toBeNull()
  })
})
