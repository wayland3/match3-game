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
    // 2x 分辨率生成，GameScene 以 0.5 基准缩放显示，保证 Retina 屏清晰
    const S = (BLOCK_SIZE + 10) * 2

    // 方块纹理：彩色糖球底托 + 主题内容（emoji 或绘制型角色）
    for (const theme of THEMES) {
      COLORS.forEach((color, i) => {
        const g = new Phaser.GameObjects.Graphics(this)
        this.drawCandyBase(g, S, color)
        if (theme.drawing === 'dogs') {
          this.drawDogHead(g, i)
        }
        const rt = this.add.renderTexture(0, 0, S, S).setOrigin(0, 0)
        rt.draw(g)
        if (theme.drawing !== 'dogs') {
          const emoji = this.add
            .text(0, 0, theme.emojis[i], { fontFamily: EMOJI_FONT, fontSize: '116px' })
            .setOrigin(0.5)
          rt.draw(emoji, S / 2, S / 2 + 6)
          emoji.destroy()
        }
        rt.saveTexture(`block_${theme.id}_${i}`)
        g.destroy()
        rt.destroy()
      })
    }

    // 选中四角瞄准框（金色，双层营造发光感）
    {
      const g = new Phaser.GameObjects.Graphics(this)
      const M = 200
      const L = 42
      const T = 12
      const drawCorners = (inset: number, len: number, thick: number): void => {
        g.fillRoundedRect(inset, inset, len, thick, 6)
        g.fillRoundedRect(inset, inset, thick, len, 6)
        g.fillRoundedRect(M - inset - len, inset, len, thick, 6)
        g.fillRoundedRect(M - inset - thick, inset, thick, len, 6)
        g.fillRoundedRect(inset, M - inset - thick, len, thick, 6)
        g.fillRoundedRect(inset, M - inset - len, thick, len, 6)
        g.fillRoundedRect(M - inset - len, M - inset - thick, len, thick, 6)
        g.fillRoundedRect(M - inset - thick, M - inset - len, thick, len, 6)
      }
      // 外层光晕角 + 内层实色角
      g.fillStyle(0xffd93d, 0.35)
      drawCorners(0, L + 8, T + 6)
      g.fillStyle(0xffd93d, 1)
      drawCorners(6, L, T)
      g.generateTexture('select-frame', M, M)
      g.destroy()
    }

    // 选中光环（2x）
    {
      const g = new Phaser.GameObjects.Graphics(this)
      g.lineStyle(10, 0xffffff, 1)
      g.strokeCircle(104, 104, 96)
      g.lineStyle(20, 0xffffff, 0.25)
      g.strokeCircle(104, 104, 108)
      g.generateTexture('ring', 216, 216)
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

  /** 糖球底托：投影 + 白边 + 主题浅色 + 高光 + 暗弧 */
  private drawCandyBase(g: Phaser.GameObjects.Graphics, S: number, color: number): void {
    g.fillStyle(0x000000, 0.3)
    g.fillCircle(S / 2 + 4, S / 2 + 10, S / 2 - 6)
    g.fillStyle(0xffffff, 1)
    g.fillCircle(S / 2, S / 2, S / 2 - 6)
    g.fillStyle(mixWhite(color, 0.66), 1)
    g.fillCircle(S / 2, S / 2, S / 2 - 14)
    g.fillStyle(0xffffff, 0.9)
    g.fillEllipse(S * 0.34, S * 0.28, 36, 22)
    g.fillCircle(S * 0.28, S * 0.22, 7)
    g.fillStyle(shade(color, -0.12), 0.55)
    g.slice(S / 2, S / 2, S / 2 - 14, Phaser.Math.DegToRad(35), Phaser.Math.DegToRad(145), false)
    g.fillPath()
  }

  /** 犬种头像：0金毛 1比格 2比熊 3西高地 4哈士奇（172x172 坐标系，中心 86,86） */
  private drawDogHead(g: Phaser.GameObjects.Graphics, breed: number): void {
    const cx = 86
    const cy = 86
    const eye = (x: number, y: number, r = 6, iris = 0x2b2b2b): void => {
      g.fillStyle(iris, 1)
      g.fillCircle(x, y, r)
      g.fillStyle(0xffffff, 0.95)
      g.fillCircle(x + r * 0.35, y - r * 0.35, r * 0.32)
    }
    const nose = (y: number): void => {
      g.fillStyle(0x2b2b2b, 1)
      g.fillEllipse(cx, y, 18, 14)
      g.fillStyle(0xffffff, 0.5)
      g.fillCircle(cx - 3, y - 2, 2.5)
    }
    const smile = (y: number): void => {
      g.lineStyle(3.5, 0x2b2b2b, 0.85)
      g.beginPath()
      g.arc(cx - 7, y, 8, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(120))
      g.strokePath()
      g.beginPath()
      g.arc(cx + 7, y, 8, Phaser.Math.DegToRad(60), Phaser.Math.DegToRad(160))
      g.strokePath()
    }

    switch (breed) {
      case 0: {
        // 金毛：金色头 + 深金垂耳 + 浅色吻部
        g.fillStyle(0xc9863b, 1)
        g.fillEllipse(cx - 52, cy + 6, 36, 78)
        g.fillEllipse(cx + 52, cy + 6, 36, 78)
        g.fillStyle(0xe8a94f, 1)
        g.fillCircle(cx, cy - 4, 48)
        g.fillStyle(0xf5d9a8, 1)
        g.fillEllipse(cx, cy + 22, 46, 36)
        eye(cx - 20, cy - 8)
        eye(cx + 20, cy - 8)
        nose(cy + 14)
        smile(cy + 22)
        break
      }
      case 1: {
        // 比格：白头 + 大棕垂耳 + 头顶棕斑
        g.fillStyle(0xfdfdfd, 1)
        g.fillCircle(cx, cy - 2, 48)
        g.fillStyle(0x9c6236, 1)
        g.fillEllipse(cx - 54, cy + 8, 38, 84)
        g.fillEllipse(cx + 54, cy + 8, 38, 84)
        g.fillEllipse(cx, cy - 42, 42, 24)
        eye(cx - 20, cy - 8)
        eye(cx + 20, cy - 8)
        nose(cy + 14)
        smile(cy + 22)
        break
      }
      case 2: {
        // 比熊：纯白绒球（描边区分）
        g.lineStyle(3, 0xd8d8e0, 1)
        g.fillStyle(0xffffff, 1)
        g.fillCircle(cx - 38, cy - 16, 24)
        g.fillCircle(cx + 38, cy - 16, 24)
        g.fillCircle(cx, cy - 34, 26)
        g.fillCircle(cx, cy + 4, 44)
        eye(cx - 17, cy - 4, 5.5)
        eye(cx + 17, cy - 4, 5.5)
        nose(cy + 12)
        smile(cy + 20)
        break
      }
      case 3: {
        // 西高地：白头 + 尖立耳
        g.fillStyle(0xfdfdfd, 1)
        g.fillTriangle(cx - 44, cy - 18, cx - 30, cy - 62, cx - 10, cy - 34)
        g.fillTriangle(cx + 44, cy - 18, cx + 30, cy - 62, cx + 10, cy - 34)
        g.lineStyle(3, 0xd8d8e0, 1)
        g.fillCircle(cx, cy + 2, 46)
        g.strokeCircle(cx, cy + 2, 46)
        eye(cx - 18, cy - 4)
        eye(cx + 18, cy - 4)
        nose(cy + 16)
        smile(cy + 24)
        break
      }
      default: {
        // 哈士奇：灰头白面具 + 立耳 + 异瞳
        g.fillStyle(0x8c96a4, 1)
        g.fillTriangle(cx - 46, cy - 14, cx - 34, cy - 64, cx - 8, cy - 30)
        g.fillTriangle(cx + 46, cy - 14, cx + 34, cy - 64, cx + 8, cy - 30)
        g.fillStyle(0xb9c2cc, 1)
        g.fillCircle(cx, cy - 2, 48)
        g.fillStyle(0xffffff, 1)
        g.fillEllipse(cx, cy + 14, 60, 50)
        g.fillEllipse(cx, cy - 30, 24, 30)
        eye(cx - 20, cy - 6, 6, 0x4fc3f7)
        eye(cx + 20, cy - 6, 6, 0x7a5243)
        nose(cy + 14)
        smile(cy + 22)
        break
      }
    }
  }
}
