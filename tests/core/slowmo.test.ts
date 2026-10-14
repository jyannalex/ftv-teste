import { describe, expect, it } from 'vitest'
import { IDLE, type MatchEvent, type MatchState, step, type TeamInput } from '../../src/core/match'
import { predictLanding } from '../../src/core/physics'
import { BALANCE } from '../../src/data/balance'
import { moveFor, simulate, stateWithAttackPlan, teamInputs } from './helpers'

type Toque = Extract<MatchEvent, { type: 'toque' }>

/** Partida com o jogador (time 0) prestes a atacar; o atacante está a 0,3 m da bola. */
const humanAttack = (slowMoSec = 1.5) => {
  const s = stateWithAttackPlan(0, [10.5, 11], 0)
  s.config.slowMoSec = slowMoSec
  return s
}

const untilSlowMo = (s: MatchState, input: TeamInput = IDLE) => {
  for (let i = 0; i < 300 && !s.slowMo; i++) step(s, [input, IDLE])
}

describe('câmera lenta do ataque do jogador', () => {
  it('começa em tIdeal − lead e o tempo anda ×0,25', () => {
    const s = humanAttack()
    const tIdeal = s.plan!.tIdeal
    untilSlowMo(s)
    expect(s.slowMo).not.toBeNull()
    expect(Math.abs(s.time - (tIdeal - 1.5 * 0.25))).toBeLessThan(1 / 60 + 1e-6)
    const t0 = s.time
    for (let i = 0; i < 20; i++) step(s, [IDLE, IDLE])
    expect(s.time - t0).toBeCloseTo(20 * (1 / 60) * BALANCE.slowMo.scale, 5)
  })

  it.each([
    [2.0, 0.5],
    [1.2, 0.3],
  ])('com %s s reais, o lead é %s s de jogo', (sec, lead) => {
    const s = humanAttack(sec)
    const tIdeal = s.plan!.tIdeal
    untilSlowMo(s)
    expect(Math.abs(s.time - (tIdeal - lead))).toBeLessThan(1 / 60 + 1e-6)
  })

  it.each([
    ['forte', 'meio', 5.0],
    ['forte', 'fundo', 7.8],
    ['forte', 'curto', 2.5],
    ['pingo', 'meio', 1.2],
  ] as const)('escolha %s com mira %s executa na hora e vai para ~%s m', (button, aim, depth) => {
    const s = humanAttack()
    untilSlowMo(s)
    const ev = step(s, teamInputs(0, { [button]: true, move: moveFor(0, aim) }))
    const t = ev.find((e): e is Toque => e.type === 'toque')
    expect(t?.action).toBe(button)
    expect(s.slowMo).toBeNull()
    expect(Math.abs(predictLanding(s.ball).x - depth)).toBeLessThanOrEqual(0.5)
  })

  it('sem escolha: fraco automático ao chegar tIdeal', () => {
    const s = humanAttack()
    const ev = simulate(s, () => [IDLE, IDLE], 600, 'toque')
    expect(ev.find((e): e is Toque => e.type === 'toque')?.action).toBe('fraco')
  })

  it('shark sem barra cheia é ignorado; com barra cheia executa e zera a barra', () => {
    const s1 = humanAttack()
    untilSlowMo(s1)
    expect(step(s1, teamInputs(0, { shark: true })).some((e) => e.type === 'toque')).toBe(false)
    expect(s1.slowMo).not.toBeNull()

    const s2 = humanAttack()
    s2.meter[0] = 100
    untilSlowMo(s2)
    const ev = step(s2, teamInputs(0, { shark: true }))
    expect(ev.some((e) => e.type === 'sharkataque')).toBe(true)
    expect(s2.meter[0]).toBe(0)
  })

  it('botão esquerdo segurado desde antes da câmera lenta não dispara o forte (Review Focus)', () => {
    const s = humanAttack()
    const held = teamInputs(0, { forte: true })
    untilSlowMo(s, held[0])
    const ev = simulate(s, () => held, 600, 'toque')
    expect(ev.find((e): e is Toque => e.type === 'toque')?.action).toBe('fraco')
  })

  it('atacante a mais de 1,2 m: sem câmera lenta', () => {
    const s = humanAttack()
    s.athletes[s.plan!.athleteId].x = -3.5
    let sawSlow = false
    simulate(s, (st) => ((sawSlow ||= st.slowMo !== null), [IDLE, IDLE]), 600, 'ponto')
    expect(sawSlow).toBe(false)
  })

  it('a IA não ativa câmera lenta', () => {
    const s = stateWithAttackPlan(1, [-3.5, -6.5], 0)
    let sawSlow = false
    simulate(s, (st) => ((sawSlow ||= st.slowMo !== null), [IDLE, IDLE]), 600, 'toque')
    expect(sawSlow).toBe(false)
  })
})

describe('câmera lenta: correções da revisão final', () => {
  it('apertar FORTE no exato passo em que a câmera lenta começa vale (não sai fraco)', () => {
    const s = humanAttack()
    const lead = 1.5 * 0.25
    const tIdeal = s.plan!.tIdeal
    let ev: MatchEvent[] = []
    for (let i = 0; i < 300 && !ev.some((e) => e.type === 'toque'); i++) {
      // Aperta no passo que vai cruzar tIdeal − lead (o passo do pulo).
      const jumpStep = !s.slowMo && s.time + 1 / 60 >= tIdeal - lead
      ev = step(s, teamInputs(0, { forte: jumpStep }))
      if (jumpStep) expect(s.slowMo !== null || ev.some((e) => e.type === 'toque')).toBe(true)
    }
    expect(ev.find((e): e is Toque => e.type === 'toque')?.action).toBe('forte')
  })
})
