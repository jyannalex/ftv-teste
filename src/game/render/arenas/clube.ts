import type Phaser from 'phaser'
import { type ArenaRuntime, cloud, crowd, SAND_Y, sand, sky, tree } from './common'

const WALL_TOP = SAND_Y - 70
const NET_TOP = 30

/** Quadra de areia do clube: árvores, rede de proteção, muro com faixas e torcida na areia. */
export function drawClube(scene: Phaser.Scene): ArenaRuntime {
  const g = scene.add.graphics()
  sky(g, 0x4fc3f7, 0xe1f5fe, WALL_TOP)
  const clouds = scene.add.graphics()
  const back = scene.add.graphics()
  for (const [x, s, c] of [
    [80, 1.1, 0x388e3c],
    [260, 0.9, 0x43a047],
    [470, 1.2, 0x2e7d32],
    [760, 1.0, 0x43a047],
    [980, 1.2, 0x388e3c],
    [1190, 1.0, 0x2e7d32],
  ] as const)
    tree(back, x, WALL_TOP + 10, s, c)

  // Rede de proteção alta (postes e malha).
  back.lineStyle(5, 0x546e7a, 1)
  for (let x = 40; x <= 1280; x += 300) back.lineBetween(x, NET_TOP, x, WALL_TOP)
  back.lineStyle(1, 0x263238, 0.3)
  for (let x = 40; x <= 1280; x += 14) back.lineBetween(x, NET_TOP, x, WALL_TOP)
  for (let y = NET_TOP; y <= WALL_TOP; y += 14) back.lineBetween(0, y, 1280, y)
  back.lineStyle(3, 0x546e7a, 1).lineBetween(0, NET_TOP, 1280, NET_TOP)

  // Muro com faixa e patrocinadores fictícios.
  back.fillStyle(0xeeeeee, 1).fillRect(0, WALL_TOP, 1280, SAND_Y - WALL_TOP)
  back.fillStyle(0x1565c0, 1).fillRect(0, WALL_TOP + 4, 1280, 8)
  const banner = (x: number, text: string, color: number) => {
    back.fillStyle(color, 1).fillRect(x, WALL_TOP + 20, 200, 38)
    scene.add.text(x + 100, WALL_TOP + 39, text, { fontFamily: 'Arial Black, Arial', fontSize: '18px', color: '#ffffff' }).setOrigin(0.5)
  }
  banner(120, 'CLUBE AREIA', 0x00897b)
  banner(540, 'FTV - TESTE', 0x1565c0)
  banner(960, 'TORNEIO 2x2', 0xef6c00)

  const front = scene.add.graphics()
  sand(front, 0xedd9a3, SAND_Y, 3)
  const fans = crowd(scene, 'clube', 0.8)

  return {
    update(t: number) {
      clouds.clear()
      for (const [x0, y, s] of [
        [200, 20, 0.8],
        [700, 10, 0.6],
      ]) cloud(clouds, ((x0 + t * 6) % 1500) - 150, y, s, 0.85)
      fans.update(t)
    },
  }
}
