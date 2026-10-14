import Phaser from 'phaser'
import type { Athlete } from '../../core/match'
import type { Pose } from './poses'
import { PX_PER_M, toScreenX, toScreenY } from './view'

export type AthleteLook = { shirt: number; shorts: number; skin: number; hair: number }

// Medidas do corpo em metros.
const THIGH = 0.45
const SHIN = 0.45
const TRUNK = 0.62
const ARM = 0.6
const HIP_H = 0.92
const HEAD_R = 0.14

type V = { x: number; y: number }
const limb = (from: V, angle: number, len: number): V => ({ x: from.x + Math.sin(angle) * len, y: from.y - Math.cos(angle) * len })
const up = (from: V, angle: number, len: number): V => ({ x: from.x + Math.sin(angle) * len, y: from.y + Math.cos(angle) * len })

/** Atleta articulado desenhado por código. Frente local = +x; o time da direita é espelhado. */
export class AthleteView {
  private g: Phaser.GameObjects.Graphics
  private shadow: Phaser.GameObjects.Ellipse

  constructor(
    scene: Phaser.Scene,
    private look: AthleteLook,
    private facing: 1 | -1,
  ) {
    this.shadow = scene.add.ellipse(0, 0, 50, 10, 0x000000, 0.25)
    this.g = scene.add.graphics()
  }

  draw(a: Athlete, p: Pose): void {
    const sx = toScreenX(a.x)
    this.shadow.setPosition(sx, toScreenY(0) + 2).setScale(1 - Math.min(0.5, p.rootY * 0.4))
    const g = this.g
    g.clear()

    // Juntas no espaço local (metros, y para cima). Giro do corpo: tronco +rot, membros −rot.
    const rot = p.rootRot
    const hip: V = { x: 0, y: HIP_H + p.rootY }
    const neck = up(hip, p.tronco + rot, TRUNK)
    const head = up(neck, p.tronco + p.cabeca + rot, HEAD_R + 0.04)
    const shoulder = up(hip, p.tronco + rot, TRUNK - 0.06)
    const kneeE = limb(hip, p.coxaE - rot, THIGH)
    const footE = limb(kneeE, p.coxaE + p.canelaE - rot, SHIN)
    const kneeD = limb(hip, p.coxaD - rot, THIGH)
    const footD = limb(kneeD, p.coxaD + p.canelaD - rot, SHIN)
    const handE = limb(shoulder, p.bracoE - rot, ARM)
    const handD = limb(shoulder, p.bracoD - rot, ARM)

    const P = (v: V) => ({ x: sx + v.x * PX_PER_M * this.facing, y: toScreenY(v.y) })
    const line = (a1: V, b1: V, w: number, color: number) => {
      const A = P(a1)
      const B = P(b1)
      g.lineStyle(w, color, 1).lineBetween(A.x, A.y, B.x, B.y)
      g.fillStyle(color, 1).fillCircle(A.x, A.y, w / 2).fillCircle(B.x, B.y, w / 2)
    }
    const { shirt, shorts, skin, hair } = this.look

    // Membros de trás primeiro.
    line(shoulder, handE, 9, darken(skin))
    line(hip, kneeE, 13, shorts)
    line(kneeE, footE, 10, darken(skin))
    line(hip, kneeD, 13, shorts)
    line(kneeD, footD, 10, skin)
    line(hip, neck, 20, shirt)
    const H = P(head)
    g.fillStyle(skin, 1).fillCircle(H.x, H.y, HEAD_R * PX_PER_M)
    g.fillStyle(hair, 1).slice(H.x, H.y, HEAD_R * PX_PER_M, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false).fillPath()
    line(shoulder, handD, 9, skin)
  }

  /** Ponto acima da cabeça (para o marcador do jogador controlado). */
  topOf(a: Athlete, p: Pose): { x: number; y: number } {
    return { x: toScreenX(a.x), y: toScreenY(HIP_H + p.rootY + TRUNK + HEAD_R * 2 + 0.25) }
  }
}

function darken(c: number): number {
  const col = Phaser.Display.Color.IntegerToColor(c)
  return Phaser.Display.Color.GetColor(col.red * 0.8, col.green * 0.8, col.blue * 0.8)
}
