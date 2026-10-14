export type Rng = {
  /** Valor uniforme em [0, 1). */
  next(): number
  /** Valor uniforme em [min, max). */
  range(min: number, max: number): number
  /** Valor com distribuição normal. */
  normal(mean: number, sd: number): number
}

/** RNG determinístico (mulberry32) para a simulação ser reproduzível. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    normal: (mean, sd) => {
      const u = 1 - next()
      const v = next()
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
  }
}
