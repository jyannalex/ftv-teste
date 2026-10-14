import Phaser from 'phaser'
import { type ArenaRuntime, HORIZON, sand, sky } from './common'

const STANDS_TOP = 150
const STANDS_BOTTOM = HORIZON + 40
const CROWD_COLORS = [0xe53935, 0xfdd835, 0x1e88e5, 0xffffff, 0x43a047, 0xff7043, 0x8e24aa]

/** Arena noturna da final: arquibancada com torcida, refletores e faixas. */
export function drawArenaNoturna(scene: Phaser.Scene): ArenaRuntime {
  const g = scene.add.graphics()
  sky(g, 0x050b1f, 0x1a237e, STANDS_TOP + 40)
  const rnd = new Phaser.Math.RandomDataGenerator(['arena'])
  for (let i = 0; i < 70; i++) g.fillStyle(0xffffff, rnd.realInRange(0.3, 0.9)).fillCircle(rnd.between(0, 1280), rnd.between(0, STANDS_TOP), rnd.realInRange(0.6, 1.6))

  // Arquibancada em degraus.
  const stands = scene.add.graphics()
  const rows = 6
  const rowH = (STANDS_BOTTOM - STANDS_TOP - 40) / rows
  for (let r = 0; r < rows; r++) {
    stands.fillStyle(r % 2 ? 0x37474f : 0x455a64, 1).fillRect(0, STANDS_TOP + r * rowH, 1280, rowH)
  }
  const crowd = scene.add.graphics()
  const fans: { x: number; y: number; c: number; ph: number }[] = []
  for (let r = 0; r < rows; r++)
    for (let x = 12 + (r % 2) * 9; x < 1280; x += 18)
      fans.push({ x, y: STANDS_TOP + r * rowH + rowH - 6, c: rnd.pick(CROWD_COLORS), ph: rnd.realInRange(0, Math.PI * 2) })

  // Faixas na grade da frente.
  const front = scene.add.graphics()
  front.fillStyle(0x263238, 1).fillRect(0, STANDS_BOTTOM - 40, 1280, 40)
  const banner = (x: number, text: string, color: number) => {
    front.fillStyle(color, 1).fillRect(x, STANDS_BOTTOM - 36, 260, 32)
    scene.add.text(x + 130, STANDS_BOTTOM - 20, text, { fontFamily: 'Arial Black, Arial', fontSize: '18px', color: '#ffffff' }).setOrigin(0.5)
  }
  banner(40, 'GRANDE FINAL', 0xc62828)
  banner(510, 'SHARKATAQUE!', 0x00838f)
  banner(980, 'FTV - TESTE', 0x283593)
  sand(front, 0xe8cf8e, STANDS_BOTTOM, 11)

  // Refletores com cone de luz.
  const lights = scene.add.graphics()
  const pole = (x: number) => {
    lights.fillStyle(0x263238, 1).fillRect(x - 5, 40, 10, STANDS_TOP - 40)
    lights.fillStyle(0x37474f, 1).fillRect(x - 40, 24, 80, 28)
    for (let i = 0; i < 4; i++) lights.fillStyle(0xfffde7, 1).fillCircle(x - 28 + i * 19, 38, 7)
  }
  pole(130)
  pole(1150)
  const cones = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD)
  cones.fillStyle(0xfff9c4, 0.07).fillTriangle(130, 40, 360, 720, 900, 720).fillTriangle(1150, 40, 380, 720, 920, 720)

  return {
    update(t: number) {
      crowd.clear()
      for (const f of fans) {
        const bob = Math.max(0, Math.sin(t * 5 + f.ph)) * 4
        crowd.fillStyle(f.c, 1).fillRect(f.x - 6, f.y - 10 - bob, 12, 10)
        crowd.fillStyle(0xd7a77a, 1).fillCircle(f.x, f.y - 15 - bob, 5)
      }
    },
  }
}
