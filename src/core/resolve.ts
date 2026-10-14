import { BALANCE } from '../data/balance'
import { reachOf, replan, setAction } from './contact'
import type { AthleteAction, ContactPlan, MatchEvent, MatchState, TeamInput } from './match'
import { registerTouch } from './rules'
import { addMeter, isMeterFull } from './specialMeter'
import { type Aim, aimFromMove, outgoing, type Quality, type TouchAction } from './touch'

export type Edges = { forteDown: boolean; forteUp: boolean; pingoDown: boolean; sharkDown: boolean }

const AUTO: Record<1 | 2, TouchAction> = { 1: 'passe', 2: 'levantada' }

const VISUAL: Partial<Record<TouchAction, AthleteAction>> = { forte: 'cabeca', pingo: 'pingo', sharkataque: 'sharkataque' }

/** Executa um toque: lança a bola, conta o toque, barra, eventos e replaneja. */
export function executeTouch(
  s: MatchState,
  plan: ContactPlan,
  action: TouchAction,
  quality: Quality,
  aim: Aim,
  events: MatchEvent[],
  from = { x: plan.x, y: plan.y },
): void {
  const team = plan.team
  const shark = action === 'sharkataque'
  const origin = { x: from.x, y: from.y + (shark ? BALANCE.sharkExtraHeight : 0) }
  const v = outgoing({ action, team, from: origin, quality, aim }, s.rng)
  s.ball = { ...origin, vx: v.vx, vy: v.vy }
  s.touch = registerTouch(s.touch, plan.athleteId)

  s.meter[team] = addMeter(s.meter[team], BALANCE.meter.toque)
  if (plan.incoming === 'forte') s.meter[team] = addMeter(s.meter[team], BALANCE.meter.defesaForte)

  events.push({ type: 'toque', athleteId: plan.athleteId, action, quality })
  if (shark) {
    s.meter[team] = 0
    events.push({ type: 'sharkataque', athleteId: plan.athleteId })
  }
  s.lastAttack = action === 'forte' || shark ? { team, kind: shark ? 'shark' : 'forte' } : null
  const visual = quality === 'peixinho' ? 'peixinho' : (VISUAL[action] ?? plan.kind)
  setAction(s.athletes[plan.athleteId], visual)
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
    return true
  }
  const aim = aimFromMove(team, inputs[team].move)
  s.slowMo.aim = aim
  const e = edges[team]
  const choice: TouchAction | null =
    e.sharkDown && isMeterFull(s.meter[team]) ? 'sharkataque' : e.forteDown ? 'forte' : e.pingoDown ? 'pingo' : null
  if (choice) executeTouch(s, plan, choice, 'normal', aim, events, { x: s.ball.x, y: s.ball.y })
  else if (s.time >= plan.tIdeal) executeTouch(s, plan, 'fraco', 'normal', aim, events)
  return true
}

/** Escolha de ataque registrada pelas bordas dos botões (a última vale). */
function recordChoice(s: MatchState, plan: ContactPlan, e: Edges): void {
  if (e.pingoDown) plan.choice = 'pingo'
  if (e.forteDown) plan.choice = 'forte'
  if (e.sharkDown && isMeterFull(s.meter[plan.team])) plan.choice = 'sharkataque'
}

/** Resolve o contato do plano atual: toque automático, peixinho ou bola perdida. */
export function resolveContact(s: MatchState, inputs: [TeamInput, TeamInput], edges: [Edges, Edges], events: MatchEvent[]): void {
  const plan = s.plan
  if (!plan) return
  const team = plan.team
  if (slowMoAttack(s, plan, inputs, edges, events)) return
  if (plan.touchIndex === 3) recordChoice(s, plan, edges[team])
  if (s.time < plan.tIdeal) return

  const athlete = s.athletes[plan.athleteId]
  const d = Math.abs(athlete.x - plan.x)
  const aim = aimFromMove(team, inputs[team].move)
  const action: TouchAction = plan.touchIndex === 3 ? (plan.choice ?? 'fraco') : AUTO[plan.touchIndex]

  if (!plan.resolving) {
    plan.resolving = true
    if (d <= reachOf(s, plan.athleteId)) {
      executeTouch(s, plan, action, 'normal', aim, events)
      return
    }
  }

  // Peixinho: botão esquerdo apertado perto do contato e bola a até 2,2 m.
  const pressAt = s.buttons[team].fortePressAt
  const dive = BALANCE.dive
  if (d <= dive.reach && pressAt !== null && pressAt >= plan.tIdeal - dive.before) {
    athlete.x = plan.x
    executeTouch(s, plan, plan.touchIndex === 3 ? 'fraco' : action, 'peixinho', 'meio', events)
    return
  }
  if (s.time > plan.tIdeal + dive.after) {
    events.push({ type: 'perdeu', athleteId: plan.athleteId })
    s.plan = null
  }
}

/** Enquanto o toque ainda pode acontecer, a bola não "cai" (ele sai do ponto planejado). */
export function touchStillPossible(s: MatchState): boolean {
  const plan = s.plan
  return plan !== null && s.time <= plan.tIdeal + BALANCE.dive.after
}
