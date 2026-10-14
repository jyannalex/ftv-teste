import Phaser from 'phaser'
import { DIFFICULTIES, type Difficulty } from '../../data/difficulty'
import { getSession } from '../session'
import { menuBackground } from '../ui/background'
import { button, FONT, title } from '../ui/button'

export class ChampionScene extends Phaser.Scene {
  constructor() {
    super('Champion')
  }

  create(data: { difficulty?: Difficulty }): void {
    menuBackground(this, 'arena', 0.3)
    const d = data.difficulty ?? 'medio'
    title(this, 90, 'CAMPEÕES!', 84).setColor('#ffe14d')

    // Troféu.
    const g = this.add.graphics()
    const cx = 640
    g.fillStyle(0xffc107, 1).fillRoundedRect(cx - 90, 170, 180, 120, { tl: 10, tr: 10, bl: 90, br: 90 })
    g.lineStyle(14, 0xffc107, 1).strokeCircle(cx - 100, 215, 34).strokeCircle(cx + 100, 215, 34)
    g.fillStyle(0xffa000, 1).fillRect(cx - 18, 285, 36, 60).fillRoundedRect(cx - 80, 340, 160, 34, 8)
    g.fillStyle(0x5d4037, 1).fillRect(cx - 100, 372, 200, 30)
    g.fillStyle(0xffffff, 0.35).fillEllipse(cx - 40, 210, 26, 70)
    this.tweens.add({ targets: g, y: -8, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' })

    const name = DIFFICULTIES.find((x) => x.id === d)?.name ?? ''
    const count = getSession().save.titles[d]
    this.add
      .text(640, 470, `Campeonato ${name} conquistado!\nTítulos no ${name}: ${count}`, {
        fontFamily: FONT,
        fontSize: '28px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setStroke('#0b1d33', 7)
    button(this, 640, 600, 'Menu', () => this.scene.start('Menu'), { color: 0x2e7d32 })
  }
}
