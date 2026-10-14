import { BALANCE } from '../data/balance'
import { DT, IDLE, type MatchState, type TeamInput } from './match'
import type { Rng } from './rng'
import { type Side, sideSign } from './rules'
import { isMeterFull } from './specialMeter'
import type { Aim, AimTarget, Lane } from './touch'

export type Personality = 'equilibrado' | 'gostaDePingo' | 'bateForte' | 'paredao'

export type SkillParams = {
  /** Atraso para começar a correr (s). */
  reactionDelay: number
  /** Desvio padrão do erro de posicionamento (m). */
  posError: number
  /** Chance de "ler" a defesa na escolha e na mira do ataque. */
  readChance: number
  /** Desvio padrão do tempo do botão DEFENDER (s). */
  defenseSigma: number
}

const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t

export function skillParams(skill: number): SkillParams {
  const k = Math.min(1, Math.max(0, skill))
  return {
    reactionDelay: lerp(0.35, 0.08, k),
    posError: lerp(1.0, 0.1, k),
    readChance: k,
    defenseSigma: lerp(0.18, 0.04, k),
  }
}

const AIMS: Aim[] = ['curto', 'meio', 'fundo']
const LANES: Lane[] = [-1, 0, 1]

/** Alvo (profundidade × faixa) mais longe dos defensores (d: distância da rede, z). */
export function bestTarget(defenders: { d: number; z: number }[]): AimTarget {
  let best: AimTarget = { aim: 'meio', lane: 0 }
  let bestGap = -1
  for (const aim of AIMS)
    for (const lane of LANES) {
      const gap = Math.min(...defenders.map((p) => Math.hypot(p.d - BALANCE.aimDepth[aim], p.z - lane * BALANCE.laneZ)))
      if (gap > bestGap) {
        bestGap = gap
        best = { aim, lane }
      }
    }
  return best
}

const randomTarget = (rng: Rng): AimTarget => ({ aim: AIMS[Math.floor(rng.next() * 3)], lane: LANES[Math.floor(rng.next() * 3)] })

const PINGO_BIAS: Record<Personality, number> = { equilibrado: 0, gostaDePingo: 0.25, bateForte: -0.2, paredao: 0 }
const RANDOM_PINGO_CHANCE = 0.3
/** Defensor mais perto da rede além disso: o Pingo é o ataque certo. */
const DEEP_DEFENSE = 6.0
const SERVE_WAIT_SEC = 1
const SERVE_HOLD_SEC = 0.1
/** Antecedência do aperto do ataque (s). */
const ATTACK_PRESS_LEAD = 0.15
const ARRIVE_TOLERANCE = 0.1

type Decision = {
  key: string
  posError: number
  posErrorZ: number
  attackPressed: boolean
  defenseAt: number | null
  defensePressed: boolean
  attackButton: 'forte' | 'pingo' | 'shark'
  aim: AimTarget
}

/** Anda num eixo até o alvo e freia a tempo: para quando a distância de frenagem cobre o que falta. */
function axisInput(gap: number, v: number): -1 | 0 | 1 {
  const movingToward = Math.sign(v) === Math.sign(gap)
  const stopDist = movingToward ? (v * v) / (2 * BALANCE.move.decel) : 0
  return Math.abs(gap) > ARRIVE_TOLERANCE + stopDist ? (gap > 0 ? 1 : -1) : 0
}

export type AIController = { think(s: MatchState): TeamInput }

/** shark: false → nunca usa o Sharkataque (parceiro do jogador: o especial fica com ele). */
export function createAI(team: Side, skill: number, personality: Personality, rng: Rng, opts: { shark?: boolean } = {}): AIController {
  const p = skillParams(skill)
  const sign = sideSign(team)
  let decision: Decision | null = null
  let serveAim: AimTarget | null = null

  /** Direções na tela que dão essa mira para este time. */
  const inputForAim = (t: AimTarget): Pick<TeamInput, 'move' | 'moveZ'> => ({
    move: t.aim === 'meio' ? 0 : t.aim === 'curto' ? (-sign as -1 | 1) : (sign as -1 | 1),
    moveZ: t.lane,
  })

  const chooseAttack = (s: MatchState): Pick<Decision, 'attackButton' | 'aim'> => {
    const defenders = s.athletes.filter((a) => a.team !== team).map((a) => ({ d: Math.abs(a.x), z: a.z }))
    const reads = rng.next() < p.readChance
    const deep = Math.min(...defenders.map((d) => d.d)) > DEEP_DEFENSE
    const pingoChance = (reads ? (deep ? 1 : 0) : RANDOM_PINGO_CHANCE) + PINGO_BIAS[personality]
    const aim = rng.next() < p.readChance ? bestTarget(defenders) : randomTarget(rng)
    if (opts.shark !== false && isMeterFull(s.meter[team])) return { attackButton: 'shark', aim }
    if (rng.next() < pingoChance) return { attackButton: 'pingo', aim: { aim: 'meio', lane: aim.lane } }
    return { attackButton: 'forte', aim }
  }

  return {
    think(s: MatchState): TeamInput {
      // O step soma dt antes de ler a entrada.
      const now = s.time + (s.slowMo ? DT * BALANCE.slowMo.scale : DT)

      if (s.phase === 'saque') {
        decision = null
        if (s.score.servingTeam !== team) return IDLE
        serveAim ??= randomTarget(rng)
        const t = s.phaseT + DT
        if (t < SERVE_WAIT_SEC) return IDLE
        if (t < SERVE_WAIT_SEC + SERVE_HOLD_SEC) return { ...IDLE, forte: true }
        return { ...IDLE, ...inputForAim(serveAim) }
      }
      serveAim = null

      const plan = s.plan
      if (s.phase !== 'rally' || !plan || plan.team !== team) return IDLE
      const key = `${plan.athleteId}:${plan.createdAt.toFixed(4)}`
      if (decision?.key !== key) {
        // Erro por eixo: no plano, o erro total fica igual a posError.
        const base = p.posError * (personality === 'paredao' ? 0.7 : 1)
        const sd = (base + (plan.incoming === 'forte' ? BALANCE.vsForte.aiExtraError : 0)) / Math.SQRT2
        const error = rng.normal(0, sd)
        const defenseAt = plan.incoming && plan.touchIndex === 1 ? plan.tIdeal + rng.normal(0, p.defenseSigma) : null
        const errorZ = rng.normal(0, sd)
        decision = { key, posError: error, posErrorZ: errorZ, attackPressed: false, attackButton: 'forte', aim: { aim: 'meio', lane: 0 }, defenseAt, defensePressed: false }
      }
      const d = decision
      const athlete = s.athletes[plan.athleteId]
      const input: TeamInput = { ...IDLE }

      // Corre até o ponto de contato (com o erro sorteado), depois do tempo de reação.
      const reaction = p.reactionDelay + (plan.incoming === 'forte' ? BALANCE.vsForte.aiExtraReaction : 0)
      if (now >= plan.createdAt + reaction) {
        input.move = axisInput(plan.x + sign * 0.3 + d.posError - athlete.x, athlete.vx)
        input.moveZ = axisInput(plan.z + d.posErrorZ - athlete.z, athlete.vz)
      }

      // Defesa: aperta DEFENDER no tempo sorteado.
      if (d.defenseAt !== null && !d.defensePressed && now >= d.defenseAt) {
        d.defensePressed = true
        input.forte = true
      }

      // Ataque: escolhe e aperta pouco antes do contato; no contato, a direção é a mira.
      if (plan.touchIndex === 3) {
        if (!d.attackPressed && now >= plan.tIdeal - ATTACK_PRESS_LEAD) {
          d.attackPressed = true
          Object.assign(d, chooseAttack(s))
          input[d.attackButton] = true
        }
        if (d.attackPressed && now >= plan.tIdeal - 1.5 * DT) Object.assign(input, inputForAim(d.aim))
      }
      return input
    },
  }
}
