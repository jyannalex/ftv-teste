import { describe, expect, it } from 'vitest'
import { createAudio } from '../../src/game/audio/synth'

/** AudioContext falso que conta os nós criados. */
function fakeCtx() {
  const counts = { osc: 0, buffer: 0 }
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} })
  const node = () => ({ connect() {}, disconnect() {}, gain: param(), frequency: param(), Q: param(), type: '' })
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    state: 'running',
    destination: {},
    createGain: node,
    createBiquadFilter: node,
    createOscillator: () => {
      counts.osc++
      return { ...node(), start() {}, stop() {} }
    },
    createBuffer: (_c: number, len: number) => {
      counts.buffer++
      return { getChannelData: () => new Float32Array(len) }
    },
    createBufferSource: () => ({ ...node(), buffer: null, loop: false, start() {}, stop() {} }),
  }
  return { ctx: ctx as unknown as AudioContext, counts }
}

describe('áudio', () => {
  it('toca efeito quando o som está ligado', () => {
    const { ctx, counts } = fakeCtx()
    const audio = createAudio(() => ctx, () => ({ sound: true, music: false }))
    audio.playSfx('toque')
    audio.playSfx('apito')
    expect(counts.osc).toBeGreaterThan(0)
  })

  it('não cria nada com o som desligado', () => {
    const { ctx, counts } = fakeCtx()
    const audio = createAudio(() => ctx, () => ({ sound: false, music: false }))
    for (const k of ['toque', 'apito', 'torcida', 'areia', 'sharkataque'] as const) audio.playSfx(k)
    expect(counts.osc + counts.buffer).toBe(0)
  })

  it('sem contexto de áudio (bloqueado) não lança erro', () => {
    const audio = createAudio(() => null, () => ({ sound: true, music: true }))
    expect(() => {
      audio.playSfx('sharkataque')
      audio.syncMusic()
    }).not.toThrow()
  })

  it('contexto que lança erro não derruba o jogo', () => {
    const audio = createAudio(
      () => {
        throw new Error('sem áudio')
      },
      () => ({ sound: true, music: true }),
    )
    expect(() => audio.playSfx('toque')).not.toThrow()
  })
})

describe('áudio antes do primeiro toque', () => {
  it('contexto suspenso: não cria nós (evita aviso do navegador)', () => {
    const { ctx, counts } = fakeCtx()
    ;(ctx as unknown as { state: string }).state = 'suspended'
    const audio = createAudio(() => ctx, () => ({ sound: true, music: true }))
    audio.playSfx('toque')
    audio.syncMusic()
    expect(counts.osc + counts.buffer).toBe(0)
  })
})
