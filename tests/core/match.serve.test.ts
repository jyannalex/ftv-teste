import { describe, expect, it } from 'vitest'
import { cancelButtons, createMatch, IDLE, matchConfig, step } from '../../src/core/match'
import { serveWith, simulate, standStill } from './helpers'

describe('partida: saque e pontuação (arcade)', () => {
  it('começa 0×0 em fase de saque com o atleta 0 no fundo', () => {
    const s = createMatch(matchConfig())
    expect(s.phase).toBe('saque')
    expect(s.score.points).toEqual([0, 0])
    expect(s.athletes[0].x).toBeCloseTo(-9.5)
  })

  it('saque meio sem defesa vira ponto do sacador', () => {
    const ev = simulate(createMatch(matchConfig({ humanTeam: null })), serveWith(0, 'meio'), 3000, 'ponto')
    expect(ev).toContainEqual({ type: 'ponto', winner: 0, reason: 'chao' })
  })

  it.each([
    ['curto', 3.0],
    ['fundo', 8.0],
  ] as const)('saque com mira %s cai a ~%s m', (aim, depth) => {
    const s = createMatch(matchConfig({ humanTeam: null }))
    // Receptores colados na rede (a IA parada não sai do lugar): ninguém recebe.
    s.athletes[2].x = 0.4
    s.athletes[3].x = 0.6
    simulate(s, serveWith(0, aim), 3000, 'ponto')
    expect(Math.abs(s.ball.x - depth)).toBeLessThan(0.6)
  })

  it('saque automático depois de 8 s', () => {
    const ev = simulate(createMatch(matchConfig()), standStill, 8.2 * 60, 'saque')
    expect(ev.some((e) => e.type === 'saque')).toBe(true)
  })

  it('botão esquerdo segurado desde a pausa não saca até soltar e apertar de novo (Review Focus)', () => {
    const s = createMatch(matchConfig({ humanTeam: null }))
    simulate(s, serveWith(0, 'meio'), 3000, 'ponto') // time 0 pontua e saca de novo
    let inServe = 0
    const ev = simulate(
      s,
      (st) => {
        if (st.phase === 'saque') inServe++
        // Segura durante a pausa e solta 0,2 s depois de voltar ao saque.
        return [{ ...IDLE, forte: inServe < 12 }, IDLE]
      },
      200,
      'saque',
    )
    expect(ev.some((e) => e.type === 'saque')).toBe(false)
    expect(s.phase).toBe('saque')
  })

  it('cancelButtons não gera borda: soltar depois não saca', () => {
    const s = createMatch(matchConfig({ humanTeam: null }))
    simulate(s, () => [{ ...IDLE, forte: true }, IDLE], 10)
    cancelButtons(s, 0)
    const ev = simulate(s, standStill, 60)
    expect(ev.some((e) => e.type === 'saque')).toBe(false)
  })

  it('11×10 + ponto encerra o set; ponto dá +10 na barra', () => {
    const s = createMatch(matchConfig({ humanTeam: null }))
    s.score.points = [11, 10]
    const ev = simulate(s, serveWith(0), 3000, 'fimDeSet')
    expect(ev).toContainEqual({ type: 'fimDeSet', winner: 0 })
    expect(s.phase).toBe('fim')
    expect(s.meter[0]).toBe(10)
  })
})

describe('correções da revisão (visão 3D)', () => {
  it('a trava de movimento não passa para o próximo rally', () => {
    const s = createMatch(matchConfig({ humanTeam: null }))
    simulate(s, serveWith(0, 'meio'), 3000, 'ponto')
    s.buttons[0].moveLock = { move: 1, moveZ: 0 }
    for (let i = 0; i < 300 && s.phase !== 'saque'; i++) step(s, [{ ...IDLE, move: 1 }, IDLE])
    expect(s.phase).toBe('saque')
    expect(s.buttons[0].moveLock).toBeNull()
  })

  it('a bola morta quica depois do ponto', () => {
    const s = createMatch(matchConfig({ humanTeam: null }))
    simulate(s, serveWith(0, 'meio'), 3000, 'ponto')
    expect(s.ball.vy).toBeGreaterThan(0)
  })
})
