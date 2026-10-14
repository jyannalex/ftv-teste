import Phaser from 'phaser'
import { menuBackground } from '../ui/background'
import { button, FONT, title } from '../ui/button'

type Card = { title: string; lines: string[]; draw: (g: Phaser.GameObjects.Graphics, x: number, y: number) => void }

const BALL = (g: Phaser.GameObjects.Graphics, x: number, y: number) => {
  g.fillStyle(0xffd600, 1).fillCircle(x, y, 12)
  g.fillStyle(0x111111, 1).slice(x, y, 12, 0, Math.PI / 2, false).fillPath().slice(x, y, 12, Math.PI, Math.PI * 1.5, false).fillPath()
}

const CARDS: Card[] = [
  {
    title: '1. Corra até a sombra',
    lines: ['Joystick ou WASD anda. O parceiro é da IA', '(Opções: controle os dois, troca com Q).', 'Ataque vindo? DEFENDER (J) na hora certa!'],
    draw: (g, x, y) => {
      g.fillStyle(0x2e7d32, 1).fillCircle(x - 40, y, 26)
      g.fillStyle(0xc62828, 1).fillCircle(x + 40, y, 26)
    },
  },
  {
    title: '2. Três toques, sem mão',
    lines: ['1º chapa ou peito → 2º levantada →', '3º ataque. O jogo troca o atleta sozinho.', 'Saque: segure FORTE e solte (direção mira).'],
    draw: (g, x, y) => {
      for (let i = 0; i < 3; i++) BALL(g, x - 60 + i * 60, y - Math.sin((i / 2) * Math.PI) * 18)
    },
  },
  {
    title: '3. Ataque em câmera lenta',
    lines: ['No 3º toque você pula e o tempo desacelera:', 'FORTE (J) bate forte · PINGO (K) cai na rede', '◀ ▶ curto/fundo · ▲ ▼ o lado da quadra.'],
    draw: (g, x, y) => {
      g.fillStyle(0xffffff, 1).fillRect(x - 3, y - 26, 6, 40)
      g.lineStyle(3, 0xffe14d, 1).lineBetween(x - 50, y - 20, x + 70, y + 10)
      BALL(g, x + 70, y + 10)
    },
  },
  {
    title: '4. Sharkataque 🦈',
    lines: ['Toques, defesas e pontos enchem a barra.', 'Cheia: aperte 🦈 (Espaço) na câmera lenta', 'para a bicicleta imparável!'],
    draw: (g, x, y) => {
      g.fillStyle(0x23384f, 1).fillRoundedRect(x - 80, y - 8, 160, 16, 6)
      g.fillStyle(0x00e5ff, 1).fillRoundedRect(x - 80, y - 8, 160, 16, 6)
    },
  },
]

export class HowToPlayScene extends Phaser.Scene {
  constructor() {
    super('HowToPlay')
  }

  create(): void {
    menuBackground(this, 'praia', 0.55)
    title(this, 60, 'Como Jogar', 48)
    const g = this.add.graphics()
    CARDS.forEach((c, i) => {
      const x = i % 2 === 0 ? 340 : 940
      const y = i < 2 ? 230 : 450
      g.fillStyle(0x0b1d33, 0.88).fillRoundedRect(x - 280, y - 95, 560, 190, 16)
      this.add.text(x, y - 70, c.title, { fontFamily: FONT, fontSize: '24px', color: '#ffe14d' }).setOrigin(0.5)
      c.draw(g, x, y - 18)
      this.add
        .text(x, y + 45, c.lines.join('\n'), { fontFamily: 'Arial, sans-serif', fontSize: '19px', color: '#ffffff', align: 'center' })
        .setOrigin(0.5)
    })
    button(this, 640, 640, 'Voltar', () => this.scene.start('Menu'), { w: 220, color: 0x546e7a })
  }
}
