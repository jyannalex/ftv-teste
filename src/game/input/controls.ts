import type { TeamInput } from '../../core/match'

/** Estado dos dois botões, alimentado por toque e teclado, lido uma vez por passo. */
export class Controls {
  private recepcaoLatched = false
  private ataqueDown = false

  pressRecepcao(): void {
    this.recepcaoLatched = true
  }

  setAtaque(down: boolean): void {
    this.ataqueDown = down
  }

  consume(): TeamInput {
    const input = { recepcao: this.recepcaoLatched, ataque: this.ataqueDown }
    this.recepcaoLatched = false
    return input
  }

  /** Pausa, perda de foco ou dedo fora do botão: nada fica "preso". */
  reset(): void {
    this.recepcaoLatched = false
    this.ataqueDown = false
  }
}
