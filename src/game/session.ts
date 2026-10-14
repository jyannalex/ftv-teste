import { getBrowserStore, type KeyValueStore, loadSave, resetSave, type SaveData, writeSave } from '../save/storage'

export type Session = {
  readonly save: SaveData
  readonly storageAvailable: boolean
  /** Altera o save e grava (se der). */
  persist(mutator: (d: SaveData) => SaveData): void
  /** true uma única vez, depois que uma gravação falhou: hora de avisar o jogador. */
  takeStorageWarning(): boolean
  /** Apaga todo o progresso. */
  reset(): void
}

export function createSession(store: KeyValueStore | null): Session {
  const loaded = loadSave(store)
  let save = loaded.data
  let warnPending = false
  let warned = false
  return {
    get save() {
      return save
    },
    storageAvailable: loaded.available,
    persist(mutator) {
      save = mutator(save)
      if (!writeSave(store, save) && !warned) {
        warnPending = true
        warned = true
      }
    },
    takeStorageWarning() {
      const w = warnPending
      warnPending = false
      return w
    },
    reset() {
      save = resetSave(store)
    },
  }
}

let current: Session | null = null

/** Sessão do jogo (carregada do localStorage na primeira chamada). */
export function getSession(): Session {
  current ??= createSession(getBrowserStore())
  return current
}
