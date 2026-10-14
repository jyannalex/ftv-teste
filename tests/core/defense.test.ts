import { describe, expect, it } from 'vitest'
import { planContact } from '../../src/core/contact'
import { IDLE, type MatchEvent, type MatchState, step } from '../../src/core/match'
import { incomingBall, teamInputs } from './helpers'

type Toque = Extract<MatchEvent, { type: 'toque' }>

/** Ataque forte do time 0 vindo para o time 1 (humano), com o defensor a `d` m do contato. */
function attackOn(d: number, kind: 'forte' | 'pingo' = 'forte'): MatchState {
  const s = incomingBall(4, { humanTeam: 1 })
  s.lastAttack = { team: 0, kind }
  s.plan = planContact(s)
  const p = s.plan!
  s.controlled = p.athleteId
  s.athletes[p.athleteId].x = p.x + d
  return s
}

/** Aperta DEFENDER (botão esquerdo) uma vez, `offset` s depois do contato ideal. */
function defendAt(s: MatchState, offset: number, max = 300): MatchEvent[] {
  const tIdeal = s.plan!.tIdeal
  let done = false
  const ev: MatchEvent[] = []
  for (let i = 0; i < max; i++) {
    const now = s.time + 1 / 60
    const press = !done && now >= tIdeal + offset - 1 / 120
    if (press) done = true
    const e = step(s, teamInputs(1, { forte: press }))
    ev.push(...e)
    if (e.some((x) => x.type === 'toque' || x.type === 'ponto')) break
  }
  return ev
}

describe('defesa com botão DEFENDER', () => {
  it('ataque forte vindo: o plano marca a defesa', () => {
    expect(attackOn(0.5).plan).toMatchObject({ incoming: 'forte', touchIndex: 1 })
  })

  it('apertar na hora (±0,07 s) a até 1,5 m: DEFESAÇA e passe', () => {
    const ev = defendAt(attackOn(1.2), 0)
    expect(ev.find((e): e is Toque => e.type === 'toque')?.action).toBe('passe')
    expect(ev).toContainEqual(expect.objectContaining({ type: 'defesa', perfeita: true }))
  })

  it('apertar 0,15 s atrasado: defende, mas não é perfeita', () => {
    const ev = defendAt(attackOn(0.5), 0.15)
    expect(ev).toContainEqual(expect.objectContaining({ type: 'defesa', perfeita: false }))
  })

  it('apertar 0,3 s antes: não defende', () => {
    const ev = defendAt(attackOn(0.5), -0.3)
    expect(ev.some((e) => e.type === 'toque')).toBe(false)
  })

  it('perto da bola mas sem apertar: não defende (ataque exige o botão)', () => {
    const s = attackOn(0.2)
    const ev: MatchEvent[] = []
    for (let i = 0; i < 300 && !ev.some((e) => e.type === 'ponto'); i++) ev.push(...step(s, [IDLE, IDLE]))
    expect(ev.some((e) => e.type === 'toque')).toBe(false)
  })

  it('longe demais (2 m): apertar na hora não defende', () => {
    const ev = defendAt(attackOn(2), 0)
    expect(ev.some((e) => e.type === 'toque')).toBe(false)
  })

  it('Pingo também pede DEFENDER', () => {
    const ev = defendAt(attackOn(0.5, 'pingo'), 0)
    expect(ev).toContainEqual(expect.objectContaining({ type: 'defesa' }))
  })

  it('Sharkataque continua indefensável', () => {
    const s = incomingBall(4, { humanTeam: 1 })
    s.lastAttack = { team: 0, kind: 'shark' }
    expect(planContact(s)).toBeNull()
  })
})

describe('trocar o atleta controlado (W)', () => {
  it('a borda do botão troca troca o controlado', () => {
    const s = incomingBall(-4, { humanTeam: 1 })
    s.controlled = 2
    step(s, teamInputs(1, { troca: true }))
    expect(s.controlled).toBe(3)
    step(s, teamInputs(1, { troca: true })) // segurado: não troca de novo
    expect(s.controlled).toBe(3)
  })

  it('no 1º toque, quem vai na bola é o controlado (não o mais perto)', () => {
    const s = incomingBall(4, { humanTeam: 1 })
    const closest = s.plan!.athleteId
    s.controlled = closest ^ 1
    s.plan = planContact(s)
    expect(s.plan!.athleteId).toBe(closest ^ 1)
  })

  it('trocar com a bola vindo muda quem vai no 1º toque', () => {
    const s = incomingBall(4, { humanTeam: 1 })
    const first = s.plan!.athleteId
    step(s, teamInputs(1, { troca: true }))
    expect(s.controlled).toBe(first ^ 1)
    expect(s.plan!.athleteId).toBe(first ^ 1)
  })
})
