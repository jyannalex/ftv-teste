import Phaser from 'phaser'
import { getSession } from '../session'
import { type Audio, createAudio } from './synth'

export type { Audio, SfxKey } from './synth'

let shared: Audio | null = null

/** Áudio do jogo, usando o contexto WebAudio do Phaser e as opções salvas. */
export function gameAudio(game: Phaser.Game): Audio {
  shared ??= createAudio(
    () => {
      const sm = game.sound
      return sm instanceof Phaser.Sound.WebAudioSoundManager ? sm.context : null
    },
    () => getSession().save.options,
  )
  return shared
}
