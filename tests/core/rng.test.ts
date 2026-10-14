import { describe, expect, it } from 'vitest'
import { createRng } from '../../src/core/rng'

describe('rng', () => {
  it('mesma semente gera a mesma sequência', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()])
  })

  it('next fica em [0,1) e range respeita os limites', () => {
    const r = createRng(1)
    for (let i = 0; i < 1000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      const x = r.range(-2, 3)
      expect(x).toBeGreaterThanOrEqual(-2)
      expect(x).toBeLessThan(3)
    }
  })

  it('normal tem média e desvio próximos do pedido', () => {
    const r = createRng(7)
    const xs = Array.from({ length: 5000 }, () => r.normal(0, 0.1))
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length)
    expect(Math.abs(mean)).toBeLessThan(0.01)
    expect(sd).toBeGreaterThan(0.09)
    expect(sd).toBeLessThan(0.11)
  })
})
