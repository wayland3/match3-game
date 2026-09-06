import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT } from './config'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    antialias: true,
    roundPixels: true
  },
  scene: [BootScene, GameScene]
})
