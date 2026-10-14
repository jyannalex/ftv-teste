import { describe, expect, it } from 'vitest'
import { createAI, skillParams } from '../../src/core/ai'
import { planContact } from '../../src/core/contact'
import { cancelHold, createMatch, IDLE, type MatchEvent, matchConfig, step } from '../../src/core/match'
import { createRng } from '../../src/core/rng'
import { holdThenRelease, type InputsFn, pressAt, simulate } from './helpers'

describe('correções da revisão final', () => {
  it('IA forte deixa passar o saque que vai para fora', () => {
    let fora = 0
    for (let seed = 1; seed <= 10; seed++) {
      const s = createMatch(matchConfig({ seed, humanTeam: 0, reactionDelay: [0, skillParams(1).reactionDelay] }))
      const ai = createAI(1, 1, 'equilibrado', createRng(seed))
      const serve = holdThenRelease(0, 1200)
      const ev: MatchEvent[] = []
      for (let i = 0; i < 600 && !ev.some((e) => e.type === 'ponto'); i++) ev.push(...step(s, [serve(s, i)[0], ai.think(s)]))
      if (ev.some((e) => e.type === 'ponto' && e.reason === 'fora' && e.winner === 1)) fora++
    }
    expect(fora).toBeGreaterThanOrEqual(8)
  })

  it('segurar Ataque desde a pausa do ponto não conta para o saque', () => {
    const s = createMatch(matchConfig({ humanTeam: null }))
    simulate(s, holdThenRelease(0, 500), 3000, 'ponto') // time 0 pontua e continua sacando
    expect(s.phase).toBe('ponto')
    // Segura durante toda a pausa e solta 0,3 s depois de voltar ao saque.
    let sinceServe = -1
    const ev = simulate(
      s,
      (st) => {
        if (st.phase === 'saque') sinceServe++
        return [{ recepcao: false, ataque: sinceServe < 18 }, IDLE]
      },
      3000,
      'ponto',
    )
    expect(ev).toContainEqual({ type: 'ponto', winner: 0, reason: 'chao' })
  })

  it('cancelHold (pausa) não dispara o saque ao soltar', () => {
    const s = createMatch(matchConfig({ humanTeam: null }))
    simulate(s, () => [{ recepcao: false, ataque: true }, IDLE], 18)
    cancelHold(s, 0)
    const ev = simulate(s, () => [IDLE, IDLE], 60)
    expect(ev.some((e) => e.type === 'saque')).toBe(false)
  })

  it('defesa do Sharkataque aceita Perfeito no lado atrasado da janela', () => {
    const s = createMatch(matchConfig({ humanTeam: null }))
    simulate(s, holdThenRelease(0, 500), 200, 'saque')
    s.lastAttack = { team: 1, force: 1, shark: true }
    s.ball = { x: 1, y: 3.0, vx: -15, vy: -3 }
    s.touch = { team: 1, count: 3, lastAthlete: 2 }
    s.athletes[0].x = -6.5
    s.plan = planContact(s)
    expect(s.plan).toMatchObject({ team: 0, incomingShark: true, reachable: true })
    const press = pressAt(0, 'recepcao', 0.012)
    const ev = simulate(s, (st, i) => [press(st, i)[0], IDLE], 200, 'toque')
    expect(ev).toContainEqual(expect.objectContaining({ type: 'toque', grade: 'perfeito' }))
  })

  it('apertar Recepção cedo demais "fura" e não deixa apertar de novo', () => {
    const s = createMatch(matchConfig({ humanTeam: null }))
    simulate(s, holdThenRelease(0, 500), 200, 'saque')
    const early = pressAt(1, 'recepcao', -0.3)
    const onTime = pressAt(1, 'recepcao', 0)
    const spam: InputsFn = (st, i) => {
      const a = early(st, i)[1]
      const b = onTime(st, i)[1]
      return [IDLE, { recepcao: a.recepcao || b.recepcao, ataque: false }]
    }
    const ev = simulate(s, spam, 600, 'ponto')
    expect(ev.some((e) => e.type === 'toque')).toBe(false)
    expect(ev).toContainEqual(expect.objectContaining({ type: 'erroTiming' }))
  })
})
