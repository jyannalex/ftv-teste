import Phaser from 'phaser'
import { type ArenaRuntime, cloud, HORIZON, sand, sky, tree } from './common'

const WALL_TOP = HORIZON - 40
const WALL_BOTTOM = HORIZON + 40

/** Quadra de areia do clube: árvores, muro, rede de proteção, tendas e cadeiras de plástico. */
export function drawClube(scene: Phaser.Scene): ArenaRuntime {
  const g = scene.add.graphics()
  sky(g, 0x4fc3f7, 0xe1f5fe, WALL_TOP)
  const clouds = scene.add.graphics()
  const back = scene.add.graphics()
  for (const [x, s, c] of [
    [80, 1.6, 0x388e3c],
    [260, 1.3, 0x43a047],
    [470, 1.8, 0x2e7d32],
    [760, 1.4, 0x43a047],
    [980, 1.7, 0x388e3c],
    [1190, 1.5, 0x2e7d32],
  ] as const)
    tree(back, x, WALL_TOP + 10, s, c)

  // Rede de proteção alta (postes e malha).
  back.lineStyle(6, 0x546e7a, 1)
  for (let x = 40; x <= 1280; x += 300) back.lineBetween(x, 40, x, WALL_TOP)
  back.lineStyle(1, 0x263238, 0.35)
  for (let x = 40; x <= 1280; x += 16) back.lineBetween(x, 40, x, WALL_TOP)
  for (let y = 40; y <= WALL_TOP; y += 16) back.lineBetween(0, y, 1280, y)
  back.lineStyle(4, 0x546e7a, 1).lineBetween(0, 40, 1280, 40)

  // Muro com faixa e patrocinadores fictícios.
  back.fillStyle(0xeeeeee, 1).fillRect(0, WALL_TOP, 1280, WALL_BOTTOM - WALL_TOP)
  back.fillStyle(0x1565c0, 1).fillRect(0, WALL_TOP + 6, 1280, 10)
  const banner = (x: number, text: string, color: number) => {
    back.fillStyle(color, 1).fillRect(x, WALL_TOP + 24, 220, 44)
    scene.add.text(x + 110, WALL_TOP + 46, text, { fontFamily: 'Arial Black, Arial', fontSize: '20px', color: '#ffffff' }).setOrigin(0.5)
  }
  banner(290, 'CLUBE AREIA', 0x00897b)
  banner(530, 'FTV - TESTE', 0x1565c0)
  banner(770, 'TORNEIO 2x2', 0xef6c00)

  const front = scene.add.graphics()
  sand(front, 0xedd9a3, WALL_BOTTOM, 3)

  // Tendas brancas e cadeiras de plástico encostadas no muro.
  const tent = (x: number) => {
    front.fillStyle(0xfafafa, 1).fillTriangle(x - 90, WALL_BOTTOM - 36, x + 90, WALL_BOTTOM - 36, x, WALL_BOTTOM - 70)
    front.fillStyle(0xe0e0e0, 1).fillRect(x - 90, WALL_BOTTOM - 36, 180, 10)
    front.lineStyle(3, 0x9e9e9e, 1).lineBetween(x - 86, WALL_BOTTOM - 26, x - 86, WALL_BOTTOM + 30).lineBetween(x + 86, WALL_BOTTOM - 26, x + 86, WALL_BOTTOM + 30)
  }
  tent(180)
  tent(1100)
  const chair = (x: number, y: number) => {
    front.fillStyle(0xffffff, 1).fillRoundedRect(x, y - 26, 20, 26, 4)
    front.fillRect(x - 2, y, 26, 5)
    front.lineStyle(2, 0xdddddd, 1).lineBetween(x, y + 5, x - 2, y + 20).lineBetween(x + 22, y + 5, x + 24, y + 20)
  }
  for (let x = 330; x < 960; x += 46) if (Math.abs(x - 640) > 60) chair(x, WALL_BOTTOM + 8)

  return {
    update(t: number) {
      clouds.clear()
      for (const [x0, y, s] of [
        [200, 70, 1],
        [700, 40, 0.8],
      ]) cloud(clouds, ((x0 + t * 6) % 1500) - 150, y, s, 0.85)
    },
  }
}
