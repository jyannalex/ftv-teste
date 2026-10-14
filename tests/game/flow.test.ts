import { describe, expect, it } from 'vitest'
import { createRng } from '../../src/core/rng'
import { createTournament } from '../../src/core/tournament'
import { applyTournamentResult } from '../../src/game/flow'
import { createSession } from '../../src/game/session'
import { DEFAULT_SAVE, type KeyValueStore, SAVE_KEY, type SaveData } from '../../src/save/storage'

const mem = (): KeyValueStore => {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }
}
const withTournament = (): SaveData => ({ ...DEFAULT_SAVE, tournament: createTournament('medio', { name: 'A', shirt: 1 }, createRng(1)) })

describe('fluxo do campeonato', () => {
  it('vencer as quartas vai para a chave e libera o Clube', () => {
    const r = applyTournamentResult(withTournament(), true, createRng(2))
    expect(r.next).toBe('chave')
    expect(r.save.tournament?.currentRound).toBe(1)
    expect(r.save.unlockedArenas).toEqual(['praia', 'clube'])
  })

  it('perder elimina e mantém o campeonato para mostrar a chave', () => {
    const r = applyTournamentResult(withTournament(), false, createRng(2))
    expect(r.next).toBe('eliminado')
    expect(r.save.tournament?.status).toBe('eliminado')
  })

  it('vencer a final conta o título e encerra o campeonato', () => {
    let save = withTournament()
    let r = applyTournamentResult(save, true, createRng(1))
    r = applyTournamentResult(r.save, true, createRng(2))
    expect(r.save.unlockedArenas).toEqual(['praia', 'clube', 'arena'])
    r = applyTournamentResult(r.save, true, createRng(3))
    expect(r.next).toBe('campeao')
    expect(r.save.titles.medio).toBe(1)
    expect(r.save.tournament).toBeNull()
    save = r.save
    expect(save.unlockedArenas).toContain('arena')
  })
})

describe('sessão', () => {
  it('persist grava no armazenamento', () => {
    const st = mem()
    const s = createSession(st)
    s.persist((d) => ({ ...d, tipsShown: true }))
    expect(s.save.tipsShown).toBe(true)
    expect(JSON.parse(st.getItem(SAVE_KEY)!).tipsShown).toBe(true)
  })

  it('sem armazenamento: funciona em memória e avisa uma vez só', () => {
    const s = createSession(null)
    expect(s.takeStorageWarning()).toBe(false)
    s.persist((d) => ({ ...d, tipsShown: true }))
    s.persist((d) => ({ ...d, tipsShown: true }))
    expect(s.save.tipsShown).toBe(true)
    expect(s.takeStorageWarning()).toBe(true)
    expect(s.takeStorageWarning()).toBe(false)
  })
})

describe('sessão: reiniciar progresso', () => {
  it('reset volta ao padrão e apaga o armazenamento', () => {
    const st = mem()
    const s = createSession(st)
    s.persist((d) => ({ ...d, tipsShown: true }))
    s.reset()
    expect(s.save).toEqual(DEFAULT_SAVE)
    expect(st.getItem(SAVE_KEY)).toBeNull()
  })
})
