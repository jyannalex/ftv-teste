import { type ArenaId, arenaForRound } from '../data/arenas'
import { type Difficulty, DIFFICULTY_SKILL } from '../data/difficulty'
import { AI_TEAMS } from '../data/teams'
import type { Rng } from './rng'

export const PLAYER_ID = 'jogador'

export type BracketMatch = { a: string; b: string; winner: string | null }

export type Tournament = {
  difficulty: Difficulty
  player: { name: string; shirt: number }
  /** As 8 duplas, incluindo 'jogador'. */
  teamIds: string[]
  /** Quartas (4 jogos), semi (2) e final (1), preenchidas conforme avança. */
  rounds: BracketMatch[][]
  currentRound: 0 | 1 | 2
  status: 'andamento' | 'eliminado' | 'campeao'
}

function shuffle<T>(xs: T[], rng: Rng): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const pair = (ids: string[]): BracketMatch[] =>
  Array.from({ length: ids.length / 2 }, (_, i) => ({ a: ids[2 * i], b: ids[2 * i + 1], winner: null }))

export function createTournament(difficulty: Difficulty, player: { name: string; shirt: number }, rng: Rng): Tournament {
  const teamIds = shuffle([PLAYER_ID, ...AI_TEAMS.map((t) => t.id)], rng)
  return { difficulty, player, teamIds, rounds: [pair(teamIds)], currentRound: 0, status: 'andamento' }
}

const playerGame = (t: Tournament) => t.rounds[t.currentRound].find((m) => m.a === PLAYER_ID || m.b === PLAYER_ID)

export function playerMatch(t: Tournament): { opponentId: string; round: 0 | 1 | 2; skill: number; arena: ArenaId } | null {
  if (t.status !== 'andamento') return null
  const m = playerGame(t)
  if (!m) return null
  const round = t.currentRound
  return {
    opponentId: m.a === PLAYER_ID ? m.b : m.a,
    round,
    skill: DIFFICULTY_SKILL[t.difficulty][round],
    arena: arenaForRound(round),
  }
}

/** Registra o resultado do jogador, sorteia os outros jogos da rodada e monta a próxima. */
export function recordPlayerResult(t: Tournament, playerWon: boolean, rng: Rng): Tournament {
  const next: Tournament = structuredClone(t)
  if (next.status !== 'andamento') return next
  const round = next.rounds[next.currentRound]
  for (const m of round) {
    const hasPlayer = m.a === PLAYER_ID || m.b === PLAYER_ID
    if (hasPlayer) m.winner = playerWon ? PLAYER_ID : m.a === PLAYER_ID ? m.b : m.a
    else m.winner = rng.next() < 0.5 ? m.a : m.b
  }
  if (!playerWon) {
    next.status = 'eliminado'
    return next
  }
  if (next.currentRound === 2) {
    next.status = 'campeao'
    return next
  }
  next.rounds.push(pair(round.map((m) => m.winner!)))
  next.currentRound = (next.currentRound + 1) as 1 | 2
  return next
}
