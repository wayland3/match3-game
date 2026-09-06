import Phaser from 'phaser'
import { COLORS, BLOCK_SIZE, THEMES } from '../config'

const EMOJI_FONT = `'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`

/** 颜色明暗调整：amt ∈ [-1,1] */
function shade(color: number, amt: number): number {
  const r = Math.min(255, Math.max(0, ((color >> 16) & 0xff) + 255 * amt))
  const g = Math.min(255, Math.max(0, ((color >> 8) & 0xff) + 255 * amt))
  const b = Math.min(255, Math.max(0, (color & 0xff) + 255 * amt))
  return (r << 16) | (g << 8) | b
}

/** 颜色向白色混合：t=0 原色，t=1 纯白 */
function mixWhite(color: number, t: number): number {
  const mix = (ch: number) => Math.round(ch + (255 - ch) * t)
  return (
    (mix((color >> 16) & 0xff) << 16) |
    (mix((color >> 8) & 0xff) << 8) |
    mix(color & 0xff)
  )
}

/** 用代码生成全部纹理，零美术资源依赖 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    this.makeTextures()
    this.scene.start('Game')
  }

  private makeTextures(): void {
    const S = BLOCK_SIZE + 10

    // 方块纹理：彩色糖球底托 + 主题 emoji（为全部主题生成 block_{themeId}_{colorIdx}）
    for (const theme of THEMES) {
      COLORS.forEach((color, i) => {
      const g = new Phaser.GameObjects.Graphics(this)
      // 底部投影
      g.fillStyle(0x000000, 0.3)
      g.fillCircle(S / 2 + 2, S / 2 + 5, S / 2 - 3)
      // 白色描边
      g.fillStyle(0xffffff, 1)
      g.fillCircle(S / 2, S / 2, S / 2 - 3)
      // 主题浅色底
      g.fillStyle(mixWhite(color, 0.66), 1)
      g.fillCircle(S / 2, S / 2, S / 2 - 7)
      // 左上高光泡泡
      g.fillStyle(0xffffff, 0.9)
      g.fillEllipse(S * 0.34, S * 0.28, 18, 11)
      g.fillCircle(S * 0.28, S * 0.22, 3.5)
      // 底部立体暗弧
      g.fillStyle(shade(color, -0.12), 0.55)
      g.slice(S / 2, S / 2, S / 2 - 7, Phaser.Math.DegToRad(35), Phaser.Math.DegToRad(145), false)
      g.fillPath()

      const rt = this.add.renderTexture(0, 0, S, S).setOrigin(0, 0)
      rt.draw(g)
      const emoji = this.add
        .text(0, 0, theme.emojis[i], { fontFamily: EMOJI_FONT, fontSize: '58px' })
        .setOrigin(0.5)
      rt.draw(emoji, S / 2, S / 2 + 3)
      rt.saveTexture(`block_${theme.id}_${i}`)
      emoji.destroy()
      g.destroy()
      rt.destroy()
      })
    }

    // 选中光环
    {
      const g = new Phaser.GameObjects.Graphics(this)
      g.lineStyle(5, 0xffffff, 1)
      g.strokeCircle(52, 52, 48)
      g.lineStyle(10, 0xffffff, 0.25)
      g.strokeCircle(52, 52, 54)
      g.generateTexture('ring', 108, 108)
      g.destroy()
    }

    // 粒子（白色圆点，运行时 tint 上色）
    {
      const g = new Phaser.GameObjects.Graphics(this)
      g.fillStyle(0xffffff, 1)
      g.fillCircle(8, 8, 7)
      g.generateTexture('particle', 16, 16)
      g.destroy()
    }

    // 星星（连击装饰）
    {
      const g = new Phaser.GameObjects.Graphics(this)
      g.fillStyle(0xffffff, 1)
      const pts: Phaser.Geom.Point[] = []
      for (let k = 0; k < 10; k++) {
        const ang = (Math.PI / 5) * k - Math.PI / 2
        const r = k % 2 === 0 ? 38 : 17
        pts.push(new Phaser.Geom.Point(40 + Math.cos(ang) * r, 40 + Math.sin(ang) * r))
      }
      g.fillPoints(pts, true)
      g.generateTexture('star', 80, 80)
      g.destroy()
    }
  }
}
