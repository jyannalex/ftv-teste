import { describe, expect, it } from 'vitest'
import { planContact } from '../../src/core/contact'
import { createMatch, IDLE, type MatchEvent, matchConfig } from '../../src/core/match'
import { holdThenRelease, type InputsFn, pressAt, simulate, stateWithAttackPlan } from './helpers'

const served = () => {
  const s = createMatch(matchConfig({ humanTeam: null }))
  simulate(s, holdThenRelease(0, 500), 200, 'saque')
  return s
}

/** Time 1 recebe e levanta com Recepção e ataca segurando 600 ms, tudo no tempo exato. */
const fullAttack = (): InputsFn => {
  const rec = pressAt(1, 'recepcao', 0)
  const atk = pressAt(1, 'ataque', 0, 600)
  return (st, i) => (st.plan?.touchIndex === 3 ? atk(st, i) : rec(st, i))
}

type Toque = Extract<MatchEvent, { type: 'toque' }>

describe('partida: toques', () => {
  it('depois do saque, um atleta do time 1 é designado para o 1º toque', () => {
    const s = served()
    expect(s.plan).toMatchObject({ team: 1, touchIndex: 1 })
    expect([2, 3]).toContain(s.plan!.athleteId)
  })

  it('recepção no tempo exato é Perfeito, passa ao parceiro e dá +8', () => {
    const s = served()
    const first = s.plan!.athleteId
    const ev = simulate(s, pressAt(1, 'recepcao', 0), 400, 'toque')
    expect(ev).toContainEqual({ type: 'toque', athleteId: first, action: 'passe', grade: 'perfeito' })
    expect(s.plan).toMatchObject({ athleteId: first ^ 1, touchIndex: 2 })
    expect(s.meter[1]).toBe(8)
  })

  it('três toques mandam a bola para o outro lado e nenhum atleta toca duas vezes seguidas', () => {
    const ev = simulate(served(), fullAttack(), 900, 'ponto')
    const toques = ev.filter((e): e is Toque => e.type === 'toque')
    expect(toques.map((t) => t.action)).toEqual(['passe', 'levantada', 'forte'])
    for (let k = 1; k < toques.length; k++) expect(toques[k].athleteId).not.toBe(toques[k - 1].athleteId)
    expect(ev).toContainEqual(expect.objectContaining({ type: 'ponto', winner: 1 }))
  })

  it('apertar fora da janela não toca e vira ponto', () => {
    const ev = simulate(served(), pressAt(1, 'recepcao', 0.3), 900, 'ponto')
    expect(ev.some((e) => e.type === 'toque')).toBe(false)
    expect(ev).toContainEqual(expect.objectContaining({ type: 'erroTiming' }))
  })

  it('pingo cai perto da rede do outro lado', () => {
    const s = stateWithAttackPlan(1, [-3.5, -6.5])
    const ev = simulate(s, pressAt(1, 'ataque', 0, 100), 900, 'ponto')
    expect(ev).toContainEqual(expect.objectContaining({ type: 'toque', action: 'pingo' }))
    expect(Math.abs(s.ball.x)).toBeLessThan(3)
    expect(s.ball.x).toBeLessThan(0)
  })

  it('Sharkataque com barra cheia perto da rede zera a barra e emite evento', () => {
    const s = served()
    s.meter[1] = 100
    const ev = simulate(s, fullAttack(), 900, 'sharkataque')
    expect(ev.some((e) => e.type === 'sharkataque')).toBe(true)
    expect(s.meter[1]).toBe(0)
  })

  it('Sharkataque só é defendido com Perfeito: atraso de 0,04 s não toca', () => {
    const s = served()
    s.lastAttack = { team: 1, force: 1, shark: true }
    s.ball = { x: 1, y: 3.0, vx: -15, vy: -3 }
    s.touch = { team: 1, count: 3, lastAthlete: 2 }
    s.plan = planContact(s)
    expect(s.plan).toMatchObject({ team: 0, incomingShark: true })
    const press = pressAt(0, 'recepcao', 0.04)
    const ev = simulate(s, (st, i) => [press(st, i)[0], IDLE], 200, 'ponto')
    expect(ev.some((e) => e.type === 'toque')).toBe(false)
  })

  it('no Fácil o humano tira Perfeito com 0,06 s de atraso', () => {
    const s = createMatch(matchConfig({ humanTeam: 1, easyAssist: true }))
    simulate(s, holdThenRelease(0, 500), 200, 'saque')
    expect(simulate(s, pressAt(1, 'recepcao', 0.06), 400, 'toque')).toContainEqual(expect.objectContaining({ grade: 'perfeito' }))
  })

  it('sem Fácil, 0,06 s de atraso é Bom', () => {
    const s = served()
    expect(simulate(s, pressAt(1, 'recepcao', 0.06), 400, 'toque')).toContainEqual(expect.objectContaining({ grade: 'bom' }))
  })
})
