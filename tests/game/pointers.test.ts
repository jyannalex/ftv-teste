import { expect, it } from 'vitest'
import { Controls } from '../../src/game/input/controls'
import { PointerRouter } from '../../src/game/input/pointers'

type Target = 'forte' | 'pingo' | 'shark' | -1 | 1
const setup = () => {
  const c = new Controls()
  const r = new PointerRouter<Target>((t, down) => (t === -1 || t === 1 ? c.setMove(t, down) : c.setButton(t, down)))
  return { c, r }
}

it('deslizar o dedo de ◀ para ▶ troca a direção sem parar (revisão final)', () => {
  const { c, r } = setup()
  r.down(1, -1)
  expect(c.consume().move).toBe(-1)
  r.out(1, -1)
  r.over(1, 1, true)
  expect(c.consume().move).toBe(1)
})

it('passar por cima de um botão sem o dedo apertado não aperta nada', () => {
  const { c, r } = setup()
  r.over(2, 'pingo', false)
  expect(c.consume().pingo).toBe(false)
})

it('soltar o dedo solta só o botão daquele dedo', () => {
  const { c, r } = setup()
  r.down(1, 'forte')
  r.down(2, 1)
  r.up(1)
  const i = c.consume()
  expect(i.forte).toBe(true) // ficou na trava deste consumo
  expect(c.consume().forte).toBe(false)
  expect(i.move).toBe(1)
})

it('mouse saindo da tela solta só os dedos, não as teclas (revisão final)', () => {
  const { c, r } = setup()
  c.setMove(1, true) // tecla D segurada
  c.setButton('forte', true) // tecla J segurada
  r.down(5, 'pingo')
  c.consume()
  r.releaseAll()
  const i = c.consume()
  expect(i.move).toBe(1)
  expect(i.forte).toBe(true)
  expect(i.pingo).toBe(false)
})
