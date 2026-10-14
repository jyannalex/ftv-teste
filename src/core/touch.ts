import { BALANCE } from '../data/balance'
import { launchVelocity, type Point } from './physics'
import type { Rng } from './rng'
import { type Side, sideSign } from './rules'

/** Qualidade do toque: normal (no lugar) ou peixinho (torto). */
export type Quality = 'normal' | 'peixinho'
export type Aim = 'curto' | 'meio' | 'fundo'
export type TouchAction = 'passe' | 'levantada' | 'fraco' | 'pingo' | 'forte' | 'sharkataque'

/** Direção na tela → mira: para a rede é curto, para trás é fundo. */
export function aimFromMove(team: Side, move: -1 | 0 | 1): Aim {
  if (move === 0) return 'meio'
  const towardNet = move === -sideSign(team)
  return towardNet ? 'curto' : 'fundo'
}

export type OutgoingRequest = { action: TouchAction; team: Side; from: Point; quality: Quality; aim?: Aim }

/** Trajetória de saída de um toque: velocidade da bola e onde ela deve cair. */
export function outgoing(req: OutgoingRequest, rng: Rng): { vx: number; vy: number; targetX: number } {
  const s = sideSign(req.team)
  const { netHeight } = BALANCE
  const a = BALANCE.attack
  const depth = BALANCE.aimDepth[req.aim ?? 'meio']
  let target: number
  let mode: { apex: number } | { time: number }

  switch (req.action) {
    case 'passe':
      target = s * 3.0
      mode = { apex: 3.8 }
      break
    case 'levantada':
      target = s * 1.0
      mode = { apex: 3.6 }
      break
    case 'fraco':
      target = -s * a.fracoDepth
      mode = { apex: a.fracoApex }
      break
    case 'pingo':
      target = -s * a.pingoDist
      mode = { apex: Math.max(netHeight + 0.5, req.from.y + 0.2) }
      break
    case 'forte':
      target = -s * depth
      mode = { time: a.forteTime }
      break
    case 'sharkataque':
      target = -s * depth
      mode = { time: a.sharkTime }
      break
  }

  const isAttack = req.action === 'forte' || req.action === 'sharkataque' || req.action === 'pingo' || req.action === 'fraco'
  const spread = isAttack ? BALANCE.quality.normal : BALANCE.quality[req.quality]
  target += rng.range(-spread, spread)
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
