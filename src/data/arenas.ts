export type ArenaId = 'praia' | 'clube' | 'arena'

export const ARENAS: { id: ArenaId; name: string }[] = [
  { id: 'praia', name: 'Praia de dia' },
  { id: 'clube', name: 'Quadra do Clube' },
  { id: 'arena', name: 'Arena Noturna' },
]

const BY_ROUND: ArenaId[] = ['praia', 'clube', 'arena']

/** Quartas na praia, semi no clube, final na arena. */
export const arenaForRound = (round: 0 | 1 | 2): ArenaId => BY_ROUND[round]
