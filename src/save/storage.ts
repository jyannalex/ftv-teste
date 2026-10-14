import { ARENAS, type ArenaId } from '../data/arenas'
import { type Character, DEFAULT_CHARACTER, isCharacter } from '../data/character'
import type { Difficulty } from '../data/difficulty'
import { PLAYER_ID, type Tournament } from '../core/tournament'

export type SaveData = {
  version: 1
  tournament: Tournament | null
  unlockedArenas: ArenaId[]
  titles: Record<Difficulty, number>
  /** control: 'solo' = só o meu atleta (parceiro IA); 'dupla' = os dois atletas. */
  options: { sound: boolean; music: boolean; control: ControlMode }
  tipsShown: boolean
  character: Character
}

export type ControlMode = 'solo' | 'dupla'

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  tournament: null,
  unlockedArenas: ['praia'],
  titles: { facil: 0, medio: 0, dificil: 0 },
  options: { sound: true, music: true, control: 'solo' },
  tipsShown: false,
  character: DEFAULT_CHARACTER,
}

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const SAVE_KEY = 'ftv-teste-save'

/** localStorage, se funcionar de verdade (modo privado e bloqueios lançam erro). */
export function getBrowserStore(): KeyValueStore | null {
  try {
    const ls = globalThis.localStorage
    const probe = `${SAVE_KEY}-probe`
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return ls
  } catch {
    return null
  }
}

const fresh = (): SaveData => structuredClone(DEFAULT_SAVE)

export function loadSave(store: KeyValueStore | null): { data: SaveData; available: boolean } {
  if (!store) return { data: fresh(), available: false }
  let raw: string | null
  try {
    raw = store.getItem(SAVE_KEY)
  } catch {
    return { data: fresh(), available: false }
  }
  if (raw === null) return { data: fresh(), available: true }
  try {
    const parsed: unknown = JSON.parse(raw)
    const data = upgrade(parsed)
    return { data: isSaveData(data) ? data : fresh(), available: true }
  } catch {
    return { data: fresh(), available: true }
  }
}

export function writeSave(store: KeyValueStore | null, data: SaveData): boolean {
  if (!store) return false
  try {
    store.setItem(SAVE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function resetSave(store: KeyValueStore | null): SaveData {
  try {
    store?.removeItem(SAVE_KEY)
  } catch {
    // Sem armazenamento: só volta ao padrão em memória.
  }
  return fresh()
}

/** Chegar à semi libera o Clube; chegar à final libera a Arena. */
export function unlockForRound(data: SaveData, round: 0 | 1 | 2): SaveData {
  const reached = new Set<ArenaId>(data.unlockedArenas)
  if (round >= 1) reached.add('clube')
  if (round >= 2) reached.add('arena')
  return { ...data, unlockedArenas: ARENAS.map((a) => a.id).filter((id) => reached.has(id)) }
}

/**
 * Campos que vieram depois (personagem, modo de controle): save antigo ganha o padrão, e um personagem
 * inválido volta ao padrão sem apagar o resto do progresso.
 */
function upgrade(v: unknown): unknown {
  if (!isObj(v)) return v
  const options = isObj(v.options) ? { control: 'solo', ...v.options } : v.options
  if (isObj(options) && options.control !== 'solo' && options.control !== 'dupla') options.control = 'solo'
  return { ...v, options, character: isCharacter(v.character) ? v.character : structuredClone(DEFAULT_CHARACTER) }
}

// ---- validação ----

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0
const ARENA_IDS = new Set<unknown>(ARENAS.map((a) => a.id))
const DIFFS = new Set<unknown>(['facil', 'medio', 'dificil'])

function isSaveData(v: unknown): v is SaveData {
  if (!isObj(v) || v.version !== 1) return false
  if (!Array.isArray(v.unlockedArenas) || !v.unlockedArenas.includes('praia')) return false
  if (!v.unlockedArenas.every((a) => ARENA_IDS.has(a))) return false
  const titles = v.titles
  if (!isObj(titles) || !isCount(titles.facil) || !isCount(titles.medio) || !isCount(titles.dificil)) return false
  if (!isObj(v.options) || !isBool(v.options.sound) || !isBool(v.options.music)) return false
  if (!isBool(v.tipsShown)) return false
  return v.tournament === null || isTournament(v.tournament)
}

const ROUND_SIZES = [4, 2, 1]

function isTournament(v: unknown): v is Tournament {
  if (!isObj(v) || !DIFFS.has(v.difficulty)) return false
  if (!isObj(v.player) || typeof v.player.name !== 'string' || typeof v.player.shirt !== 'number') return false
  if (!['andamento', 'eliminado', 'campeao'].includes(v.status as string)) return false
  const ids = v.teamIds
  if (!Array.isArray(ids) || ids.length !== 8 || new Set(ids).size !== 8 || !ids.includes(PLAYER_ID)) return false
  if (!ids.every((id): id is string => typeof id === 'string')) return false
  const cr = v.currentRound
  if (cr !== 0 && cr !== 1 && cr !== 2) return false
  const rounds = v.rounds
  if (!Array.isArray(rounds) || rounds.length !== cr + 1) return false
  return rounds.every(
    (round, i) =>
      Array.isArray(round) &&
      round.length === ROUND_SIZES[i] &&
      round.every(
        (m) => isObj(m) && typeof m.a === 'string' && typeof m.b === 'string' && ids.includes(m.a) && ids.includes(m.b) && (m.winner === null || m.winner === m.a || m.winner === m.b),
      ),
  )
}
