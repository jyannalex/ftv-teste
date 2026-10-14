import Phaser from 'phaser'
import type { Athlete } from '../../core/match'
import type { Pose } from './poses'
import { PX_PER_M, toScreenX, toScreenY } from './view'

export type HairStyle = 'curto' | 'rabo' | 'blackPower' | 'bone'
export type AthleteLook = { shirt: number; shorts: number; skin: number; hair: number; style: HairStyle; number: number }

/**
 * Quem desenha um atleta. Hoje: AthleteView (desenho por código). Para trocar por sprites,
 * basta outra classe com esta interface (formato dos sprites no README).
 */
export type AthleteRenderer = {
  draw(a: Athlete, p: Pose): void
  topOf(a: Athlete, p: Pose): { x: number; y: number }
}

// Medidas do corpo em metros (atleta de ~1,9 m).
const THIGH = 0.48
const SHIN = 0.48
const TRUNK = 0.62
const UPPER_ARM = 0.32
const FOREARM = 0.3
const HIP_H = 0.96
const HEAD_R = 0.12
/** Cotovelo levemente dobrado (rad). */
const ELBOW = 0.3
const OUTLINE = 0x1a1a24

type V = { x: number; y: number }
const limb = (from: V, angle: number, len: number): V => ({ x: from.x + Math.sin(angle) * len, y: from.y - Math.cos(angle) * len })
const up = (from: V, angle: number, len: number): V => ({ x: from.x + Math.sin(angle) * len, y: from.y + Math.cos(angle) * len })
const lerpV = (a: V, b: V, t: number): V => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** Versão mais clara da cor (para o sombreado). */
function lighten(c: number, k = 1.28): number {
  const col = Phaser.Display.Color.IntegerToColor(c)
  const f = (v: number) => Math.min(255, v * k + 18)
  return Phaser.Display.Color.GetColor(f(col.red), f(col.green), f(col.blue))
}

function shade(c: number, k: number): number {
  const col = Phaser.Display.Color.IntegerToColor(c)
  return Phaser.Display.Color.GetColor(col.red * k, col.green * k, col.blue * k)
}

/** Atleta articulado, fino, com contorno escuro. Frente local = +x; o time da direita é espelhado. */
export class AthleteView implements AthleteRenderer {
  private g: Phaser.GameObjects.Graphics
  private shadow: Phaser.GameObjects.Ellipse
  private num: Phaser.GameObjects.Text

  constructor(
    scene: Phaser.Scene,
    private look: AthleteLook,
    private facing: 1 | -1,
  ) {
    this.shadow = scene.add.ellipse(0, 0, 46, 9, 0x000000, 0.25)
    this.g = scene.add.graphics()
    const light = Phaser.Display.Color.IntegerToColor(look.shirt).v > 0.6
    this.num = scene.add
      .text(0, 0, String(look.number), { fontFamily: 'Arial Black, Arial', fontSize: '11px', color: light ? '#1a1a24' : '#ffffff' })
      .setOrigin(0.5)
  }

  draw(a: Athlete, p: Pose): void {
    const sx = toScreenX(a.x)
    this.shadow.setPosition(sx, toScreenY(0) + 2).setScale(1 - Math.min(0.6, p.rootY * 0.4))
    const g = this.g
    g.clear()

    // Juntas no espaço local (metros, y para cima). Giro do corpo: tronco +rot, membros −rot.
    const rot = p.rootRot
    const hip: V = { x: 0, y: HIP_H + p.rootY }
    const neck = up(hip, p.tronco + rot, TRUNK)
    const head = up(neck, p.tronco + p.cabeca + rot, HEAD_R + 0.06)
    const shoulder = up(hip, p.tronco + rot, TRUNK - 0.05)
    const kneeE = limb(hip, p.coxaE - rot, THIGH)
    const footE = limb(kneeE, p.coxaE + p.canelaE - rot, SHIN)
    const kneeD = limb(hip, p.coxaD - rot, THIGH)
    const footD = limb(kneeD, p.coxaD + p.canelaD - rot, SHIN)
    const elbowE = limb(shoulder, p.bracoE - rot, UPPER_ARM)
    const handE = limb(elbowE, p.bracoE - rot + ELBOW, FOREARM)
    const elbowD = limb(shoulder, p.bracoD - rot, UPPER_ARM)
    const handD = limb(elbowD, p.bracoD - rot + ELBOW, FOREARM)
    const shinAngE = p.coxaE + p.canelaE - rot
    const shinAngD = p.coxaD + p.canelaD - rot

    const P = (v: V) => ({ x: sx + v.x * PX_PER_M * this.facing, y: toScreenY(v.y) })
    const seg = (a1: V, b1: V, w: number, color: number) => {
      const A = P(a1)
      const B = P(b1)
      g.lineStyle(w + 3, OUTLINE, 1).lineBetween(A.x, A.y, B.x, B.y)
      g.fillStyle(OUTLINE, 1).fillCircle(A.x, A.y, (w + 3) / 2).fillCircle(B.x, B.y, (w + 3) / 2)
      g.lineStyle(w, color, 1).lineBetween(A.x, A.y, B.x, B.y)
      g.fillStyle(color, 1).fillCircle(A.x, A.y, w / 2).fillCircle(B.x, B.y, w / 2)
      // Luz vinda de cima: uma faixa mais clara no segmento.
      if (w >= 5) g.lineStyle(Math.max(1.5, w * 0.35), lighten(color), 0.9).lineBetween(A.x - 1, A.y - 1, B.x - 1, B.y - 1)
    }
    const shoe = (foot: V, shinAngle: number, color: number) => {
      // Tênis: para a frente, perpendicular à canela.
      const toe = limb(foot, shinAngle - Math.PI / 2, -0.14)
      seg(foot, toe, 6, color)
    }
    const { shirt, shorts, skin, hair, style } = this.look
    const skinBack = shade(skin, 0.82)

    // Lado de trás primeiro.
    seg(shoulder, elbowE, 5, skinBack)
    seg(elbowE, handE, 5, skinBack)
    seg(kneeE, footE, 6, skinBack)
    shoe(footE, shinAngE, 0x37474f)
    seg(hip, lerpV(hip, kneeE, 0.45), 9, shade(shorts, 0.85))
    seg(lerpV(hip, kneeE, 0.45), kneeE, 7, skinBack)

    // Tronco em trapézio (ombros mais largos).
    const dir = { x: neck.x - hip.x, y: neck.y - hip.y }
    const len = Math.hypot(dir.x, dir.y) || 1
    const perp = { x: -dir.y / len, y: dir.x / len }
    const quad = [
      { x: hip.x + perp.x * 0.11, y: hip.y + perp.y * 0.11 },
      { x: shoulder.x + perp.x * 0.16, y: shoulder.y + perp.y * 0.16 },
      { x: shoulder.x - perp.x * 0.16, y: shoulder.y - perp.y * 0.16 },
      { x: hip.x - perp.x * 0.11, y: hip.y - perp.y * 0.11 },
    ].map(P)
    g.fillStyle(OUTLINE, 1).fillPoints(quad.map((q) => new Phaser.Math.Vector2(q.x, q.y)), true)
    g.fillStyle(shirt, 1).fillPoints(
      quad.map((q, i) => {
        const c = P({ x: (hip.x + shoulder.x) / 2, y: (hip.y + shoulder.y) / 2 })
        const k = i === 0 || i === 3 ? 0.78 : 0.86
        return new Phaser.Math.Vector2(c.x + (q.x - c.x) * k, c.y + (q.y - c.y) * k)
      }),
      true,
    )
    // Listra na camisa e número no peito.
    const s1 = P(lerpV(hip, shoulder, 0.62))
    const sp = { x: perp.x * PX_PER_M * 0.13 * this.facing, y: -perp.y * PX_PER_M * 0.13 }
    g.lineStyle(2.5, lighten(shirt, 1.5), 0.9).lineBetween(s1.x - sp.x, s1.y - sp.y, s1.x + sp.x, s1.y + sp.y)
    const mid = P(lerpV(hip, shoulder, 0.4))
    this.num.setPosition(mid.x, mid.y).setRotation(Math.atan2(dir.x * this.facing, dir.y) * 1)
    seg(neck, lerpV(neck, shoulder, 0.5), 5, skin)

    // Perna da frente com short.
    seg(lerpV(hip, kneeD, 0.45), kneeD, 7, skin)
    seg(kneeD, footD, 6, skin)
    shoe(footD, shinAngD, 0x263238)
    seg(hip, lerpV(hip, kneeD, 0.45), 9, shorts)
    {
      const A = P(hip)
      const B = P(lerpV(hip, kneeD, 0.42))
      g.lineStyle(1.5, 0xffffff, 0.85).lineBetween(A.x, A.y, B.x, B.y)
    }

    // Cabeça e cabelo.
    const H = P(head)
    const r = HEAD_R * PX_PER_M
    g.fillStyle(OUTLINE, 1).fillCircle(H.x, H.y, r + 1.5)
    g.fillStyle(skin, 1).fillCircle(H.x, H.y, r)
    const f = this.facing
    g.fillStyle(OUTLINE, 1).fillCircle(H.x + f * r * 0.45, H.y - r * 0.1, 1.4)
    g.lineStyle(1.2, 0x7a3b2e, 1).lineBetween(H.x + f * r * 0.3, H.y + r * 0.42, H.x + f * r * 0.62, H.y + r * 0.36)
    g.fillStyle(hair, 1)
    switch (style) {
      case 'curto':
        g.slice(H.x, H.y, r + 1, Math.PI, 2 * Math.PI, false).fillPath()
        g.fillEllipse(H.x - f * r * 0.35, H.y - r * 0.15, r * 1.3, r * 0.9)
        break
      case 'rabo':
        g.slice(H.x, H.y, r + 1, Math.PI, 2 * Math.PI, false).fillPath()
        g.fillEllipse(H.x - f * r * 1.15, H.y + r * 0.1, r * 0.8, r * 1.3)
        break
      case 'blackPower':
        g.fillCircle(H.x - f * r * 0.15, H.y - r * 0.35, r * 1.25)
        g.fillStyle(skin, 1).fillCircle(H.x + f * r * 0.15, H.y + r * 0.15, r * 0.82)
        g.fillStyle(OUTLINE, 1).fillCircle(H.x + f * r * 0.45, H.y - r * 0.1, 1.4)
        break
      case 'bone':
        g.slice(H.x, H.y, r + 1.5, Math.PI, 2 * Math.PI, false).fillPath()
        g.fillRect(f > 0 ? H.x : H.x - r * 1.6, H.y - r * 0.25, r * 1.6, r * 0.32)
        break
    }

    // Braço da frente por último.
    seg(shoulder, elbowD, 5, skin)
    seg(elbowD, handD, 5, skin)
  }

  /** Ponto acima da cabeça (para o marcador do jogador controlado). */
  topOf(a: Athlete, p: Pose): { x: number; y: number } {
    return { x: toScreenX(a.x), y: toScreenY(HIP_H + p.rootY + TRUNK + HEAD_R * 2 + 0.3) }
  }
}
