import { describe, expect, it } from 'vitest'
import { planContact } from '../../src/core/contact'
import { createAI } from '../../src/core/ai'
import { IDLE, type MatchEvent, step } from '../../src/core/match'
import { createRng } from '../../src/core/rng'
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
    expect(toques(ev)[0]).toMatchObject({ action: 'passe' })
    expect(s.meter[1]).toBe(BALANCE.meter.toque)
  })

  it('três toques com a IA se posicionando: passe → levantada → ataque, sem atleta repetido', () => {
    const s = incomingBall(4)
    const ai = createAI(1, 1, 'equilibrado', createRng(7))
    const ev = simulate(s, (st) => [IDLE, ai.think(st)], 900, 'ponto')
    const t = toques(ev).filter((e) => e.athleteId >= 2)
    expect(t.map((e) => e.action).slice(0, 2)).toEqual(['passe', 'levantada'])
    expect(['forte', 'pingo', 'fraco', 'sharkataque']).toContain(t[2].action)
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

  it('sem peixinho: apertar FORTE com a bola a 1,5 m não salva', () => {
    const s = incomingBall(4)
    placeDesignated(s, 1.5)
    const tIdeal = s.plan!.tIdeal
    // Aperta 0,3 s antes do contato (era a janela do peixinho).
    const ev = simulate(s, (st) => teamInputs(1, { forte: st.time + 1 / 60 >= tIdeal - 0.3 }), 300, 'ponto')
    expect(toques(ev)).toHaveLength(0)
    expect(ev).toContainEqual({ type: 'ponto', winner: 0, reason: 'chao' })
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

  it('sem entrada o controlado fica parado (sem ajuda automática)', () => {
    const s = incomingBall(4, { humanTeam: 1 })
    const id = s.plan!.athleteId
    s.athletes[id].x = 8
    for (let i = 0; i < 30; i++) step(s, [IDLE, IDLE])
    expect(s.athletes[id].x).toBe(8)
  })

  it('com a bola, o parceiro sem controle vai sozinho para perto da rede', () => {
    const s = incomingBall(4, { humanTeam: 1 })
    s.ball.y = 12 // bola alta: dá tempo de o parceiro chegar
    s.plan = planContact(s)
    const other = s.plan!.athleteId ^ 1
    s.athletes[other].x = 6
    for (let i = 0; i < 100; i++) step(s, teamInputs(1, { move: 0 }))
    expect(s.athletes[other].x).toBeCloseTo(BALANCE.basePos.support, 1)
  })

  it('na defesa, o parceiro ocupa a posição que o controlado deixou livre', () => {
    const s = incomingBall(-4, { humanTeam: 1 }) // bola indo para o time 0
    s.controlled = 2
    s.athletes[2].x = 7 // controlado no fundo
    s.athletes[3].x = 8.5
    s.ball.y = 12
    s.plan = planContact(s)
    for (let i = 0; i < 100; i++) step(s, [IDLE, IDLE])
    expect(s.athletes[3].x).toBeCloseTo(BALANCE.basePos.front, 1)
  })

  it('acelera até 5 m/s em ~0,15 s e freia em ~0,1 s', () => {
    const s = incomingBall(4, { humanTeam: 1 })
    const id = s.plan!.athleteId
    s.athletes[id].x = 8
    step(s, teamInputs(1, { move: -1 }))
    expect(Math.abs(s.athletes[id].vx)).toBeLessThan(BALANCE.move.manual)
    for (let i = 0; i < 9; i++) step(s, teamInputs(1, { move: -1 }))
    expect(s.athletes[id].vx).toBeCloseTo(-BALANCE.move.manual, 5)
    for (let i = 0; i < 7; i++) step(s, [IDLE, IDLE])
    expect(s.athletes[id].vx).toBe(0)
  })

  it('bola do outro lado: o controle não troca enquanto o parceiro se posiciona', () => {
    const s = incomingBall(-4, { humanTeam: 1 }) // bola indo para o time 0
    s.controlled = 2
    s.athletes[2].x = 7
    s.athletes[3].x = 4 // mais perto da bola, mas não é o controlado
    for (let i = 0; i < 30; i++) step(s, [IDLE, IDLE])
    expect(s.controlled).toBe(2)
  })
})
