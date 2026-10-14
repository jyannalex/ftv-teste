import Phaser from 'phaser'
import { createAI, type AIController, type Personality } from '../../core/ai'
import { aimFromMove, type TouchAction } from '../../core/touch'
import { predictLanding } from '../../core/physics'
import { type Athlete, cancelButtons, createMatch, IDLE, type TeamInput, type MatchEvent, matchConfig, type MatchState, step } from '../../core/match'
import { createRng } from '../../core/rng'
import type { Side } from '../../core/rules'
import { BALANCE } from '../../data/balance'
import type { ArenaId } from '../../data/arenas'
import { ASSIST, type Difficulty } from '../../data/difficulty'
import { isMeterFull } from '../../core/specialMeter'
import { AI_TEAMS, teamById } from '../../data/teams'
import { type Audio, gameAudio } from '../audio/sound'
import { type ButtonName, Controls } from '../input/controls'
import { getSession } from '../session'
import { createFixedStepper, type FixedStepper } from '../loop/fixedStep'
import { type ArenaRuntime, drawArena } from '../render/arenas'
import { AthleteView } from '../render/AthleteView'
import { BallView } from '../render/BallView'
import { BallTrail, GroundMarks, SlowMoFx, sandPuff, sharkEffect } from '../render/effects'
import { Hud } from '../render/Hud'
import { ACTION_DURATION, LOOPING, type Pose, poseFor } from '../render/poses'
import { toScreenX, toScreenY } from '../render/view'

export type MatchSceneData = {
  mode: 'campeonato' | 'rapida'
  arena: ArenaId
  opponentId: string
  skill: number
  difficulty: Difficulty
  player: { name: string; shirt: number }
}

export type MatchResult = { winner: Side; points: [number, number]; data: MatchSceneData }

const DEFAULT_DATA: MatchSceneData = {
  mode: 'rapida',
  arena: 'praia',
  opponentId: AI_TEAMS[0].id,
  skill: 0.45,
  difficulty: 'medio',
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
  peixinho: 0.35,
}
const ACTION_TEXT: Partial<Record<TouchAction, [string, string]>> = { forte: ['FORTE!', '#ffe14d'], pingo: ['PINGO!', '#9cff57'] }
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
  /** Qual botão cada dedo está segurando. */
  private pointerButtons = new Map<number, ButtonName | -1 | 1>()
  private sharkButton?: Phaser.GameObjects.Container
  private marks!: GroundMarks
  private slowFx!: SlowMoFx
  /** Última entrada do jogador (para a mira na tela). */
  private lastHuman: TeamInput = IDLE
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
    this.pointerButtons.clear()
  }

  create(): void {
    const opponent = teamById(this.cfg.opponentId) ?? AI_TEAMS[0]
    const personality: Personality = opponent.personality
    const seed = Math.floor(Math.random() * 1e9)
    const assist = ASSIST[this.cfg.difficulty]
    this.state = createMatch(matchConfig({ seed, humanTeam: 0, humanReach: assist.reach, slowMoSec: assist.slowMoSec }))
    this.ai = createAI(1, this.cfg.skill, personality, createRng(seed + 1))

    this.arena = drawArena(this, this.cfg.arena)
    this.drawCourt()
    this.marks = new GroundMarks(this)
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
    this.slowFx = new SlowMoFx(this)
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
    this.lastHuman = this.controls.consume()
    const events = step(s, [this.lastHuman, s.phase === 'fim' ? IDLE : this.ai.think(s)])
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
        const label = e.quality === 'peixinho' ? (['PEIXINHO!', '#4fc3f7'] as [string, string]) : ACTION_TEXT[e.action]
        if (label) this.hud.float(label[0], toScreenX(a.x), toScreenY(2.6), label[1])
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
    this.marks.update(this.landingX(), this.aimX(), dt)
    if (s.slowMo) {
      const a = s.athletes[s.slowMo.athleteId]
      this.slowFx.show({ x: toScreenX(a.x), y: toScreenY(Math.max(1.3, s.ball.y - 0.9)) }, { x: toScreenX(s.ball.x), y: toScreenY(s.ball.y) }, dt)
    } else this.slowFx.hide()
    this.ballView.draw(s.ball, dt)
    this.sharkButton?.setVisible(isMeterFull(s.meter[0]))
    this.hud.update(s, marker, dt)
    this.updateTips()
  }

  /** Onde a bola vai cair (sombra na areia), durante o rally. */
  private landingX(): number | null {
    const s = this.state
    if (s.phase !== 'rally') return null
    const x = predictLanding(s.ball).x
    return Math.abs(x) <= 12 ? x : null
  }

  /** Alvo da mira do jogador: no saque (segurando FORTE) e na câmera lenta. */
  private aimX(): number | null {
    const s = this.state
    if (s.slowMo) return BALANCE.aimDepth[s.slowMo.aim]
    const b = s.buttons[0]
    if (s.phase === 'saque' && s.score.servingTeam === 0 && b.forte && b.forteDownAt !== null)
      return BALANCE.serveDepth[aimFromMove(0, this.lastHuman.move)]
    return null
  }

  /** Dicas contextuais no primeiro rally da primeira partida. */
  private updateTips(): void {
    const tip = this.tipText
    if (!tip) return
    const s = this.state
    const plan = s.phase === 'rally' ? s.plan : null
    let text = ''
    if (s.slowMo) text = ''
    else if (s.phase === 'saque' && s.score.servingTeam === 0) text = 'Segure FORTE e solte para sacar  ·  ◀ ▶ mira'
    else if (plan?.team === 0) text = 'Use ◀ ▶ para ir até a sombra da bola'
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
    const b = s.buttons[a.team]
    if (s.phase === 'saque' && a.id === s.score.server && b.forte && b.forteDownAt !== null) {
      const held = Math.min(1, (s.time - b.forteDownAt) / 0.4)
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
    if (action === 'forte' || action === 'pingo' || action === 'sharkataque') {
      sandPuff(this, toScreenX(a.x), toScreenY(0))
      this.audio.playSfx('areia')
    }
    if (action === 'sharkataque') this.trail.start(0x00e5ff)
    else if (action === 'forte') this.trail.start(0xffffff)
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
    const make = (x: number, y: number, r: number, label: string, key: string, color: number, target: ButtonName | -1 | 1) => {
      const c = this.add.circle(0, 0, r, color, 0.55).setStrokeStyle(4, 0xffffff, 0.8)
      const items: Phaser.GameObjects.GameObject[] = [c, this.add.text(0, -8, label, { fontFamily: FONT, fontSize: r > 50 ? '16px' : '26px', color: '#ffffff' }).setOrigin(0.5)]
      if (!touch) items.push(this.add.text(0, 16, key, { fontFamily: FONT, fontSize: '14px', color: '#ffffffaa' }).setOrigin(0.5))
      const box = this.add.container(x, y, items).setSize(r * 2, r * 2).setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains)
      box.on('pointerdown', (p: Phaser.Input.Pointer) => {
        this.pointerButtons.set(p.id, target)
        this.press(target, true)
      })
      // Dedo que sai do botão conta como soltar.
      box.on('pointerout', (p: Phaser.Input.Pointer) => this.releasePointer(p))
      return box
    }
    make(80, 652, 46, '◀', '[A]', 0x37474f, -1)
    make(200, 652, 46, '▶', '[D]', 0x37474f, 1)
    make(1060, 652, 58, 'FORTE', '[J]', 0xc62828, 'forte')
    make(1190, 652, 58, 'PINGO', '[K]', 0x2e7d32, 'pingo')
    this.sharkButton = make(1125, 540, 44, '🦈', '[Espaço]', 0x00838f, 'shark').setVisible(false)
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.releasePointer(p))
    this.input.on('gameout', () => {
      this.pointerButtons.clear()
      this.controls.reset()
    })
  }

  private press(target: ButtonName | -1 | 1, down: boolean): void {
    if (target === -1 || target === 1) this.controls.setMove(target, down)
    else this.controls.setButton(target, down)
  }

  private releasePointer(p: Phaser.Input.Pointer): void {
    const target = this.pointerButtons.get(p.id)
    if (target === undefined) return
    this.pointerButtons.delete(p.id)
    this.press(target, false)
  }

  private createKeyboard(): void {
    const kb = this.input.keyboard
    if (!kb) return
    const KEYS: Record<string, ButtonName | -1 | 1> = {
      KeyA: -1,
      ArrowLeft: -1,
      KeyD: 1,
      ArrowRight: 1,
      KeyJ: 'forte',
      KeyK: 'pingo',
      Space: 'shark',
    }
    kb.on('keydown', (ev: KeyboardEvent) => {
      if (ev.repeat) return
      if (ev.code === 'Escape') return this.setPaused(!this.paused)
      const t = KEYS[ev.code]
      if (t !== undefined) this.press(t, true)
    })
    kb.on('keyup', (ev: KeyboardEvent) => {
      const t = KEYS[ev.code]
      if (t !== undefined) this.press(t, false)
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
    cancelButtons(this.state, 0)
    this.pointerButtons.clear()
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
