import Phaser from 'phaser'
import { ARENAS, type ArenaId } from '../../data/arenas'
import { DIFFICULTIES, type Difficulty, quickMatchSkill } from '../../data/difficulty'
import { AI_TEAMS } from '../../data/teams'
import { getSession } from '../session'
import { menuBackground } from '../ui/background'
import { button, FONT, label, panel, title } from '../ui/button'
import type { MatchSceneData } from './MatchScene'

const UNLOCK_HINT: Record<ArenaId, string> = { praia: '', clube: 'Chegue à semi', arena: 'Chegue à final' }

export class QuickMatchSetupScene extends Phaser.Scene {
  private arena: ArenaId = 'praia'
  private difficulty: Difficulty = 'medio'
  private dynamic: Phaser.GameObjects.GameObject[] = []

  constructor() {
    super('QuickMatchSetup')
  }

  create(): void {
    menuBackground(this)
    title(this, 70, 'Partida Rápida', 48)
    panel(this, 640, 360, 900, 470)
    label(this, 640, 160, 'Cenário')
    label(this, 640, 390, 'Dificuldade')
    this.renderChoices()

    button(this, 520, 640, 'Voltar', () => this.scene.start('Menu'), { w: 200, color: 0x546e7a })
    button(this, 760, 640, 'Jogar!', () => this.play(), { w: 240, color: 0x2e7d32 })
  }

  private renderChoices(): void {
    for (const o of this.dynamic) o.destroy()
    this.dynamic = []
    const unlocked = getSession().save.unlockedArenas
    ARENAS.forEach((a, i) => {
      const x = 380 + i * 260
      const open = unlocked.includes(a.id)
      const b = button(this, x, 240, open ? a.name : `🔒 ${a.name}`, () => this.pick(() => (this.arena = a.id)), {
        w: 240,
        h: 80,
        size: 20,
        enabled: open,
        color: a.id === this.arena ? 0xf9a825 : 0x37474f,
      })
      this.dynamic.push(b)
      if (!open)
        this.dynamic.push(
          this.add.text(x, 302, UNLOCK_HINT[a.id], { fontFamily: FONT, fontSize: '16px', color: '#b0bec5' }).setOrigin(0.5),
        )
    })
    DIFFICULTIES.forEach((d, i) => {
      this.dynamic.push(
        button(this, 400 + i * 240, 450, d.name, () => this.pick(() => (this.difficulty = d.id)), {
          w: 210,
          h: 56,
          color: d.id === this.difficulty ? 0xf9a825 : 0x37474f,
        }),
      )
    })
  }

  private pick(fn: () => void): void {
    fn()
    this.renderChoices()
  }

  private play(): void {
    const t = getSession().save.tournament
    const opponent = AI_TEAMS[Math.floor(Math.random() * AI_TEAMS.length)]
    const data: MatchSceneData = {
      mode: 'rapida',
      arena: this.arena,
      opponentId: opponent.id,
      skill: quickMatchSkill(this.difficulty),
      difficulty: this.difficulty,
      player: t?.player ?? { name: 'Minha Dupla', shirt: getSession().save.character.shirt },
    }
    this.scene.start('Match', data)
  }
}
