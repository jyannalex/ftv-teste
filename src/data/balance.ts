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

  /** Janelas de timing (segundos, para mais ou para menos do momento ideal). */
  windows: { perfeito: 0.05, bom: 0.11, ruim: 0.18 },
  /** Defender um Sharkataque: só Perfeito, nesta janela. */
  sharkWindow: 0.025,
  /** Fácil: janelas do time humano ×1,5. */
  easyWindowScale: 1.5,
  /** Ataque forte encolhe a janela da defesa por (1 − 0,4·força). */
  forceWindowShrink: 0.4,
  hold: { pingoMaxMs: 150, forceRampMs: 600, overpowerMs: 900 },
  meter: { perfeito: 8, defesaForte: 12, ponto: 10, max: 100 },
  /** Distância máxima da rede para o Sharkataque sair. */
  sharkMaxNetDist: 2.5,
  /** Além desta distância da rede, o ataque forte perde força e precisão. */
  attackFarDist: 3,
} as const
