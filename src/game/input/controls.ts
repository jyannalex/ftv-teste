import type { TeamInput } from '../../core/match'

export type ButtonName = 'forte' | 'pingo' | 'shark'

/** Estado dos controles (toque e teclado), lido uma vez por passo da simulação. */
export class Controls {
  private down: Record<ButtonName, boolean> = { forte: false, pingo: false, shark: false }
  /** Apertado desde o último consumo: um toque rápido não se perde entre dois passos. */
  private latched: Record<ButtonName, boolean> = { forte: false, pingo: false, shark: false }
  /** Direções seguradas, a mais recente por último. */
  private moves: (-1 | 1)[] = []

  setButton(b: ButtonName, isDown: boolean): void {
    if (isDown && !this.down[b]) this.latched[b] = true
    this.down[b] = isDown
  }

  setMove(dir: -1 | 1, isDown: boolean): void {
    this.moves = this.moves.filter((m) => m !== dir)
    if (isDown) this.moves.push(dir)
  }

  consume(): TeamInput {
    const input: TeamInput = {
      move: this.moves.length ? this.moves[this.moves.length - 1] : 0,
      forte: this.down.forte || this.latched.forte,
      pingo: this.down.pingo || this.latched.pingo,
      shark: this.down.shark || this.latched.shark,
    }
    this.latched = { forte: false, pingo: false, shark: false }
    return input
  }

  /** Pausa, perda de foco: nada fica segurado nem travado. */
  reset(): void {
    this.down = { forte: false, pingo: false, shark: false }
    this.latched = { forte: false, pingo: false, shark: false }
    this.moves = []
  }
}
