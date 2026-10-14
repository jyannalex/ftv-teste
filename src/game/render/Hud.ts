import Phaser from 'phaser'
import type { MatchState } from '../../core/match'
import type { Side } from '../../core/rules'
import { toScreenX } from './view'

const FONT = 'Arial Black, Arial, sans-serif'
const METER_W = 260

/** Placar, barras do Sharkataque, contador de toques, marcador e textos flutuantes. */
export class Hud {
  private scoreText: Phaser.GameObjects.Text
  private meters: Phaser.GameObjects.Graphics
  private touchText: Phaser.GameObjects.Text
  private marker: Phaser.GameObjects.Triangle
  private t = 0
  /** Quando a faixa atual libera a tela (ms do relógio da cena). */
  private bannerFreeAt = 0

  constructor(
    private scene: Phaser.Scene,
    teamNames: [string, string],
  ) {
    const panel = scene.add.graphics()
    panel.fillStyle(0x0b1d33, 0.85).fillRoundedRect(340, 8, 600, 78, 14)
    teamNames.forEach((n, i) =>
      scene.add
        .text(i === 0 ? 360 : 920, 18, n, { fontFamily: FONT, fontSize: '18px', color: '#ffffff' })
        .setOrigin(i === 0 ? 0 : 1, 0),
    )
    this.scoreText = scene.add
      .text(640, 14, '0  x  0', { fontFamily: FONT, fontSize: '34px', color: '#ffe14d' })
      .setOrigin(0.5, 0)
    this.meters = scene.add.graphics()
    this.touchText = scene.add
      .text(640, 98, '', { fontFamily: FONT, fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5, 0)
      .setStroke('#0b1d33', 5)
    this.marker = scene.add.triangle(0, 0, 0, 0, 22, 0, 11, 16, 0xffd600).setStrokeStyle(2, 0x000000)
  }

  update(s: MatchState, markerPos: { x: number; y: number } | null, dt: number): void {
    this.t += dt
    const [a, b] = s.score.points
    this.scoreText.setText(`${String(a).padStart(2, '0')}  x  ${String(b).padStart(2, '0')}`)

    const g = this.meters
    g.clear()
    for (const team of [0, 1] as Side[]) {
      const x = team === 0 ? 360 : 920 - METER_W
      const v = s.meter[team] / 100
      const full = v >= 1
      g.fillStyle(0x23384f, 1).fillRoundedRect(x, 60, METER_W, 14, 6)
      const color = full ? (Math.floor(this.t * 6) % 2 ? 0x00e5ff : 0xffffff) : 0x1e88e5
      const w = METER_W * v
      if (w > 2) g.fillStyle(color, 1).fillRoundedRect(team === 0 ? x : x + METER_W - w, 60, w, 14, 6)
    }

    const plan = s.plan
    if (s.phase === 'rally' && plan) {
      this.touchText.setText(`Toque ${plan.touchIndex}/3`).setX(toScreenX(plan.team === 0 ? -4.5 : 4.5)).setVisible(true)
    } else this.touchText.setVisible(false)

    if (markerPos) this.marker.setPosition(markerPos.x, markerPos.y + Math.sin(this.t * 8) * 3).setVisible(true)
    else this.marker.setVisible(false)
  }

  /** Texto que sobe e some (nota do toque, "ERROU"). */
  float(text: string, x: number, y: number, color: string): void {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: FONT, fontSize: '26px', color })
      .setOrigin(0.5)
      .setStroke('#0b1d33', 6)
    this.scene.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() })
  }

  /** Faixa grande no centro ("PONTO!", "SHARKATAQUE!"). */
  banner(text: string, color = '#ffffff', size = 56): void {
    // Faixas em fila: a seguinte espera a anterior aparecer o suficiente para ser lida.
    const now = this.scene.time.now
    const delay = Math.max(0, this.bannerFreeAt - now)
    this.bannerFreeAt = now + delay + 700
    const t = this.scene.add
      .text(640, 300, text, { fontFamily: FONT, fontSize: `${size}px`, color })
      .setOrigin(0.5)
      .setStroke('#0b1d33', 10)
      .setScale(0.4)
      .setAlpha(delay > 0 ? 0 : 1)
    this.scene.tweens.add({ targets: t, scale: 1, alpha: 1, delay, duration: 250, ease: 'Back.easeOut' })
    this.scene.tweens.add({ targets: t, alpha: 0, delay: delay + 650, duration: 300, onComplete: () => t.destroy() })
  }
}
