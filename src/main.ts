import Phaser from 'phaser'
import { BootScene } from './game/scenes/BootScene'
import { BracketScene } from './game/scenes/BracketScene'
import { CharacterScene } from './game/scenes/CharacterScene'
import { ChampionScene } from './game/scenes/ChampionScene'
import { HowToPlayScene } from './game/scenes/HowToPlayScene'
import { MatchScene } from './game/scenes/MatchScene'
import { MenuScene } from './game/scenes/MenuScene'
import { OptionsScene } from './game/scenes/OptionsScene'
import { QuickMatchSetupScene } from './game/scenes/QuickMatchSetupScene'
import { ResultScene } from './game/scenes/ResultScene'
import { TournamentSetupScene } from './game/scenes/TournamentSetupScene'

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#87CEEB',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  dom: { createContainer: true },
  scene: [
    BootScene,
    MenuScene,
    TournamentSetupScene,
    BracketScene,
    QuickMatchSetupScene,
    MatchScene,
    ResultScene,
    ChampionScene,
    HowToPlayScene,
    OptionsScene,
    CharacterScene,
  ],
})

if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game
