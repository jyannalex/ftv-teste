/** Conversão mundo (metros) → tela (pixels), base 1280×720. */
export const PX_PER_M = 1280 / 24
export const GROUND_Y = 560
export const toScreenX = (x: number): number => 640 + x * PX_PER_M
export const toScreenY = (y: number): number => GROUND_Y - y * PX_PER_M
