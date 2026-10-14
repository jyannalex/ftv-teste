import { PLAYER_SHIRTS } from './teams'

export type HairStyle = 'curto' | 'rabo' | 'blackPower' | 'bone'

/** O atleta do jogador, criado na tela "Meu Atleta". */
export type Character = { name: string; skin: number; hair: number; style: HairStyle; shirt: number; number: number }

export const SKIN_TONES = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524]
export const HAIR_COLORS = [0x111111, 0x4a2c17, 0x8d5524, 0xf5d76e, 0xc62828]
export const HAIR_STYLES: { id: HairStyle; name: string }[] = [
  { id: 'curto', name: 'Curto' },
  { id: 'rabo', name: 'Rabo' },
  { id: 'blackPower', name: 'Black power' },
  { id: 'bone', name: 'Boné' },
]
export const NAME_MAX = 12

export const DEFAULT_CHARACTER: Character = { name: 'Você', skin: SKIN_TONES[1], hair: HAIR_COLORS[0], style: 'curto', shirt: PLAYER_SHIRTS[0], number: 7 }

const STYLE_IDS = new Set<unknown>(HAIR_STYLES.map((h) => h.id))

export function isCharacter(v: unknown): v is Character {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  const color = (x: unknown) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 0xffffff
  return (
    typeof c.name === 'string' &&
    c.name.length <= NAME_MAX &&
    color(c.skin) &&
    color(c.hair) &&
    color(c.shirt) &&
    STYLE_IDS.has(c.style) &&
    Number.isInteger(c.number) &&
    (c.number as number) >= 1 &&
    (c.number as number) <= 99
  )
}
