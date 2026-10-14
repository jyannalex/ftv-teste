import Phaser from 'phaser'
import { DIFFICULTIES } from '../../data/difficulty'
import { getSession } from '../session'
import { menuBackground } from '../ui/background'
import { button, FONT, storageWarning, title } from '../ui/button'

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu')
  }

  create(): void {
    menuBackground(this)
    const save = getSession().save
    title(this, 120, 'FTV - Teste', 84)
    this.add.text(640, 190, 'Futevôlei 2x2 · Sharkataque', { fontFamily: FONT, fontSize: '26px', color: '#ffe14d' }).setOrigin(0.5).setStroke('#0b1d33', 6)

    let y = 280
    const next = () => (y += 78) - 78
    if (save.tournament?.status === 'andamento') button(this, 640, next(), 'Continuar campeonato', () => this.scene.start('Bracket'), { color: 0x2e7d32 })
    button(this, 640, next(), 'Campeonato', () => this.scene.start('TournamentSetup'))
    button(this, 640, next(), 'Partida Rápida', () => this.scene.start('QuickMatchSetup'))
    button(this, 640, next(), 'Como Jogar', () => this.scene.start('HowToPlay'), { color: 0x00897b })
    button(this, 640, next(), 'Opções', () => this.scene.start('Options'), { color: 0x546e7a })

    const titles = DIFFICULTIES.map((d) => `${d.name} ${save.titles[d.id]}`).join('  ·  ')
    this.add.text(640, 700, `🏆 Títulos: ${titles}`, { fontFamily: FONT, fontSize: '18px', color: '#ffffff' }).setOrigin(0.5, 1).setStroke('#0b1d33', 5)
    storageWarning(this)
    // Celular: tela cheia no primeiro toque.
    this.input.once('pointerdown', () => {
      if (!this.sys.game.device.input.touch || this.scale.isFullscreen) return
      try {
        this.scale.startFullscreen()
      } catch {
        // Navegador sem tela cheia.
      }
    })
  }
}
