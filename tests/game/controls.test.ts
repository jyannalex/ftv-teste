import { expect, it } from 'vitest'
import { Controls } from '../../src/game/input/controls'

it('recepção é entregue uma vez só', () => {
  const c = new Controls()
  c.pressRecepcao()
  expect(c.consume().recepcao).toBe(true)
  expect(c.consume().recepcao).toBe(false)
})

it('segurar e soltar o ataque, junto com recepção (dois dedos)', () => {
  const c = new Controls()
  c.setAtaque(true)
  c.pressRecepcao()
  expect(c.consume()).toEqual({ recepcao: true, ataque: true })
  expect(c.consume()).toEqual({ recepcao: false, ataque: true })
  c.setAtaque(false)
  expect(c.consume().ataque).toBe(false)
})

it('reset (pausa / dedo saiu do botão) solta o ataque (Review Focus 1)', () => {
  const c = new Controls()
  c.setAtaque(true)
  c.pressRecepcao()
  c.reset()
  expect(c.consume()).toEqual({ recepcao: false, ataque: false })
})
