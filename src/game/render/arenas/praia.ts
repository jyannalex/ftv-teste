import Phaser from 'phaser'
import { GROUND_Y } from '../view'
import { type ArenaRuntime, cloud, HORIZON, palm, sand, sky } from './common'

const SEA_TOP = HORIZON - 10
const SEA_BOTTOM = HORIZON + 50

/** Praia de dia: céu, morro ao fundo, mar com ondas, coqueiros, guarda-sóis e gaivotas. */
export function drawPraia(scene: Phaser.Scene): ArenaRuntime {
  const g = scene.add.graphics()
  sky(g, 0x29b6f6, 0xb3e5fc, SEA_TOP)
  g.fillStyle(0xfff59d, 0.9).fillCircle(1080, 110, 46)
  g.fillStyle(0xfff59d, 0.25).fillCircle(1080, 110, 70)

  const clouds = scene.add.graphics()
  // Morros ao fundo, no horizonte.
  g.fillStyle(0x558b2f, 1)
  g.fillEllipse(170, SEA_TOP + 8, 360, 150).fillEllipse(330, SEA_TOP + 14, 200, 90)
  g.fillStyle(0x6d8b3a, 1).fillEllipse(1180, SEA_TOP + 10, 300, 110)

  g.fillGradientStyle(0x0277bd, 0x0277bd, 0x4fc3f7, 0x4fc3f7, 1).fillRect(0, SEA_TOP, 1280, SEA_BOTTOM - SEA_TOP)
  const waves = scene.add.graphics()

  const front = scene.add.graphics()
  sand(front, 0xf4d58d, SEA_BOTTOM, 7)
  front.fillStyle(0xffffff, 0.35).fillRect(0, SEA_BOTTOM, 1280, 4)

  // Guarda-sóis e coqueiros no fundo da areia.
  const umbrella = (x: number, color: number) => {
    front.lineStyle(4, 0xeeeeee, 1).lineBetween(x, SEA_BOTTOM + 34, x - 6, SEA_BOTTOM - 26)
    front.fillStyle(color, 1).slice(x - 6, SEA_BOTTOM - 22, 42, Math.PI, 0, false).fillPath()
    front.fillStyle(0xffffff, 1).slice(x - 6, SEA_BOTTOM - 22, 42, Math.PI * 1.33, Math.PI * 1.66, false).fillPath()
  }
  umbrella(260, 0xe53935)
  umbrella(420, 0xfdd835)
  umbrella(880, 0x1e88e5)
  umbrella(1010, 0x43a047)
  palm(front, 60, GROUND_Y - 20, 300, 40)
  palm(front, 1225, GROUND_Y - 30, 270, -50)

  const birds = scene.add.graphics()

  return {
    update(t: number) {
      clouds.clear()
      for (const [x0, y, s, v] of [
        [100, 90, 1.2, 8],
        [520, 60, 0.9, 5],
        [820, 140, 1, 7],
      ]) {
        const x = ((x0 + t * v) % 1500) - 150
        cloud(clouds, x, y, s)
      }
      waves.clear()
      waves.lineStyle(3, 0xffffff, 0.6)
      for (let row = 0; row < 3; row++) {
        const y = SEA_TOP + 14 + row * 14
        const shift = (t * (20 + row * 10)) % 80
        for (let x = -80 + shift; x < 1280; x += 80) waves.lineBetween(x, y, x + 30 + row * 6, y)
      }
      waves.fillStyle(0xffffff, 0.5).fillRect(0, SEA_BOTTOM - 4 + Math.sin(t * 1.6) * 3, 1280, 4)
      birds.clear()
      birds.lineStyle(3, 0x37474f, 1)
      for (let i = 0; i < 3; i++) {
        const x = ((t * 40 + i * 420) % 1400) - 60
        const y = 150 + i * 40 + Math.sin(t * 2 + i) * 10
        const flap = Math.sin(t * 9 + i) * 6
        birds.lineBetween(x - 12, y - flap, x, y).lineBetween(x, y, x + 12, y - flap)
      }
    },
  }
}
