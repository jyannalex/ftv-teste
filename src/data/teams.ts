import type { Personality } from '../core/ai'

export type TeamDef = { id: string; name: string; shirt: number; shorts: number; personality: Personality }

/** Duplas adversárias (fictícias). */
export const AI_TEAMS: TeamDef[] = [
  { id: 'tubaroes', name: 'Tubarões do Leme', shirt: 0x1565c0, shorts: 0x0d2b52, personality: 'bateForte' },
  { id: 'areia-quente', name: 'Areia Quente', shirt: 0xef6c00, shorts: 0x5d2a00, personality: 'equilibrado' },
  { id: 'pe-de-ouro', name: 'Pé de Ouro', shirt: 0xfdd835, shorts: 0x6d5a00, personality: 'gostaDePingo' },
  { id: 'muralha', name: 'Muralha do Posto 9', shirt: 0x6a1b9a, shorts: 0x2a0a3d, personality: 'paredao' },
  { id: 'brisa-norte', name: 'Brisa Norte', shirt: 0x00acc1, shorts: 0x00474f, personality: 'gostaDePingo' },
  { id: 'mare-alta', name: 'Maré Alta', shirt: 0x2e7d32, shorts: 0x0f3311, personality: 'bateForte' },
  { id: 'coqueiral', name: 'Coqueiral FC', shirt: 0xc62828, shorts: 0x4a0d0d, personality: 'equilibrado' },
]

export const teamById = (id: string): TeamDef | undefined => AI_TEAMS.find((t) => t.id === id)

/** Cores de camisa que o jogador pode escolher. */
export const PLAYER_SHIRTS = [0xffffff, 0xd32f2f, 0x1976d2, 0x388e3c, 0xff9800, 0x212121]
