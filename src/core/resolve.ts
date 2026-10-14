import { BALANCE } from '../data/balance'
import { isPartnerAI, planeDist, reachDist, reachOf, replan, setAction } from './contact'
import type { AthleteAction, ContactPlan, MatchEvent, MatchState, TeamInput } from './match'
import { partner, registerTouch } from './rules'
import { addMeter, isMeterFull } from './specialMeter'
import { type AimTarget, aimFromInput, outgoing, type TouchAction } from './touch'

export type Edges = { forteDown: boolean; forteUp: boolean; pingoDown: boolean; sharkDown: boolean; trocaDown: boolean }

const AUTO: Record<1 | 2, TouchAction> = { 1: 'passe', 2: 'levantada' }

const VISUAL: Partial<Record<TouchAction, AthleteAction>> = { forte: 'cabeca', pingo: 'pingo', sharkataque: 'sharkataque' }

/** Executa um toque: lança a bola, conta o toque, barra, eventos e replaneja. */
export function executeTouch(
  s: MatchState,
  plan: ContactPlan,
  action: TouchAction,
  target: AimTarget,
  events: MatchEvent[],
  from = { x: plan.x, y: plan.y, z: plan.z },
  precise = false,
): void {
  const team = plan.team
  const shark = action === 'sharkataque'
  const origin = { x: from.x, y: from.y + (shark ? BALANCE.sharkExtraHeight : 0), z: from.z }
  // Passe e levantada sobem para o parceiro, que vai fazer o próximo toque.
  const toZ = s.athletes[partner(plan.athleteId)].z
  const v = outgoing({ action, team, from: origin, aim: target.aim, lane: target.lane, toZ, precise }, s.rng)
  s.ball = { ...origin, vx: v.vx, vy: v.vy, vz: v.vz }
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
    if (planeDist(athlete, plan) > BALANCE.slowMo.jumpMaxDist) return false
    athlete.x = plan.x
    athlete.z = plan.z
    athlete.vx = 0
    athlete.vz = 0
    setAction(athlete, 'cabeca')
    s.slowMo = { athleteId: plan.athleteId, aim: aimFromInput(team, inputs[team]) }
    // Segue: um aperto neste mesmo passo já vale como escolha.
  }
  const aim = aimFromInput(team, inputs[team])
  s.slowMo.aim = aim
  const e = edges[team]
  const choice: TouchAction | null =
    e.sharkDown && isMeterFull(s.meter[team]) ? 'sharkataque' : e.forteDown ? 'forte' : e.pingoDown ? 'pingo' : null
  if (choice) executeTouch(s, plan, choice, aim, events, { x: s.ball.x, y: s.ball.y, z: s.ball.z })
  else if (s.time >= plan.tIdeal) executeTouch(s, plan, 'fraco', aim, events)
  // A direção da mira continua segurada depois do ataque: não faz o atleta correr.
  if (!s.slowMo) s.buttons[team].moveLock = { move: inputs[team].move, moveZ: inputs[team].moveZ }
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

  if (reachDist(s.athletes[plan.athleteId], plan) <= reachOf(s, plan.athleteId)) {
    const action: TouchAction = plan.touchIndex === 3 ? (plan.choice ?? 'fraco') : AUTO[plan.touchIndex]
    executeTouch(s, plan, action, aimFromInput(team, inputs[team]), events)
    return
  }
  events.push({ type: 'perdeu', athleteId: plan.athleteId })
  s.plan = null
}

/**
 * Defesa de ataque (forte/Pingo). Dentro do alcance normal o atleta defende sozinho (passe comum);
 * o botão DEFENDER perto do contato estica o alcance até `defense.reach` m e, bem no tempo, é DEFESAÇA.
 */
function defend(s: MatchState, plan: ContactPlan, inputs: [TeamInput, TeamInput], events: MatchEvent[]): void {
  const def = BALANCE.defense
  const press = (isPartnerAI(s, plan.athleteId) ? s.partnerButtons : s.buttons[plan.team]).fortePressAt
  const offset = press === null ? Infinity : press - plan.tIdeal
  const pressed = press !== null && Math.abs(offset) <= def.window && press >= plan.createdAt
  const d = reachDist(s.athletes[plan.athleteId], plan)
  if (pressed && s.time >= plan.tIdeal && d <= def.reach) {
    const perfeita = Math.abs(offset) <= def.perfect
    if (perfeita) s.meter[plan.team] = addMeter(s.meter[plan.team], BALANCE.meter.defesaPerfeita)
    events.push({ type: 'defesa', athleteId: plan.athleteId, perfeita })
    executeTouch(s, plan, 'passe', aimFromInput(plan.team, inputs[plan.team]), events, undefined, perfeita)
    return
  }
  if (!pressed && s.time >= plan.tIdeal && d <= reachOf(s, plan.athleteId)) {
    executeTouch(s, plan, 'passe', aimFromInput(plan.team, inputs[plan.team]), events)
    return
  }
  if (s.time > plan.tIdeal + def.window) {
    events.push({ type: 'perdeu', athleteId: plan.athleteId })
    s.plan = null
  }
}
