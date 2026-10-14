import type { AthleteAction } from '../../core/match'

/**
 * Ângulos das juntas em radianos. Membros: 0 = apontando para baixo, positivo = para a frente
 * (em direção à rede). Canelas e cabeça são relativas ao segmento pai.
 * rootY: altura do pulo (m). rootRot: giro do corpo inteiro (negativo = para trás).
 */
export type Pose = {
  tronco: number
  cabeca: number
  bracoE: number
  bracoD: number
  coxaE: number
  canelaE: number
  coxaD: number
  canelaD: number
  rootY: number
  rootRot: number
}

const BASE: Pose = { tronco: 0, cabeca: 0, bracoE: -0.15, bracoD: 0.15, coxaE: -0.08, canelaE: 0, coxaD: 0.08, canelaD: 0, rootY: 0, rootRot: 0 }

type Key = [number, Partial<Pose>]

/** Duração de cada ação em segundos (para converter actionT em 0..1). */
export const ACTION_DURATION: Record<AthleteAction, number> = {
  parado: 1.2,
  correndo: 0.5,
  chapa: 0.45,
  peito: 0.45,
  cabeca: 0.6,
  pingo: 0.55,
  sharkataque: 0.9,
  saque: 0.5,
  comemorando: 1.0,
  peixinho: 0.8,
}

/** Ações que se repetem em ciclo; as outras param no último quadro. */
export const LOOPING: Partial<Record<AthleteAction, true>> = { parado: true, correndo: true, comemorando: true }

const KEYS: Record<Exclude<AthleteAction, 'correndo'>, Key[]> = {
  parado: [
    [0, { canelaE: 0.1, canelaD: -0.1 }],
    [0.5, { tronco: 0.05, canelaE: 0.2, canelaD: 0.05 }],
    [1, { canelaE: 0.1, canelaD: -0.1 }],
  ],
  chapa: [
    [0, { coxaD: -0.2, canelaD: 0.3 }],
    [0.4, { tronco: -0.15, coxaD: 1.1, canelaD: -0.4, bracoE: -0.8, bracoD: 0.6 }],
    [1, { coxaD: 0.2, canelaD: 0.1 }],
  ],
  peito: [
    [0, {}],
    [0.4, { tronco: -0.45, cabeca: 0.3, bracoE: -1.2, bracoD: -1.0, coxaE: 0.2, canelaE: -0.4, coxaD: 0.25, canelaD: -0.4 }],
    [1, {}],
  ],
  cabeca: [
    [0, { coxaE: 0.4, canelaE: -0.8, coxaD: 0.4, canelaD: -0.8 }],
    [0.45, { rootY: 0.6, tronco: -0.3, cabeca: -0.3, bracoE: -0.9, bracoD: -0.6, coxaE: -0.3, canelaE: 0.6, coxaD: 0.2, canelaD: 0.5 }],
    [0.6, { rootY: 0.55, tronco: 0.35, cabeca: 0.45, bracoE: 0.5, bracoD: 0.6 }],
    [1, { rootY: 0 }],
  ],
  pingo: [
    [0, { coxaE: 0.3, canelaE: -0.6, coxaD: 0.3, canelaD: -0.6 }],
    [0.5, { rootY: 0.35, tronco: 0.1, cabeca: 0.25, bracoE: -0.4, bracoD: 0.4 }],
    [1, { rootY: 0 }],
  ],
  sharkataque: [
    [0, { coxaE: 0.4, canelaE: -0.8, coxaD: 0.4, canelaD: -0.8 }],
    [0.25, { rootY: 0.6, rootRot: -1.2, coxaE: 1.0, canelaE: -0.2, bracoE: -1.2, bracoD: -1.4 }],
    // Bicicleta: corpo invertido, perna de chute por cima, a outra em tesoura.
    [0.5, { rootY: 1.0, rootRot: -2.6, coxaD: 0.2, canelaD: 0, coxaE: 1.3, canelaE: -0.6, bracoE: -2.4, bracoD: -2.8 }],
    [0.75, { rootY: 0.6, rootRot: -1.6, coxaD: 0.6, coxaE: 1.4, bracoE: -1.5, bracoD: -1.8 }],
    [1, { rootY: 0, rootRot: 0 }],
  ],
  saque: [
    [0, {}],
    [0.35, { tronco: 0.15, coxaD: -0.9, canelaD: 1.2, bracoE: 0.6, bracoD: -0.6 }],
    [0.6, { tronco: -0.15, coxaD: 1.2, canelaD: -0.1, bracoE: -0.6, bracoD: 0.5 }],
    [1, {}],
  ],
  // Mergulho para a frente: corpo quase horizontal, braços esticados à frente, pernas para trás.
  peixinho: [
    [0, { rootRot: 0.2, coxaE: 0.5, canelaE: -0.8 }],
    [0.35, { rootY: 0.35, rootRot: 1.35, bracoE: 2.9, bracoD: 3.0, coxaE: -0.1, coxaD: 0.1 }],
    [0.7, { rootY: 0.05, rootRot: 1.45, bracoE: 3.0, bracoD: 3.0 }],
    [1, { rootY: 0, rootRot: 1.4, bracoE: 2.6, bracoD: 2.8 }],
  ],
  comemorando: [
    [0, { bracoE: -2.8, bracoD: 2.8 }],
    [0.5, { rootY: 0.25, bracoE: -3.0, bracoD: 3.0, coxaE: 0.3, canelaE: -0.6 }],
    [1, { bracoE: -2.8, bracoD: 2.8 }],
  ],
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function interpolate(keys: Key[], t: number): Pose {
  const full = keys.map(([kt, p]) => [kt, { ...BASE, ...p }] as const)
  let i = 0
  while (i < full.length - 2 && t > full[i + 1][0]) i++
  const [t0, p0] = full[i]
  const [t1, p1] = full[i + 1]
  const k = t1 === t0 ? 0 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))
  const out = { ...BASE }
  for (const name of Object.keys(BASE) as (keyof Pose)[]) out[name] = lerp(p0[name], p1[name], k)
  return out
}

/** Pose da ação no instante t (0..1 da duração da ação). */
export function poseFor(action: AthleteAction, t: number): Pose {
  const u = Math.min(1, Math.max(0, t))
  if (action === 'correndo') {
    const w = Math.sin(u * Math.PI * 2)
    return { ...BASE, tronco: 0.15, coxaE: 0.7 * w, coxaD: -0.7 * w, canelaE: -0.6 * Math.max(0, -w), canelaD: -0.6 * Math.max(0, w), bracoE: -0.6 * w, bracoD: 0.6 * w }
  }
  return interpolate(KEYS[action], u)
}
