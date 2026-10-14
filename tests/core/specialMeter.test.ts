import { expect, it } from 'vitest'
import { addMeter, isMeterFull } from '../../src/core/specialMeter'

it('barra soma e trava em 100', () => {
  expect(addMeter(95, 8)).toBe(100)
  expect(isMeterFull(100)).toBe(true)
  expect(isMeterFull(99)).toBe(false)
})
