import Phaser from 'phaser'
import { getSession } from '../session'

export const FONT = 'Arial Black, Arial, sans-serif'

export type ButtonOpts = { w?: number; h?: number; color?: number; size?: number; enabled?: boolean }

/** Botão retangular arredondado com texto. */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOpts = {},
): Phaser.GameObjects.Container {
  const { w = 340, h = 62, color = 0x1e88e5, size = 24, enabled = true } = opts
  const bg = scene.add.graphics()
  const paint = (hover: boolean) => {
    bg.clear()
    bg.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, 14)
    bg.fillStyle(enabled ? (hover ? Phaser.Display.Color.ValueToColor(color).lighten(12).color : color) : 0x607d8b, 1)
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14)
    bg.lineStyle(3, 0xffffff, enabled ? 0.9 : 0.4).strokeRoundedRect(-w / 2, -h / 2, w, h, 14)
  }
  paint(false)
  const text = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: `${size}px`, color: enabled ? '#ffffff' : '#cfd8dc' }).setOrigin(0.5)
  const c = scene.add.container(x, y, [bg, text]).setSize(w, h)
  if (enabled) {
    c.setInteractive({ useHandCursor: true })
    c.on('pointerover', () => paint(true))
    c.on('pointerout', () => paint(false))
    c.on('pointerup', onClick)
  }
  return c
}

export function title(scene: Phaser.Scene, y: number, text: string, size = 52): Phaser.GameObjects.Text {
  return scene.add.text(640, y, text, { fontFamily: FONT, fontSize: `${size}px`, color: '#ffffff' }).setOrigin(0.5).setStroke('#0b1d33', 10)
}

export function label(scene: Phaser.Scene, x: number, y: number, text: string, size = 22, color = '#ffffff'): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color }).setOrigin(0.5).setStroke('#0b1d33', 6)
}

/** Painel escuro translúcido para destacar o conteúdo sobre o cenário. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
  return scene.add.graphics().fillStyle(0x0b1d33, 0.82).fillRoundedRect(x - w / 2, y - h / 2, w, h, 18)
}

/** Aviso que aparece e some. */
export function toast(scene: Phaser.Scene, text: string): void {
  const t = scene.add
    .text(640, 690, text, { fontFamily: FONT, fontSize: '20px', color: '#ffffff', backgroundColor: '#b71c1cdd', padding: { x: 16, y: 8 } })
    .setOrigin(0.5)
    .setDepth(1000)
  scene.tweens.add({ targets: t, alpha: 0, delay: 3500, duration: 600, onComplete: () => t.destroy() })
}

/** Mostra o aviso de "progresso não será salvo" se uma gravação falhou. */
export function storageWarning(scene: Phaser.Scene): void {
  if (getSession().takeStorageWarning()) toast(scene, 'Seu progresso não será salvo neste navegador')
}
