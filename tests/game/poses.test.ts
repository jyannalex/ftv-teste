import { expect, it } from 'vitest'
import type { AthleteAction } from '../../src/core/match'
import { poseFor } from '../../src/game/render/poses'

const ACTIONS: AthleteAction[] = ['parado', 'correndo', 'chapa', 'peito', 'cabeca', 'pingo', 'sharkataque', 'saque', 'comemorando']

it('todas as ações dão poses finitas', () => {
  for (const a of ACTIONS)
    for (const t of [0, 0.25, 0.5, 0.75, 1]) for (const v of Object.values(poseFor(a, t))) expect(Number.isFinite(v)).toBe(true)
})

it('sharkataque fica de cabeça para baixo no meio e volta de pé no fim', () => {
  expect(Math.abs(poseFor('sharkataque', 0.5).rootRot)).toBeGreaterThan(Math.PI * 0.7)
  expect(poseFor('sharkataque', 0.5).rootY).toBeGreaterThan(0.5)
  expect(Math.abs(poseFor('sharkataque', 1).rootRot)).toBeLessThan(0.2)
})

it('cabeceio pula', () => {
  expect(poseFor('cabeca', 0.5).rootY).toBeGreaterThan(0.3)
  expect(poseFor('parado', 0.5).rootY).toBe(0)
})
