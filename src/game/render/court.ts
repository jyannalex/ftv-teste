import Phaser from 'phaser'
import { BALANCE } from '../../data/balance'
import { depthOf, LAYER, project } from './view'

const V = (p: { x: number; y: number }) => new Phaser.Math.Vector2(p.x, p.y)

/** Quadra pintada em perspectiva (trapézio), com faixas de textura e linhas finas. */
export function drawCourt(scene: Phaser.Scene, colors: [number, number]): void {
  const [outer, inner] = colors
  const L = BALANCE.halfCourt
  const W = BALANCE.halfWidth
  const g = scene.add.graphics().setDepth(LAYER.court)
  const ground = (x: number, z: number) => project(x, 0, z)
  const quad = (x0: number, x1: number, z0: number, z1: number) => [ground(x0, z0), ground(x1, z0), ground(x1, z1), ground(x0, z1)].map(V)

  // Sombra suave em volta e a quadra.
  g.fillStyle(0x000000, 0.12).fillPoints(quad(-L - 0.6, L + 0.6, -W - 0.4, W + 0.6), true)
  g.fillStyle(outer, 1).fillPoints(quad(-L, L, -W, W), true)
  // Faixas alternadas no sentido da rede (textura de areia batida).
  for (let i = 0; i < 12; i++) {
    const x0 = -L + (i * 2 * L) / 12
    if (i % 2) g.fillStyle(inner, 0.35).fillPoints(quad(x0, x0 + (2 * L) / 12, -W, W), true)
  }
  // Brilho perto da câmera.
  g.fillStyle(0xffffff, 0.06).fillPoints(quad(-L, L, W - 2, W), true)

  // Linhas: contorno e linha central.
  g.lineStyle(3, 0xffffff, 0.95)
  g.strokePoints(quad(-L, L, -W, W), true)
  const c0 = ground(0, -W)
  const c1 = ground(0, W)
  g.lineStyle(2, 0xffffff, 0.7).lineBetween(c0.x, c0.y, c1.x, c1.y)
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
