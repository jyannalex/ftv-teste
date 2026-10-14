import Phaser from 'phaser'
import { createAI, type AIController, type Personality, skillParams } from '../../core/ai'
import type { TouchAction } from '../../core/touch'
import { type Athlete, createMatch, IDLE, type MatchEvent, matchConfig, type MatchState, step } from '../../core/match'
import { createRng } from '../../core/rng'
import type { Side } from '../../core/rules'
import { BALANCE } from '../../data/balance'
import type { ArenaId } from '../../data/arenas'
import { AI_TEAMS, teamById } from '../../data/teams'
import { type Audio, gameAudio } from '../audio/sound'
import { Controls } from '../input/controls'
import { getSession } from '../session'
import { createFixedStepper, type FixedStepper } from '../loop/fixedStep'
import { type ArenaRuntime, drawArena } from '../render/arenas'
import { AthleteView } from '../render/AthleteView'
import { BallView } from '../render/BallView'
import { BallTrail, sandPuff, sharkEffect } from '../render/effects'
import { Hud } from '../render/Hud'
import { ACTION_DURATION, LOOPING, type Pose, poseFor } from '../render/poses'
import { toScreenX, toScreenY } from '../render/view'

export type MatchSceneData = {
  mode: 'campeonato' | 'rapida'
  arena: ArenaId
  opponentId: string
  skill: number
  easyAssist: boolean
  player: { name: string; shirt: number }
}

export type MatchResult = { winner: Side; points: [number, number]; data: MatchSceneData }

const DEFAULT_DATA: MatchSceneData = {
  mode: 'rapida',
  arena: 'praia',
  opponentId: AI_TEAMS[0].id,
  skill: 0.45,
  easyAssist: false,
  player: { name: 'Minha Dupla', shirt: 0xffffff },
}

const FONT = 'Arial Black, Arial, sans-serif'
const SKINS = [0xf1c27d, 0x8d5524, 0xc68642, 0xe0ac69]
const HAIRS = [0x2b1b0e, 0xf5d76e, 0x111111, 0x4a2c17]
/** Fração da animação em que acontece o contato com a bola. */
const CONTACT_KEY: Partial<Record<Athlete['action'], number>> = {
  chapa: 0.4,
  peito: 0.4,
  cabeca: 0.45,
  pingo: 0.5,
  sharkataque: 0.5,
  saque: 0.6,
}
const GRADE_TEXT = { perfeito: ['PERFEITO!', '#ffe14d'], bom: ['BOM', '#9cff57'], ruim: ['RUIM', '#ffa726'] } as const
const END_DELAY_SEC = 2

export class MatchScene extends Phaser.Scene {
  private cfg: MatchSceneData = DEFAULT_DATA
  private state!: MatchState
  private ai!: AIController
  private controls = new Controls()
  private stepper!: FixedStepper
  private athleteViews: AthleteView[] = []
  private ballView!: BallView
  private hud!: Hud
  private prevX: number[] = []
  private paused = false
  private pauseLayer?: Phaser.GameObjects.Container
  private endT = 0
  private ataquePointer: number | null = null
  private arena!: ArenaRuntime
  private trail!: BallTrail
  private tipText?: Phaser.GameObjects.Text
  private audio!: Audio

  constructor() {
    super('Match')
  }

  init(data: Partial<MatchSceneData>): void {
    this.cfg = { ...DEFAULT_DATA, ...data }
    this.paused = false
    this.endT = 0
    this.athleteViews = []
    this.controls.reset()
    this.ataquePointer = null
  }

  create(): void {
    const opponent = teamById(this.cfg.opponentId) ?? AI_TEAMS[0]
    const personality: Personality = opponent.personality
    const seed = Math.floor(Math.random() * 1e9)
    const aiParams = skillParams(this.cfg.skill)
    this.state = createMatch(
      matchConfig({ seed, humanTeam: 0, easyAssist: this.cfg.easyAssist, reactionDelay: [0, aiParams.reactionDelay] }),
    )
    this.ai = createAI(1, this.cfg.skill, personality, createRng(seed + 1))

    this.arena = drawArena(this, this.cfg.arena)
    this.drawCourt()
    this.audio = gameAudio(this.game)
    const looks = [
      { shirt: this.cfg.player.shirt, shorts: 0x263238 },
      { shirt: this.cfg.player.shirt, shorts: 0x263238 },
      { shirt: opponent.shirt, shorts: opponent.shorts },
      { shirt: opponent.shirt, shorts: opponent.shorts },
    ]
    for (const a of this.state.athletes) {
      const look = { ...looks[a.id], skin: SKINS[a.id], hair: HAIRS[a.id] }
      this.athleteViews.push(new AthleteView(this, look, a.team === 0 ? 1 : -1))
    }
    this.drawNet()
    this.trail = new BallTrail(this)
    this.ballView = new BallView(this)
    this.hud = new Hud(this, [this.cfg.player.name, opponent.name])
    this.prevX = this.state.athletes.map((a) => a.x)

    this.createButtons()
    this.createKeyboard()
    this.createPauseButton()
    this.tipText = getSession().save.tipsShown
      ? undefined
      : this.add
          .text(640, 170, '', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', backgroundColor: '#0b1d33cc', padding: { x: 18, y: 10 } })
          .setOrigin(0.5)
          .setVisible(false)
    this.stepper = createFixedStepper(() => this.tick())

    const onBlur = () => this.setPaused(true)
    const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)')
    const onRotate = () => portrait.matches && this.setPaused(true)
    portrait.addEventListener('change', onRotate)
    this.game.events.on(Phaser.Core.Events.BLUR, onBlur)
    this.game.events.on(Phaser.Core.Events.HIDDEN, onBlur)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, onBlur)
      this.game.events.off(Phaser.Core.Events.HIDDEN, onBlur)
      portrait.removeEventListener('change', onRotate)
    })
    if (import.meta.env.DEV) (window as unknown as { __match: MatchState }).__match = this.state
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000
    if (!this.paused) {
      this.prevX = this.state.athletes.map((a) => a.x)
      this.stepper.advance(dt)
      if (this.state.phase === 'fim') {
        this.endT += dt
        if (this.endT >= END_DELAY_SEC) this.finish()
      }
    }
    this.arena.update(this.time.now / 1000)
    this.render(dt)
  }

  private tick(): void {
    const s = this.state
    const events = step(s, [this.controls.consume(), s.phase === 'fim' ? IDLE : this.ai.think(s)])
    for (const e of events) this.onEvent(e)
  }

  private onEvent(e: MatchEvent): void {
    const s = this.state
    switch (e.type) {
      case 'toque': {
        const a = s.athletes[e.athleteId]
        this.touchEffects(e.action, a)
        this.audio.playSfx('toque')
        if (a.team !== s.config.humanTeam) break
        const [text, color] = GRADE_TEXT[e.grade]
        this.hud.float(text, toScreenX(a.x), toScreenY(2.6), color)
        break
      }
      case 'erroTiming': {
        const a = s.athletes[e.athleteId]
        if (a.team === s.config.humanTeam) this.hud.float('ERROU', toScreenX(a.x), toScreenY(2.6), '#ff5252')
        break
      }
      case 'sharkataque': {
        const a = s.athletes[e.athleteId]
        sharkEffect(this, toScreenX(s.ball.x), toScreenY(s.ball.y), a.team === 0 ? 1 : -1)
        this.audio.playSfx('sharkataque')
        this.slowMotion()
        this.hud.banner('SHARKATAQUE!', '#00e5ff', 64)
        break
      }
      case 'ponto': {
        this.endTips()
        this.audio.playSfx('apito')
        this.audio.playSfx('torcida')
        this.trail.stop()
        if (s.ball.y < 0.5) sandPuff(this, toScreenX(s.ball.x), toScreenY(0), 14)
        const text = e.reason === 'fora' ? 'FORA!' : e.reason === 'falta' ? 'FALTA!' : 'PONTO!'
        this.hud.banner(text, e.winner === 0 ? '#ffe14d' : '#ff8a80', 48)
        break
      }
      case 'fimDeSet':
        this.audio.playSfx('apito')
        this.hud.banner(e.winner === 0 ? 'VITÓRIA!' : 'DERROTA', e.winner === 0 ? '#ffe14d' : '#ff8a80', 72)
        break
    }
  }

  private render(dt: number): void {
    const s = this.state
    let marker: { x: number; y: number } | null = null
    s.athletes.forEach((a, i) => {
      const pose = this.poseOf(a, i)
      this.athleteViews[i].draw(a, pose)
      if (a.id === s.controlled && s.phase !== 'fim') marker = this.athleteViews[i].topOf(a, pose)
    })
    this.trail.update(s.ball)
    this.ballView.draw(s.ball, dt)
    this.hud.update(s, marker, dt)
    this.updateTips()
  }

  /** Dicas contextuais no primeiro rally da primeira partida. */
  private updateTips(): void {
    const tip = this.tipText
    if (!tip) return
    const s = this.state
    const plan = s.phase === 'rally' ? s.plan : null
    let text = ''
    if (s.phase === 'saque' && s.score.servingTeam === 0) text = 'Segure ATAQUE e solte para sacar'
    else if (plan?.team === 0 && plan.touchIndex < 3) text = 'Aperte RECEPÇÃO quando a bola chegar!'
    else if (plan?.team === 0) text = 'Toque rápido em ATAQUE = Pingo  ·  Segure = ataque forte'
    tip.setText(text).setVisible(text !== '')
  }

  private endTips(): void {
    if (!this.tipText) return
    this.tipText.destroy()
    this.tipText = undefined
    getSession().persist((d) => ({ ...d, tipsShown: true }))
  }

  private poseOf(a: Athlete, i: number): Pose {
    const s = this.state
    const d = ACTION_DURATION[a.action]
    const contact = CONTACT_KEY[a.action]
    if (contact !== undefined && a.actionT < d * (1 - contact)) {
      return poseFor(a.action, contact + a.actionT / d)
    }
    // Antecipação: o atleta do plano começa o movimento antes da bola chegar.
    const plan = s.plan
    if (s.phase === 'rally' && plan && plan.athleteId === a.id) {
      const lead = ACTION_DURATION[plan.kind] * (CONTACT_KEY[plan.kind] ?? 0.4)
      const left = plan.tIdeal - s.time
      if (left > 0 && left < lead) return poseFor(plan.kind, (CONTACT_KEY[plan.kind] ?? 0.4) * (1 - left / lead))
    }
    // Sacador preparando o chute enquanto segura.
    if (s.phase === 'saque' && a.id === s.score.server && s.hold[a.team].down) {
      const held = Math.min(1, (s.time - s.hold[a.team].startT) / (BALANCE.serve.fullMs / 1000))
      return poseFor('saque', 0.35 * held)
    }
    if (Math.abs(a.x - this.prevX[i]) > 0.001) return poseFor('correndo', (s.time * 2.2) % 1)
    const base = LOOPING[a.action] ? a.action : 'parado'
    return poseFor(base, (a.actionT % ACTION_DURATION[base]) / ACTION_DURATION[base])
  }

  private finish(): void {
    const s = this.state
    const result: MatchResult = { winner: s.winner ?? 0, points: s.score.points, data: this.cfg }
    this.scene.start('Result', result)
  }

  private touchEffects(action: TouchAction, a: Athlete): void {
    const s = this.state
    if (action === 'forte' || action === 'pingo' || action === 'sharkataque') {
      sandPuff(this, toScreenX(a.x), toScreenY(0))
      this.audio.playSfx('areia')
    }
    if (action === 'sharkataque') this.trail.start(0x00e5ff)
    else if (action === 'forte' && (s.lastAttack?.force ?? 0) >= 0.5) this.trail.start(0xffffff)
    else this.trail.stop()
  }

  /** Câmera lenta curta no contato do Sharkataque. */
  private slowMotion(): void {
    this.stepper.timeScale = 0.3
    this.time.delayedCall(250, () => (this.stepper.timeScale = 1))
  }

  // ---- quadra e rede ----

  private drawCourt(): void {
    const g = this.add.graphics()
    const y0 = toScreenY(0)
    const x0 = toScreenX(-BALANCE.halfCourt)
    const x1 = toScreenX(BALANCE.halfCourt)
    g.fillStyle(0xe9c46a, 1).fillRect(x0 - 40, y0 - 12, x1 - x0 + 80, 40)
    g.lineStyle(5, 0x1565c0, 1).strokeRect(x0, y0 - 6, x1 - x0, 24)
  }

  private drawNet(): void {
    const g = this.add.graphics()
    const x = toScreenX(0)
    const top = toScreenY(BALANCE.netHeight)
    const bottom = toScreenY(BALANCE.netHeight - 1)
    g.fillStyle(0x37474f, 1).fillRect(x - 3, top - 8, 6, toScreenY(0) - top + 8)
    g.fillStyle(0x000000, 0.35).fillRect(x - 7, top, 14, bottom - top)
    g.lineStyle(1, 0xffffff, 0.5)
    for (let yy = top; yy <= bottom; yy += 8) g.lineBetween(x - 7, yy, x + 7, yy)
    g.fillStyle(0xffffff, 1).fillRect(x - 8, top - 3, 16, 6)
    g.fillStyle(0x000000, 1).fillRect(x - 8, bottom, 16, 3)
  }

  // ---- controles ----

  private createButtons(): void {
    this.input.addPointer(2)
    const touch = this.sys.game.device.input.touch
    const make = (x: number, label: string, key: string, color: number) => {
      const c = this.add.circle(x, 652, 58, color, 0.55).setStrokeStyle(4, 0xffffff, 0.8).setInteractive()
      this.add.text(x, 642, label, { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5)
      if (!touch) this.add.text(x, 668, key, { fontFamily: FONT, fontSize: '14px', color: '#ffffffaa' }).setOrigin(0.5)
      return c
    }
    const rec = make(90, 'RECEPÇÃO', '[J]', 0x2e7d32)
    const atk = make(1190, 'ATAQUE', '[K]', 0xc62828)
    rec.on('pointerdown', () => this.controls.pressRecepcao())
    atk.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.ataquePointer = p.id
      this.controls.setAtaque(true)
    })
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.ataquePointer) return
      this.ataquePointer = null
      this.controls.setAtaque(false)
    }
    // Dedo que sai do botão conta como soltar.
    atk.on('pointerout', release)
    this.input.on('pointerup', release)
    this.input.on('gameout', () => {
      this.ataquePointer = null
      this.controls.setAtaque(false)
    })
  }

  private createKeyboard(): void {
    const kb = this.input.keyboard
    if (!kb) return
    kb.on('keydown', (ev: KeyboardEvent) => {
      if (ev.repeat) return
      if (ev.code === 'KeyJ' || ev.code === 'ArrowDown') this.controls.pressRecepcao()
      if (ev.code === 'KeyK' || ev.code === 'ArrowUp') this.controls.setAtaque(true)
      if (ev.code === 'Escape') this.setPaused(!this.paused)
    })
    kb.on('keyup', (ev: KeyboardEvent) => {
      if (ev.code === 'KeyK' || ev.code === 'ArrowUp') this.controls.setAtaque(false)
    })
  }

  // ---- pausa ----

  private createPauseButton(): void {
    const b = this.add.circle(1236, 44, 26, 0x0b1d33, 0.8).setInteractive()
    this.add.text(1236, 44, 'II', { fontFamily: FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5)
    b.on('pointerdown', () => this.setPaused(true))
  }

  private setPaused(paused: boolean): void {
    if (paused === this.paused || this.state.phase === 'fim') return
    this.paused = paused
    this.controls.reset()
    this.ataquePointer = null
    if (!paused) {
      this.pauseLayer?.destroy()
      this.pauseLayer = undefined
      return
    }
    const layer = this.add.container(0, 0)
    layer.add(this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.6).setInteractive())
    layer.add(this.add.text(640, 220, 'PAUSA', { fontFamily: FONT, fontSize: '56px', color: '#ffffff' }).setOrigin(0.5))
    const opt = (y: number, label: string, fn: () => void) => {
      const r = this.add.rectangle(640, y, 320, 64, 0x1e88e5).setStrokeStyle(3, 0xffffff).setInteractive({ useHandCursor: true })
      r.on('pointerdown', fn)
      layer.add([r, this.add.text(640, y, label, { fontFamily: FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0.5)])
    }
    opt(330, 'Continuar', () => this.setPaused(false))
    opt(410, 'Reiniciar', () => this.scene.restart(this.cfg))
    opt(490, 'Sair', () => this.scene.start('Menu'))
    this.pauseLayer = layer
  }
}
