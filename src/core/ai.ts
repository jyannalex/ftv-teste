import { BALANCE } from '../data/balance'
import { DT, IDLE, type MatchState, type TeamInput } from './match'
import type { Rng } from './rng'
import { type Side, sideSign } from './rules'
import { isMeterFull } from './specialMeter'
import type { Aim } from './touch'

export type Personality = 'equilibrado' | 'gostaDePingo' | 'bateForte' | 'paredao'

export type SkillParams = {
  /** Atraso para começar a correr (s). */
  reactionDelay: number
  /** Desvio padrão do erro de posicionamento (m). */
  posError: number
  /** Chance de "ler" a defesa na escolha e na mira do ataque. */
  readChance: number
}

const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t

export function skillParams(skill: number): SkillParams {
  const k = Math.min(1, Math.max(0, skill))
  return {
    reactionDelay: lerp(0.35, 0.08, k),
    posError: lerp(1.0, 0.1, k),
    readChance: k,
  }
}

const AIMS: Aim[] = ['curto', 'meio', 'fundo']

/** Mira para a profundidade mais longe dos dois defensores (distâncias da rede). */
export function bestAim(defenderDists: number[]): Aim {
  let best: Aim = 'meio'
  let bestGap = -1
  for (const aim of AIMS) {
    const gap = Math.min(...defenderDists.map((d) => Math.abs(d - BALANCE.aimDepth[aim])))
    if (gap > bestGap) {
      bestGap = gap
      best = aim
    }
  }
  return best
}

const PINGO_BIAS: Record<Personality, number> = { equilibrado: 0, gostaDePingo: 0.25, bateForte: -0.2, paredao: 0 }
const RANDOM_PINGO_CHANCE = 0.3
/** Defensor mais perto da rede além disso: o Pingo é o ataque certo. */
const DEEP_DEFENSE = 4.5
/** Placar a partir do qual a IA forte solta o Sharkataque guardado. */
const DECISIVE_POINTS = 9
const SERVE_WAIT_SEC = 1
const SERVE_HOLD_SEC = 0.1
/** Antecedência do aperto do ataque (s). */
const ATTACK_PRESS_LEAD = 0.15
const ARRIVE_TOLERANCE = 0.1

type Decision = {
  key: string
  posError: number
  attackPressed: boolean
  attackButton: 'forte' | 'pingo' | 'shark'
  aim: Aim
}

export type AIController = { think(s: MatchState): TeamInput }

export function createAI(team: Side, skill: number, personality: Personality, rng: Rng): AIController {
  const p = skillParams(skill)
  const sign = sideSign(team)
  let decision: Decision | null = null
  let serveAim: Aim | null = null

  /** Direção na tela que dá essa mira para este time. */
  const moveForAim = (aim: Aim): -1 | 0 | 1 => (aim === 'meio' ? 0 : aim === 'curto' ? (-sign as -1 | 1) : (sign as -1 | 1))

  const chooseAttack = (s: MatchState): Pick<Decision, 'attackButton' | 'aim'> => {
    const defenders = s.athletes.filter((a) => a.team !== team).map((a) => Math.abs(a.x))
    const reads = rng.next() < p.readChance
    const deep = Math.min(...defenders) > DEEP_DEFENSE
    const pingoChance = (reads ? (deep ? 1 : 0) : RANDOM_PINGO_CHANCE) + PINGO_BIAS[personality]
    const aim = rng.next() < p.readChance ? bestAim(defenders) : AIMS[Math.floor(rng.next() * 3)]
    const saveShark = skill >= 0.5 && Math.max(...s.score.points) < DECISIVE_POINTS
    if (isMeterFull(s.meter[team]) && !saveShark) return { attackButton: 'shark', aim }
    if (rng.next() < pingoChance) return { attackButton: 'pingo', aim: 'meio' }
    return { attackButton: 'forte', aim }
  }

  return {
    think(s: MatchState): TeamInput {
      // O step soma dt antes de ler a entrada.
      const now = s.time + (s.slowMo ? DT * BALANCE.slowMo.scale : DT)

      if (s.phase === 'saque') {
        decision = null
        if (s.score.servingTeam !== team) return IDLE
        serveAim ??= AIMS[Math.floor(rng.next() * 3)]
        const t = s.phaseT + DT
        if (t < SERVE_WAIT_SEC) return IDLE
        if (t < SERVE_WAIT_SEC + SERVE_HOLD_SEC) return { ...IDLE, forte: true }
        return { ...IDLE, move: moveForAim(serveAim) }
      }
      serveAim = null

      const plan = s.plan
      if (s.phase !== 'rally' || !plan || plan.team !== team) return IDLE
      const key = `${plan.athleteId}:${plan.createdAt.toFixed(4)}`
      if (decision?.key !== key) {
        const error = rng.normal(0, p.posError * (personality === 'paredao' ? 0.7 : 1))
        decision = { key, posError: error, attackPressed: false, attackButton: 'forte', aim: 'meio' }
      }
      const d = decision
      const athlete = s.athletes[plan.athleteId]
      const input: TeamInput = { ...IDLE }

      // Corre até o ponto de contato (com o erro sorteado), depois do tempo de reação.
      const reaction = p.reactionDelay + (plan.incoming === 'forte' ? BALANCE.vsForte.aiExtraReaction : 0)
      if (now >= plan.createdAt + reaction) {
        const target = plan.x + sign * 0.3 + d.posError
        const gap = target - athlete.x
        // Freia a tempo: para de andar quando a distância de frenagem cobre o que falta.
        const movingToward = Math.sign(athlete.vx) === Math.sign(gap)
        const stopDist = movingToward ? (athlete.vx * athlete.vx) / (2 * BALANCE.move.decel) : 0
        if (Math.abs(gap) > ARRIVE_TOLERANCE + stopDist) input.move = gap > 0 ? 1 : -1
      }

      // Ataque: escolhe e aperta pouco antes do contato; no contato, a direção é a mira.
      if (plan.touchIndex === 3) {
        if (!d.attackPressed && now >= plan.tIdeal - ATTACK_PRESS_LEAD) {
          d.attackPressed = true
          Object.assign(d, chooseAttack(s))
          input[d.attackButton] = true
        }
        if (d.attackPressed && now >= plan.tIdeal - 1.5 * DT) input.move = moveForAim(d.aim)
      }
      return input
    },
  }
}
