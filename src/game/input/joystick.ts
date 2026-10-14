import Phaser from 'phaser'
import { LAYER } from '../render/view'

/**
 * Joystick virtual: o dedo que encosta na área fica preso a ele até soltar (mesmo saindo da área).
 * Chama onChange com x e z de −1 a 1 (z+ = para baixo na tela) e null ao soltar.
 */
export class Joystick {
  private pointerId: number | null = null
  private knob: Phaser.GameObjects.Arc

  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
    private radius: number,
    private onChange: (v: { x: number; z: number } | null) => void,
  ) {
    scene.add.circle(x, y, radius, 0x0b1d33, 0.35).setStrokeStyle(4, 0xffffff, 0.6).setDepth(LAYER.hud)
    for (const [dx, dy, r] of [
      [0, -1, 0],
      [0, 1, Math.PI],
      [-1, 0, -Math.PI / 2],
      [1, 0, Math.PI / 2],
    ])
      scene.add
        .triangle(x + dx * radius * 0.72, y + dy * radius * 0.72, 0, 10, 8, -4, 16, 10, 0xffffff, 0.6)
        .setRotation(r)
        .setDepth(LAYER.hud)
    this.knob = scene.add.circle(x, y, radius * 0.42, 0xffffff, 0.75).setStrokeStyle(3, 0x0b1d33, 0.6).setDepth(LAYER.hud)

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.pointerId !== null || Math.hypot(p.x - x, p.y - y) > radius * 1.4) return
      this.pointerId = p.id
      this.move(p)
    })
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id === this.pointerId) this.move(p)
    })
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.id === this.pointerId) this.release()
    })
    scene.input.on('gameout', () => this.release())
  }

  /** O dedo é o do joystick (os botões o ignoram ao passar por cima). */
  owns(pointerId: number): boolean {
    return pointerId === this.pointerId
  }

  /** Solta sem avisar (os controles já foram zerados). */
  clear(): void {
    this.pointerId = null
    this.knob.setPosition(this.x, this.y)
  }

  private move(p: Phaser.Input.Pointer): void {
    const dx = p.x - this.x
    const dy = p.y - this.y
    const len = Math.hypot(dx, dy)
    const k = len > this.radius ? this.radius / len : 1
    this.knob.setPosition(this.x + dx * k, this.y + dy * k)
    this.onChange({ x: (dx * k) / this.radius, z: (dy * k) / this.radius })
  }

  private release(): void {
    if (this.pointerId === null) return
    this.clear()
    this.onChange(null)
  }
}
