import Phaser from 'phaser'
import { BALANCE } from '../../data/balance'
import { depthOf, LAYER, project } from './view'

const V = (p: { x: number; y: number }) => new Phaser.Math.Vector2(p.x, p.y)

/** Aparência da quadra de areia em cada cenário: cor da areia e da fita das linhas. */
export type CourtStyle = { sand: number; tape: number; props: 'praia' | 'clube' | 'arena' }

const shade = (c: number, k: number): number => {
  const col = Phaser.Display.Color.IntegerToColor(c)
  return Phaser.Display.Color.GetColor(Math.min(255, col.red * k), Math.min(255, col.green * k), Math.min(255, col.blue * k))
}

/**
 * Quadra de areia: areia batida com grãos, marcas de rastelo, pegadas e montinhos; fitas nas linhas
 * presas por estacas nos cantos; objetos na areia em volta. Tudo no chão, na camada da quadra.
 */
export function drawCourt(scene: Phaser.Scene, style: CourtStyle): void {
  const L = BALANCE.halfCourt
  const W = BALANCE.halfWidth
  const rnd = new Phaser.Math.RandomDataGenerator([`quadra-${style.props}`])
  const g = scene.add.graphics().setDepth(LAYER.court)
  const ground = (x: number, z: number) => project(x, 0, z)
  const dark = shade(style.sand, 0.82)
  const light = shade(style.sand, 1.12)

  // Areia da quadra um pouco mais lisa (rastelada) que a de fora.
  g.fillStyle(light, 0.18).fillPoints([ground(-L, -W), ground(L, -W), ground(L, W), ground(-L, W)].map(V), true)

  // Marcas do rastelo: linhas curtas no sentido da largura.
  for (let i = 0; i < 160; i++) {
    const x = rnd.realInRange(-L, L)
    const z = rnd.realInRange(-W, W)
    const len = rnd.realInRange(0.4, 1.1)
    const a = ground(x, z)
    const b = ground(x + rnd.realInRange(-0.1, 0.1), z + len)
    g.lineStyle(1.5, dark, 0.22).lineBetween(a.x, a.y, b.x, b.y)
    g.lineStyle(1, light, 0.3).lineBetween(a.x + 1, a.y, b.x + 1, b.y)
  }
  // Grãos claros e escuros, dentro e em volta da quadra.
  for (let i = 0; i < 1100; i++) {
    const p = ground(rnd.realInRange(-12.5, 12.5), rnd.realInRange(-6.2, 6.8))
    g.fillStyle(rnd.frac() < 0.5 ? dark : 0xffffff, rnd.realInRange(0.12, 0.3)).fillCircle(p.x, p.y, rnd.realInRange(0.6, 1.5) * (p.k / 50))
  }
  // Montinhos de areia: brilho em cima e sombra embaixo.
  for (let i = 0; i < 26; i++) {
    const p = ground(rnd.realInRange(-11, 11), rnd.realInRange(-5.5, 6))
    const r = rnd.realInRange(0.3, 0.7) * p.k
    g.fillStyle(dark, 0.18).fillEllipse(p.x + r * 0.15, p.y + r * 0.12, r * 2, r * 0.55)
    g.fillStyle(light, 0.35).fillEllipse(p.x, p.y, r * 1.7, r * 0.4)
  }
  // Pegadas espalhadas (pares de pés).
  for (let i = 0; i < 70; i++) {
    const x = rnd.realInRange(-10, 10)
    const z = rnd.realInRange(-5, 5.5)
    for (const side of [-1, 1]) {
      const p = ground(x + side * 0.12, z + side * 0.18)
      g.fillStyle(dark, 0.22).fillEllipse(p.x, p.y, 0.13 * p.k, 0.2 * p.k * 0.6)
    }
  }

  // Fitas das linhas (largura de 12 cm) e estacas nos cantos.
  const tape = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const nx = (-(z1 - z0) / len) * 0.06
    const nz = ((x1 - x0) / len) * 0.06
    g.fillStyle(0x000000, 0.12).fillPoints([ground(x0 + nx, z0 + nz + 0.05), ground(x1 + nx, z1 + nz + 0.05), ground(x1 - nx, z1 - nz + 0.05), ground(x0 - nx, z0 - nz + 0.05)].map(V), true)
    g.fillStyle(style.tape, 1).fillPoints([ground(x0 + nx, z0 + nz), ground(x1 + nx, z1 + nz), ground(x1 - nx, z1 - nz), ground(x0 - nx, z0 - nz)].map(V), true)
    const a = ground(x0, z0)
    const b = ground(x1, z1)
    g.lineStyle(1, 0xffffff, 0.45).lineBetween(a.x, a.y - 1, b.x, b.y - 1)
  }
  tape(-L, -W, L, -W)
  tape(-L, W, L, W)
  tape(-L, -W, -L, W)
  tape(L, -W, L, W)
  for (const [x, z] of [
    [-L, -W],
    [L, -W],
    [-L, W],
    [L, W],
  ]) {
    const p = ground(x + Math.sign(x) * 0.15, z + Math.sign(z) * 0.15)
    const s = p.k / 50
    g.fillStyle(0x6d4c41, 1).fillRect(p.x - 2 * s, p.y - 9 * s, 4 * s, 9 * s)
    g.fillStyle(style.tape, 1).fillRect(p.x - 2.5 * s, p.y - 10 * s, 5 * s, 3 * s)
  }

  drawProps(scene, style)
}

/** Objetos na areia em volta da quadra, por cenário. */
function drawProps(scene: Phaser.Scene, style: CourtStyle): void {
  const at = (x: number, z: number) => {
    const p = project(x, 0, z)
    return { p, s: p.k / 50, g: scene.add.graphics().setDepth(depthOf(z)) }
  }
  const towel = (x: number, z: number, a: number, b: number) => {
    const g = scene.add.graphics().setDepth(LAYER.court)
    // Deitada no sentido do comprimento, com listras.
    const pts = [project(x - 0.9, 0, z - 0.45), project(x + 0.9, 0, z - 0.45), project(x + 0.9, 0, z + 0.45), project(x - 0.9, 0, z + 0.45)].map(V)
    g.fillStyle(0x000000, 0.12).fillPoints(pts.map((q) => new Phaser.Math.Vector2(q.x + 3, q.y + 3)), true)
    g.fillStyle(a, 1).fillPoints(pts, true)
    for (let i = 1; i < 5; i += 2) {
      const x0 = x - 0.9 + (i * 1.8) / 5
      g.fillStyle(b, 1).fillPoints([project(x0, 0, z - 0.45), project(x0 + 0.36, 0, z - 0.45), project(x0 + 0.36, 0, z + 0.45), project(x0, 0, z + 0.45)].map(V), true)
    }
  }
  const cooler = (x: number, z: number, color: number) => {
    const { p, s, g } = at(x, z)
    g.fillStyle(0x000000, 0.2).fillEllipse(p.x, p.y, 44 * s, 10 * s)
    g.fillStyle(color, 1).fillRoundedRect(p.x - 18 * s, p.y - 26 * s, 36 * s, 26 * s, 4 * s)
    g.fillStyle(0xffffff, 1).fillRoundedRect(p.x - 20 * s, p.y - 30 * s, 40 * s, 7 * s, 3 * s)
    g.lineStyle(2 * s, 0x37474f, 1).strokeRoundedRect(p.x - 18 * s, p.y - 26 * s, 36 * s, 26 * s, 4 * s)
  }
  const sandcastle = (x: number, z: number) => {
    const { p, s, g } = at(x, z)
    const c = shade(style.sand, 0.92)
    g.fillStyle(0x000000, 0.15).fillEllipse(p.x, p.y, 60 * s, 12 * s)
    g.fillStyle(c, 1).fillRect(p.x - 24 * s, p.y - 16 * s, 48 * s, 16 * s)
    g.fillRect(p.x - 10 * s, p.y - 30 * s, 20 * s, 16 * s)
    for (let i = 0; i < 3; i++) g.fillRect(p.x - 10 * s + i * 8 * s, p.y - 35 * s, 5 * s, 5 * s)
    g.fillStyle(0xe53935, 1).fillTriangle(p.x, p.y - 46 * s, p.x, p.y - 38 * s, p.x + 9 * s, p.y - 42 * s)
    g.lineStyle(1.5 * s, 0x5d4037, 1).lineBetween(p.x, p.y - 30 * s, p.x, p.y - 46 * s)
  }
  const bench = (x: number, z: number) => {
    const { p, s, g } = at(x, z)
    g.fillStyle(0x000000, 0.18).fillEllipse(p.x, p.y, 110 * s, 12 * s)
    g.fillStyle(0x5d4037, 1).fillRect(p.x - 48 * s, p.y - 16 * s, 6 * s, 16 * s).fillRect(p.x + 42 * s, p.y - 16 * s, 6 * s, 16 * s)
    g.fillStyle(0x8d6e63, 1).fillRect(p.x - 54 * s, p.y - 22 * s, 108 * s, 8 * s)
    g.fillStyle(0xffffff, 0.2).fillRect(p.x - 54 * s, p.y - 22 * s, 108 * s, 2 * s)
  }
  const bottle = (x: number, z: number) => {
    const { p, s, g } = at(x, z)
    g.fillStyle(0x4fc3f7, 0.9).fillRoundedRect(p.x - 4 * s, p.y - 18 * s, 8 * s, 18 * s, 2 * s)
    g.fillStyle(0x1565c0, 1).fillRect(p.x - 2.5 * s, p.y - 22 * s, 5 * s, 4 * s)
  }

  if (style.props === 'praia') {
    towel(-11, -5.4, 0xe53935, 0xffffff)
    towel(11, -5.2, 0x1e88e5, 0xfdd835)
    cooler(-10.5, -3.6, 0x1976d2)
    sandcastle(10.4, 3.8)
    bottle(-10.3, -4.4)
  } else if (style.props === 'clube') {
    bench(-10.8, -4.2)
    bench(10.8, -4.2)
    cooler(-10.6, -1.2, 0xef6c00)
    bottle(10.3, -1.4)
    bottle(10.55, -1.2)
  } else {
    cooler(-10.5, -3.8, 0xc62828)
    cooler(10.5, -3.8, 0x283593)
    bottle(-10.2, -1.5)
    bottle(10.2, -1.5)
  }
}

/** Rede quase de perfil (câmera sobre a rede), postes nas pontas. */
export function drawNet(scene: Phaser.Scene): void {
  const zPost = BALANCE.halfWidth + 0.5
  const top = BALANCE.netHeight
  const bottom = top - 1

  const post = (z: number) => {
    const g = scene.add.graphics().setDepth(depthOf(z))
    const base = project(0, 0, z)
    const head = project(0, top + 0.35, z)
    const w = Math.max(4, base.k * 0.12)
    g.fillStyle(0x000000, 0.25).fillEllipse(base.x + w, base.y, w * 3, w)
    g.fillStyle(0x37474f, 1).fillRect(base.x - w / 2, head.y, w, base.y - head.y)
    g.fillStyle(0x90a4ae, 1).fillRect(base.x - w / 2, head.y, w * 0.35, base.y - head.y)
    // Proteção acolchoada na base do poste.
    g.fillStyle(0xe53935, 1).fillRect(base.x - w * 0.9, base.y - base.k * 1.2, w * 1.8, base.k * 1.2)
    g.fillStyle(0xffffff, 0.35).fillRect(base.x - w * 0.9, base.y - base.k * 1.2, w * 0.5, base.k * 1.2)
  }
  post(-zPost)

  // Malha: faixa estreita entre a fita de cima e a de baixo, de um poste ao outro.
  const g = scene.add.graphics().setDepth(depthOf(0))
  const farTop = project(0, top, -zPost)
  const nearTop = project(0, top, zPost)
  const farBot = project(0, bottom, -zPost)
  const nearBot = project(0, bottom, zPost)
  const half = 5
  g.fillStyle(0x0b1d33, 0.35).fillPoints(
    [V({ x: farTop.x - half, y: farTop.y }), V({ x: farTop.x + half, y: farTop.y }), V({ x: nearBot.x + half, y: nearBot.y }), V({ x: nearBot.x - half, y: nearBot.y })],
    true,
  )
  g.lineStyle(1, 0xffffff, 0.35)
  for (let y = farTop.y + 6; y < nearBot.y; y += 7) g.lineBetween(640 - half, y, 640 + half, y)
  g.lineStyle(4, 0xffffff, 1).lineBetween(farTop.x, farTop.y, nearTop.x, nearTop.y)
  g.lineStyle(3, 0x1a1a24, 1).lineBetween(farBot.x, farBot.y, nearBot.x, nearBot.y)
  post(zPost)
}
