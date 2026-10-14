import Phaser from 'phaser'
import { GROUND_Y } from '../view'

export type ArenaRuntime = { update(timeSec: number): void }

export const HORIZON = GROUND_Y - 110

export function sky(g: Phaser.GameObjects.Graphics, top: number, bottom: number, toY = HORIZON): void {
  g.fillGradientStyle(top, top, bottom, bottom, 1).fillRect(0, 0, 1280, toY)
}

/** Areia do fundo até a base da tela, com pontinhos de textura. */
export function sand(g: Phaser.GameObjects.Graphics, color: number, fromY: number, seed = 1): void {
  g.fillStyle(color, 1).fillRect(0, fromY, 1280, 720 - fromY)
  const rnd = new Phaser.Math.RandomDataGenerator([String(seed)])
  for (let i = 0; i < 260; i++) {
    g.fillStyle(rnd.pick([0xffffff, 0x000000]), rnd.realInRange(0.04, 0.1))
    g.fillCircle(rnd.between(0, 1280), rnd.between(fromY + 4, 720), rnd.realInRange(1, 2.4))
  }
}

export function cloud(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, alpha = 0.95): void {
  g.fillStyle(0xffffff, alpha)
  g.fillCircle(x, y, 22 * s).fillCircle(x + 26 * s, y - 10 * s, 28 * s).fillCircle(x + 56 * s, y, 22 * s)
  g.fillRoundedRect(x - 10 * s, y, 80 * s, 20 * s, 10 * s)
}

export function palm(g: Phaser.GameObjects.Graphics, x: number, baseY: number, h: number, lean: number): void {
  const topX = x + lean
  const topY = baseY - h
  g.lineStyle(14, 0x8d6e63, 1)
  const curve = new Phaser.Curves.QuadraticBezier(
    new Phaser.Math.Vector2(x, baseY),
    new Phaser.Math.Vector2(x + lean * 0.2, baseY - h * 0.6),
    new Phaser.Math.Vector2(topX, topY),
  )
  curve.draw(g, 24)
  g.lineStyle(3, 0x6d4c41, 0.6)
  for (let t = 0.1; t < 1; t += 0.08) {
    const p = curve.getPoint(t)
    g.lineBetween(p.x - 6, p.y, p.x + 6, p.y + 2)
  }
  const leaves = [-2.6, -2.1, -1.4, -0.9, -0.4, 0.2]
  for (const a of leaves) {
    const len = 90
    const ex = topX + Math.cos(a) * len
    const ey = topY + Math.sin(a) * len * 0.6 + 30
    g.fillStyle(0x2e7d32, 1)
    g.fillTriangle(topX, topY, ex, ey, topX + Math.cos(a) * len * 0.5, topY + Math.sin(a) * len * 0.3 + 6)
    g.fillStyle(0x388e3c, 1)
    g.fillTriangle(topX, topY - 4, ex, ey - 6, topX + Math.cos(a) * len * 0.6, topY + Math.sin(a) * len * 0.2 - 4)
  }
  g.fillStyle(0x5d4037, 1).fillCircle(topX - 6, topY + 6, 7).fillCircle(topX + 7, topY + 8, 7)
}

export function tree(g: Phaser.GameObjects.Graphics, x: number, baseY: number, s: number, color = 0x43a047): void {
  g.fillStyle(0x6d4c41, 1).fillRect(x - 6 * s, baseY - 60 * s, 12 * s, 60 * s)
  g.fillStyle(color, 1)
  g.fillCircle(x, baseY - 90 * s, 42 * s).fillCircle(x - 30 * s, baseY - 70 * s, 30 * s).fillCircle(x + 30 * s, baseY - 72 * s, 32 * s)
  g.fillStyle(0xffffff, 0.08).fillCircle(x - 10 * s, baseY - 105 * s, 18 * s)
}
