import { BALANCE } from '../data/balance'
import { launchVelocity, type Point } from './physics'
import type { Rng } from './rng'
import { type Side, sideSign } from './rules'

export type Grade = 'perfeito' | 'bom' | 'ruim'
export type Windows = { perfeito: number; bom: number; ruim: number }
export type TouchAction = 'passe' | 'levantada' | 'devolucao' | 'pingo' | 'forte' | 'sharkataque'

export function windowsFor(ctx: { incomingForce: number; incomingShark: boolean; easyAssist: boolean }): Windows {
  const easy = ctx.easyAssist ? BALANCE.easyWindowScale : 1
  if (ctx.incomingShark) return { perfeito: BALANCE.sharkWindow * easy, bom: 0, ruim: 0 }
  const k = easy * (1 - BALANCE.forceWindowShrink * ctx.incomingForce)
  const w = BALANCE.windows
  return { perfeito: w.perfeito * k, bom: w.bom * k, ruim: w.ruim * k }
}

export function gradeTiming(offsetSec: number, w: Windows): Grade | null {
  const d = Math.abs(offsetSec)
  if (d <= w.perfeito) return 'perfeito'
  if (d <= w.bom) return 'bom'
  if (d <= w.ruim) return 'ruim'
  return null
}

export function classifyHold(holdMs: number): { kind: 'pingo' } | { kind: 'forte'; force: number; overpower: boolean } {
  const h = BALANCE.hold
  if (holdMs < h.pingoMaxMs) return { kind: 'pingo' }
  const force = Math.min(1, Math.max(0, (holdMs - h.pingoMaxMs) / h.forceRampMs))
  return { kind: 'forte', force, overpower: holdMs > h.overpowerMs }
}

const ERROR_SPREAD: Record<Grade, number> = { perfeito: 0, bom: 0.6, ruim: 2.5 }

export type OutgoingRequest = {
  action: TouchAction
  team: Side
  from: Point
  grade: Grade
  force?: number
  overpower?: boolean
}

/** Trajetória de saída de um toque: velocidade da bola e onde ela deve cair. */
export function outgoing(req: OutgoingRequest, rng: Rng): { vx: number; vy: number; targetX: number } {
  const s = sideSign(req.team)
  const { netHeight, halfCourt } = BALANCE
  const force = req.force ?? 0
  let errorScale = 1
  let target: number
  let mode: { apex: number } | { time: number }

  switch (req.action) {
    case 'passe':
      target = s * 3.0
      mode = { apex: 4.5 }
      break
    case 'levantada':
      target = s * 1.0
      mode = { apex: 4.0 }
      break
    case 'devolucao':
      target = -s * 5.0
      mode = { apex: 4.5 }
      break
    case 'pingo':
      target = -s * 1.2
      mode = { apex: Math.max(netHeight + 0.7, req.from.y + 0.4) }
      break
    case 'forte': {
      target = req.overpower ? -s * (halfCourt + rng.range(1.5, 3)) : -s * (1.5 + 6.5 * force)
      let time = 0.75 - 0.4 * force
      if (Math.abs(req.from.x) > BALANCE.attackFarDist) {
        time *= 1.3
        errorScale = 2
      }
      mode = { time }
      break
    }
    case 'sharkataque':
      target = -s * rng.range(5, 8)
      mode = { time: 0.35 }
      break
  }

  const spread = ERROR_SPREAD[req.grade] * errorScale
  if (spread > 0) target += rng.range(-spread, spread)
  const to = { x: target, y: BALANCE.ballRadius }
  let v = launchVelocity(req.from, to, mode)
  if ('time' in mode) {
    // Bola reta para baixo não passa a faixa perto da rede: se faltar folga, abre um pouco o arco.
    let time = mode.time
    while (heightAtNet(req.from, v) < NET_CLEARANCE && time < MAX_ATTACK_TIME) {
      time *= 1.05
      v = launchVelocity(req.from, to, { time })
    }
  }
  return { ...v, targetX: target }
}

const NET_CLEARANCE = BALANCE.netHeight + BALANCE.ballRadius + 0.1
const MAX_ATTACK_TIME = 2

/** Altura da bola ao cruzar x = 0 (Infinity se não cruza a rede). */
function heightAtNet(from: Point, v: { vx: number; vy: number }): number {
  if (v.vx === 0 || Math.sign(-from.x) !== Math.sign(v.vx)) return Infinity
  const t = -from.x / v.vx
  return from.y + v.vy * t - 0.5 * BALANCE.gravity * t * t
}
