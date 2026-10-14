import { BALANCE } from '../data/balance'
import { reachOf, replan, setAction } from './contact'
import type { AthleteAction, ContactPlan, MatchEvent, MatchState, TeamInput } from './match'
import { registerTouch } from './rules'
import { addMeter, isMeterFull } from './specialMeter'
import { type Aim, aimFromMove, outgoing, type TouchAction } from './touch'

export type Edges = { forteDown: boolean; forteUp: boolean; pingoDown: boolean; sharkDown: boolean; trocaDown: boolean }

const AUTO: Record<1 | 2, TouchAction> = { 1: 'passe', 2: 'levantada' }

const VISUAL: Partial<Record<TouchAction, AthleteAction>> = { forte: 'cabeca', pingo: 'pingo', sharkataque: 'sharkataque' }

/** Executa um toque: lança a bola, conta o toque, barra, eventos e replaneja. */
export function executeTouch(
  s: MatchState,
  plan: ContactPlan,
  action: TouchAction,
  aim: Aim,
  events: MatchEvent[],
  from = { x: plan.x, y: plan.y },
  precise = false,
): void {
  const team = plan.team
  const shark = action === 'sharkataque'
  const origin = { x: from.x, y: from.y + (shark ? BALANCE.sharkExtraHeight : 0) }
  const v = outgoing({ action, team, from: origin, aim, precise }, s.rng)
  s.ball = { ...origin, vx: v.vx, vy: v.vy }
  s.touch = registerTouch(s.touch, plan.athleteId)

  s.meter[team] = addMeter(s.meter[team], BALANCE.meter.toque)
  if (plan.incoming === 'forte') s.meter[team] = addMeter(s.meter[team], BALANCE.meter.defesaForte)

  events.push({ type: 'toque', athleteId: plan.athleteId, action })
  if (shark) {
    s.meter[team] = 0
    events.push({ type: 'sharkataque', athleteId: plan.athleteId })
  }
  s.lastAttack =
    action === 'forte' || action === 'pingo' || shark ? { team, kind: shark ? 'shark' : action === 'pingo' ? 'pingo' : 'forte' } : null
  setAction(s.athletes[plan.athleteId], VISUAL[action] ?? plan.kind)
  s.slowMo = null
  replan(s)
}

/** Duração da câmera lenta em tempo de jogo. */
export const slowMoLead = (s: MatchState): number => s.config.slowMoSec * BALANCE.slowMo.scale

/**
 * Ataque do jogador: pula em tIdeal − lead (se perto), entra em câmera lenta e executa a primeira
 * escolha nova. Devolve true quando cuidou do passo.
 */
function slowMoAttack(s: MatchState, plan: ContactPlan, inputs: [TeamInput, TeamInput], edges: [Edges, Edges], events: MatchEvent[]): boolean {
  const team = plan.team
  if (plan.touchIndex !== 3 || team !== s.config.humanTeam || plan.athleteId !== s.controlled) return false
  const athlete = s.athletes[plan.athleteId]
  if (!s.slowMo) {
    if (plan.jumpChecked || s.time < plan.tIdeal - slowMoLead(s)) return false
    plan.jumpChecked = true
    if (Math.abs(athlete.x - plan.x) > BALANCE.slowMo.jumpMaxDist) return false
    athlete.x = plan.x
    setAction(athlete, 'cabeca')
    s.slowMo = { athleteId: plan.athleteId, aim: aimFromMove(team, inputs[team].move) }
    // Segue: um aperto neste mesmo passo já vale como escolha.
  }
  const aim = aimFromMove(team, inputs[team].move)
  s.slowMo.aim = aim
  const e = edges[team]
  const choice: TouchAction | null =
    e.sharkDown && isMeterFull(s.meter[team]) ? 'sharkataque' : e.forteDown ? 'forte' : e.pingoDown ? 'pingo' : null
  if (choice) executeTouch(s, plan, choice, aim, events, { x: s.ball.x, y: s.ball.y })
  else if (s.time >= plan.tIdeal) executeTouch(s, plan, 'fraco', aim, events)
  return true
}

/** Escolha de ataque registrada pelas bordas dos botões (a última vale). */
function recordChoice(s: MatchState, plan: ContactPlan, e: Edges): void {
  if (e.pingoDown) plan.choice = 'pingo'
  if (e.forteDown) plan.choice = 'forte'
  if (e.sharkDown && isMeterFull(s.meter[plan.team])) plan.choice = 'sharkataque'
}

/** Resolve o contato do plano atual: toque automático se o atleta estiver no lugar, senão a bola cai. */
export function resolveContact(s: MatchState, inputs: [TeamInput, TeamInput], edges: [Edges, Edges], events: MatchEvent[]): void {
  const plan = s.plan
  if (!plan) return
  const team = plan.team
  if (slowMoAttack(s, plan, inputs, edges, events)) return
  if (plan.touchIndex === 3) recordChoice(s, plan, edges[team])
  if (plan.incoming && plan.touchIndex === 1) return defend(s, plan, inputs, events)
  if (s.time < plan.tIdeal) return

  const d = Math.abs(s.athletes[plan.athleteId].x - plan.x)
  if (d <= reachOf(s, plan.athleteId)) {
    const action: TouchAction = plan.touchIndex === 3 ? (plan.choice ?? 'fraco') : AUTO[plan.touchIndex]
    executeTouch(s, plan, action, aimFromMove(team, inputs[team].move), events)
    return
  }
  events.push({ type: 'perdeu', athleteId: plan.athleteId })
  s.plan = null
}

/**
 * Defesa de ataque (forte/Pingo): precisa do botão DEFENDER (esquerdo) perto do contato e o atleta
 * a até 1,5 m da bola. Bem no tempo é DEFESAÇA (passe perfeito e bônus).
 */
function defend(s: MatchState, plan: ContactPlan, inputs: [TeamInput, TeamInput], events: MatchEvent[]): void {
  const def = BALANCE.defense
  const press = s.buttons[plan.team].fortePressAt
  const offset = press === null ? Infinity : press - plan.tIdeal
  const pressed = press !== null && Math.abs(offset) <= def.window && press >= plan.createdAt
  const d = Math.abs(s.athletes[plan.athleteId].x - plan.x)
  if (pressed && s.time >= plan.tIdeal && d <= def.reach) {
    const perfeita = Math.abs(offset) <= def.perfect
    if (perfeita) s.meter[plan.team] = addMeter(s.meter[plan.team], BALANCE.meter.defesaPerfeita)
    events.push({ type: 'defesa', athleteId: plan.athleteId, perfeita })
    executeTouch(s, plan, 'passe', aimFromMove(plan.team, inputs[plan.team].move), events, { x: plan.x, y: plan.y }, perfeita)
    return
  }
  if (s.time > plan.tIdeal + def.window) {
    events.push({ type: 'perdeu', athleteId: plan.athleteId })
    s.plan = null
  }
}

/** Enquanto o toque ainda pode acontecer, a bola não "cai" (ele sai do ponto planejado). */
export function touchStillPossible(s: MatchState): boolean {
  const plan = s.plan
  if (!plan) return false
  const grace = plan.incoming && plan.touchIndex === 1 ? BALANCE.defense.window : BALANCE.contactGrace
  return s.time <= plan.tIdeal + grace
}
