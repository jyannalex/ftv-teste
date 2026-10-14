import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    this.add
      .text(640, 360, 'FTV - Teste', { fontFamily: 'Arial Black, Arial', fontSize: '64px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#1e3a5f', 8)
  }
}
