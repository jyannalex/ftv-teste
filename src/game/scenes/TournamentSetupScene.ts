import Phaser from 'phaser'
import { createRng } from '../../core/rng'
import { createTournament } from '../../core/tournament'
import { DIFFICULTIES, type Difficulty } from '../../data/difficulty'
import { PLAYER_SHIRTS } from '../../data/teams'
import { getSession } from '../session'
import { menuBackground } from '../ui/background'
import { button, label, panel, title } from '../ui/button'

const DEFAULT_NAME = 'Minha Dupla'

export class TournamentSetupScene extends Phaser.Scene {
  private difficulty: Difficulty = 'medio'
  private shirt = PLAYER_SHIRTS[0]

  constructor() {
    super('TournamentSetup')
  }

  create(): void {
    menuBackground(this)
    title(this, 70, 'Novo Campeonato', 48)
    panel(this, 640, 380, 820, 520)
    const last = getSession().save.tournament
    // A camisa da dupla começa com a do personagem (tela Meu Atleta).
    this.shirt = getSession().save.character.shirt

    label(this, 640, 160, 'Dificuldade')
    const diffButtons: { d: (typeof DIFFICULTIES)[number]; x: number; btn?: Phaser.GameObjects.Container }[] = DIFFICULTIES.map(
      (d, i) => ({ d, x: 400 + i * 240 }),
    )
    const renderDiff = () => {
      for (const b of diffButtons) {
        b.btn?.destroy()
        b.btn = button(this, b.x, 215, b.d.name, () => {
          this.difficulty = b.d.id
          renderDiff()
        }, { w: 210, h: 56, color: b.d.id === this.difficulty ? 0xf9a825 : 0x37474f })
      }
    }
    renderDiff()

    label(this, 640, 300, 'Nome da dupla')
    const input = this.add.dom(640, 352, 'input', 'width: 400px; height: 44px; font: 22px Arial; text-align: center; border-radius: 10px; border: 3px solid #fff; background: #ffffffee;')
    const el = input.node as HTMLInputElement
    el.maxLength = 16
    el.value = last?.player.name ?? DEFAULT_NAME

    label(this, 640, 430, 'Cor da camisa')
    const swatches = this.add.graphics()
    const renderSwatches = () => {
      swatches.clear()
      PLAYER_SHIRTS.forEach((c, i) => {
        const x = 440 + i * 80
        swatches.fillStyle(c, 1).fillCircle(x, 485, 26)
        swatches.lineStyle(c === this.shirt ? 6 : 2, c === this.shirt ? 0xffe14d : 0xffffff, 1).strokeCircle(x, 485, 26)
      })
    }
    PLAYER_SHIRTS.forEach((c, i) => {
      this.add.zone(440 + i * 80, 485, 60, 60).setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.shirt = c
        renderSwatches()
      })
    })
    renderSwatches()

    button(this, 520, 590, 'Voltar', () => this.scene.start('Menu'), { w: 200, color: 0x546e7a })
    button(this, 760, 590, 'Começar!', () => {
      const name = el.value.trim() || DEFAULT_NAME
      const t = createTournament(this.difficulty, { name, shirt: this.shirt }, createRng(Date.now()))
      getSession().persist((d) => ({ ...d, tournament: t }))
      this.scene.start('Bracket')
    }, { w: 240, color: 0x2e7d32 })
  }
}
