import { BALANCE } from '../data/balance'

export const addMeter = (v: number, amount: number): number => Math.min(BALANCE.meter.max, v + amount)
export const isMeterFull = (v: number): boolean => v >= BALANCE.meter.max
