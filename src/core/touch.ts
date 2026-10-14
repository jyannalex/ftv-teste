import { BALANCE } from '../data/balance'
import { launchVelocity, type Point } from './physics'
import type { Rng } from './rng'
import { type Side, sideSign } from './rules'

export type Aim = 'curto' | 'meio' | 'fundo'
export type TouchAction = 'passe' | 'levantada' | 'fraco' | 'pingo' | 'forte' | 'sharkataque'
/** Faixa da mira: −1 fundo da tela, 0 meio, +1 perto da câmera. */
export type Lane = -1 | 0 | 1
export type AimTarget = { aim: Aim; lane: Lane }

/** Direção na tela → mira: para a rede é curto, para trás é fundo. */
export function aimFromMove(team: Side, move: -1 | 0 | 1): Aim {
  if (move === 0) return 'meio'
  const towardNet = move === -sideSign(team)
  return towardNet ? 'curto' : 'fundo'
}

/** Direções na tela → mira 2D: x dá a profundidade, z dá a faixa. */
export function aimFromInput(team: Side, input: { move: -1 | 0 | 1; moveZ: -1 | 0 | 1 }): AimTarget {
  return { aim: aimFromMove(team, input.move), lane: input.moveZ }
}

export type OutgoingRequest = {
  action: TouchAction
  team: Side
  from: Point
  aim?: Aim
  lane?: Lane
  /** Passe e levantada: z de quem vai receber. */
  toZ?: number
  precise?: boolean
}

/** Trajetória de saída de um toque: velocidade da bola e onde ela deve cair. */
export function outgoing(req: OutgoingRequest, rng: Rng): { vx: number; vy: number; vz: number; targetX: number; targetZ: number } {
  const s = sideSign(req.team)
  const { netHeight } = BALANCE
  const a = BALANCE.attack
  const depth = BALANCE.aimDepth[req.aim ?? 'meio']
  const lane = req.lane ?? 0
  const passZ = Math.max(-BALANCE.passMaxZ, Math.min(BALANCE.passMaxZ, req.toZ ?? req.from.z ?? 0))
  let target: number
  let targetZ = 0
  let mode: { apex: number } | { time: number }

  switch (req.action) {
    case 'passe':
      target = s * 3.0
      targetZ = passZ
      mode = { apex: 5.0 }
      break
    case 'levantada':
      target = s * 1.0
      targetZ = passZ
      mode = { apex: 4.8 }
      break
    case 'fraco':
      target = -s * a.fracoDepth
      mode = { apex: a.fracoApex }
      break
    case 'pingo':
      target = -s * a.pingoDist
      targetZ = lane * BALANCE.pingoLaneZ
      mode = { apex: Math.max(netHeight + 0.5, req.from.y + 0.2) }
      break
    case 'forte':
      target = -s * depth
      targetZ = lane * BALANCE.laneZ
      mode = { time: a.forteTime }
      break
    case 'sharkataque':
      target = -s * depth
      targetZ = lane * BALANCE.laneZ
      mode = { time: a.sharkTime }
      break
  }

  const spread = req.precise ? 0 : BALANCE.aimError
  target += rng.range(-spread, spread)
  targetZ += rng.range(-spread, spread)
  const to = { x: target, y: BALANCE.ballRadius, z: targetZ }
  let v = launchVelocity(req.from, to, mode)
  if ('time' in mode) {
    // Bola reta para baixo não passa a faixa perto da rede: se faltar folga, abre um pouco o arco.
    let time = mode.time
    while (heightAtNet(req.from, v) < NET_CLEARANCE && time < MAX_ATTACK_TIME) {
      time *= 1.05
      v = launchVelocity(req.from, to, { time })
    }
  }
  return { ...v, targetX: target, targetZ }
}

const NET_CLEARANCE = BALANCE.netHeight + BALANCE.ballRadius + 0.1
const MAX_ATTACK_TIME = 2

/** Altura da bola ao cruzar x = 0 (Infinity se não cruza a rede). */
function heightAtNet(from: Point, v: { vx: number; vy: number }): number {
  if (v.vx === 0 || Math.sign(-from.x) !== Math.sign(v.vx)) return Infinity
  const t = -from.x / v.vx
  return from.y + v.vy * t - 0.5 * BALANCE.gravity * t * t
}
