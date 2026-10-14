import { describe, expect, it } from 'vitest'
import { BALANCE } from '../../src/data/balance'
import { createRng } from '../../src/core/rng'
import { classifyHold, type Grade, gradeTiming, outgoing, windowsFor } from '../../src/core/touch'

describe('touch', () => {
  it('notas de timing pelas janelas base', () => {
    const w = windowsFor({ incomingForce: 0, incomingShark: false, easyAssist: false })
    expect(gradeTiming(0.04, w)).toBe('perfeito')
    expect(gradeTiming(-0.1, w)).toBe('bom')
    expect(gradeTiming(0.17, w)).toBe('ruim')
    expect(gradeTiming(0.2, w)).toBeNull()
  })

  it('Fácil alarga a janela ×1,5; ataque forte encolhe', () => {
    expect(gradeTiming(0.07, windowsFor({ incomingForce: 0, incomingShark: false, easyAssist: true }))).toBe('perfeito')
    expect(windowsFor({ incomingForce: 1, incomingShark: false, easyAssist: false }).ruim).toBeCloseTo(0.108)
  })

  it('Sharkataque só aceita Perfeito na janela de 0,025', () => {
    const w = windowsFor({ incomingForce: 1, incomingShark: true, easyAssist: false })
    expect(gradeTiming(0.02, w)).toBe('perfeito')
    expect(gradeTiming(0.04, w)).toBeNull()
  })

  it('classifyHold: pingo, força e exagero', () => {
    expect(classifyHold(100)).toEqual({ kind: 'pingo' })
    expect(classifyHold(450)).toEqual({ kind: 'forte', force: 0.5, overpower: false })
    expect(classifyHold(800)).toEqual({ kind: 'forte', force: 1, overpower: false })
    expect(classifyHold(950)).toMatchObject({ kind: 'forte', overpower: true })
  })

  it('pingo perfeito do time 1 cai a 1,2 m da rede no lado do time 0', () => {
    expect(outgoing({ action: 'pingo', team: 1, from: { x: 1, y: 2.5 }, grade: 'perfeito' }, createRng(1)).targetX).toBeCloseTo(-1.2)
  })

  it('forte com exagero cai fora', () => {
    const r = outgoing({ action: 'forte', team: 0, from: { x: -1, y: 2.5 }, grade: 'perfeito', force: 1, overpower: true }, createRng(1))
    expect(r.targetX).toBeGreaterThan(BALANCE.halfCourt)
  })

  it('ruim espalha mais que bom', () => {
    const spread = (g: Grade) => {
      const r = createRng(3)
      const xs = Array.from({ length: 200 }, () => outgoing({ action: 'passe', team: 0, from: { x: -4, y: 1 }, grade: g }, r).targetX)
      return Math.max(...xs) - Math.min(...xs)
    }
    expect(spread('ruim')).toBeGreaterThan(spread('bom') * 2)
  })
})
