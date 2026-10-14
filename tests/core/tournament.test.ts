import { describe, expect, it } from 'vitest'
import { createRng } from '../../src/core/rng'
import { createTournament, playerMatch, recordPlayerResult } from '../../src/core/tournament'
import { arenaForRound } from '../../src/data/arenas'
import { quickMatchSkill } from '../../src/data/difficulty'
import { AI_TEAMS } from '../../src/data/teams'

const t0 = () => createTournament('medio', { name: 'Os Brabos', shirt: 0xff0000 }, createRng(1))

describe('campeonato', () => {
  it('7 duplas adversárias com ids e nomes únicos', () => {
    expect(AI_TEAMS).toHaveLength(7)
    expect(new Set(AI_TEAMS.map((t) => t.id)).size).toBe(7)
    expect(new Set(AI_TEAMS.map((t) => t.name)).size).toBe(7)
  })

  it('8 duplas distintas, uma é o jogador, 4 jogos nas quartas', () => {
    const t = t0()
    expect(new Set(t.teamIds).size).toBe(8)
    expect(t.teamIds.filter((id) => id === 'jogador')).toHaveLength(1)
    expect(t.rounds[0]).toHaveLength(4)
    expect(t.status).toBe('andamento')
  })

  it('vencer avança com os vencedores da rodada anterior', () => {
    const t = recordPlayerResult(t0(), true, createRng(2))
    expect(t.currentRound).toBe(1)
    expect(t.rounds[1]).toHaveLength(2)
    const winners = t.rounds[0].map((m) => m.winner)
    expect(winners).toContain('jogador')
    expect(t.rounds[1].flatMap((m) => [m.a, m.b]).sort()).toEqual([...winners].sort())
  })

  it('perder elimina', () => {
    const t = recordPlayerResult(t0(), false, createRng(2))
    expect(t.status).toBe('eliminado')
    expect(playerMatch(t)).toBeNull()
  })

  it('três vitórias = campeão', () => {
    let t = t0()
    for (let i = 0; i < 3; i++) t = recordPlayerResult(t, true, createRng(i))
    expect(t.status).toBe('campeao')
    expect(t.rounds[2][0].winner).toBe('jogador')
    expect(playerMatch(t)).toBeNull()
  })

  it('habilidade e cenário por rodada', () => {
    let t = t0()
    expect(playerMatch(t)).toMatchObject({ round: 0, skill: 0.45, arena: 'praia' })
    t = recordPlayerResult(recordPlayerResult(t, true, createRng(1)), true, createRng(2))
    expect(playerMatch(t)).toMatchObject({ round: 2, skill: 0.65, arena: 'arena' })
    expect(arenaForRound(1)).toBe('clube')
  })

  it('partida rápida usa o valor da semi', () => {
    expect(quickMatchSkill('dificil')).toBe(0.8)
  })

  it('não altera o campeonato recebido', () => {
    const t = t0()
    const copy = JSON.parse(JSON.stringify(t))
    recordPlayerResult(t, true, createRng(2))
    expect(t).toEqual(copy)
  })
})
