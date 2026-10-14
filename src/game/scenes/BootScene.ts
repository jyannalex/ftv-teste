import Phaser from 'phaser'
import { gameAudio } from '../audio/sound'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    this.add
      .text(640, 360, 'FTV - Teste', { fontFamily: 'Arial Black, Arial', fontSize: '64px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#1e3a5f', 8)
    // A música começa assim que o navegador liberar o áudio (primeiro toque).
    const audio = gameAudio(this.game)
    // Se o navegador não bloqueia áudio, toca já; senão, no primeiro toque.
    audio.syncMusic()
    this.game.events.on('options-changed', () => audio.syncMusic())
    this.sound.once(Phaser.Sound.Events.UNLOCKED, () => audio.syncMusic())
    this.time.delayedCall(400, () => this.scene.start('Menu'))
  }
}
