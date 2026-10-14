import Phaser from 'phaser'
import type { Ball } from '../../core/physics'
import { depthOf, LAYER, project } from './view'

/** Raio desenhado a 50 px/m: maior que o real para ser legível no celular. */
const R = 12

/** Bola amarela e preta de futevôlei, com sombra no chão (mostra onde ela está na quadra). */
export class BallView {
  private shadow: Phaser.GameObjects.Ellipse
  private glow: Phaser.GameObjects.Arc
  private g: Phaser.GameObjects.Graphics
  private spin = 0

  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add.ellipse(0, 0, 26, 10, 0x000000, 0.35).setDepth(LAYER.marks + 2)
    this.glow = scene.add.circle(0, 0, R * 1.9, 0xfff59d, 0.28).setBlendMode(Phaser.BlendModes.ADD)
    this.g = scene.add.graphics()
  }

  draw(b: Ball, dt: number): void {
    const p = project(b.x, b.y, b.z)
    const ground = project(b.x, 0, b.z)
    const r = (R * p.k) / 50
    const depth = depthOf(b.z) + 0.5
    this.glow.setDepth(depth).setPosition(p.x, p.y).setRadius(r * 1.9)
    this.g.setDepth(depth)
    this.spin += (b.vx + b.vz) * dt * 0.8
    const height = Math.max(0, b.y)
    this.shadow
      .setPosition(ground.x, ground.y)
      .setDisplaySize(r * 2.2 * Math.max(0.5, 1 - height * 0.06), r * 0.8 * Math.max(0.5, 1 - height * 0.06))
      .setAlpha(Math.max(0.15, 0.4 - height * 0.03))
    const g = this.g
    g.clear()
    g.fillStyle(0xffd600, 1).fillCircle(p.x, p.y, r)
    g.fillStyle(0x111111, 1)
    for (let k = 0; k < 4; k += 2) {
      const a0 = this.spin + (k * Math.PI) / 2
      g.slice(p.x, p.y, r, a0, a0 + Math.PI / 2, false).fillPath()
    }
    g.lineStyle(1.5, 0x111111, 1).strokeCircle(p.x, p.y, r)
    g.fillStyle(0xffffff, 0.55).fillCircle(p.x - r * 0.35, p.y - r * 0.4, r * 0.28)
  }
}
