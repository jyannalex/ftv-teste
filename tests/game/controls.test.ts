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
  expect(c.consume()).toEqual({ move: 0, moveZ: 0, forte: false, pingo: false, shark: false, troca: false })
})

it('W/S (moveZ) seguem a última direção segurada, como ◀ ▶', () => {
  const c = new Controls()
  c.setMoveZ(-1, true)
  expect(c.consume().moveZ).toBe(-1)
  c.setMoveZ(1, true)
  expect(c.consume().moveZ).toBe(1)
  c.setMoveZ(1, false)
  expect(c.consume().moveZ).toBe(-1)
})

it('joystick: 8 direções com zona morta; solto, volta às teclas', () => {
  const c = new Controls()
  c.setStick(0.9, 0.1)
  expect(c.consume()).toMatchObject({ move: 1, moveZ: 0 })
  c.setStick(-0.6, -0.6)
  expect(c.consume()).toMatchObject({ move: -1, moveZ: -1 })
  c.setStick(0.1, 0.15)
  expect(c.consume()).toMatchObject({ move: 0, moveZ: 0 })
  c.setMove(1, true)
  c.setStick(null)
  expect(c.consume()).toMatchObject({ move: 1, moveZ: 0 })
})

it('reset solta o joystick', () => {
  const c = new Controls()
  c.setStick(1, 0)
  c.reset()
  expect(c.consume()).toMatchObject({ move: 0, moveZ: 0 })
})
