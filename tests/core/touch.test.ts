import { describe, expect, it } from 'vitest'
import { BALANCE } from '../../src/data/balance'
import { createRng } from '../../src/core/rng'
import { type Aim, aimFromMove, outgoing } from '../../src/core/touch'

const heightAtNet = (from: { x: number; y: number }, v: { vx: number; vy: number }) => {
  const t = -from.x / v.vx
  return from.y + v.vy * t - 0.5 * BALANCE.gravity * t * t
}

describe('touch arcade', () => {
  it('aimFromMove: para a rede = curto, para trás = fundo, nos dois lados', () => {
    expect(aimFromMove(0, 1)).toBe('curto')
    expect(aimFromMove(0, -1)).toBe('fundo')
    expect(aimFromMove(1, -1)).toBe('curto')
    expect(aimFromMove(1, 1)).toBe('fundo')
    expect(aimFromMove(0, 0)).toBe('meio')
  })

  it.each([
    ['curto', 2.5],
    ['meio', 5.0],
    ['fundo', 7.8],
  ] as const)('forte do time 0 com mira %s cai a %s m (±0,4)', (aim: Aim, d) => {
    const r = outgoing({ action: 'forte', team: 0, from: { x: -1, y: 3 }, aim }, createRng(1))
    expect(Math.abs(r.targetX - d)).toBeLessThanOrEqual(0.4)
  })

  it('Shark do time 1 cai no lado do time 0 e é mais rápido que o forte', () => {
    const from = { x: 1, y: 3 }
    const shark = outgoing({ action: 'sharkataque', team: 1, from, aim: 'fundo' }, createRng(2))
    const forte = outgoing({ action: 'forte', team: 1, from, aim: 'fundo' }, createRng(2))
    expect(shark.targetX).toBeLessThan(-7)
    expect(Math.abs(shark.vx)).toBeGreaterThan(Math.abs(forte.vx))
  })

  it('pingo do time 1 cai a ~1,2 m da rede no lado 0', () => {
    const r = outgoing({ action: 'pingo', team: 1, from: { x: 1, y: 3 } }, createRng(3))
    expect(r.targetX).toBeGreaterThanOrEqual(-1.6)
    expect(r.targetX).toBeLessThanOrEqual(-0.8)
  })

  it('fraco vai ao meio do outro lado', () => {
    const r = outgoing({ action: 'fraco', team: 0, from: { x: -1, y: 2.7 } }, createRng(4))
    expect(r.targetX).toBeGreaterThanOrEqual(4.6)
    expect(r.targetX).toBeLessThanOrEqual(5.4)
  })

  it.each([0.3, 1.5])('forte de 3 m de altura a %s m da rede passa a faixa', (x) => {
    for (const aim of ['curto', 'meio', 'fundo'] as const) {
      const from = { x, y: 3 }
      const v = outgoing({ action: 'forte', team: 1, from, aim }, createRng(6))
      expect(heightAtNet(from, v)).toBeGreaterThan(BALANCE.netHeight + BALANCE.ballRadius)
    }
  })
})

describe('mais tempo no ar', () => {
  const flight = (action: 'passe' | 'levantada', from: { x: number; y: number }) => {
    const v = outgoing({ action, team: 0, from }, createRng(1))
    const g = BALANCE.gravity
    return (v.vy + Math.sqrt(v.vy * v.vy + 2 * g * (from.y - BALANCE.ballRadius))) / g
  }
  it('recepção de chapa e levantada ficam mais de 2 s no ar', () => {
    expect(flight('passe', { x: -6, y: 0.45 })).toBeGreaterThan(2)
    expect(flight('levantada', { x: -3, y: 0.45 })).toBeGreaterThan(2)
  })
  it('contato do ataque é a 3,2 m', () => {
    expect(BALANCE.contact.cabeca).toBe(3.2)
  })
})
