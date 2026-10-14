import Phaser from 'phaser'
import { BootScene } from './game/scenes/BootScene'
import { MatchScene } from './game/scenes/MatchScene'

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#87CEEB',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [BootScene, MatchScene],
})
