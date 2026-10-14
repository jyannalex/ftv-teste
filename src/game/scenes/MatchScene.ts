import Phaser from 'phaser'
import { createAI, type AIController, type Personality } from '../../core/ai'
import { reachDist } from '../../core/contact'
import { aimFromInput, type AimTarget, type TouchAction } from '../../core/touch'
import { predictLanding } from '../../core/physics'
import { type Athlete, cancelButtons, createMatch, DT, IDLE, type TeamInput, type MatchEvent, matchConfig, type MatchState, step } from '../../core/match'
import { createRng } from '../../core/rng'
import { type Side, sideSign } from '../../core/rules'
import { BALANCE } from '../../data/balance'
import type { ArenaId } from '../../data/arenas'
import { ASSIST, type Difficulty, PARTNER_SKILL } from '../../data/difficulty'
import { isMeterFull } from '../../core/specialMeter'
import { AI_TEAMS, teamById } from '../../data/teams'
import { type Audio, gameAudio } from '../audio/sound'
import { type ButtonName, Controls } from '../input/controls'
import { Joystick } from '../input/joystick'
import { PointerRouter } from '../input/pointers'
import { getSession } from '../session'
import { createFixedStepper, type FixedStepper } from '../loop/fixedStep'
import { type ArenaRuntime, drawArena } from '../render/arenas'
import { type AthleteRenderer, AthleteView, HEAD_CENTER_H, type HairStyle } from '../render/AthleteView'
import { BallView } from '../render/BallView'
import { drawCourt, drawNet } from '../render/court'
import { BallTrail, fxDepth, type GroundPoint, GroundMarks, hitFlash, SlowMoFx, sandPuff, sharkEffect } from '../render/effects'
import { Hud } from '../render/Hud'
import { ACTION_DURATION, blendPose, LOOPING, type Pose, poseFor } from '../render/poses'
import { LAYER, project } from '../render/view'

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
const STYLES: HairStyle[] = ['curto', 'rabo', 'blackPower', 'bone']
const NUMBERS = [7, 10, 2, 9]
const COURT_COLORS: Record<ArenaId, [number, number]> = {
  praia: [0xe0707e, 0xd2475f],
  clube: [0x5b8ed6, 0x3a6bbd],
  arena: [0xd2475f, 0xb02a44],
}
/** Fração da animação em que acontece o contato com a bola. */
const CONTACT_KEY: Partial<Record<Athlete['action'], number>> = {
  chapa: 0.4,
  peito: 0.4,
  cabeca: 0.45,
  pingo: 0.5,
  sharkataque: 0.5,
  saque: 0.6,
}
const ACTION_TEXT: Partial<Record<TouchAction, [string, string]>> = { forte: ['FORTE!', '#ffe14d'], pingo: ['PINGO!', '#9cff57'] }
const END_DELAY_SEC = 2
/** Teclado: direções (eixo e sentido) e botões. */
type KeyTarget = ButtonName | { axis: 'x' | 'z'; dir: -1 | 1 }
const KEYS: Record<string, KeyTarget> = {
  KeyA: { axis: 'x', dir: -1 },
  ArrowLeft: { axis: 'x', dir: -1 },
  KeyD: { axis: 'x', dir: 1 },
  ArrowRight: { axis: 'x', dir: 1 },
  KeyW: { axis: 'z', dir: -1 },
  ArrowUp: { axis: 'z', dir: -1 },
  KeyS: { axis: 'z', dir: 1 },
  ArrowDown: { axis: 'z', dir: 1 },
  KeyJ: 'forte',
  KeyK: 'pingo',
  Space: 'shark',
  KeyQ: 'troca',
}

export class MatchScene extends Phaser.Scene {
  private cfg: MatchSceneData = DEFAULT_DATA
  private state!: MatchState
  private ai!: AIController
  /** IA do parceiro do jogador (modo "só meu atleta"). */
  private partnerAI: AIController | null = null
  private controls = new Controls()
  private stepper!: FixedStepper
  private athleteViews: AthleteRenderer[] = []
  private ballView!: BallView
  private hud!: Hud
  /** Pose mostrada (suavizada) e fase da corrida de cada atleta. */
  private shown: (Pose | null)[] = [null, null, null, null]
  private runPhase = [0, 0, 0, 0]
  private prevSpeed = [0, 0, 0, 0]
  private paused = false
  private pauseLayer?: Phaser.GameObjects.Container
  private endT = 0
  /** Qual botão cada dedo está segurando. */
  private pointers = new PointerRouter<ButtonName>((t, down) => this.controls.setButton(t, down))
  private joystick?: Joystick
  private sharkButton?: Phaser.GameObjects.Container
  /** Rótulo do botão esquerdo: FORTE ou DEFENDER. */
  private leftLabel?: Phaser.GameObjects.Text
  private marks!: GroundMarks
  private slowFx!: SlowMoFx
  /** Última entrada do jogador (para a mira na tela). */
  private lastHuman: TeamInput = IDLE
  private arena!: ArenaRuntime
  private trail!: BallTrail
  private tipText?: Phaser.GameObjects.Text
  /** Nome do personagem acima do atleta do jogador. */
  private nameTag!: Phaser.GameObjects.Text
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
    this.pointers.clear()
    this.shown = [null, null, null, null]
    this.runPhase = [0, 0, 0, 0]
    this.prevSpeed = [0, 0, 0, 0]
  }

  create(): void {
    const opponent = teamById(this.cfg.opponentId) ?? AI_TEAMS[0]
    const personality: Personality = opponent.personality
    const seed = Math.floor(Math.random() * 1e9)
    const assist = ASSIST[this.cfg.difficulty]
    const save = getSession().save
    const control = save.options.control
    this.state = createMatch(matchConfig({ seed, humanTeam: 0, humanReach: assist.reach, slowMoSec: assist.slowMoSec, control }))
    this.ai = createAI(1, this.cfg.skill, personality, createRng(seed + 1))
    // O parceiro joga sozinho, mas não gasta o Sharkataque: o especial fica com o jogador.
    this.partnerAI = control === 'solo' ? createAI(0, PARTNER_SKILL, 'equilibrado', createRng(seed + 2), { shark: false }) : null

    this.arena = drawArena(this, this.cfg.arena)
    drawCourt(this, COURT_COLORS[this.cfg.arena])
    this.marks = new GroundMarks(this)
    this.audio = gameAudio(this.game)
    const looks = [
      { shirt: this.cfg.player.shirt, shorts: 0x263238 },
      { shirt: this.cfg.player.shirt, shorts: 0x263238 },
      { shirt: opponent.shirt, shorts: opponent.shorts },
      { shirt: opponent.shirt, shorts: opponent.shorts },
    ]
    for (const a of this.state.athletes) {
      const me = save.character
      // O atleta 0 é o personagem do jogador (tela Meu Atleta).
      const look =
        a.id === 0
          ? { ...looks[0], skin: me.skin, hair: me.hair, style: me.style, number: me.number }
          : { ...looks[a.id], skin: SKINS[a.id], hair: HAIRS[a.id], style: STYLES[a.id], number: NUMBERS[a.id] }
      this.athleteViews.push(new AthleteView(this, look, a.team === 0 ? 1 : -1))
    }
    drawNet(this)
    this.trail = new BallTrail(this)
    this.ballView = new BallView(this)
    this.hud = new Hud(this, [this.cfg.player.name, opponent.name])
    this.nameTag = this.add
      .text(0, 0, save.character.name, { fontFamily: FONT, fontSize: '16px', color: '#ffe14d' })
      .setOrigin(0.5, 1)
      .setStroke('#0b1d33', 5)
      .setDepth(LAYER.fx)
    this.slowFx = new SlowMoFx(this)
    this.createButtons()
    this.createKeyboard()
    this.createPauseButton()
    this.tipText = getSession().save.tipsShown
      ? undefined
      : this.add
          .text(640, 112, '', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', backgroundColor: '#0b1d33cc', padding: { x: 16, y: 8 } })
          .setOrigin(0.5)
          .setDepth(LAYER.hud)
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
    const done = s.phase === 'fim'
    const partner = this.partnerAI && !done ? this.partnerAI.think(s) : IDLE
    const events = step(s, [this.lastHuman, done ? IDLE : this.ai.think(s)], DT, partner)
    for (const e of events) this.onEvent(e)
  }

  /** Posição na tela acima do atleta (textos flutuantes). */
  private above(a: Athlete): { x: number; y: number } {
    return project(a.x, 2.6, a.z)
  }

  private onEvent(e: MatchEvent): void {
    const s = this.state
    switch (e.type) {
      case 'toque': {
        const a = s.athletes[e.athleteId]
        this.touchEffects(e.action, a)
        this.audio.playSfx('toque')
        if (a.team !== s.config.humanTeam) break
        const label = ACTION_TEXT[e.action]
        const p = this.above(a)
        if (label) this.hud.float(label[0], p.x, p.y, label[1])
        break
      }
      case 'defesa': {
        const a = s.athletes[e.athleteId]
        const p = this.above(a)
        if (e.perfeita) this.hud.banner('DEFESAÇA!', '#80deea', 52)
        else if (a.team === s.config.humanTeam) this.hud.float('DEFENDEU!', p.x, p.y, '#80deea')
        break
      }
      case 'sharkataque': {
        const a = s.athletes[e.athleteId]
        const b = project(s.ball.x, s.ball.y, s.ball.z)
        sharkEffect(this, b.x, b.y, a.team === 0 ? 1 : -1)
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
        if (s.ball.y < 0.5) {
          const g = project(s.ball.x, 0, s.ball.z)
          sandPuff(this, g.x, g.y, 14, fxDepth(s.ball.z))
        }
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
    // Suavização: a pose mostrada persegue a pose alvo (~0,05 s), sem trocas bruscas.
    const k = 1 - Math.exp(-dt * 22)
    s.athletes.forEach((a, i) => {
      const target = this.poseOf(a, i, dt)
      const prev = this.shown[i]
      const pose = prev ? blendPose(prev, target, k) : target
      this.shown[i] = pose
      // Poeira ao frear forte.
      const speed = Math.hypot(a.vx, a.vz)
      if (this.prevSpeed[i] > 3 && speed < 1 && a.y === 0) {
        const g = project(a.x, 0, a.z)
        sandPuff(this, g.x, g.y, 5, fxDepth(a.z))
      }
      this.prevSpeed[i] = speed
      this.athleteViews[i].draw(a, pose)
      if (a.id === s.controlled && s.phase !== 'fim') marker = this.athleteViews[i].topOf(a, pose)
    })
    this.trail.update(s.ball)
    this.marks.update(this.reachRing(), this.landing(), this.aimPoint(), dt)
    // Na pausa, os efeitos da câmera lenta não cobrem o menu.
    if (s.slowMo && !this.paused) {
      const a = s.athletes[s.slowMo.athleteId]
      this.slowFx.show(project(a.x, Math.max(1.3, s.ball.y - 0.9), a.z), project(s.ball.x, s.ball.y, s.ball.z), dt)
    } else this.slowFx.hide()
    this.ballView.draw(s.ball, dt)
    this.sharkButton?.setVisible(isMeterFull(s.meter[0]))
    // Ataque vindo para o seu time: o botão esquerdo vira DEFENDER, piscando.
    const defending = this.defending()
    this.leftLabel?.setText(defending ? 'DEFENDER' : 'FORTE').setColor(defending && Math.floor(this.time.now / 150) % 2 ? '#80deea' : '#ffffff')
    this.hud.update(s, marker, dt)
    const tag = marker as { x: number; y: number } | null
    this.nameTag.setVisible(tag !== null)
    if (tag) this.nameTag.setPosition(tag.x, tag.y - 6)
    this.updateTips()
  }

  /** Um ataque do adversário está vindo para o 1º toque do jogador. */
  private defending(): boolean {
    const p = this.state.plan
    return this.state.phase === 'rally' && p !== null && p.team === 0 && p.touchIndex === 1 && p.incoming !== null && p.athleteId === this.state.controlled
  }

  /** Círculo de alcance do atleta controlado; vermelho quando a bola vai chegar dentro dele. */
  private reachRing(): (GroundPoint & { r: number; hot: boolean; defense: number | null }) | null {
    const s = this.state
    if (s.controlled === null || s.phase === 'fim' || s.slowMo) return null
    const a = s.athletes[s.controlled]
    const plan = s.phase === 'rally' ? s.plan : null
    const mine = plan !== null && plan.athleteId === a.id
    const r = s.config.humanReach
    const defense = mine && plan.incoming && plan.touchIndex === 1 ? BALANCE.defense.reach : null
    return { x: a.x, z: a.z, r, defense, hot: mine && reachDist(a, plan) <= (defense ?? r) }
  }

  /** Onde a bola vai cair, durante o rally. */
  private landing(): GroundPoint | null {
    const s = this.state
    if (s.phase !== 'rally') return null
    const p = predictLanding(s.ball)
    return Math.abs(p.x) <= 12 && Math.abs(p.z) <= 8 ? p : null
  }

  /** Alvo da mira do jogador: no saque (segurando FORTE) e na câmera lenta. */
  private aimPoint(): GroundPoint | null {
    const s = this.state
    const at = (t: AimTarget, depth: number): GroundPoint => ({ x: -sideSign(0) * depth, z: t.lane * BALANCE.laneZ })
    if (s.slowMo) return at(s.slowMo.aim, BALANCE.aimDepth[s.slowMo.aim.aim])
    const b = s.buttons[0]
    if (s.phase === 'saque' && s.score.servingTeam === 0 && b.forte && b.forteDownAt !== null) {
      const t = aimFromInput(0, this.lastHuman)
      return at(t, BALANCE.serveDepth[t.aim])
    }
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
    else if (s.phase === 'saque' && s.score.servingTeam === 0) text = 'Segure FORTE e solte para sacar  ·  direção = mira'
    else if (this.defending()) text = 'Ataque vindo! Fique perto e aperte DEFENDER (J) na hora'
    else if (plan?.team === 0 && plan.athleteId !== s.controlled) text = 'Essa é do parceiro: ele vai sozinho'
    else if (plan?.team === 0) text = s.config.control === 'dupla' ? 'Leve o círculo até a marca da bola  ·  Q troca o atleta' : 'Leve o círculo até a marca da bola'
    tip.setText(text).setVisible(text !== '')
  }

  private endTips(): void {
    if (!this.tipText) return
    this.tipText.destroy()
    this.tipText = undefined
    getSession().persist((d) => ({ ...d, tipsShown: true }))
  }

  private poseOf(a: Athlete, i: number, dt: number): Pose {
    const s = this.state
    // Câmera lenta: o atacante sobe alto, com a cabeça na altura da bola.
    if (s.slowMo?.athleteId === a.id) return { ...poseFor('cabeca', 0.4), rootY: Math.min(2.2, Math.max(0, s.ball.y - HEAD_CENTER_H)) }
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
    const speed = Math.hypot(a.vx, a.vz)
    if (speed > 0.2) {
      // A passada acompanha a velocidade; o corpo inclina para onde está indo.
      this.runPhase[i] = (this.runPhase[i] + speed * dt * 0.42) % 1
      const forward = a.team === 0 ? a.vx : -a.vx
      const run = poseFor('correndo', this.runPhase[i])
      return { ...run, tronco: run.tronco + Math.max(-0.3, Math.min(0.3, forward * 0.045)) - 0.15 }
    }
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
      const b = this.state.ball
      if (action !== 'pingo') {
        const p = project(b.x, b.y, b.z)
        hitFlash(this, p.x, p.y)
      }
      const g = project(a.x, 0, a.z)
      sandPuff(this, g.x, g.y, 8, fxDepth(a.z))
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

  // ---- controles ----

  private createButtons(): void {
    this.input.addPointer(2)
    const touch = this.sys.game.device.input.touch
    const make = (x: number, y: number, r: number, label: string, key: string, color: number, target: ButtonName) => {
      const c = this.add.circle(0, 0, r, color, 0.55).setStrokeStyle(4, 0xffffff, 0.8)
      const text = this.add.text(0, -8, label, { fontFamily: FONT, fontSize: r > 50 ? '16px' : '26px', color: '#ffffff' }).setOrigin(0.5)
      if (target === 'forte') this.leftLabel = text
      const items: Phaser.GameObjects.GameObject[] = [c, text]
      if (!touch) items.push(this.add.text(0, 16, key, { fontFamily: FONT, fontSize: '14px', color: '#ffffffaa' }).setOrigin(0.5))
      const box = this.add
        .container(x, y, items)
        .setDepth(LAYER.hud)
        .setSize(r * 2, r * 2)
        .setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains)
      box.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (!this.joystick?.owns(p.id)) this.pointers.down(p.id, target)
      })
      // Dedo que desliza de um botão para outro troca o alvo; sair do botão conta como soltar.
      box.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (!this.joystick?.owns(p.id)) this.pointers.over(p.id, target, p.isDown)
      })
      box.on('pointerout', (p: Phaser.Input.Pointer) => this.pointers.out(p.id, target))
      return box
    }
    this.joystick = new Joystick(this, 130, 600, 74, (v) => (v ? this.controls.setStick(v.x, v.z) : this.controls.setStick(null)))
    if (this.state.config.control === 'dupla') make(290, 430, 34, '⇄', '[Q]', 0x5e35b1, 'troca')
    make(1060, 652, 58, 'FORTE', '[J]', 0xc62828, 'forte')
    make(1190, 652, 58, 'PINGO', '[K]', 0x2e7d32, 'pingo')
    this.sharkButton = make(1125, 540, 44, '🦈', '[Espaço]', 0x00838f, 'shark').setVisible(false)
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.pointers.up(p.id))
    // Mouse/dedo saindo da tela solta só os botões dos dedos, não as teclas seguradas.
    this.input.on('gameout', () => this.pointers.releaseAll())
  }

  private press(t: KeyTarget, down: boolean): void {
    if (typeof t === 'string') this.controls.setButton(t, down)
    else if (t.axis === 'x') this.controls.setMove(t.dir, down)
    else this.controls.setMoveZ(t.dir, down)
  }

  private createKeyboard(): void {
    const kb = this.input.keyboard
    if (!kb) return
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
    const b = this.add.circle(1236, 40, 26, 0x0b1d33, 0.8).setInteractive().setDepth(LAYER.hud)
    this.add.text(1236, 40, 'II', { fontFamily: FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5).setDepth(LAYER.hud)
    b.on('pointerdown', () => this.setPaused(true))
  }

  private setPaused(paused: boolean): void {
    if (paused === this.paused || this.state.phase === 'fim') return
    this.paused = paused
    this.controls.reset()
    cancelButtons(this.state, 0)
    this.pointers.clear()
    this.joystick?.clear()
    if (!paused) {
      this.pauseLayer?.destroy()
      this.pauseLayer = undefined
      return
    }
    const layer = this.add.container(0, 0).setDepth(LAYER.overlay)
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
