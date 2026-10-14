import { expect, it } from 'vitest'
import { Controls } from '../../src/game/input/controls'

it('toque rápido entre dois consumos não se perde (Review Focus)', () => {
  const c = new Controls()
  c.setButton('pingo', true)
  c.setButton('pingo', false)
  expect(c.consume().pingo).toBe(true)
  expect(c.consume().pingo).toBe(false)
})

it('botão segurado continua true até soltar', () => {
  const c = new Controls()
  c.setButton('forte', true)
  expect(c.consume().forte).toBe(true)
  expect(c.consume().forte).toBe(true)
  c.setButton('forte', false)
  expect(c.consume().forte).toBe(false)
})

it('move segue a última direção segurada; soltar volta à outra ou a 0', () => {
  const c = new Controls()
  c.setMove(-1, true)
  expect(c.consume().move).toBe(-1)
  c.setMove(1, true)
  expect(c.consume().move).toBe(1)
  c.setMove(1, false)
  expect(c.consume().move).toBe(-1)
  c.setMove(-1, false)
  expect(c.consume().move).toBe(0)
})

it('reset solta tudo sem gerar toque (Review Focus)', () => {
  const c = new Controls()
  c.setButton('forte', true)
  c.setButton('shark', true)
  c.setMove(1, true)
  c.reset()
  expect(c.consume()).toEqual({ move: 0, forte: false, pingo: false, shark: false })
})
