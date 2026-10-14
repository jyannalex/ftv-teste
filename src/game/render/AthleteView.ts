import Phaser from 'phaser'
import type { Athlete } from '../../core/match'
import type { Pose } from './poses'
import { depthOf, LAYER, project } from './view'

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

// Medidas do boneco chibi em metros "de desenho" (maior que o real para ler bem): cabeça grande, corpo curto.
const THIGH = 0.37
const SHIN = 0.37
const TRUNK = 0.56
const UPPER_ARM = 0.3
const FOREARM = 0.27
const HIP_H = 0.74
const HEAD_R = 0.37
/** Altura do centro da cabeça com o atleta em pé (para o pulo do ataque). */
export const HEAD_CENTER_H = HIP_H + TRUNK + 0.04 + HEAD_R
/** Cotovelo levemente dobrado (rad). */
const ELBOW = 0.3
const OUTLINE = 0x1a1a24
/** Larguras de traço pensadas para 50 px/m. */
const BASE_K = 50

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

/** Atleta chibi articulado, com contorno fino. Frente local = +x; o time da direita é espelhado. */
export class AthleteView implements AthleteRenderer {
  private g: Phaser.GameObjects.Graphics
  private shadow: Phaser.GameObjects.Ellipse
  private num: Phaser.GameObjects.Text

  constructor(
    scene: Phaser.Scene,
    private look: AthleteLook,
    private facing: 1 | -1,
  ) {
    this.shadow = scene.add.ellipse(0, 0, 56, 16, 0x000000, 0.28).setDepth(LAYER.marks + 1)
    this.g = scene.add.graphics()
    const light = Phaser.Display.Color.IntegerToColor(look.shirt).v > 0.6
    this.num = scene.add
      .text(0, 0, String(look.number), { fontFamily: 'Arial Black, Arial', fontSize: '22px', color: light ? '#1a1a24' : '#ffffff' })
      .setOrigin(0.5)
  }

  draw(a: Athlete, p: Pose): void {
    const ground = project(a.x, 0, a.z)
    const k = ground.k
    const w = k / BASE_K
    const depth = depthOf(a.z)
    this.g.setDepth(depth)
    this.num.setDepth(depth + 0.01)
    this.shadow
      .setPosition(ground.x, ground.y)
      .setDisplaySize(56 * w * (1 - Math.min(0.5, p.rootY * 0.25)), 16 * w * (1 - Math.min(0.5, p.rootY * 0.25)))
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
    const elbowE = limb(shoulder, p.bracoE - rot, UPPER_ARM)
    const handE = limb(elbowE, p.bracoE - rot + ELBOW, FOREARM)
    const elbowD = limb(shoulder, p.bracoD - rot, UPPER_ARM)
    const handD = limb(elbowD, p.bracoD - rot + ELBOW, FOREARM)
    const shinAngE = p.coxaE + p.canelaE - rot
    const shinAngD = p.coxaD + p.canelaD - rot

    const P = (v: V) => ({ x: ground.x + v.x * k * this.facing, y: ground.y - v.y * k })
    const seg = (a1: V, b1: V, width: number, color: number) => {
      const A = P(a1)
      const B = P(b1)
      const sw = width * w
      const o = sw + 2.5 * w
      g.lineStyle(o, OUTLINE, 1).lineBetween(A.x, A.y, B.x, B.y)
      g.fillStyle(OUTLINE, 1).fillCircle(A.x, A.y, o / 2).fillCircle(B.x, B.y, o / 2)
      g.lineStyle(sw, color, 1).lineBetween(A.x, A.y, B.x, B.y)
      g.fillStyle(color, 1).fillCircle(A.x, A.y, sw / 2).fillCircle(B.x, B.y, sw / 2)
      if (width >= 6) g.lineStyle(Math.max(1.5, sw * 0.3), lighten(color), 0.9).lineBetween(A.x - w, A.y - w, B.x - w, B.y - w)
    }
    const shoe = (foot: V, shinAngle: number, color: number) => {
      // Tênis: para a frente, perpendicular à canela.
      const toe = limb(foot, shinAngle - Math.PI / 2, -0.12)
      seg(foot, toe, 10, color)
    }
    const { shirt, shorts, skin, hair, style } = this.look
    const skinBack = shade(skin, 0.82)

    // Lado de trás primeiro.
    seg(shoulder, elbowE, 9, skinBack)
    seg(elbowE, handE, 9, skinBack)
    seg(kneeE, footE, 10, skinBack)
    shoe(footE, shinAngE, 0x37474f)
    seg(hip, lerpV(hip, kneeE, 0.5), 17, shade(shorts, 0.85))

    // Tronco: corpinho arredondado (trapézio com cantos), camisa com listra e número.
    const dir = { x: neck.x - hip.x, y: neck.y - hip.y }
    const len = Math.hypot(dir.x, dir.y) || 1
    const perp = { x: -dir.y / len, y: dir.x / len }
    const body = (inset: number) =>
      [
        { x: hip.x + perp.x * (0.24 - inset), y: hip.y + perp.y * (0.24 - inset) },
        { x: shoulder.x + perp.x * (0.26 - inset), y: shoulder.y + perp.y * (0.26 - inset) },
        { x: shoulder.x - perp.x * (0.26 - inset), y: shoulder.y - perp.y * (0.26 - inset) },
        { x: hip.x - perp.x * (0.24 - inset), y: hip.y - perp.y * (0.24 - inset) },
      ]
        .map(P)
        .map((q) => new Phaser.Math.Vector2(q.x, q.y))
    g.fillStyle(OUTLINE, 1).fillPoints(body(0), true)
    g.fillStyle(shirt, 1).fillPoints(body(0.035), true)
    const s1 = P(lerpV(hip, shoulder, 0.7))
    const sp = { x: perp.x * k * 0.21 * this.facing, y: -perp.y * k * 0.21 }
    g.lineStyle(3 * w, lighten(shirt, 1.5), 0.9).lineBetween(s1.x - sp.x, s1.y - sp.y, s1.x + sp.x, s1.y + sp.y)
    const mid = P(lerpV(hip, shoulder, 0.42))
    this.num
      .setPosition(mid.x, mid.y)
      .setScale(w * 0.8)
      .setRotation(Math.atan2(dir.x * this.facing, dir.y))

    // Perna da frente com short.
    seg(kneeD, footD, 10, skin)
    shoe(footD, shinAngD, 0x263238)
    seg(hip, lerpV(hip, kneeD, 0.5), 17, shorts)
    seg(lerpV(hip, kneeD, 0.5), kneeD, 10, skin)

    // Cabeça grande e cabelo.
    const H = P(head)
    const r = HEAD_R * k
    const f = this.facing
    g.fillStyle(OUTLINE, 1).fillCircle(H.x, H.y, r + 2 * w)
    g.fillStyle(skin, 1).fillCircle(H.x, H.y, r)
    g.fillStyle(0xffffff, 0.18).fillCircle(H.x - f * r * 0.25, H.y - r * 0.35, r * 0.45)
    g.fillStyle(hair, 1)
    switch (style) {
      case 'curto':
        g.slice(H.x, H.y, r + w, Math.PI * 1.05, Math.PI * 1.95, false).fillPath()
        g.fillEllipse(H.x - f * r * 0.4, H.y - r * 0.25, r * 1.4, r * 1.1)
        break
      case 'rabo':
        g.slice(H.x, H.y, r + w, Math.PI, 2 * Math.PI, false).fillPath()
        g.fillEllipse(H.x - f * r * 1.05, H.y + r * 0.15, r * 0.7, r * 1.2)
        break
      case 'blackPower':
        g.fillCircle(H.x - f * r * 0.15, H.y - r * 0.35, r * 1.2)
        g.fillStyle(skin, 1).fillCircle(H.x + f * r * 0.18, H.y + r * 0.18, r * 0.78)
        break
      case 'bone':
        g.slice(H.x, H.y, r + 1.5 * w, Math.PI, 2 * Math.PI, false).fillPath()
        g.fillRect(f > 0 ? H.x : H.x - r * 1.5, H.y - r * 0.22, r * 1.5, r * 0.28)
        break
    }
    // Rosto de lado: olho grande, sobrancelha e boca.
    const eye = { x: H.x + f * r * 0.48, y: H.y + r * 0.02 }
    g.fillStyle(0xffffff, 1).fillEllipse(eye.x, eye.y, r * 0.3, r * 0.36)
    g.fillStyle(OUTLINE, 1).fillEllipse(eye.x + f * r * 0.05, eye.y + r * 0.02, r * 0.15, r * 0.22)
    g.lineStyle(1.6 * w, OUTLINE, 1).lineBetween(eye.x - f * r * 0.14, eye.y - r * 0.26, eye.x + f * r * 0.14, eye.y - r * 0.3)
    g.lineStyle(1.6 * w, 0x7a3b2e, 1).lineBetween(H.x + f * r * 0.42, H.y + r * 0.45, H.x + f * r * 0.7, H.y + r * 0.4)
    g.fillStyle(shade(skin, 0.85), 1).fillCircle(H.x - f * r * 0.15, H.y + r * 0.1, r * 0.17)

    // Braço da frente por último.
    seg(shoulder, elbowD, 9, skin)
    seg(elbowD, handD, 9, skin)
  }

  /** Ponto acima da cabeça (para o marcador do jogador controlado). */
  topOf(a: Athlete, p: Pose): { x: number; y: number } {
    const top = project(a.x, HIP_H + p.rootY + TRUNK + HEAD_R * 2 + 0.35, a.z)
    return { x: top.x, y: top.y }
  }
}
