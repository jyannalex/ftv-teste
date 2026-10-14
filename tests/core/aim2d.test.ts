import { describe, expect, it } from 'vitest'
import { bestTarget } from '../../src/core/ai'
import { createMatch, type MatchEvent, matchConfig, step } from '../../src/core/match'
import { predictLanding } from '../../src/core/physics'
import { createRng } from '../../src/core/rng'
import { aimFromInput, outgoing } from '../../src/core/touch'
import { BALANCE } from '../../src/data/balance'
import { incomingBall, simulate, standStill, stateWithAttackPlan, teamInputs } from './helpers'

describe('mira 2D', () => {
  it('aimFromInput: x dá a profundidade, z dá a faixa', () => {
    expect(aimFromInput(0, { move: 1, moveZ: -1 })).toEqual({ aim: 'curto', lane: -1 })
    expect(aimFromInput(1, { move: 1, moveZ: 1 })).toEqual({ aim: 'fundo', lane: 1 })
    expect(aimFromInput(0, { move: 0, moveZ: 0 })).toEqual({ aim: 'meio', lane: 0 })
  })

  it.each([-1, 1] as const)('forte na faixa %s cai em z ≈ faixa × 2,8 (±0,4)', (lane) => {
    const r = outgoing({ action: 'forte', team: 0, from: { x: -1, y: 3, z: 0 }, aim: 'meio', lane }, createRng(1))
    expect(Math.abs(r.targetZ - lane * BALANCE.laneZ)).toBeLessThanOrEqual(BALANCE.aimError)
  })

  it('Pingo também mira a faixa, mais perto do meio', () => {
    const r = outgoing({ action: 'pingo', team: 1, from: { x: 1, y: 3, z: 0 }, lane: 1 }, createRng(2))
    expect(Math.abs(r.targetZ - BALANCE.pingoLaneZ)).toBeLessThanOrEqual(BALANCE.aimError)
  })

  it('passe vai para o z pedido, limitado a ±3,5', () => {
    const near = outgoing({ action: 'passe', team: 0, from: { x: -5, y: 0.45, z: -3 }, toZ: 1.5 }, createRng(3))
    expect(Math.abs(near.targetZ - 1.5)).toBeLessThanOrEqual(BALANCE.aimError)
    const wide = outgoing({ action: 'passe', team: 0, from: { x: -5, y: 0.45, z: 0 }, toZ: 6 }, createRng(3))
    expect(wide.targetZ).toBeLessThanOrEqual(BALANCE.passMaxZ + BALANCE.aimError)
  })

  it('no jogo, o passe sobe para o parceiro (z do parceiro)', () => {
    const s = incomingBall(4)
    const p = s.plan!
    s.athletes[p.athleteId].x = p.x
    s.athletes[p.athleteId ^ 1].z = 1.5
    simulate(s, standStill, 300, 'toque')
    expect(Math.abs(predictLanding(s.ball).z - 1.5)).toBeLessThanOrEqual(0.6)
  })

  it('ataque em câmera lenta com ▼ (moveZ +1) vai para a faixa de perto', () => {
    const s = stateWithAttackPlan(0, [10.5, 11], 0)
    for (let i = 0; i < 300 && !s.slowMo; i++) step(s, teamInputs(0, {}))
    step(s, teamInputs(0, { forte: true, moveZ: 1 }))
    expect(Math.abs(predictLanding(s.ball).z - BALANCE.laneZ)).toBeLessThanOrEqual(0.6)
  })

  it('saque com ▲ (moveZ −1) vai para a faixa do fundo', () => {
    const s = createMatch(matchConfig({ humanTeam: null }))
    let ev: MatchEvent[] = []
    for (let i = 0; i < 20 && !ev.some((e) => e.type === 'saque'); i++)
      ev = step(s, teamInputs(0, { forte: i < 10, moveZ: i >= 10 ? -1 : 0 }))
    expect(Math.abs(predictLanding(s.ball).z + BALANCE.laneZ)).toBeLessThanOrEqual(0.6)
  })

  it('bestTarget mira longe dos defensores: fundo e faixa vazia', () => {
    // Defensores perto da rede e na faixa do fundo (z−): melhor é fundo, faixa de perto.
    expect(bestTarget([{ d: 1.5, z: -2 }, { d: 3, z: -2.5 }])).toEqual({ aim: 'fundo', lane: 1 })
    expect(bestTarget([{ d: 7, z: 2.5 }, { d: 7.5, z: 0 }])).toEqual({ aim: 'curto', lane: -1 })
  })
})
