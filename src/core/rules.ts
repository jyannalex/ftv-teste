import { BALANCE } from '../data/balance'

/** 0 = time da esquerda (jogador), 1 = time da direita. */
export type Side = 0 | 1

export const sideSign = (s: Side): -1 | 1 => (s === 0 ? -1 : 1)
export const sideOf = (x: number): Side => (x < 0 ? 0 : 1)
export const other = (s: Side): Side => (s === 0 ? 1 : 0)
/** Atletas 0 e 1 são do time 0; 2 e 3 do time 1. */
export const partner = (id: number): number => id ^ 1
export const teamOf = (id: number): Side => (id < 2 ? 0 : 1)

export type TouchState = { team: Side | null; count: number; lastAthlete: number | null }

export function canTouch(t: TouchState, athleteId: number): boolean {
  if (teamOf(athleteId) !== t.team) return true
  return t.count < 3 && t.lastAthlete !== athleteId
}

export function registerTouch(t: TouchState, athleteId: number): TouchState {
  const team = teamOf(athleteId)
  return { team, count: team === t.team ? t.count + 1 : 1, lastAthlete: athleteId }
}

export type PointReason = 'chao' | 'fora' | 'falta'

export function resolveLanding(x: number, t: TouchState): { winner: Side; reason: PointReason } {
  if (Math.abs(x) <= BALANCE.halfCourt) {
    const owner = sideOf(x)
    return { winner: other(owner), reason: t.team === owner && t.count >= 3 ? 'falta' : 'chao' }
  }
  // Fora: perde quem tocou por último.
  const loser = t.team ?? sideOf(x)
  return { winner: other(loser), reason: 'fora' }
}

export type ScoreState = {
  points: [number, number]
  servingTeam: Side
  /** Atleta que saca agora. */
  server: number
  /** Quem saca da próxima vez que cada time recuperar o saque. */
  nextServer: [number, number]
}

export const initialScore = (): ScoreState => ({ points: [0, 0], servingTeam: 0, server: 0, nextServer: [1, 2] })

export function awardPoint(s: ScoreState, winner: Side): ScoreState {
  const points: [number, number] = [...s.points]
  points[winner]++
  if (winner === s.servingTeam) return { ...s, points }
  const server = s.nextServer[winner]
  const nextServer: [number, number] = [...s.nextServer]
  nextServer[winner] = partner(server)
  return { points, servingTeam: winner, server, nextServer }
}

export function setWinner(points: [number, number], target: number): Side | null {
  const [a, b] = points
  if (a >= target && a - b >= 2) return 0
  if (b >= target && b - a >= 2) return 1
  return null
}
