import Phaser from 'phaser'
import { createRng } from '../../core/rng'
import { createTournament, PLAYER_ID, playerMatch, type Tournament } from '../../core/tournament'
import { DIFFICULTIES } from '../../data/difficulty'
import { teamById } from '../../data/teams'
import { getSession } from '../session'
import { menuBackground } from '../ui/background'
import { button, FONT, storageWarning, title } from '../ui/button'
import type { MatchSceneData } from './MatchScene'

const ROUND_NAMES = ['Quartas', 'Semifinal', 'Final']
const BOX_W = 300
const BOX_H = 70
const COLS = [200, 640, 1080]
const ROWS = [[175, 280, 385, 490], [228, 438], [333]]

export const teamName = (t: Tournament, id: string): string => (id === PLAYER_ID ? t.player.name : (teamById(id)?.name ?? id))

/** Chave do campeonato e botão para a próxima partida. */
export class BracketScene extends Phaser.Scene {
  constructor() {
    super('Bracket')
  }

  create(): void {
    const t = getSession().save.tournament
    if (!t) {
      this.scene.start('Menu')
      return
    }
    menuBackground(this, 'praia', 0.55)
    const diff = DIFFICULTIES.find((d) => d.id === t.difficulty)?.name ?? ''
    title(this, 60, `Campeonato · ${diff}`, 40)

    const g = this.add.graphics()
    ROUND_NAMES.forEach((n, r) =>
      this.add.text(COLS[r], 120, n, { fontFamily: FONT, fontSize: '22px', color: '#ffe14d' }).setOrigin(0.5).setStroke('#0b1d33', 6),
    )
    for (let r = 0; r < 3; r++) {
      ROWS[r].forEach((y, i) => {
        if (r < 2) {
          const nextY = ROWS[r + 1][Math.floor(i / 2)]
          const x0 = COLS[r] + BOX_W / 2
          g.lineStyle(3, 0xffffff, 0.5).lineBetween(x0, y, x0 + 20, y).lineBetween(x0 + 20, y, COLS[r + 1] - BOX_W / 2, nextY)
        }
        const m = t.rounds[r]?.[i]
        this.box(g, t, COLS[r], y, m?.a, m?.b, m?.winner ?? null)
      })
    }

    const pm = playerMatch(t)
    if (t.status === 'andamento' && pm) {
      const data: MatchSceneData = {
        mode: 'campeonato',
        arena: pm.arena,
        opponentId: pm.opponentId,
        skill: pm.skill,
        difficulty: t.difficulty,
        player: t.player,
      }
      button(this, 820, 640, `Jogar ${ROUND_NAMES[pm.round]}`, () => this.scene.start('Match', data), { color: 0x2e7d32 })
      button(this, 460, 640, 'Menu', () => this.scene.start('Menu'), { w: 200, color: 0x546e7a })
    } else {
      this.add
        .text(640, 575, 'Vocês foram eliminados!', { fontFamily: FONT, fontSize: '28px', color: '#ff8a80' })
        .setOrigin(0.5)
        .setStroke('#0b1d33', 6)
      button(
        this,
        820,
        640,
        'Tentar de novo',
        () => {
          const nt = createTournament(t.difficulty, t.player, createRng(Date.now()))
          getSession().persist((d) => ({ ...d, tournament: nt }))
          this.scene.restart()
        },
        { color: 0x2e7d32 },
      )
      button(
        this,
        460,
        640,
        'Menu',
        () => {
          getSession().persist((d) => ({ ...d, tournament: null }))
          this.scene.start('Menu')
        },
        { w: 200, color: 0x546e7a },
      )
    }
    storageWarning(this)
  }

  private box(g: Phaser.GameObjects.Graphics, t: Tournament, x: number, y: number, a?: string, b?: string, winner: string | null = null): void {
    const hasPlayer = a === PLAYER_ID || b === PLAYER_ID
    g.fillStyle(0x0b1d33, 0.9).fillRoundedRect(x - BOX_W / 2, y - BOX_H / 2, BOX_W, BOX_H, 10)
    g.lineStyle(3, hasPlayer ? 0xffe14d : 0x90a4ae, 1).strokeRoundedRect(x - BOX_W / 2, y - BOX_H / 2, BOX_W, BOX_H, 10)
    const line = (id: string | undefined, dy: number) => {
      const name = id ? teamName(t, id) : '—'
      const lost = winner !== null && id !== winner
      const color = id === PLAYER_ID ? '#ffe14d' : lost ? '#78909c' : '#ffffff'
      this.add.text(x - BOX_W / 2 + 14, y + dy, (id !== undefined && id === winner ? '▶ ' : '') + name, { fontFamily: FONT, fontSize: '17px', color }).setOrigin(0, 0.5)
    }
    line(a, -16)
    line(b, 16)
  }
}
