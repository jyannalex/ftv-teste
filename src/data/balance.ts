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

  /** Velocidades (m/s): controle manual, ajuda automática e posicionamento base. */
  move: { manual: 5, assist: 2.8, base: 4.5 },
  /** Distância máxima até a bola para o toque automático. */
  reach: 0.7,
  /** Peixinho: alcance e intervalo do botão em volta do contato (s). */
  dive: { reach: 2.2, before: 0.6, after: 0.05 },
  /** Contra ataque forte a bola chega rápida: alcance automático menor e peixinho mais curto. */
  vsForte: { reachScale: 0.6, diveReach: 1.5, aiExtraReaction: 0.15 },
  /** Bola com pouso além da linha mais esta margem: ninguém toca. */
  outMargin: 0.3,
  /** Câmera lenta do ataque do jogador. */
  slowMo: { scale: 0.25, jumpMaxDist: 1.2 },
  /** Mira do ataque e do saque (distância da rede). */
  aimDepth: { curto: 2.5, meio: 5.0, fundo: 7.8 },
  serveDepth: { curto: 3.0, meio: 5.5, fundo: 8.0 },
  attack: { forteTime: 0.45, sharkTime: 0.32, pingoDist: 1.2, fracoDepth: 5.0, fracoApex: 4.0 },
  /** Erro de alvo (m, para mais ou para menos) por qualidade do toque. */
  quality: { normal: 0.4, peixinho: 1.2 },
  meter: { toque: 5, defesaForte: 12, ponto: 10, max: 100 },

  /** Posição x (em módulo) do sacador, atrás da linha de fundo. */
  serveX: 9.5,
  pointPauseSec: 1.5,
  /** Saque automático se o sacador ficar parado. */
  autoServeSec: 8,
  serve: { apex: 4.3 },

  /** Altura da bola no contato de cada parte do corpo (cabeça já com o pulo). */
  contact: { chapa: 0.45, peito: 1.3, cabeca: 2.7 },
  /** O pé do Sharkataque bate acima da cabeça. */
  sharkExtraHeight: 0.3,
  /** Posições base (distância da rede). */
  basePos: { front: 3.5, back: 6.5, support: 1.5 },
} as const
