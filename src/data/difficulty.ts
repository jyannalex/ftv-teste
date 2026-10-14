export type Difficulty = 'facil' | 'medio' | 'dificil'

export const DIFFICULTIES: { id: Difficulty; name: string }[] = [
  { id: 'facil', name: 'Fácil' },
  { id: 'medio', name: 'Médio' },
  { id: 'dificil', name: 'Difícil' },
]

/** Habilidade da IA nas quartas, na semi e na final. */
export const DIFFICULTY_SKILL: Record<Difficulty, [number, number, number]> = {
  facil: [0.2, 0.3, 0.4],
  medio: [0.45, 0.55, 0.65],
  dificil: [0.7, 0.8, 0.9],
}

export const quickMatchSkill = (d: Difficulty): number => DIFFICULTY_SKILL[d][1]

/** Ajuda ao jogador por dificuldade: alcance do toque automático e duração real da câmera lenta. */
export const ASSIST: Record<Difficulty, { reach: number; slowMoSec: number }> = {
  facil: { reach: 0.9, slowMoSec: 2.0 },
  medio: { reach: 0.7, slowMoSec: 1.5 },
  dificil: { reach: 0.6, slowMoSec: 1.2 },
}
