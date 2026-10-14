import { describe, expect, it } from 'vitest'
import { planContact } from '../../src/core/contact'
import { IDLE, type MatchEvent, step } from '../../src/core/match'
import { BALANCE } from '../../src/data/balance'
import { incomingBall, simulate, standStill, teamInputs } from './helpers'

type Toque = Extract<MatchEvent, { type: 'toque' }>
const toques = (ev: MatchEvent[]) => ev.filter((e): e is Toque => e.type === 'toque')

/** Coloca o atleta designado a `d` metros do ponto de contato (do lado mais fundo). */
function placeDesignated(s: ReturnType<typeof incomingBall>, d: number) {
  const p = s.plan!
  const sign = p.team === 0 ? -1 : 1
  s.athletes[p.athleteId].x = p.x + sign * d
}

describe('partida: toques automáticos (arcade)', () => {
  it('atleta parado sob a bola recebe sozinho (qualidade normal, +5 na barra)', () => {
    const s = incomingBall(4)
    placeDesignated(s, 0.3)
    const ev = simulate(s, standStill, 300, 'toque')
    expect(toques(ev)[0]).toMatchObject({ action: 'passe', quality: 'normal' })
    expect(s.meter[1]).toBe(BALANCE.meter.toque)
  })

  it('três toques automáticos com ajuda: passe → levantada → fraco, sem atleta repetido', () => {
    const s = incomingBall(4, { humanTeam: 1 })
    const ev = simulate(s, standStill, 900, 'ponto')
    const t = toques(ev).filter((e) => e.athleteId >= 2)
    expect(t.map((e) => e.action).slice(0, 3)).toEqual(['passe', 'levantada', 'fraco'])
    for (let k = 1; k < 3; k++) expect(t[k].athleteId).not.toBe(t[k - 1].athleteId)
  })

  it('atleta longe sem botão: bola cai e sai "perdeu"', () => {
    const s = incomingBall(4)
    placeDesignated(s, 1.5)
    const ev = simulate(s, standStill, 300, 'ponto')
    expect(toques(ev)).toHaveLength(0)
    expect(ev).toContainEqual(expect.objectContaining({ type: 'perdeu' }))
    expect(ev).toContainEqual({ type: 'ponto', winner: 0, reason: 'chao' })
  })

  it('atleta a 1,5 m com o botão esquerdo apertado 0,3 s antes: peixinho', () => {
    const s = incomingBall(4)
    placeDesignated(s, 1.5)
    const tIdeal = s.plan!.tIdeal
    let pressed = false
    const ev = simulate(
      s,
      (st) => {
        const now = st.time + 1 / 60
        const press = !pressed && now >= tIdeal - 0.3
        if (press) pressed = true
        return teamInputs(1, { forte: press })
      },
      300,
      'toque',
    )
    expect(toques(ev)[0]).toMatchObject({ action: 'passe', quality: 'peixinho' })
    expect(s.athletes[s.touch.lastAthlete!].action).toBe('peixinho')
  })

  it('atleta a 3 m: nem o peixinho alcança', () => {
    const s = incomingBall(4)
    placeDesignated(s, 3)
    const ev = simulate(s, () => teamInputs(1, { forte: true }), 300, 'ponto')
    expect(toques(ev)).toHaveLength(0)
  })

  it('bola indo para fora: ninguém planeja e a ajuda não corre atrás (Review Focus)', () => {
    const s = incomingBall(4, { humanTeam: 1, vx: 6 })
    expect(s.plan).toBeNull()
    const x0 = s.athletes.map((a) => a.x)
    const ev = simulate(s, standStill, 300, 'ponto')
    expect(ev).toContainEqual(expect.objectContaining({ type: 'ponto', reason: 'fora' }))
    // Ninguém do time 1 correu para fora da quadra atrás da bola.
    for (const a of s.athletes.filter((a) => a.team === 1)) expect(a.x).toBeLessThanOrEqual(Math.max(x0[a.id], BALANCE.basePos.back) + 0.01)
  })

  it('Sharkataque não é defendido: o outro time não planeja toque', () => {
    const s = incomingBall(4)
    s.lastAttack = { team: 0, kind: 'shark' }
    expect(planContact(s)).toBeNull()
  })

  it('defender um forte dá +12 a mais', () => {
    const s = incomingBall(4)
    s.lastAttack = { team: 0, kind: 'forte' }
    s.plan = planContact(s)
    placeDesignated(s, 0.2)
    simulate(s, standStill, 300, 'toque')
    expect(s.meter[1]).toBe(BALANCE.meter.toque + BALANCE.meter.defesaForte)
  })

  it('controlado com move=+1 anda 5 m/s; com move=0 e designado, a ajuda puxa a 2,8 m/s', () => {
    const s = incomingBall(4, { humanTeam: 1 })
    const id = s.plan!.athleteId
    s.athletes[id].x = 8
    const x0 = s.athletes[id].x
    step(s, teamInputs(1, { move: -1 }))
    expect(x0 - s.athletes[id].x).toBeCloseTo(BALANCE.move.manual / 60, 3)
    const x1 = s.athletes[id].x
    step(s, [IDLE, IDLE])
    expect(Math.abs(s.athletes[id].x - x1)).toBeCloseTo(BALANCE.move.assist / 60, 3)
  })
})
