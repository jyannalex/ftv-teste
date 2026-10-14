import Phaser from 'phaser'
import type { ArenaId } from '../../data/arenas'
import { drawArena } from '../render/arenas'

/** Cenário animado com véu escuro, para as telas de menu. */
export function menuBackground(scene: Phaser.Scene, arena: ArenaId = 'praia', veil = 0.35): void {
  const rt = drawArena(scene, arena)
  scene.add.rectangle(640, 360, 1280, 720, 0x0b1d33, veil)
  const tick = () => rt.update(scene.time.now / 1000)
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick)
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick))
}
