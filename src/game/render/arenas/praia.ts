import type Phaser from 'phaser'
import { type ArenaRuntime, cloud, crowd, HORIZON, palm, SAND_Y, sand, sky } from './common'

/** Praia de dia: céu, morros, mar com ondas, guarda-sóis, coqueiros, gaivotas e torcida na areia. */
export function drawPraia(scene: Phaser.Scene): ArenaRuntime {
  const g = scene.add.graphics()
  sky(g, 0x29b6f6, 0xb3e5fc, HORIZON)
  g.fillStyle(0xfff59d, 0.9).fillCircle(1090, 62, 34)
  g.fillStyle(0xfff59d, 0.25).fillCircle(1090, 62, 54)

  const clouds = scene.add.graphics()
  // Morros e prédios ao longe, no horizonte.
  g.fillStyle(0x558b2f, 1).fillEllipse(150, HORIZON + 4, 360, 110).fillEllipse(320, HORIZON + 8, 200, 60)
  g.fillStyle(0x6d8b3a, 1).fillEllipse(1170, HORIZON + 6, 300, 80)
  for (const [x, w, h] of [
    [820, 26, 46],
    [850, 20, 64],
    [876, 30, 38],
    [930, 22, 56],
  ])
    g.fillStyle(0x90a4ae, 1).fillRect(x, HORIZON - h, w, h).fillStyle(0xcfd8dc, 0.6).fillRect(x + 3, HORIZON - h + 4, w * 0.3, h - 6)

  g.fillGradientStyle(0x0277bd, 0x0277bd, 0x4fc3f7, 0x4fc3f7, 1).fillRect(0, HORIZON, 1280, SAND_Y - HORIZON)
  const waves = scene.add.graphics()

  const front = scene.add.graphics()
  sand(front, 0xf4d58d, SAND_Y, 7)
  front.fillStyle(0xffffff, 0.35).fillRect(0, SAND_Y, 1280, 3)

  // Guarda-sóis no fundo da areia e coqueiros nos cantos.
  const umbrella = (x: number, color: number) => {
    front.lineStyle(3, 0xeeeeee, 1).lineBetween(x, SAND_Y + 26, x - 4, SAND_Y - 14)
    front.fillStyle(color, 1).slice(x - 4, SAND_Y - 12, 30, Math.PI, 0, false).fillPath()
    front.fillStyle(0xffffff, 1).slice(x - 4, SAND_Y - 12, 30, Math.PI * 1.33, Math.PI * 1.66, false).fillPath()
  }
  umbrella(70, 0xe53935)
  umbrella(150, 0xfdd835)
  umbrella(1140, 0x1e88e5)
  umbrella(1220, 0x43a047)
  palm(front, 40, 470, 330, 50)
  palm(front, 1245, 470, 310, -60)

  const birds = scene.add.graphics()
  const fans = crowd(scene, 'praia')

  return {
    update(t: number) {
      clouds.clear()
      for (const [x0, y, s, v] of [
        [100, 50, 1, 8],
        [520, 30, 0.8, 5],
        [820, 80, 0.9, 7],
      ]) {
        const x = ((x0 + t * v) % 1500) - 150
        cloud(clouds, x, y, s)
      }
      waves.clear()
      waves.lineStyle(2, 0xffffff, 0.6)
      for (let row = 0; row < 3; row++) {
        const y = HORIZON + 10 + row * 12
        const shift = (t * (20 + row * 10)) % 80
        for (let x = -80 + shift; x < 1280; x += 80) waves.lineBetween(x, y, x + 24 + row * 6, y)
      }
      waves.fillStyle(0xffffff, 0.5).fillRect(0, SAND_Y - 4 + Math.sin(t * 1.6) * 2, 1280, 3)
      birds.clear()
      birds.lineStyle(2, 0x37474f, 1)
      for (let i = 0; i < 3; i++) {
        const x = ((t * 40 + i * 420) % 1400) - 60
        const y = 60 + i * 26 + Math.sin(t * 2 + i) * 8
        const flap = Math.sin(t * 9 + i) * 5
        birds.lineBetween(x - 9, y - flap, x, y).lineBetween(x, y, x + 9, y - flap)
      }
      fans.update(t)
    },
  }
}
