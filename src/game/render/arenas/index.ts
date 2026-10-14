import type Phaser from 'phaser'
import type { ArenaId } from '../../../data/arenas'
import { drawArenaNoturna } from './arena'
import { drawClube } from './clube'
import type { ArenaRuntime } from './common'
import { drawPraia } from './praia'

export type { ArenaRuntime }

/** Desenha o fundo do cenário (camadas) e devolve o que precisa animar. */
export function drawArena(scene: Phaser.Scene, id: ArenaId): ArenaRuntime {
  if (id === 'clube') return drawClube(scene)
  if (id === 'arena') return drawArenaNoturna(scene)
  return drawPraia(scene)
}
