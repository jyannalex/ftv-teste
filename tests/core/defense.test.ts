import { describe, expect, it } from 'vitest'
import { planContact } from '../../src/core/contact'
import { createMatch, IDLE, type MatchEvent, type MatchState, matchConfig, step } from '../../src/core/match'
import { createRng } from '../../src/core/rng'
import { outgoing } from '../../src/core/touch'
import { incomingBall, simulate, standStill, teamInputs } from './helpers'

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

  it('apertar na hora (±0,09 s) a 1,2 m: DEFESAÇA e passe', () => {
    const ev = defendAt(attackOn(1.2), 0)
    expect(ev.find((e): e is Toque => e.type === 'toque')?.action).toBe('passe')
    expect(ev).toContainEqual(expect.objectContaining({ type: 'defesa', perfeita: true }))
  })

  it('apertar 0,15 s adiantado: defende, mas não é perfeita', () => {
    const ev = defendAt(attackOn(0.5), -0.15)
    expect(ev).toContainEqual(expect.objectContaining({ type: 'defesa', perfeita: false }))
  })

  it('fora do alcance normal (1,8 m) e apertando 0,5 s antes: não defende', () => {
    const ev = defendAt(attackOn(1.8), -0.5)
    expect(ev.some((e) => e.type === 'toque')).toBe(false)
  })

  it('fora do alcance normal (1,8 m): o botão na hora estica o alcance e defende', () => {
    const ev = defendAt(attackOn(1.8), 0)
    expect(ev).toContainEqual(expect.objectContaining({ type: 'defesa' }))
  })

  it('perto da bola sem apertar: defende sozinho (passe comum, sem DEFESAÇA)', () => {
    const s = attackOn(0.2)
    const ev: MatchEvent[] = []
    for (let i = 0; i < 300 && !ev.some((e) => e.type === 'ponto' || e.type === 'toque'); i++) ev.push(...step(s, [IDLE, IDLE]))
    expect(ev.find((e): e is Toque => e.type === 'toque')?.action).toBe('passe')
    expect(ev.some((e) => e.type === 'defesa')).toBe(false)
  })

  it('longe demais (2,5 m): apertar na hora não defende', () => {
    const ev = defendAt(attackOn(2.5), 0)
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

describe('bola que toca o chão para ali', () => {
  it('forte não defendido cai dentro: ponto "chão", não "fora" (a carência da defesa não arrasta a bola)', () => {
    const s = createMatch(matchConfig({ humanTeam: null }))
    s.phase = 'rally'
    s.touch = { team: 1, count: 3, lastAthlete: 3 }
    const from = { x: 1.4, y: 3.2, z: 0 }
    const v = outgoing({ action: 'forte', team: 1, from, aim: 'fundo', lane: 0, precise: true }, createRng(1))
    s.ball = { ...from, vx: v.vx, vy: v.vy, vz: v.vz }
    s.lastAttack = { team: 1, kind: 'forte' }
    for (const a of s.athletes.filter((a) => a.team === 0)) a.z = -6
    s.plan = planContact(s)
    const ev = simulate(s, standStill, 300, 'ponto')
    expect(ev).toContainEqual({ type: 'ponto', winner: 1, reason: 'chao' })
  })
})

describe('alcance ao longo da trajetória', () => {
  it('parado sobre a marca de queda (longe do ponto de contato) ainda pega a bola', () => {
    const s = incomingBall(4, { humanTeam: 1 })
    s.ball = { x: 1, y: 2.5, z: 0, vx: 7, vy: -1, vz: 0 } // bola rápida e baixa, como um ataque
    s.plan = planContact(s)
    const p = s.plan!
    s.controlled = p.athleteId
    Object.assign(s.athletes[p.athleteId], { x: p.landX, z: p.landZ, vx: 0, vz: 0 })
    expect(Math.hypot(p.landX - p.x, p.landZ - p.z)).toBeGreaterThan(s.config.humanReach)
    const ev = simulate(s, standStill, 300, 'toque')
    expect(ev.some((e) => e.type === 'toque')).toBe(true)
  })
})

describe('bola no chão é ponto na hora', () => {
  it('DEFENDER apertado depois de a bola tocar o chão não tira a bola do chão', () => {
    const s = createMatch(matchConfig({ humanTeam: 1 }))
    s.phase = 'rally'
    s.touch = { team: 0, count: 3, lastAthlete: 1 }
    const from = { x: -1.4, y: 3.2, z: 0 }
    const v = outgoing({ action: 'forte', team: 0, from, aim: 'fundo', lane: 0, precise: true }, createRng(1))
    s.ball = { ...from, vx: v.vx, vy: v.vy, vz: v.vz }
    s.lastAttack = { team: 0, kind: 'forte' }
    for (const a of s.athletes) a.z = 0
    s.plan = planContact(s)
    const p = s.plan!
    s.controlled = p.athleteId
    // Longe demais para a defesa automática, perto o bastante para o DEFENDER.
    s.athletes[p.athleteId].x = p.x
    s.athletes[p.athleteId].z = p.z + 1.6
    let landed = false
    let pressed = false
    const ev: MatchEvent[] = []
    for (let i = 0; i < 200 && !ev.some((e) => e.type === 'ponto'); i++) {
      const press = landed && !pressed
      if (press) pressed = true
      ev.push(...step(s, teamInputs(1, { forte: press })))
      if (s.ball.y <= 0.11 + 1e-9) landed = true
    }
    expect(pressed || ev.some((e) => e.type === 'ponto')).toBe(true)
    expect(ev.some((e) => e.type === 'toque')).toBe(false)
    expect(ev).toContainEqual({ type: 'ponto', winner: 0, reason: 'chao' })
  })
})
