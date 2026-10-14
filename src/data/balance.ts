/**
 * Constantes de jogo. Mundo em metros: x comprimento (rede em x = 0), y altura, z largura.
 * Valores pensados para ajuste fino depois de jogar.
 */
export const BALANCE = {
  /** Gravidade um pouco menor que a real para a bola "flutuar" mais. */
  gravity: 7.5,
  ballRadius: 0.11,
  netHeight: 2.2,
  /** Metade do comprimento da quadra (a quadra vai de -9 a 9). */
  halfCourt: 9,
  /** Metade da largura da quadra (z vai de -4,5 a 4,5). */
  halfWidth: 4.5,
  /** Além disso a bola é considerada caída (segurança contra bola perdida). */
  worldLimit: 30,

  /** Velocidades (m/s) e aceleração/frenagem (m/s²): controle manual e posicionamento base. */
  move: { manual: 5, base: 4.5, accel: 33, decel: 50 },
  /** Distância máxima até a bola para o toque automático. */
  reach: 1.2,
  /** Contra ataque forte a bola chega rápida: a IA reage mais devagar e erra mais o lugar (m). */
  vsForte: { aiExtraReaction: 0.15, aiExtraError: 1.0 },
  /** Defesa de ataque (forte/Pingo): alcance (m) com o botão DEFENDER e janelas de tempo (s). */
  defense: { reach: 2.1, window: 0.3, perfect: 0.09 },
  /** Bola com pouso além da linha mais esta margem: ninguém toca. */
  outMargin: 0.3,
  /** Câmera lenta do ataque do jogador. */
  slowMo: { scale: 0.25, jumpMaxDist: 1.2 },
  /** Mira do ataque e do saque (distância da rede). */
  aimDepth: { curto: 2.5, meio: 5.0, fundo: 7.8 },
  serveDepth: { curto: 3.0, meio: 5.5, fundo: 8.0 },
  attack: { forteTime: 0.45, sharkTime: 0.32, pingoDist: 1.2, fracoDepth: 5.0, fracoApex: 4.0 },
  /** Erro de alvo dos toques (m, para mais ou para menos). */
  aimError: 0.4,
  /** Faixas da mira (z do alvo para lane ±1): ataque/saque e Pingo. */
  laneZ: 3.3,
  pingoLaneZ: 2.0,
  /** Passe e levantada vão para o z do parceiro, até este limite. */
  passMaxZ: 3.5,
  meter: { toque: 5, defesaForte: 12, defesaPerfeita: 10, ponto: 10, max: 100 },

  /** Posição x (em módulo) do sacador, atrás da linha de fundo. */
  serveX: 9.5,
  pointPauseSec: 1.5,
  /** Saque automático se o sacador ficar parado. */
  autoServeSec: 8,
  serve: { apex: 4.3 },

  /** Altura da bola no contato de cada parte do corpo (cabeça já com o pulo). */
  contact: { chapa: 0.45, peito: 1.3, cabeca: 3.2 },
  /** O pé do Sharkataque bate acima da cabeça. */
  sharkExtraHeight: 0.3,
  /**
   * Posições base: sem a bola, lado a lado a `defense` m da rede e z = ±laneZ; com a bola, quem não toca
   * vai a `support` m da rede (z limitado a ±supportZ); no saque, o parceiro do sacador fica a `front` m.
   */
  basePos: { defense: 5.0, laneZ: 2.2, support: 1.5, supportZ: 2, front: 3.5, serveZ: 2 },
  /** Limite de z dos atletas (podem sair um pouco da quadra). */
  athleteMaxZ: 6.5,
} as const
