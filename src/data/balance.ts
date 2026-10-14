/**
 * Constantes de jogo. Mundo em metros, visão lateral, rede em x = 0.
 * Valores pensados para ajuste fino depois de jogar.
 */
export const BALANCE = {
  /** Gravidade um pouco menor que a real para a bola "flutuar" mais. */
  gravity: 7.5,
  ballRadius: 0.11,
  netHeight: 2.2,
  /** Metade do comprimento da quadra (a quadra vai de -9 a 9). */
  halfCourt: 9,
  /** Além disso a bola é considerada caída (segurança contra bola perdida). */
  worldLimit: 30,
} as const
