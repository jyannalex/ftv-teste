import { describe, expect, it } from 'vitest'
import { BALANCE } from '../../src/data/balance'
import { type Ball, launchVelocity, predictLanding, stepBall, timeToHeight } from '../../src/core/physics'

const sim = (start: Ball) => {
  let b = start
  let hit = false
  let maxY = b.y
  for (let i = 0; i < 2000; i++) {
    const r = stepBall(b, 1 / 60)
    b = r.ball
    hit ||= r.hitNet
    maxY = Math.max(maxY, b.y)
    if (r.landed) return { b, hit, maxY, steps: i + 1 }
  }
  throw new Error('não caiu')
}

describe('physics', () => {
  it('lançamento por ápice cai no alvo e passa pelo ápice pedido', () => {
    const v = launchVelocity({ x: -5, y: 1 }, { x: 5, y: BALANCE.ballRadius }, { apex: 5 })
    const r = sim({ x: -5, y: 1, ...v })
    expect(Math.abs(r.b.x - 5)).toBeLessThan(0.15)
    expect(Math.abs(r.maxY - 5)).toBeLessThan(0.1)
    expect(r.hit).toBe(false)
  })

  it('lançamento por tempo cai no tempo pedido (±1 passo)', () => {
    const v = launchVelocity({ x: -1, y: 2.5 }, { x: 6, y: BALANCE.ballRadius }, { time: 0.6 })
    expect(Math.abs(sim({ x: -1, y: 2.5, ...v }).steps - 36)).toBeLessThanOrEqual(1)
  })

  it('bola baixa bate na rede e volta', () => {
    let b: Ball = { x: -0.5, y: 1, vx: 8, vy: 0 }
    let hit = false
    for (let i = 0; i < 10; i++) {
      const r = stepBall(b, 1 / 60)
      b = r.ball
      hit ||= r.hitNet
    }
    expect(hit).toBe(true)
    expect(b.vx).toBeLessThan(0)
    expect(b.x).toBeLessThan(0)
  })

  it('bola caindo parada sobre a faixa da rede cai para um lado (Review Focus 3)', () => {
    const r = sim({ x: 0, y: 3, vx: 0, vy: 0 })
    expect(Math.abs(r.b.x)).toBeGreaterThan(BALANCE.ballRadius)
  })

  it('predictLanding confere com a simulação', () => {
    const b = { x: 2, y: 3, vx: 3, vy: 4 }
    expect(Math.abs(predictLanding(b).x - sim(b).b.x)).toBeLessThan(0.15)
  })

  it('timeToHeight é null quando a bola não alcança a altura', () => {
    expect(timeToHeight({ x: 0, y: 1, vx: 0, vy: 1 }, 3)).toBeNull()
  })
})
