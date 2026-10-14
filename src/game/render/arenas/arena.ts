import Phaser from 'phaser'
import { type ArenaRuntime, crowd, SAND_Y, sand, sky } from './common'

const STANDS_TOP = 40
const RAIL = SAND_Y - 34
const CROWD_COLORS = [0xe53935, 0xfdd835, 0x1e88e5, 0xffffff, 0x43a047, 0xff7043, 0x8e24aa]

/** Arena noturna da final: arquibancada lotada, refletores, faixas e torcida na areia. */
export function drawArenaNoturna(scene: Phaser.Scene): ArenaRuntime {
  const g = scene.add.graphics()
  sky(g, 0x050b1f, 0x1a237e, STANDS_TOP + 20)
  const rnd = new Phaser.Math.RandomDataGenerator(['arena'])
  for (let i = 0; i < 50; i++) g.fillStyle(0xffffff, rnd.realInRange(0.3, 0.9)).fillCircle(rnd.between(0, 1280), rnd.between(0, STANDS_TOP), rnd.realInRange(0.6, 1.4))

  // Arquibancada em degraus.
  const stands = scene.add.graphics()
  const rows = 6
  const rowH = (RAIL - STANDS_TOP) / rows
  for (let r = 0; r < rows; r++) stands.fillStyle(r % 2 ? 0x37474f : 0x455a64, 1).fillRect(0, STANDS_TOP + r * rowH, 1280, rowH)
  const fansBack = scene.add.graphics()
  const seats: { x: number; y: number; c: number; ph: number }[] = []
  for (let r = 0; r < rows; r++)
    for (let x = 8 + (r % 2) * 6; x < 1280; x += 12)
      seats.push({ x, y: STANDS_TOP + r * rowH + rowH - 3, c: rnd.pick(CROWD_COLORS), ph: rnd.realInRange(0, Math.PI * 2) })

  // Faixas na grade da frente.
  const front = scene.add.graphics()
  front.fillStyle(0x263238, 1).fillRect(0, RAIL, 1280, SAND_Y - RAIL)
  const banner = (x: number, text: string, color: number) => {
    front.fillStyle(color, 1).fillRect(x, RAIL + 4, 240, SAND_Y - RAIL - 8)
    scene.add.text(x + 120, (RAIL + SAND_Y) / 2, text, { fontFamily: 'Arial Black, Arial', fontSize: '16px', color: '#ffffff' }).setOrigin(0.5)
  }
  banner(60, 'GRANDE FINAL', 0xc62828)
  banner(520, 'SHARKATAQUE!', 0x00838f)
  banner(980, 'FTV - TESTE', 0x283593)
  sand(front, 0xe8cf8e, SAND_Y, 11)

  // Refletores com cone de luz.
  const lights = scene.add.graphics()
  const pole = (x: number) => {
    lights.fillStyle(0x263238, 1).fillRect(x - 4, 20, 8, STANDS_TOP)
    lights.fillStyle(0x37474f, 1).fillRect(x - 34, 8, 68, 22)
    for (let i = 0; i < 4; i++) lights.fillStyle(0xfffde7, 1).fillCircle(x - 24 + i * 16, 19, 6)
  }
  pole(110)
  pole(1170)
  const cones = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD)
  cones.fillStyle(0xfff9c4, 0.06).fillTriangle(110, 20, 300, 720, 900, 720).fillTriangle(1170, 20, 380, 720, 980, 720)
  const fans = crowd(scene, 'arena')

  return {
    update(t: number) {
      fansBack.clear()
      for (const f of seats) {
        const bob = Math.max(0, Math.sin(t * 5 + f.ph)) * 3
        fansBack.fillStyle(f.c, 1).fillRect(f.x - 4, f.y - 7 - bob, 8, 7)
        fansBack.fillStyle(0xd7a77a, 1).fillCircle(f.x, f.y - 11 - bob, 4)
      }
      fans.update(t)
    },
  }
}
