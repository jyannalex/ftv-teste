import Phaser from 'phaser'
import { getSession } from '../session'
import { menuBackground } from '../ui/background'
import { button, label, panel, title } from '../ui/button'

export class OptionsScene extends Phaser.Scene {
  private items: Phaser.GameObjects.GameObject[] = []

  constructor() {
    super('Options')
  }

  create(): void {
    menuBackground(this)
    title(this, 80, 'Opções', 52)
    panel(this, 640, 360, 620, 440)
    this.render()
    button(this, 640, 640, 'Voltar', () => this.scene.start('Menu'), { w: 220, color: 0x546e7a })
  }

  private render(confirming = false): void {
    for (const o of this.items) o.destroy()
    this.items = []
    const session = getSession()
    const { sound, music, control } = session.save.options
    const toggle = (y: number, name: string, on: boolean, key: 'sound' | 'music') =>
      button(
        this,
        640,
        y,
        `${name}: ${on ? 'LIGADO' : 'DESLIGADO'}`,
        () => {
          session.persist((d) => ({ ...d, options: { ...d.options, [key]: !on } }))
          this.game.events.emit('options-changed')
          this.render()
        },
        { w: 420, color: on ? 0x2e7d32 : 0x546e7a },
      )
    this.items.push(toggle(190, 'Som', sound, 'sound'), toggle(265, 'Música', music, 'music'))
    // Controle: só o meu atleta (parceiro IA) ou os dois atletas (troca com Q).
    this.items.push(
      button(
        this,
        640,
        340,
        `Controle: ${control === 'solo' ? 'SÓ MEU ATLETA' : 'OS DOIS ATLETAS'}`,
        () => {
          session.persist((d) => ({ ...d, options: { ...d.options, control: control === 'solo' ? 'dupla' : 'solo' } }))
          this.render()
        },
        { w: 520, color: 0x5e35b1, size: 22 },
      ),
    )

    if (!confirming) {
      this.items.push(button(this, 640, 450, 'Reiniciar progresso', () => this.render(true), { w: 420, color: 0xc62828 }))
      return
    }
    this.items.push(label(this, 640, 430, 'Tem certeza? Isso apaga títulos e campeonato.', 20, '#ff8a80'))
    this.items.push(
      button(
        this,
        520,
        500,
        'Sim, apagar',
        () => {
          session.reset()
          this.game.events.emit('options-changed')
          this.render()
        },
        { w: 220, color: 0xc62828 },
      ),
      button(this, 760, 500, 'Cancelar', () => this.render(), { w: 220, color: 0x546e7a }),
    )
  }
}
