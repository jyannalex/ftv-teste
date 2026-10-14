/**
 * Câmera alta e fixa, em perspectiva (base 1280×720). Mundo em metros: x comprimento (rede em 0),
 * y altura, z largura (z+ perto da câmera). A câmera fica sobre x = 0, então a rede aparece de perfil.
 */
const FOCAL = 2000
const CAM_H = 28.8
/** Distância da câmera até a linha lateral de perto (z = 4,5). */
const D_NEAR = 36
const NEAR_Z = 4.5
/** Linha lateral de perto fica em y = 610 na tela. */
const HORIZON_Y = 610 - (FOCAL * CAM_H) / D_NEAR

export type Projected = { x: number; y: number; /** pixels por metro nessa profundidade */ k: number }

/** Distância da câmera ao ponto (só depende de z). */
const depthAt = (z: number): number => D_NEAR + (NEAR_Z - z)

export function project(x: number, y: number, z: number): Projected {
  const d = depthAt(z)
  const k = FOCAL / d
  return { x: 640 + x * k, y: HORIZON_Y + (FOCAL * CAM_H) / d - y * k, k }
}

/** Achatamento de um círculo no chão (altura / largura da elipse na tela). */
export const groundSquash = (z: number): number => CAM_H / depthAt(z)

/** Escala de desenho relativa ao meio da quadra (1 em z = 0). */
export const scaleAt = (z: number): number => depthAt(0) / depthAt(z)

/** Ordem de desenho: mais perto da câmera (z maior) por cima. */
export const depthOf = (z: number): number => 100 + z * 10

/** Camadas fixas: cenário, chão, marcas, mundo (100 ± 70), efeitos, HUD. */
export const LAYER = { scenery: 0, court: 10, marks: 20, fx: 500, hud: 1000, overlay: 2000 } as const
