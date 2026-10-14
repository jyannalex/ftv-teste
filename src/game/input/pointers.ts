/**
 * Liga cada dedo (pointer) ao botão que ele está segurando. Deslizar o dedo de um botão para
 * outro troca o alvo; soltar ou sair da tela solta só o que os dedos seguravam.
 */
export class PointerRouter<T> {
  private held = new Map<number, T>()

  constructor(private press: (target: T, down: boolean) => void) {}

  down(id: number, target: T): void {
    this.release(id)
    this.held.set(id, target)
    this.press(target, true)
  }

  /** Dedo entrou num botão; só aperta se o dedo já estiver na tela. */
  over(id: number, target: T, pointerIsDown: boolean): void {
    if (!pointerIsDown || this.held.get(id) === target) return
    this.down(id, target)
  }

  /** Dedo saiu do botão que segurava. */
  out(id: number, target: T): void {
    if (this.held.get(id) === target) this.release(id)
  }

  up(id: number): void {
    this.release(id)
  }

  releaseAll(): void {
    for (const id of [...this.held.keys()]) this.release(id)
  }

  /** Esquece os dedos sem soltar nada (os controles já foram zerados). */
  clear(): void {
    this.held.clear()
  }

  private release(id: number): void {
    const target = this.held.get(id)
    if (target === undefined) return
    this.held.delete(id)
    this.press(target, false)
  }
}
