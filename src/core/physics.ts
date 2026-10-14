import { BALANCE } from '../data/balance'

/** Bola em 3D: x comprimento, y altura, z largura (velocidade em z constante). */
export type Ball = { x: number; y: number; z: number; vx: number; vy: number; vz: number }
export type Point = { x: number; y: number; z?: number }

const NET_BOUNCE = 0.35
const TAPE_BOUNCE = 0.3
const TAPE_MIN_VX = 0.5
const TAPE_NUDGE_VX = 0.8

/** Avança a bola um passo, tratando rede e chão. Não altera a bola recebida. */
export function stepBall(b: Ball, dt: number): { ball: Ball; hitNet: boolean; landed: boolean } {
  const { gravity: g, ballRadius: r, netHeight } = BALANCE
  const vy = b.vy - g * dt
  const next: Ball = { x: b.x + b.vx * dt, y: b.y + vy * dt, z: b.z + b.vz * dt, vx: b.vx, vy, vz: b.vz }
  let hitNet = false

  const crossed = (b.x < 0 && next.x >= 0) || (b.x > 0 && next.x <= 0)
  if (crossed || Math.abs(next.x) < r) {
    const yAtNet = crossed && next.x !== b.x ? b.y + ((next.y - b.y) * (0 - b.x)) / (next.x - b.x) : next.y
    if (yAtNet - r < netHeight) {
      hitNet = true
      if (b.y - r >= netHeight) {
        // Contato por cima, na faixa: quica pouco e nunca fica parada em cima.
        next.y = netHeight + r
        next.vy = Math.abs(next.vy) * TAPE_BOUNCE
        if (Math.abs(next.vx) < TAPE_MIN_VX) next.vx = (Math.sign(next.x) || 1) * TAPE_NUDGE_VX
      } else {
        const side = Math.sign(b.x) || -Math.sign(b.vx) || -1
        next.vx = -next.vx * NET_BOUNCE
        next.x = side * r
      }
    }
  }

  let landed = false
  if (next.y <= r) {
    next.y = r
    landed = true
  }
  if (Math.abs(next.x) > BALANCE.worldLimit || Math.abs(next.z) > BALANCE.worldLimit) landed = true
  return { ball: next, hitNet, landed }
}

export function positionAt(b: Ball, t: number): { x: number; y: number; z: number } {
  return { x: b.x + b.vx * t, y: b.y + b.vy * t - 0.5 * BALANCE.gravity * t * t, z: b.z + b.vz * t }
}

/** Tempo até a bola descer pela altura h (raiz maior), ou null se nunca chegar. */
export function timeToHeight(b: Ball, h: number): number | null {
  const g = BALANCE.gravity
  const disc = b.vy * b.vy - 2 * g * (h - b.y)
  if (disc < 0) return null
  const t = (b.vy + Math.sqrt(disc)) / g
  return t < 0 ? null : t
}

/** Onde e quando o centro da bola chega ao chão. Ignora a rede. */
export function predictLanding(b: Ball): { x: number; z: number; t: number } {
  const t = timeToHeight(b, BALANCE.ballRadius) ?? 0
  return { x: b.x + b.vx * t, z: b.z + b.vz * t, t }
}

/** Velocidade para ir de `from` até `to` passando por um ápice ou num tempo dado. */
export function launchVelocity(from: Point, to: Point, mode: { apex: number } | { time: number }): { vx: number; vy: number; vz: number } {
  const g = BALANCE.gravity
  const dx = to.x - from.x
  const dz = (to.z ?? 0) - (from.z ?? 0)
  if ('time' in mode) {
    const t = mode.time
    return { vx: dx / t, vy: (to.y - from.y + 0.5 * g * t * t) / t, vz: dz / t }
  }
  const apex = Math.max(mode.apex, from.y + 0.1, to.y + 0.1)
  const vy = Math.sqrt(2 * g * (apex - from.y))
  const tTotal = vy / g + Math.sqrt((2 * (apex - to.y)) / g)
  return { vx: dx / tTotal, vy, vz: dz / tTotal }
}

/** Quique da bola morta depois do ponto (só visual): baixo e curto, a areia segura a bola. */
export function bounceDead(b: Ball): Ball {
  return { x: b.x, y: BALANCE.ballRadius, z: b.z, vx: b.vx * 0.15, vy: Math.min(3, Math.abs(b.vy) * 0.3), vz: b.vz * 0.15 }
}
