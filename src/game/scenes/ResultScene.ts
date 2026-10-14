import Phaser from 'phaser'
import { createRng } from '../../core/rng'
import { teamById } from '../../data/teams'
import { type AfterMatch, applyTournamentResult } from '../flow'
import { getSession } from '../session'
import { menuBackground } from '../ui/background'
import { button, FONT, label, panel, storageWarning, title } from '../ui/button'
import type { MatchResult } from './MatchScene'

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result')
  }

  create(result: MatchResult): void {
    const { data, winner, points } = result
    menuBackground(this, data.arena, 0.5)
    const won = winner === 0
    title(this, 150, won ? 'VITÓRIA!' : 'DERROTA', 80).setColor(won ? '#ffe14d' : '#ff8a80')
    panel(this, 640, 300, 760, 120)
    label(this, 400, 300, data.player.name, 24)
    label(this, 640, 300, `${points[0]}  x  ${points[1]}`, 44, '#ffe14d')
    label(this, 880, 300, teamById(data.opponentId)?.name ?? '', 24)

    if (data.mode === 'rapida') {
      button(this, 820, 470, 'Jogar de novo', () => this.scene.start('Match', data), { color: 0x2e7d32 })
      button(this, 460, 470, 'Menu', () => this.scene.start('Menu'), { w: 200, color: 0x546e7a })
      return
    }

    const session = getSession()
    const difficulty = session.save.tournament?.difficulty ?? 'medio'
    let next = 'chave' as AfterMatch
    session.persist((save) => {
      const r = applyTournamentResult(save, won, createRng(Date.now()))
      next = r.next
      return r.save
    })
    if (next === 'campeao') {
      button(this, 640, 470, 'Ver troféu 🏆', () => this.scene.start('Champion', { difficulty }), { color: 0xf9a825 })
    } else if (next === 'eliminado') {
      this.add
        .text(640, 400, 'Fim do campeonato para vocês...', { fontFamily: FONT, fontSize: '24px', color: '#ffffff' })
        .setOrigin(0.5)
        .setStroke('#0b1d33', 6)
      button(this, 640, 480, 'Ver chave', () => this.scene.start('Bracket'))
    } else {
      button(this, 640, 470, 'Próxima fase ▶', () => this.scene.start('Bracket'), { color: 0x2e7d32 })
    }
    storageWarning(this)
  }
}
