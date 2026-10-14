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

  /** Posição x (em módulo) do sacador, atrás da linha de fundo. */
  serveX: 9.5,
  runSpeed: 6,
  pointPauseSec: 1.5,
  /** Saque automático se o sacador ficar parado. */
  autoServeSec: 8,
  serve: { fullMs: 800, overMs: 1000, apex: 5 },

  /** Altura da bola no contato de cada parte do corpo (cabeça já com o pulo). */
  contact: { chapa: 0.45, peito: 1.3, cabeca: 2.7 },
  /** O pé do Sharkataque bate acima da cabeça. */
  sharkExtraHeight: 0.3,
  /** Posições base (distância da rede). */
  basePos: { front: 3.5, back: 6.5, support: 1.5 },
} as const
