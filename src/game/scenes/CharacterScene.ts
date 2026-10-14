import Phaser from 'phaser'
import type { Athlete } from '../../core/match'
import { type Character, HAIR_COLORS, HAIR_STYLES, NAME_MAX, type PlayerSide, SKIN_TONES } from '../../data/character'
import { PLAYER_SHIRTS } from '../../data/teams'
import { AthleteView } from '../render/AthleteView'
import { poseFor } from '../render/poses'
import { getSession } from '../session'
import { menuBackground } from '../ui/background'
import { button, label, panel, title } from '../ui/button'

/** Prévia grande: chão em (1010, 540), 150 px por metro. */
const PREVIEW = { x: 1010, y: 540, k: 150 }
const LEFT_X = 440

/** Tela "Meu Atleta": nome, pele, cabelo, camisa e número, com o boneco aparecendo ao lado. */
export class CharacterScene extends Phaser.Scene {
  private draft!: Character
  private preview!: AthleteView
  private rows: Phaser.GameObjects.GameObject[] = []
  private numberText!: Phaser.GameObjects.Text
  private nameInput!: HTMLInputElement

  constructor() {
    super('Character')
  }

  create(): void {
    this.draft = { ...getSession().save.character }
    menuBackground(this)
    title(this, 56, 'Meu Atleta', 48)
    panel(this, LEFT_X, 365, 700, 510)
    panel(this, PREVIEW.x, 365, 340, 510)

    label(this, LEFT_X, 128, 'Nome')
    const input = this.add.dom(LEFT_X, 170, 'input', 'width: 320px; height: 42px; font: 22px Arial; text-align: center; border-radius: 10px; border: 3px solid #fff; background: #ffffffee;')
    this.nameInput = input.node as HTMLInputElement
    this.nameInput.maxLength = NAME_MAX
    this.nameInput.value = this.draft.name

    this.preview = new AthleteView(this, this.look(), 1, (x, y) => ({ x: PREVIEW.x + x * PREVIEW.k, y: PREVIEW.y - y * PREVIEW.k, k: PREVIEW.k }))
    this.numberText = label(this, LEFT_X + 80, 495, '', 30)
    this.renderRows()

    button(this, LEFT_X - 110, 660, 'Voltar', () => this.scene.start('Menu'), { w: 200, color: 0x546e7a })
    button(this, LEFT_X + 130, 660, 'Salvar', () => this.save(), { w: 240, color: 0x2e7d32 })
  }

  update(time: number): void {
    const a = { x: 0, z: 0, vx: 0, vz: 0, y: 0 } as Athlete
    this.preview.draw(a, poseFor('parado', (time / 1200) % 1))
  }

  private look() {
    const d = this.draft
    return { shirt: d.shirt, shorts: 0x263238, skin: d.skin, hair: d.hair, style: d.style, number: d.number }
  }

  private change(fn: (d: Character) => Character): void {
    this.draft = fn(this.draft)
    this.preview.setLook(this.look())
    this.renderRows()
  }

  /** Linhas de escolha (redesenhadas a cada mudança para marcar a seleção). */
  private renderRows(): void {
    for (const o of this.rows) o.destroy()
    this.rows = []
    const d = this.draft
    const swatches = (y: number, name: string, colors: number[], selected: number, pick: (c: number) => void) => {
      this.rows.push(label(this, 150, y, name, 20).setOrigin(0, 0.5))
      colors.forEach((c, i) => {
        const x = 330 + i * 64
        const on = c === selected
        const dot = this.add.circle(x, y, 22, c).setStrokeStyle(on ? 6 : 2, on ? 0xffe14d : 0xffffff)
        dot.setInteractive({ useHandCursor: true }).on('pointerup', () => pick(c))
        this.rows.push(dot)
      })
    }
    swatches(230, 'Pele', SKIN_TONES, d.skin, (skin) => this.change((x) => ({ ...x, skin })))
    this.rows.push(label(this, 150, 297, 'Cabelo', 20).setOrigin(0, 0.5))
    HAIR_STYLES.forEach((h, i) =>
      this.rows.push(
        button(this, 360 + i * 128, 297, h.name, () => this.change((x) => ({ ...x, style: h.id })), {
          w: 120,
          h: 46,
          size: 16,
          color: h.id === d.style ? 0xf9a825 : 0x37474f,
        }),
      ),
    )
    swatches(363, 'Cor do cabelo', HAIR_COLORS, d.hair, (hair) => this.change((x) => ({ ...x, hair })))
    swatches(429, 'Camisa', PLAYER_SHIRTS, d.shirt, (shirt) => this.change((x) => ({ ...x, shirt })))

    this.rows.push(label(this, 150, 495, 'Número', 20).setOrigin(0, 0.5))
    const step = (delta: number) => this.change((x) => ({ ...x, number: ((x.number - 1 + delta + 99) % 99) + 1 }))
    this.rows.push(button(this, LEFT_X - 10, 495, '−', () => step(-1), { w: 64, h: 50, size: 28 }))
    this.rows.push(button(this, LEFT_X + 170, 495, '+', () => step(1), { w: 64, h: 50, size: 28 }))

    // Lado: direito joga em cima na tela, esquerdo embaixo.
    this.rows.push(label(this, 150, 565, 'Lado', 20).setOrigin(0, 0.5))
    const sides: [PlayerSide, string][] = [
      ['direito', 'Direito (em cima)'],
      ['esquerdo', 'Esquerdo (embaixo)'],
    ]
    sides.forEach(([side, name], i) =>
      this.rows.push(
        button(this, 400 + i * 220, 565, name, () => this.change((x) => ({ ...x, side })), {
          w: 210,
          h: 46,
          size: 16,
          color: side === d.side ? 0xf9a825 : 0x37474f,
        }),
      ),
    )
    this.numberText.setText(String(d.number))
  }

  private save(): void {
    const name = this.nameInput.value.trim().slice(0, NAME_MAX) || 'Você'
    const character = { ...this.draft, name }
    getSession().persist((s) => ({ ...s, character }))
    this.scene.start('Menu')
  }
}
