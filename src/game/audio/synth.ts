/**
 * Sons sintetizados por código (WebAudio): obra própria, sem arquivos de terceiros.
 * Qualquer falha de áudio é engolida: o jogo continua sem som.
 */
export type SfxKey = 'toque' | 'apito' | 'torcida' | 'areia' | 'sharkataque'
type Options = { sound: boolean; music: boolean }

export type Audio = {
  playSfx(key: SfxKey): void
  /** Liga ou desliga a música conforme as opções. */
  syncMusic(): void
}

const BPM = 96
const STEP = 60 / BPM / 4
const LOOKAHEAD = 0.3
// Progressão leve (Am7, D7, Gmaj7, Cmaj7) em Hz.
const CHORDS = [
  [220, 261.6, 329.6, 392],
  [146.8, 185, 220, 261.6],
  [196, 246.9, 293.7, 370],
  [130.8, 164.8, 196, 246.9],
]
const BASS_STEPS = new Set([0, 6, 8, 14])

export function createAudio(getCtx: () => AudioContext | null, getOptions: () => Options): Audio {
  let noise: AudioBuffer | null = null
  let musicTimer: ReturnType<typeof setInterval> | null = null
  let musicGain: GainNode | null = null
  let nextStepTime = 0
  let stepIndex = 0

  /** Contexto pronto para tocar; suspenso (antes do primeiro toque) conta como indisponível. */
  const ctxOrNull = (): AudioContext | null => {
    try {
      const ctx = getCtx()
      return ctx && ctx.state === 'running' ? ctx : null
    } catch {
      return null
    }
  }

  const noiseBuffer = (ctx: AudioContext): AudioBuffer => {
    if (noise) return noise
    const len = Math.floor(ctx.sampleRate * 2)
    noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return noise
  }

  const env = (ctx: AudioContext, out: AudioNode, t: number, peak: number, attack: number, decay: number): GainNode => {
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
    g.connect(out)
    return g
  }

  const tone = (ctx: AudioContext, out: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, peak: number, dur: number) => {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur)
    o.connect(env(ctx, out, t, peak, 0.005, dur))
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  const burst = (ctx: AudioContext, out: AudioNode, t: number, filter: BiquadFilterType, f0: number, f1: number, peak: number, attack: number, dur: number) => {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx)
    const flt = ctx.createBiquadFilter()
    flt.type = filter
    flt.frequency.setValueAtTime(f0, t)
    if (f1 !== f0) flt.frequency.exponentialRampToValueAtTime(f1, t + attack + dur)
    src.connect(flt)
    flt.connect(env(ctx, out, t, peak, attack, dur))
    src.start(t)
    src.stop(t + attack + dur + 0.05)
  }

  const SFX: Record<SfxKey, (ctx: AudioContext, t: number) => void> = {
    toque: (ctx, t) => {
      tone(ctx, ctx.destination, t, 'sine', 160, 60, 0.5, 0.14)
      burst(ctx, ctx.destination, t, 'highpass', 2500, 2500, 0.12, 0.002, 0.03)
    },
    apito: (ctx, t) => {
      tone(ctx, ctx.destination, t, 'square', 2900, 2850, 0.06, 0.16)
      tone(ctx, ctx.destination, t + 0.22, 'square', 2900, 2800, 0.06, 0.4)
    },
    torcida: (ctx, t) => burst(ctx, ctx.destination, t, 'bandpass', 700, 1100, 0.22, 0.35, 1.4),
    areia: (ctx, t) => burst(ctx, ctx.destination, t, 'highpass', 1800, 3500, 0.12, 0.005, 0.16),
    sharkataque: (ctx, t) => {
      burst(ctx, ctx.destination, t, 'lowpass', 300, 5000, 0.35, 0.05, 0.35)
      tone(ctx, ctx.destination, t + 0.05, 'sawtooth', 110, 40, 0.25, 0.6)
      tone(ctx, ctx.destination, t + 0.05, 'sine', 70, 35, 0.5, 0.7)
    },
  }

  const scheduleStep = (ctx: AudioContext, out: AudioNode, t: number, i: number) => {
    const bar = Math.floor(i / 16) % CHORDS.length
    const s = i % 16
    const chord = CHORDS[bar]
    if (s === 0 || s === 10) for (const f of chord) tone(ctx, out, t, 'triangle', f, f, 0.025, STEP * 5)
    if (BASS_STEPS.has(s)) tone(ctx, out, t, 'sine', chord[0] / 2, chord[0] / 2, 0.18, STEP * 2)
    burst(ctx, out, t, 'highpass', 6000, 6000, s % 4 === 2 ? 0.05 : 0.02, 0.002, 0.05)
  }

  const startMusic = (ctx: AudioContext) => {
    musicGain = ctx.createGain()
    musicGain.gain.value = 0.6
    musicGain.connect(ctx.destination)
    nextStepTime = ctx.currentTime + 0.1
    stepIndex = 0
    const out = musicGain
    musicTimer = setInterval(() => {
      try {
        while (nextStepTime < ctx.currentTime + LOOKAHEAD) {
          scheduleStep(ctx, out, nextStepTime, stepIndex++)
          nextStepTime += STEP
        }
      } catch {
        stopMusic()
      }
    }, 100)
  }

  const stopMusic = () => {
    if (musicTimer) clearInterval(musicTimer)
    musicTimer = null
    try {
      musicGain?.disconnect()
    } catch {
      // já desconectado
    }
    musicGain = null
  }

  return {
    playSfx(key) {
      if (!getOptions().sound) return
      const ctx = ctxOrNull()
      if (!ctx) return
      try {
        SFX[key](ctx, ctx.currentTime)
      } catch {
        // Sem som, sem problema.
      }
    },
    syncMusic() {
      const want = getOptions().music
      if (!want) return stopMusic()
      if (musicTimer) return
      const ctx = ctxOrNull()
      if (!ctx) return
      try {
        startMusic(ctx)
      } catch {
        stopMusic()
      }
    },
  }
}
