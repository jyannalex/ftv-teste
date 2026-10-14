import { expect, it } from 'vitest'
import { createFixedStepper } from '../../src/game/loop/fixedStep'

it('1/60 s roda 1 passo; 1 s de atraso roda no máximo 5 e descarta o resto (Review Focus 2)', () => {
  let n = 0
  const fs = createFixedStepper(() => n++)
  expect(fs.advance(1 / 60)).toBe(1)
  expect(fs.advance(1)).toBe(5)
  expect(fs.advance(1 / 60)).toBe(1)
  expect(n).toBe(7)
})

it('acumula frações de passo', () => {
  let n = 0
  const fs = createFixedStepper(() => n++)
  fs.advance(1 / 120)
  expect(n).toBe(0)
  fs.advance(1 / 120)
  expect(n).toBe(1)
})

it('timeScale 0,3 desacelera', () => {
  let n = 0
  const fs = createFixedStepper(() => n++)
  fs.timeScale = 0.3
  fs.advance(10 / 60)
  expect(n).toBe(3)
})
