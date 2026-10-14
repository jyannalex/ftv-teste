import { describe, expect, it } from 'vitest'
import { createRng } from '../../src/core/rng'
import { createTournament, recordPlayerResult } from '../../src/core/tournament'
import { DEFAULT_SAVE, type KeyValueStore, loadSave, resetSave, SAVE_KEY, unlockForRound, writeSave } from '../../src/save/storage'

const mem = (): KeyValueStore => {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }
}

describe('save', () => {
  it('vazio carrega o padrão, disponível', () => {
    expect(loadSave(mem())).toEqual({ data: DEFAULT_SAVE, available: true })
  })

  it('ida e volta, inclusive com campeonato em andamento', () => {
    const st = mem()
    const tournament = recordPlayerResult(createTournament('medio', { name: 'A', shirt: 1 }, createRng(1)), true, createRng(2))
    const d = { ...DEFAULT_SAVE, tipsShown: true, tournament, titles: { facil: 1, medio: 0, dificil: 0 } }
    expect(writeSave(st, d)).toBe(true)
    expect(loadSave(st).data).toEqual(d)
  })

  it('JSON quebrado volta ao padrão', () => {
    const st = mem()
    st.setItem(SAVE_KEY, '{oops')
    expect(loadSave(st).data).toEqual(DEFAULT_SAVE)
  })

  it('campeonato inconsistente ou versão desconhecida volta ao padrão (Review Focus 4)', () => {
    const st = mem()
    const t = createTournament('facil', { name: 'X', shirt: 0 }, createRng(1))
    st.setItem(SAVE_KEY, JSON.stringify({ ...DEFAULT_SAVE, tournament: { ...t, teamIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] } }))
    expect(loadSave(st).data).toEqual(DEFAULT_SAVE)
    st.setItem(SAVE_KEY, JSON.stringify({ ...DEFAULT_SAVE, tournament: { ...t, currentRound: 5 } }))
    expect(loadSave(st).data).toEqual(DEFAULT_SAVE)
    st.setItem(SAVE_KEY, JSON.stringify({ ...DEFAULT_SAVE, version: 99 }))
    expect(loadSave(st).data).toEqual(DEFAULT_SAVE)
    st.setItem(SAVE_KEY, JSON.stringify({ ...DEFAULT_SAVE, unlockedArenas: ['marte'] }))
    expect(loadSave(st).data).toEqual(DEFAULT_SAVE)
  })

  it('armazenamento que lança erro: indisponível, sem travar', () => {
    const boom: KeyValueStore = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
      removeItem: () => {},
    }
    expect(loadSave(boom)).toEqual({ data: DEFAULT_SAVE, available: false })
    expect(writeSave(boom, DEFAULT_SAVE)).toBe(false)
    expect(loadSave(null).available).toBe(false)
  })

  it('liberação de cenários por rodada', () => {
    expect(unlockForRound(DEFAULT_SAVE, 0).unlockedArenas).toEqual(['praia'])
    expect(unlockForRound(DEFAULT_SAVE, 1).unlockedArenas).toEqual(['praia', 'clube'])
    expect(unlockForRound(unlockForRound(DEFAULT_SAVE, 1), 2).unlockedArenas).toEqual(['praia', 'clube', 'arena'])
    expect(unlockForRound(unlockForRound(DEFAULT_SAVE, 2), 1).unlockedArenas).toEqual(['praia', 'clube', 'arena'])
  })

  it('resetSave apaga e devolve o padrão', () => {
    const st = mem()
    writeSave(st, { ...DEFAULT_SAVE, tipsShown: true })
    expect(resetSave(st)).toEqual(DEFAULT_SAVE)
    expect(st.getItem(SAVE_KEY)).toBeNull()
  })
})
