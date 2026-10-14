export type FixedStepper = {
  /** Avança o tempo real decorrido e roda os passos fixos devidos. Devolve quantos rodou. */
  advance(elapsedSec: number): number
  /** Multiplica o tempo decorrido (câmera lenta < 1). */
  timeScale: number
}

const EPS = 1e-9

export function createFixedStepper(stepFn: () => void, dt = 1 / 60, maxSteps = 5): FixedStepper {
  let acc = 0
  const stepper: FixedStepper = {
    timeScale: 1,
    advance(elapsedSec: number): number {
      acc += elapsedSec * stepper.timeScale
      let steps = 0
      while (acc + EPS >= dt && steps < maxSteps) {
        stepFn()
        acc -= dt
        steps++
      }
      // Quadro muito longo (aba em segundo plano): descarta o atraso em vez de "teleportar".
      if (steps === maxSteps) acc = 0
      return steps
    },
  }
  return stepper
}
