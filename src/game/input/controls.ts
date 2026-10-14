import type { TeamInput } from '../../core/match'

export type ButtonName = 'forte' | 'pingo' | 'shark' | 'troca'

/** Joystick com menos que isso (raio 0..1) não anda. */
const STICK_DEAD = 0.3
/** Seno de 22,5°: separa as 8 direções do joystick. */
const SECTOR = Math.sin(Math.PI / 8)

type Dir = -1 | 1
/** Direções seguradas num eixo, a mais recente por último. */
class AxisKeys {
  private held: Dir[] = []
  set(dir: Dir, isDown: boolean): void {
    this.held = this.held.filter((m) => m !== dir)
    if (isDown) this.held.push(dir)
  }
  value(): -1 | 0 | 1 {
    return this.held.length ? this.held[this.held.length - 1] : 0
  }
  clear(): void {
    this.held = []
  }
}

const freshButtons = (): Record<ButtonName, boolean> => ({ forte: false, pingo: false, shark: false, troca: false })

/** Estado dos controles (toque e teclado), lido uma vez por passo da simulação. */
export class Controls {
  private down = freshButtons()
  /** Apertado desde o último consumo: um toque rápido não se perde entre dois passos. */
  private latched = freshButtons()
  private keysX = new AxisKeys()
  private keysZ = new AxisKeys()
  /** Joystick na tela (x, z de −1 a 1), ou null se nenhum dedo está nele. */
  private stick: { x: number; z: number } | null = null

  setButton(b: ButtonName, isDown: boolean): void {
    if (isDown && !this.down[b]) this.latched[b] = true
    this.down[b] = isDown
  }

  /** Teclas ◀ ▶ (eixo x). */
  setMove(dir: Dir, isDown: boolean): void {
    this.keysX.set(dir, isDown)
  }

  /** Teclas ▲ ▼ (eixo z): −1 para o fundo da tela, +1 para perto. */
  setMoveZ(dir: Dir, isDown: boolean): void {
    this.keysZ.set(dir, isDown)
  }

  /** Joystick: posição do dedo (raio 0..1), ou null ao soltar. */
  setStick(x: number | null, z = 0): void {
    this.stick = x === null ? null : { x, z }
  }

  consume(): TeamInput {
    const [move, moveZ] = this.stick ? stickDirection(this.stick) : [this.keysX.value(), this.keysZ.value()]
    const input: TeamInput = {
      move,
      moveZ,
      forte: this.down.forte || this.latched.forte,
      pingo: this.down.pingo || this.latched.pingo,
      shark: this.down.shark || this.latched.shark,
      troca: this.down.troca || this.latched.troca,
    }
    this.latched = freshButtons()
    return input
  }

  /** Pausa, perda de foco: nada fica segurado nem travado. */
  reset(): void {
    this.down = freshButtons()
    this.latched = freshButtons()
    this.keysX.clear()
    this.keysZ.clear()
    this.stick = null
  }
}

/** Joystick → uma das 8 direções (ou parado na zona morta). */
function stickDirection(s: { x: number; z: number }): [-1 | 0 | 1, -1 | 0 | 1] {
  const len = Math.hypot(s.x, s.z)
  if (len < STICK_DEAD) return [0, 0]
  const axis = (v: number) => (Math.abs(v / len) > SECTOR ? (Math.sign(v) as -1 | 1) : 0)
  return [axis(s.x), axis(s.z)]
}
