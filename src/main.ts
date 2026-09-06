import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT } from './config'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'

declare global {
  interface Window {
    __pwaPrompt?: Event & { prompt: () => Promise<void>; userChoice?: Promise<unknown> }
  }
}

// PWA：拦截原生安装提示，由游戏内按钮触发
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  window.__pwaPrompt = e as Window['__pwaPrompt']
})

// 注册 Service Worker（Android/Chrome 可安装条件）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}

// iOS 引导弹窗关闭
document.getElementById('ios-guide-close')?.addEventListener('click', () => {
  document.getElementById('ios-guide')?.classList.remove('show')
})

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
