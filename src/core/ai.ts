import { BALANCE } from '../data/balance'
import { DT, IDLE, type MatchState, type TeamInput } from './match'
import type { Rng } from './rng'
import type { Side } from './rules'
import { isMeterFull } from './specialMeter'

export type Personality = 'equilibrado' | 'gostaDePingo' | 'bateForte' | 'paredao'

export type SkillParams = {
  /** Desvio padrão do erro de timing (segundos). */
  timingSigma: number
  reactionDelay: number
  /** Chance de "ler" a defesa e escolher o ataque certo. */
  readChance: number
  /** Desvio padrão do erro na força do ataque. */
  forceSigma: number
  sharkDefenseChance: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function skillParams(skill: number): SkillParams {
  const k = Math.min(1, Math.max(0, skill))
  return {
    timingSigma: lerp(0.16, 0.03, k),
    reactionDelay: lerp(0.35, 0.08, k),
    readChance: k,
    forceSigma: lerp(0.35, 0.05, k),
    sharkDefenseChance: lerp(0.02, 0.15, k),
  }
}

const PINGO_BIAS: Record<Personality, number> = { equilibrado: 0, gostaDePingo: 0.25, bateForte: -0.2, paredao: 0 }
const RANDOM_PINGO_CHANCE = 0.3
/** Defensor mais perto da rede além disso: o Pingo é o ataque certo. */
const DEEP_DEFENSE = 4.5
const PINGO_HOLD_MS = 90
const SERVE_WAIT_SEC = 1
/** Placar a partir do qual a IA forte solta o Sharkataque guardado. */
const DECISIVE_POINTS = 9

/** Força (0..1) que manda a bola para a profundidade mais longe dos dois defensores. */
export function gapForce(defenderDists: number[]): number {
  let best = 0
  let bestGap = -1
  for (let f = 0; f <= 1.0001; f += 0.05) {
    const depth = 1.5 + 6.5 * f
    const gap = Math.min(...defenderDists.map((d) => Math.abs(d - depth)))
    if (gap > bestGap) {
      bestGap = gap
      best = f
    }
  }
  return best
}

type Decision ={ key: string; button: 'recepcao' | 'ataque' | 'nada'; at: number; holdMs: number; done: boolean }

export type AIController = { think(s: MatchState): TeamInput }

export function createAI(team: Side, skill: number, personality: Personality, rng: Rng): AIController {
  const p = skillParams(skill)
  let decision: Decision | null = null
  let serveHoldMs: number | null = null

  const decide = (s: MatchState, key: string): Decision => {
    const plan = s.plan!
    const sigma = p.timingSigma * (personality === 'paredao' && plan.touchIndex === 1 ? 0.85 : 1)
    let offset = rng.normal(0, sigma)
    if (plan.incomingShark) {
      // Só defende o Sharkataque com a chance da habilidade; quando defende, acerta o Perfeito.
      if (rng.next() >= p.sharkDefenseChance) return { key, button: 'nada', at: 0, holdMs: 0, done: true }
      offset = 0
    }
    const at = plan.tIdeal + offset
    if (plan.touchIndex < 3) return { key, button: 'recepcao', at, holdMs: 0, done: false }

    const defenders = s.athletes.filter((a) => a.team !== team).map((a) => Math.abs(a.x))
    const optimalPingo = Math.min(...defenders) > DEEP_DEFENSE
    const base = rng.next() < p.readChance ? (optimalPingo ? 1 : 0) : RANDOM_PINGO_CHANCE
    let pingo = rng.next() < base + PINGO_BIAS[personality]
    // Guarda o Sharkataque para o fim do set, mas só troca por Pingo quando o Pingo também é bom.
    const saveShark =
      isMeterFull(s.meter[team]) && skill >= 0.5 && Math.max(...s.score.points) < DECISIVE_POINTS && optimalPingo
    if (saveShark) pingo = true
    if (pingo) return { key, button: 'ataque', at, holdMs: PINGO_HOLD_MS, done: false }

    // Mira: quem lê a defesa escolhe a profundidade do maior buraco; senão bate no padrão.
    const aimed = rng.next() < p.readChance ? gapForce(defenders) : personality === 'bateForte' ? 0.9 : 0.8
    const force = Math.max(0.05, aimed + rng.normal(0, p.forceSigma))
    const holdMs = BALANCE.hold.pingoMaxMs + force * BALANCE.hold.forceRampMs
    return { key, button: 'ataque', at, holdMs, done: false }
  }

  const input = (ataque: boolean, recepcao = false): TeamInput => ({ recepcao, ataque })

  return {
    think(s: MatchState): TeamInput {
      // O step soma dt antes de ler a entrada.
      const now = s.time + DT

      if (s.phase === 'saque') {
        decision = null
        if (s.score.servingTeam !== team) return IDLE
        serveHoldMs ??= 350 + rng.range(0, 400)
        const start = SERVE_WAIT_SEC
        const t = s.phaseT + DT
        return input(t >= start && t < start + serveHoldMs / 1000)
      }
      serveHoldMs = null

      const plan = s.plan
      if (s.phase !== 'rally' || !plan || plan.team !== team) return IDLE
      const key = `${plan.athleteId}:${plan.tIdeal.toFixed(4)}`
      if (decision?.key !== key) decision = decide(s, key)
      const d = decision
      if (d.done || d.button === 'nada') return IDLE

      if (now >= d.at - DT / 2) {
        d.done = true
        return input(false, d.button === 'recepcao')
      }
      if (d.button === 'ataque') return input(now >= d.at - d.holdMs / 1000 - DT / 2)
      return IDLE
    },
  }
}
