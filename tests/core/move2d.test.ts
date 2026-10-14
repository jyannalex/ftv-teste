import { describe, expect, it } from 'vitest'
import { createMatch, IDLE, type MatchEvent, matchConfig, step } from '../../src/core/match'
import { BALANCE } from '../../src/data/balance'
import { incomingBall, simulate, standStill, teamInputs } from './helpers'

const toques = (ev: MatchEvent[]) => ev.filter((e) => e.type === 'toque')

describe('movimento em 2 eixos', () => {
  it('moveZ leva o controlado para perto da câmera (z+) e para o fundo (z−)', () => {
    const s = incomingBall(4, { humanTeam: 1 })
    const id = s.controlled!
    const z0 = s.athletes[id].z
    for (let i = 0; i < 20; i++) step(s, teamInputs(1, { moveZ: 1 }))
    expect(s.athletes[id].z).toBeGreaterThan(z0 + 1)
    for (let i = 0; i < 60; i++) step(s, teamInputs(1, { moveZ: -1 }))
    expect(s.athletes[id].z).toBeLessThan(z0 - 1)
  })

  it('na diagonal a velocidade não passa da máxima', () => {
    const s = incomingBall(4, { humanTeam: 1 })
    const a = s.athletes[s.controlled!]
    for (let i = 0; i < 20; i++) step(s, teamInputs(1, { move: -1, moveZ: 1 }))
    expect(Math.hypot(a.vx, a.vz)).toBeCloseTo(BALANCE.move.manual, 5)
  })

  it('na defesa, o parceiro fica na faixa oposta à do controlado', () => {
    const s = incomingBall(-4, { humanTeam: 1 }) // bola indo para o time 0
    s.ball.y = 12
    s.controlled = 2
    s.athletes[2].z = 2.5
    s.athletes[3].z = 2
    s.athletes[3].x = 8
    for (let i = 0; i < 120; i++) step(s, [IDLE, IDLE])
    expect(s.athletes[3].z).toBeCloseTo(-BALANCE.basePos.laneZ, 1)
    expect(s.athletes[3].x).toBeCloseTo(BALANCE.basePos.defense, 1)
  })

  it('o toque automático usa a distância no plano (x e z)', () => {
    const near = incomingBall(4)
    const p = near.plan!
    near.athletes[p.athleteId].x = p.x
    near.athletes[p.athleteId].z = p.z + 0.5
    expect(toques(simulate(near, standStill, 300, 'toque'))).toHaveLength(1)

    const far = incomingBall(4)
    const q = far.plan!
    far.athletes[q.athleteId].x = q.x
    far.athletes[q.athleteId].z = q.z + 1.3
    const ev = simulate(far, standStill, 300, 'ponto')
    expect(toques(ev)).toHaveLength(0)
    expect(ev).toContainEqual(expect.objectContaining({ type: 'perdeu' }))
  })
})

describe('trava de movimento depois do saque', () => {
  it('direção segurada no saque não faz o sacador correr; soltando, volta a andar', () => {
    const s = createMatch(matchConfig({ humanTeam: 0 }))
    const server = s.athletes[s.score.server]
    const x0 = server.x
    // Segura FORTE com a seta para a rede e continua segurando a seta depois de sacar.
    simulate(s, (_st, i) => teamInputs(0, { forte: i < 10, move: 1 }), 60)
    expect(s.phase).toBe('rally')
    expect(server.x).toBeCloseTo(x0, 5)
    simulate(s, () => [IDLE, IDLE], 1)
    simulate(s, () => teamInputs(0, { move: 1 }), 10)
    expect(server.x).toBeGreaterThan(x0 + 0.1)
  })
})

describe('trava de movimento: outra direção libera na hora', () => {
  it('depois do saque segurando ▶, apertar ▼ já anda', () => {
    const s = createMatch(matchConfig({ humanTeam: 0 }))
    const server = s.athletes[s.score.server]
    simulate(s, (_st, i) => teamInputs(0, { forte: i < 10, move: 1 }), 30)
    const z0 = server.z
    simulate(s, () => teamInputs(0, { move: 1, moveZ: 1 }), 10)
    expect(server.z).toBeGreaterThan(z0 + 0.1)
  })
})
