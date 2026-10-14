import type { Rng } from '../core/rng'
import { recordPlayerResult } from '../core/tournament'
import { type SaveData, unlockForRound } from '../save/storage'

export type AfterMatch = 'chave' | 'eliminado' | 'campeao'

/** Aplica o resultado de uma partida do campeonato ao save e diz para onde ir. */
export function applyTournamentResult(save: SaveData, playerWon: boolean, rng: Rng): { save: SaveData; next: AfterMatch } {
  if (!save.tournament) return { save, next: 'chave' }
  const t = recordPlayerResult(save.tournament, playerWon, rng)
  if (t.status === 'eliminado') return { save: { ...save, tournament: t }, next: 'eliminado' }
  if (t.status === 'campeao') {
    const titles = { ...save.titles, [t.difficulty]: save.titles[t.difficulty] + 1 }
    return { save: { ...save, tournament: null, titles }, next: 'campeao' }
  }
  return { save: unlockForRound({ ...save, tournament: t }, t.currentRound), next: 'chave' }
}
