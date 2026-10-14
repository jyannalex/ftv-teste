import Phaser from 'phaser'
import type { Ball } from '../../core/physics'
import { depthOf, groundSquash, LAYER, project } from './view'

const SAND_TEXTURE = 'grao-areia'

/** Areia levantando (pulo, freada, bola caindo): grãos com gravidade. */
export function sandPuff(scene: Phaser.Scene, x: number, y: number, amount = 8, depth: number = LAYER.fx): void {
  if (!scene.textures.exists(SAND_TEXTURE)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4)
    g.generateTexture(SAND_TEXTURE, 8, 8)
    g.destroy()
  }
  const e = scene.add.particles(x, y, SAND_TEXTURE, {
    speed: { min: 50, max: 150 },
    angle: { min: 200, max: 340 },
    gravityY: 520,
    lifespan: { min: 350, max: 600 },
    scale: { start: 0.9, end: 0.25 },
    alpha: { start: 0.95, end: 0 },
    tint: [0xe6c27a, 0xd9b36a, 0xf0d9a0, 0xc9a35a],
    emitting: false,
  })
  e.setDepth(depth)
  e.explode(amount)
  scene.time.delayedCall(700, () => e.destroy())
}

/** Rastro da bola em ataques fortes (ciano no Sharkataque). */
export class BallTrail {
  private points: { x: number; y: number }[] = []
  private g: Phaser.GameObjects.Graphics
  private color = 0xffffff
  private active = false

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(LAYER.fx)
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
    if (this.active) this.points.push(project(b.x, b.y, b.z))
    else this.points.shift()
    if (this.points.length > 14) this.points.shift()
    const g = this.g
    g.clear()
    this.points.forEach((p, i) => {
      const k = (i + 1) / this.points.length
      g.fillStyle(this.color, 0.25 * k).fillCircle(p.x, p.y, 18 * k)
      g.fillStyle(this.color, 0.6 * k).fillCircle(p.x, p.y, 9 * k)
    })
  }
}

/** Tubarão saindo do pé no Sharkataque: barbatana, boca e flash. */
export function sharkEffect(scene: Phaser.Scene, x: number, y: number, dir: 1 | -1): void {
  const flash = scene.add.rectangle(640, 360, 1280, 720, 0xffffff, 0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(LAYER.fx)
  scene.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() })

  const shark = scene.add.container(x, y).setDepth(LAYER.fx)
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

export type GroundPoint = { x: number; z: number }

/**
 * Marcas no chão, sob os atletas: círculo de alcance do controlado, onde a bola vai cair e a mira.
 */
export class GroundMarks {
  private g: Phaser.GameObjects.Graphics
  private t = 0

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(LAYER.marks)
  }

  /** Círculo de raio r (m) no chão, achatado pela perspectiva. */
  private ring(p: GroundPoint, r: number): { x: number; y: number; w: number; h: number } {
    const c = project(p.x, 0, p.z)
    return { x: c.x, y: c.y, w: 2 * r * c.k, h: 2 * r * c.k * groundSquash(p.z) }
  }

  update(reach: (GroundPoint & { r: number; hot: boolean; defense: number | null }) | null, landing: GroundPoint | null, aim: GroundPoint | null, dt: number): void {
    this.t += dt
    const g = this.g
    g.clear()
    if (reach) {
      // Alcance do atleta controlado: fica vermelho quando a bola vai cair dentro.
      const e = this.ring(reach, reach.r)
      const color = reach.hot ? 0xff5252 : 0xffffff
      g.fillStyle(color, reach.hot ? 0.2 : 0.07).fillEllipse(e.x, e.y, e.w, e.h)
      g.lineStyle(2, color, 0.7).strokeEllipse(e.x, e.y, e.w, e.h)
      // Ataque vindo: contorno fino do alcance com o botão DEFENDER.
      if (reach.defense !== null) {
        const d = this.ring(reach, reach.defense)
        g.lineStyle(1.5, 0x80deea, 0.6).strokeEllipse(d.x, d.y, d.w, d.h)
      }
    }
    if (landing) {
      const e = this.ring(landing, 0.35)
      const pulse = 1 + Math.sin(this.t * 12) * 0.12
      g.fillStyle(0xff5252, 0.35).fillEllipse(e.x, e.y, e.w * pulse, e.h * pulse)
      g.lineStyle(2, 0xffffff, 0.9).strokeEllipse(e.x, e.y, e.w * pulse, e.h * pulse)
    }
    if (aim) {
      const pulse = 1 + Math.sin(this.t * 10) * 0.08
      const e = this.ring(aim, 0.55)
      g.lineStyle(3, 0xffe14d, 1).strokeEllipse(e.x, e.y, e.w * pulse, e.h * pulse)
      g.lineStyle(2, 0xffffff, 0.9).strokeEllipse(e.x, e.y, e.w * 0.55 * pulse, e.h * 0.55 * pulse)
    }
  }
}

/** Ordem de desenho de um efeito no chão em z. */
export const fxDepth = (z: number): number => depthOf(z) + 0.6

/** Câmera lenta do ataque: bordas escurecidas, bolha no atacante, anel na bola e o aviso de escolha. */
export class SlowMoFx {
  private veil: Phaser.GameObjects.Graphics
  private fx: Phaser.GameObjects.Graphics
  private text: Phaser.GameObjects.Text
  private t = 0

  constructor(scene: Phaser.Scene) {
    this.veil = scene.add.graphics().setDepth(LAYER.fx)
    for (let i = 0; i < 6; i++) {
      const inset = i * 14
      this.veil.lineStyle(28, 0x000000, 0.08).strokeRect(inset, inset, 1280 - 2 * inset, 720 - 2 * inset)
    }
    this.fx = scene.add.graphics().setDepth(LAYER.fx).setBlendMode(Phaser.BlendModes.ADD)
    this.text = scene.add
      .text(640, 128, 'ESCOLHA!   FORTE · PINGO · 🦈', { fontFamily: 'Arial Black, Arial', fontSize: '30px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#0b1d33', 8)
      .setDepth(LAYER.fx)
    this.hide()
  }

  show(attacker: { x: number; y: number }, ball: { x: number; y: number }, dt: number): void {
    this.t += dt
    this.veil.setVisible(true)
    this.text.setVisible(true).setScale(1 + Math.sin(this.t * 6) * 0.04)
    const g = this.fx.setVisible(true)
    g.clear()
    const r = 78 + Math.sin(this.t * 5) * 4
    g.fillStyle(0x80deea, 0.12).fillEllipse(attacker.x, attacker.y, r * 1.5, r * 2)
    g.lineStyle(3, 0xe0f7fa, 0.6).strokeEllipse(attacker.x, attacker.y, r * 1.5, r * 2)
    g.lineStyle(3, 0xffffff, 0.95).strokeCircle(ball.x, ball.y, 22 + Math.sin(this.t * 12) * 3)
  }

  hide(): void {
    this.veil.setVisible(false)
    this.fx.setVisible(false)
    this.text.setVisible(false)
    this.t = 0
  }
}

/** Brilho curto no contato de um ataque forte. */
export function hitFlash(scene: Phaser.Scene, x: number, y: number): void {
  const c = scene.add.circle(x, y, 16, 0xffffff, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(LAYER.fx)
  scene.tweens.add({ targets: c, scale: 3, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: () => c.destroy() })
}
