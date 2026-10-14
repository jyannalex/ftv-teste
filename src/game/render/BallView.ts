import Phaser from 'phaser'
import type { Ball } from '../../core/physics'
import { toScreenX, toScreenY } from './view'

/** Desenhada maior que o tamanho real para ser legível no celular. */
const R = 11

/** Bola amarela e preta de futevôlei, com sombra na areia. */
export class BallView {
  private shadow: Phaser.GameObjects.Ellipse
  private glow: Phaser.GameObjects.Arc
  private g: Phaser.GameObjects.Graphics
  private spin = 0

  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add.ellipse(0, 0, 22, 6, 0x000000, 0.3)
    this.glow = scene.add.circle(0, 0, R * 1.9, 0xfff59d, 0.28).setBlendMode(Phaser.BlendModes.ADD)
    this.g = scene.add.graphics()
  }

  draw(b: Ball, dt: number): void {
    const x = toScreenX(b.x)
    const y = toScreenY(b.y)
    this.spin += b.vx * dt * 0.8
    const height = Math.max(0, b.y)
    this.shadow.setPosition(x, toScreenY(0) + 2).setScale(Math.max(0.3, 1 - height * 0.12)).setAlpha(Math.max(0.08, 0.3 - height * 0.03))
    this.glow.setPosition(x, y)
    const g = this.g
    g.clear()
    g.fillStyle(0xffd600, 1).fillCircle(x, y, R)
    g.fillStyle(0x111111, 1)
    for (let k = 0; k < 4; k += 2) {
      const a0 = this.spin + (k * Math.PI) / 2
      g.slice(x, y, R, a0, a0 + Math.PI / 2, false).fillPath()
    }
    g.lineStyle(1.5, 0x111111, 1).strokeCircle(x, y, R)
    g.fillStyle(0xffffff, 0.55).fillCircle(x - R * 0.35, y - R * 0.4, R * 0.28)
  }
}
