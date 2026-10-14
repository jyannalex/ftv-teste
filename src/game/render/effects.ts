import Phaser from 'phaser'
import type { Ball } from '../../core/physics'
import { toScreenX, toScreenY } from './view'

/** Areia levantando (pulo do atleta ou bola caindo). */
export function sandPuff(scene: Phaser.Scene, x: number, y: number, amount = 8): void {
  for (let i = 0; i < amount; i++) {
    const p = scene.add.circle(x, y, Phaser.Math.Between(2, 5), 0xe6c27a, 0.9)
    const ang = Phaser.Math.FloatBetween(Math.PI * 1.05, Math.PI * 1.95)
    const dist = Phaser.Math.Between(14, 40)
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(ang) * dist,
      y: y + Math.sin(ang) * dist * 0.7,
      alpha: 0,
      scale: 0.4,
      duration: Phaser.Math.Between(300, 550),
      ease: 'Quad.easeOut',
      onComplete: () => p.destroy(),
    })
  }
}

/** Rastro da bola em ataques fortes (ciano no Sharkataque). */
export class BallTrail {
  private points: { x: number; y: number }[] = []
  private g: Phaser.GameObjects.Graphics
  private color = 0xffffff
  private active = false

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics()
  }

  start(color: number): void {
    this.color = color
    this.active = true
    this.points = []
  }

  stop(): void {
    this.active = false
  }

  update(b: Ball): void {
    if (this.active) this.points.push({ x: toScreenX(b.x), y: toScreenY(b.y) })
    else this.points.shift()
    if (this.points.length > 14) this.points.shift()
    const g = this.g
    g.clear()
    this.points.forEach((p, i) => {
      const k = (i + 1) / this.points.length
      g.fillStyle(this.color, 0.5 * k).fillCircle(p.x, p.y, 10 * k)
    })
  }
}

/** Tubarão saindo do pé no Sharkataque: barbatana, boca e flash. */
export function sharkEffect(scene: Phaser.Scene, x: number, y: number, dir: 1 | -1): void {
  const flash = scene.add.rectangle(640, 360, 1280, 720, 0xffffff, 0.7).setBlendMode(Phaser.BlendModes.ADD)
  scene.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() })

  const shark = scene.add.container(x, y)
  const g = scene.add.graphics()
  // Corpo e boca aberta, desenhados virados para +x.
  g.fillStyle(0x546e7a, 1).fillEllipse(-40, 0, 120, 46)
  g.fillStyle(0xeceff1, 1).fillEllipse(-36, 10, 100, 22)
  g.fillStyle(0x546e7a, 1).fillTriangle(-50, -18, -24, -18, -46, -58)
  g.fillStyle(0x546e7a, 1).fillTriangle(-96, 0, -124, -26, -124, 26)
  g.fillStyle(0xb71c1c, 1).fillTriangle(2, -6, 2, 14, 22, 4)
  g.fillStyle(0xffffff, 1)
  for (let i = 0; i < 4; i++) g.fillTriangle(4 + i * 4, -6, 8 + i * 4, -6, 6 + i * 4, 0).fillTriangle(4 + i * 4, 14, 8 + i * 4, 14, 6 + i * 4, 8)
  g.fillStyle(0x000000, 1).fillCircle(-8, -8, 3)
  shark.add(g)
  shark.setScale(dir * 0.7, 0.7).setRotation(dir * 0.35)
  scene.tweens.add({ targets: shark, scaleX: dir * 1.8, scaleY: 1.8, x: x + dir * 220, y: y + 110, duration: 450, ease: 'Cubic.easeOut' })
  scene.tweens.add({ targets: shark, alpha: 0, delay: 420, duration: 250, onComplete: () => shark.destroy() })
  scene.cameras.main.shake(180, 0.008)
}
