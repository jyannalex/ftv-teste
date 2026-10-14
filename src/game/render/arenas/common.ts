import Phaser from 'phaser'
import { depthOf, project } from '../view'

export type ArenaRuntime = { update(timeSec: number): void }

/** Linha do horizonte (céu/mar) e onde começa a areia, na tela. */
export const HORIZON = 150
export const SAND_Y = 200

const CROWD_SHIRTS = [0xe53935, 0xfdd835, 0x1e88e5, 0xffffff, 0x43a047, 0xff7043, 0x8e24aa, 0x26c6da]
const CROWD_SKINS = [0xf1c27d, 0x8d5524, 0xc68642, 0xe0ac69, 0xffdbac]
const CROWD_HAIR = [0x2b1b0e, 0x111111, 0xf5d76e, 0x6d4c41, 0xb71c1c]

/**
 * Torcida em pé na areia, atrás e dos lados da quadra: bonecos cabeçudos que pulam e acenam.
 * Cada um fica numa posição do mundo (x, z) e é desenhado na ordem da profundidade.
 */
export function crowd(scene: Phaser.Scene, seed: string, density = 1): ArenaRuntime {
  const rnd = new Phaser.Math.RandomDataGenerator([seed])
  type Fan = { x: number; z: number; shirt: number; skin: number; hair: number; ph: number; wave: boolean }
  const fans: Fan[] = []
  const add = (x: number, z: number) =>
    fans.push({ x, z, shirt: rnd.pick(CROWD_SHIRTS), skin: rnd.pick(CROWD_SKINS), hair: rnd.pick(CROWD_HAIR), ph: rnd.realInRange(0, 6.3), wave: rnd.frac() < 0.3 })
  for (const z of [-6.6, -7.6])
    for (let x = -12; x <= 12; x += 1.25 / density) if (rnd.frac() < 0.85) add(x + rnd.realInRange(-0.3, 0.3), z + rnd.realInRange(-0.2, 0.2))
  for (const side of [-1, 1])
    for (let z = -4.5; z <= 3; z += 1.5 / density) if (rnd.frac() < 0.7) add(side * rnd.realInRange(11.6, 13), z)
  fans.sort((a, b) => a.z - b.z)
  // Um gráfico por fileira de profundidade: atrás (z < -5) e dos lados.
  const back = scene.add.graphics().setDepth(depthOf(-7))
  const sides = scene.add.graphics().setDepth(depthOf(4))
  return {
    update(t: number) {
      back.clear()
      sides.clear()
      for (const f of fans) {
        const g = f.z < -5 ? back : sides
        const p = project(f.x, 0, f.z)
        const s = p.k / 50
        const hop = Math.max(0, Math.sin(t * 4 + f.ph)) * 6 * s
        const y = p.y - hop
        g.fillStyle(0x000000, 0.18).fillEllipse(p.x, p.y, 22 * s, 6 * s)
        g.fillStyle(0x263238, 1).fillRect(p.x - 6 * s, y - 16 * s, 5 * s, 16 * s).fillRect(p.x + 1 * s, y - 16 * s, 5 * s, 16 * s)
        g.fillStyle(f.shirt, 1).fillRoundedRect(p.x - 9 * s, y - 38 * s, 18 * s, 24 * s, 5 * s)
        // Braço acenando ou parado.
        const arm = f.wave ? Math.sin(t * 8 + f.ph) * 0.5 - 2.4 : 0.2
        g.lineStyle(4 * s, f.skin, 1).lineBetween(p.x + 8 * s, y - 34 * s, p.x + 8 * s + Math.sin(arm) * 14 * s, y - 34 * s + Math.cos(arm) * 14 * s)
        g.fillStyle(0x1a1a24, 1).fillCircle(p.x, y - 50 * s, 13 * s)
        g.fillStyle(f.skin, 1).fillCircle(p.x, y - 50 * s, 11.5 * s)
        g.fillStyle(f.hair, 1).slice(p.x, y - 50 * s, 12 * s, Math.PI, 0, false).fillPath()
        g.fillStyle(0x1a1a24, 1).fillCircle(p.x - 4 * s, y - 49 * s, 1.5 * s).fillCircle(p.x + 4 * s, y - 49 * s, 1.5 * s)
      }
    },
  }
}

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
