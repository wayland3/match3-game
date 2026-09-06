import Phaser from 'phaser'
import {
  GAME_WIDTH, GAME_HEIGHT, ROWS, COLS, COLORS,
  BLOCK_SIZE, BLOCK_GAP, SCORE_PER_BLOCK, THEMES, THEME_KEY,
  boardOriginX, boardOriginY, boardPixelWidth, boardPixelHeight,
  cellX, cellY
} from '../config'
import { Board, Pos } from '../core/Board'
import { Sfx } from '../audio/Sfx'

type BlockSprite = Phaser.GameObjects.Image

declare global {
  interface Window {
    __pwaPrompt?: Event & { prompt: () => Promise<void>; userChoice?: Promise<unknown> }
  }
}

const BEST_KEY = 'match3-best'
const DRAG_THRESHOLD = 24
const FALL_SPEED = 1300 // px/s

const COMBO_WORDS: Record<number, string> = { 2: '连击', 3: '漂亮', 4: '厉害', 5: '超神' }

/** 2x 纹理基准缩放（Retina 清晰度） */
const BS = 0.5
/** 文字渲染分辨率 */
const TEXT_RES = 2

function tweenP(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise(resolve => {
    scene.tweens.add({ ...config, onComplete: () => resolve() })
  })
}

export class GameScene extends Phaser.Scene {
  private board = new Board()
  private sprites: (BlockSprite | null)[][] = []
  private busy = true
  private selected: Pos | null = null
  private selectedRing!: Phaser.GameObjects.Image
  private hintRings: Phaser.GameObjects.Image[] = []
  private startPointer: { x: number; y: number } | null = null
  private startCell: Pos | null = null
  private dragged = false

  private score = 0
  private best = 0
  private scoreText!: Phaser.GameObjects.Text
  private bestText!: Phaser.GameObjects.Text
  private comboBanner: Phaser.GameObjects.Text | null = null

  private sfx = new Sfx()
  private themeId: string

  constructor() {
    super('Game')
    const saved = localStorage.getItem(THEME_KEY)
    this.themeId = THEMES.some(t => t.id === saved) ? saved! : THEMES[0].id
  }

  private blockKey(color: number): string {
    return `block_${this.themeId}_${color}`
  }

  create(): void {
    this.score = 0
    this.busy = true
    this.selected = null
    this.board.reset()
    this.best = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0

    this.drawBackground()
    this.createHud()
    this.createBoardFrame()
    this.createButtons()

    this.selectedRing = this.add.image(0, 0, 'ring').setVisible(false).setDepth(15)

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p))
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p))
    this.input.on('pointerup', () => this.onPointerUp())

    void this.introFall()
  }

  // ---------- 视觉搭建 ----------

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-10)
    const top = Phaser.Display.Color.IntegerToColor(0x1a1a2e)
    const bottom = Phaser.Display.Color.IntegerToColor(0x0f3460)
    const steps = 40
    for (let i = 0; i < steps; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, steps - 1, i)
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1)
      g.fillRect(0, (GAME_HEIGHT / steps) * i, GAME_WIDTH, GAME_HEIGHT / steps + 1)
    }
    // 缓慢上升的装饰气泡
    const bubbles = this.add.particles(0, 0, 'particle', {
      x: { min: 0, max: GAME_WIDTH },
      y: GAME_HEIGHT + 20,
      speedY: { min: -40, max: -15 },
      speedX: { min: -10, max: 10 },
      scale: { min: 0.4, max: 1.6 },
      alpha: { start: 0.12, end: 0 },
      lifespan: 12000,
      quantity: 1,
      frequency: 900,
      tint: 0x88aaff
    })
    bubbles.setDepth(-9)
  }

  private createHud(): void {
    const title = this.add.text(GAME_WIDTH / 2, 64, '消消乐', {
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
      fontSize: '52px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#0f3460',
      strokeThickness: 8,
      resolution: TEXT_RES
    }).setOrigin(0.5).setDepth(5)

    this.scoreText = this.add.text(GAME_WIDTH / 2, 132, '分数 0', {
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
      fontSize: '34px',
      color: '#ffd93d',
      fontStyle: 'bold',
      resolution: TEXT_RES
    }).setOrigin(0.5).setDepth(5)

    this.bestText = this.add.text(GAME_WIDTH / 2, 178, `最高 ${this.best}`, {
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
      fontSize: '24px',
      color: '#9fb3c8',
      resolution: TEXT_RES
    }).setOrigin(0.5).setDepth(5)

    this.tweens.add({
      targets: title,
      scale: { from: 0, to: 1 },
      ease: 'Back.easeOut',
      duration: 500
    })
  }

  private createBoardFrame(): void {
    const g = this.add.graphics().setDepth(-5)
    g.fillStyle(0x000000, 0.28)
    g.fillRoundedRect(boardOriginX - 8, boardOriginY - 8, boardPixelWidth + 16, boardPixelHeight + 16, 24)
    g.lineStyle(3, 0xffffff, 0.12)
    g.strokeRoundedRect(boardOriginX - 8, boardOriginY - 8, boardPixelWidth + 16, boardPixelHeight + 16, 24)
    // 棋盘格底纹
    g.fillStyle(0xffffff, 0.04)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if ((r + c) % 2 === 0) {
          g.fillRoundedRect(
            boardOriginX + BLOCK_GAP + c * (BLOCK_SIZE + BLOCK_GAP),
            boardOriginY + BLOCK_GAP + r * (BLOCK_SIZE + BLOCK_GAP),
            BLOCK_SIZE, BLOCK_SIZE, 16
          )
        }
      }
    }
  }

  private themeBtnText: Phaser.GameObjects.Text | null = null
  private themeSwitching = false

  private createButtons(): void {
    const y = boardOriginY + boardPixelHeight + 78
    this.makeButton(GAME_WIDTH / 2 - 240, y, '💡 提示', () => this.onHint(), 220)
    const cur = THEMES.find(t => t.id === this.themeId) ?? THEMES[0]
    this.themeBtnText = this.makeButton(GAME_WIDTH / 2, y, `🎨 ${cur.emojis[0]}`, () => this.cycleTheme(), 220)
    this.makeButton(GAME_WIDTH / 2 + 240, y, '🔄 重开', () => this.scene.restart(), 220)
    this.createInstallButton()
  }

  private makeButton(x: number, y: number, label: string, onTap: () => void, w = 200): Phaser.GameObjects.Text {
    const h = 72
    const g = this.add.graphics({ x, y }).setDepth(5)
    g.fillStyle(0x2e4a7d, 1)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 20)
    g.lineStyle(2, 0xffffff, 0.25)
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 20)
    const t = this.add.text(x, y, label, {
      fontFamily: 'Apple Color Emoji, PingFang SC, Microsoft YaHei, sans-serif',
      fontSize: '30px',
      color: '#ffffff',
      fontStyle: 'bold',
      resolution: TEXT_RES
    }).setOrigin(0.5).setDepth(6)
    const hit = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true })
    hit.on('pointerdown', () => {
      this.sfx.ensure()
      this.tweens.add({ targets: [g, t], scale: 0.92, duration: 70, yoyo: true })
      onTap()
    })
    return t
  }

  /** 顶部"添加到桌面"按钮：仅未安装且环境支持时显示 */
  private createInstallButton(): void {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (standalone || (!isIOS && !window.__pwaPrompt)) return

    this.makeButton(GAME_WIDTH - 90, 70, '📲 桌面', () => this.onInstall(), 150)
  }

  private onInstall(): void {
    const ev = window.__pwaPrompt
    if (ev) {
      void ev.prompt()
      window.__pwaPrompt = undefined
    } else {
      document.getElementById('ios-guide')?.classList.add('show')
    }
  }

  /** 切换图标主题：波浪翻面动画。只换纹理不碰棋盘数据，任何时刻（含消除动画中）都安全即时 */
  private async cycleTheme(): Promise<void> {
    if (this.themeSwitching) return
    this.themeSwitching = true
    this.clearSelection()
    const idx = THEMES.findIndex(t => t.id === this.themeId)
    const next = THEMES[(idx + 1) % THEMES.length]
    this.themeId = next.id
    localStorage.setItem(THEME_KEY, next.id)
    this.sfx.theme()
    this.showToast(`主题：${next.emojis.join(' ')} ${next.name}组`)
    this.themeBtnText?.setText(`🎨 ${next.emojis[0]}`)

    const jobs: Promise<void>[] = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const s = this.sprites[r][c]
        const color = this.board.grid[r][c]
        if (!s || color === null) continue
        jobs.push(
          tweenP(this, {
            targets: s,
            scaleX: 0,
            duration: 150,
            delay: (r + c) * 12,
            ease: 'Quad.easeIn',
            onComplete: () => {
              s.setTexture(this.blockKey(color))
              this.tweens.add({
                targets: s,
                scaleX: BS,
                duration: 200,
                ease: 'Back.easeOut'
              })
            }
          })
        )
      }
    }
    await Promise.all(jobs)
    await new Promise(res => this.time.delayedCall(240, () => res(undefined)))
    this.themeSwitching = false
  }

  // ---------- 棋盘精灵 ----------

  private makeSprite(row: number, col: number, color: number): BlockSprite {
    const s = this.add.image(cellX(col), cellY(row), this.blockKey(color)).setDepth(10).setScale(BS)
    s.setData('row', row)
    s.setData('col', col)
    s.setData('color', color)
    return s
  }

  private spriteAt(p: Pos): BlockSprite | null {
    return this.sprites[p.row]?.[p.col] ?? null
  }

  private setSpriteAt(p: Pos, s: BlockSprite | null): void {
    this.sprites[p.row][p.col] = s
  }

  /** 开场：全部方块从顶部错落下落 */
  private async introFall(): Promise<void> {
    this.sprites = Array.from({ length: ROWS }, () => Array<BlockSprite | null>(COLS).fill(null))
    const jobs: Promise<void>[] = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const color = this.board.grid[r][c]!
        const s = this.makeSprite(r, c, color)
        this.setSpriteAt({ row: r, col: c }, s)
        s.setY(boardOriginY - (ROWS - r) * 40 - 60)
        s.setAlpha(0.9)
        jobs.push(
          tweenP(this, {
            targets: s,
            y: cellY(r),
            duration: 500,
            delay: c * 45 + (ROWS - r) * 18,
            ease: 'Bounce.easeOut'
          })
        )
      }
    }
    await Promise.all(jobs)
    this.busy = false
  }

  // ---------- 输入 ----------

  private posFromPointer(p: { x: number; y: number }): Pos | null {
    const col = Math.floor((p.x - boardOriginX - BLOCK_GAP) / (BLOCK_SIZE + BLOCK_GAP))
    const row = Math.floor((p.y - boardOriginY - BLOCK_GAP) / (BLOCK_SIZE + BLOCK_GAP))
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null
    return { row, col }
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    this.sfx.ensure()
    if (this.busy) return
    const cell = this.posFromPointer(p)
    if (!cell) return
    this.startPointer = { x: p.x, y: p.y }
    this.startCell = cell
    this.dragged = false
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (this.busy || !this.startPointer || !this.startCell || this.dragged) return
    const dx = p.x - this.startPointer.x
    const dy = p.y - this.startPointer.y
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    this.dragged = true
    const dir: Pos =
      Math.abs(dx) > Math.abs(dy)
        ? { row: 0, col: dx > 0 ? 1 : -1 }
        : { row: dy > 0 ? 1 : -1, col: 0 }
    const target: Pos = { row: this.startCell.row + dir.row, col: this.startCell.col + dir.col }
    if (target.row >= 0 && target.row < ROWS && target.col >= 0 && target.col < COLS) {
      void this.trySwap(this.startCell, target)
    }
    this.clearSelection()
    this.startPointer = null
    this.startCell = null
  }

  private onPointerUp(): void {
    if (this.busy) return
    if (this.dragged || !this.startCell) {
      this.startPointer = null
      this.startCell = null
      return
    }
    const cell = this.startCell
    this.startPointer = null
    this.startCell = null
    if (this.selected) {
      if (cell.row === this.selected.row && cell.col === this.selected.col) {
        this.clearSelection()
        return
      }
      if (this.board.isAdjacent(this.selected, cell)) {
        const from = this.selected
        this.clearSelection()
        void this.trySwap(from, cell)
        return
      }
    }
    this.select(cell)
  }

  private select(cell: Pos): void {
    this.clearSelection()
    this.selected = cell
    this.sfx.select()
    const s = this.spriteAt(cell)
    if (!s) return
    this.selectedRing.setPosition(s.x, s.y).setVisible(true).setAlpha(1).setScale(0.3)
    this.tweens.add({
      targets: this.selectedRing,
      scale: BS,
      duration: 320,
      ease: 'Back.easeOut',
      yoyo: false
    })
    this.tweens.add({
      targets: this.selectedRing,
      alpha: 0.45,
      scale: 0.56,
      duration: 500,
      yoyo: true,
      repeat: -1
    })
    this.tweens.add({ targets: s, scale: BS * 1.14, duration: 120, yoyo: false })
  }

  private clearSelection(): void {
    if (this.selected) {
      const s = this.spriteAt(this.selected)
      if (s) this.tweens.add({ targets: s, scale: BS, duration: 120 })
    }
    this.selected = null
    this.tweens.killTweensOf(this.selectedRing)
    this.selectedRing.setVisible(false)
  }

  // ---------- 核心流程 ----------

  private async trySwap(a: Pos, b: Pos): Promise<void> {
    if (this.busy) return
    this.busy = true
    this.sfx.swap()
    this.board.swap(a, b)
    const sa = this.spriteAt(a)
    const sb = this.spriteAt(b)
    if (!sa || !sb) {
      this.busy = false
      return
    }
    this.setSpriteAt(a, sb)
    this.setSpriteAt(b, sa)
    sa.setData('row', b.row).setData('col', b.col)
    sb.setData('row', a.row).setData('col', a.col)

    await Promise.all([
      tweenP(this, { targets: sa, x: cellX(b.col), y: cellY(b.row), duration: 160, ease: 'Cubic.easeInOut' }),
      tweenP(this, { targets: sb, x: cellX(a.col), y: cellY(a.row), duration: 160, ease: 'Cubic.easeInOut' })
    ])

    if (this.board.findMatches().count === 0) {
      // 无效交换：震一下弹回
      this.sfx.invalid()
      this.board.swap(a, b)
      this.setSpriteAt(a, sa)
      this.setSpriteAt(b, sb)
      sa.setData('row', a.row).setData('col', a.col)
      sb.setData('row', b.row).setData('col', b.col)
      await Promise.all([
        tweenP(this, { targets: sa, x: cellX(a.col), y: cellY(a.row), duration: 200, ease: 'Back.easeOut' }),
        tweenP(this, { targets: sb, x: cellX(b.col), y: cellY(b.row), duration: 200, ease: 'Back.easeOut' })
      ])
      this.busy = false
      return
    }
    await this.resolveBoard(1)
  }

  /** 连锁消除主循环 */
  private async resolveBoard(combo: number): Promise<void> {
    const matches = this.board.findMatches()
    if (matches.count === 0) {
      if (!this.board.hasValidMove()) {
        await this.autoShuffle()
      }
      this.busy = false
      return
    }

    // 消除中心：庆祝特效的锚点
    const cx = matches.cells.reduce((s, p) => s + cellX(p.col), 0) / matches.cells.length
    const cy = matches.cells.reduce((s, p) => s + cellY(p.row), 0) / matches.cells.length

    // 音效 + 连击横幅（在消除位置庆祝）
    this.sfx.pop(combo)
    if (combo >= 2) {
      this.sfx.fanfare(combo)
      this.showComboBanner(combo, cx, cy)
    }

    // 大消除：冲击波 + 震屏
    if (matches.cells.length >= 4 || combo >= 2) this.shockwave(cx, cy)
    if (matches.cells.length >= 5 || combo >= 3) this.cameras.main.shake(130, 0.006)

    // 消除动画：先弹一下再缩没（每个方块错开 15ms），精确等待全部完成
    const gained = matches.cells.length * SCORE_PER_BLOCK * combo
    this.addScore(gained)
    const jobs: Promise<void>[] = []
    matches.cells.forEach((p, idx) => {
      const s = this.spriteAt(p)
      if (!s) return
      this.setSpriteAt(p, null)
      this.burst(s.x, s.y, COLORS[this.board.grid[p.row][p.col] ?? 0])
      this.floatScore(s.x, s.y, `+${SCORE_PER_BLOCK * combo}`, combo)
      const sprite = s
      jobs.push(
        (async () => {
          await tweenP(this, {
            targets: sprite,
            scale: BS * 1.35,
            duration: 80,
            delay: idx * 15,
            yoyo: true
          })
          await tweenP(this, {
            targets: sprite,
            scale: 0,
            angle: Phaser.Math.Between(-90, 90),
            alpha: 0,
            duration: 140
          })
          sprite.destroy()
        })()
      )
    })
    await Promise.all(jobs)
    this.board.removeCells(matches.cells)

    await this.fallAndFill()

    await this.resolveBoard(combo + 1)
  }

  /** 重力 + 填充 + 下落弹跳动画 */
  private async fallAndFill(): Promise<void> {
    const moves = this.board.applyGravity()
    const filled = this.board.refill()

    const jobs: Promise<void>[] = []

    for (const m of moves) {
      const s = this.spriteAt(m.from)
      if (!s) continue
      this.setSpriteAt(m.from, null)
      this.setSpriteAt(m.to, s)
      s.setData('row', m.to.row).setData('col', m.to.col)
      const dist = cellY(m.to.row) - s.y
      jobs.push(
        tweenP(this, {
          targets: s,
          y: cellY(m.to.row),
          duration: Math.max(140, (Math.abs(dist) / FALL_SPEED) * 1000),
          ease: 'Quad.easeIn',
          onComplete: () => this.squash(s)
        })
      )
    }

    for (const f of filled) {
      const s = this.makeSprite(f.pos.row, f.pos.col, f.color)
      this.setSpriteAt(f.pos, s)
      const targetY = cellY(f.pos.row)
      const startY = boardOriginY - (ROWS - f.pos.row) * 30 - 80
      s.setY(startY)
      const dist = targetY - startY
      jobs.push(
        tweenP(this, {
          targets: s,
          y: targetY,
          duration: Math.max(160, (Math.abs(dist) / FALL_SPEED) * 1000),
          ease: 'Quad.easeIn',
          onComplete: () => this.squash(s)
        })
      )
    }

    if (jobs.length > 0) this.sfx.land()
    await Promise.all(jobs)
    this.verifySync('fall')
  }

  /**
   * 防御性强一致校验：强制 sprites 与 board 数据对齐。
   * 任何未知的时序错位在这里被发现并立即自愈（含 console.warn 上报）。
   */
  private verifySync(tag: string): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const color = this.board.grid[r][c]
        let s = this.sprites[r][c]
        if (color === null) {
          if (s) {
            console.warn(`[sync:${tag}] 多余精灵 (${r},${c})，销毁`)
            this.tweens.killTweensOf(s)
            s.destroy()
            this.sprites[r][c] = null
          }
          continue
        }
        if (!s) {
          console.warn(`[sync:${tag}] 缺失精灵 (${r},${c})，重建`)
          s = this.makeSprite(r, c, color)
          this.sprites[r][c] = s
          continue
        }
        const cur = s.getData('color') as number
        if (cur !== color) {
          console.warn(`[sync:${tag}] 颜色错位 (${r},${c}) ${cur} != ${color}，修正`)
          this.tweens.killTweensOf(s)
          s.setTexture(this.blockKey(color))
          s.setScale(BS)
          s.setData('color', color)
        }
        if (Math.abs(s.x - cellX(c)) > 2 || Math.abs(s.y - cellY(r)) > 2) {
          console.warn(`[sync:${tag}] 位置错位 (${r},${c})，校正`)
          s.setPosition(cellX(c), cellY(r))
        }
        s.setData('row', r).setData('col', c)
      }
    }
  }

  /** 落地挤压回弹 */
  private squash(s: BlockSprite): void {
    this.tweens.add({
      targets: s,
      scaleY: BS * 0.78,
      scaleX: BS * 1.15,
      duration: 55,
      yoyo: true,
      ease: 'Quad.easeOut'
    })
  }

  /** 死局自动洗牌 */
  private async autoShuffle(): Promise<void> {
    this.showToast('无可消除，自动洗牌…')
    this.sfx.shuffle()
    const jobs: Promise<void>[] = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const s = this.sprites[r][c]
        if (s) jobs.push(tweenP(this, { targets: s, scale: 0, duration: 220, delay: (r + c) * 12 }))
      }
    }
    await Promise.all(jobs)
    this.board.shuffle()
    const jobs2: Promise<void>[] = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const s = this.sprites[r][c]
        const color = this.board.grid[r][c]!
        if (s) {
          s.setTexture(this.blockKey(color))
          s.setData('color', color)
          jobs2.push(tweenP(this, { targets: s, scale: BS, duration: 260, delay: (r + c) * 12, ease: 'Back.easeOut' }))
        }
      }
    }
    await Promise.all(jobs2)
    this.verifySync('shuffle')
  }

  // ---------- 特效 ----------

  private burst(x: number, y: number, color: number): void {
    const emitter = this.add.particles(x, y, 'particle', {
      speed: { min: 160, max: 460 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 },
      lifespan: { min: 260, max: 520 },
      gravityY: 900,
      tint: [color, 0xffffff],
      emitting: false,
      blendMode: 'ADD'
    })
    emitter.setDepth(20)
    emitter.explode(24, x, y)
    this.time.delayedCall(700, () => emitter.destroy())
    // 星星点缀
    if (Math.random() < 0.5) {
      const star = this.add.image(x, y, 'star').setDepth(21).setTint(color).setScale(0.3)
      this.tweens.add({
        targets: star,
        scale: 0.9,
        angle: Phaser.Math.Between(-120, 120),
        alpha: 0,
        duration: 420,
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy()
      })
    }
  }

  private floatScore(x: number, y: number, text: string, combo: number): void {
    const size = 26 + Math.min(combo, 8) * 7
    const colors = ['#fff4b8', '#ffd93d', '#ffb347', '#ff8c42', '#ff6b6b']
    const color = colors[Math.min(combo - 1, 4)]
    const t = this.add
      .text(x, y, text, {
        fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
        fontSize: `${size}px`,
        color,
        fontStyle: 'bold',
        stroke: '#4a2500',
        strokeThickness: 8,
        shadow: { offsetX: 0, offsetY: 4, color: '#000000', blur: 8, fill: true },
        resolution: TEXT_RES
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setScale(0)
      .setAngle(Phaser.Math.Between(-8, 8))
    this.tweens.chain({
      tweens: [
        { targets: t, scale: 1.4, duration: 130, ease: 'Back.easeOut' },
        { targets: t, scale: 1, duration: 70 },
        { targets: t, y: y - 95, alpha: 0, duration: 620, ease: 'Cubic.easeOut', onComplete: () => t.destroy() }
      ]
    })
  }

  /** 冲击波：消除中心扩散双圆环 */
  private shockwave(x: number, y: number): void {
    for (let i = 0; i < 2; i++) {
      const ring = this.add.image(x, y, 'ring').setDepth(19).setTint(0xffffff).setScale(0.15).setAlpha(0.9)
      this.tweens.add({
        targets: ring,
        scale: 1.4 + i * 0.6,
        alpha: 0,
        duration: 380,
        delay: i * 70,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy()
      })
    }
  }

  /** 连击横幅：在消除中心庆祝（星星迸发 + 光晕扩散） */
  private showComboBanner(combo: number, ox: number, oy: number): void {
    this.comboBanner?.destroy()
    const word = COMBO_WORDS[Math.min(combo, 5)] ?? '疯狂连消'
    const color = ['#ffffff', '#ffd93d', '#ff9f43', '#ff6b6b', '#b983ff'][Math.min(combo - 2, 4)]
    const cx = Phaser.Math.Clamp(ox, boardOriginX + 200, boardOriginX + boardPixelWidth - 200)
    const cy = Phaser.Math.Clamp(oy, boardOriginY + 70, boardOriginY + boardPixelHeight - 70)
    // 背后光晕
    const halo = this.add
      .image(cx, cy, 'ring')
      .setDepth(39)
      .setTint(0xffffff)
      .setAlpha(0.35)
      .setScale(0.2)
    this.tweens.add({
      targets: halo,
      scale: 2.6,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => halo.destroy()
    })
    const t = this.add
      .text(cx, cy, `${word} x${combo}`, {
        fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
        fontSize: `${58 + Math.min(combo, 6) * 6}px`,
        color,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 12,
        shadow: { offsetX: 0, offsetY: 6, color: '#000000', blur: 10, fill: true },
        resolution: TEXT_RES
      })
      .setOrigin(0.5)
      .setDepth(40)
      .setScale(0)
    this.comboBanner = t
    this.tweens.chain({
      tweens: [
        { targets: t, scale: 1.3, duration: 160, ease: 'Back.easeOut' },
        { targets: t, scale: 1, duration: 90 },
        { targets: t, x: cx + 10, duration: 45, yoyo: true, repeat: 3 },
        { targets: t, alpha: 1, duration: 380 },
        { targets: t, alpha: 0, scale: 1.35, duration: 260, onComplete: () => t.destroy() }
      ]
    })
    // 星星迸发
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.5
      const dist = 150 + Math.random() * 110
      const star = this.add
        .image(cx, cy, 'star')
        .setDepth(41)
        .setTint([0xffd93d, 0xff9f43, 0xffffff][i % 3])
        .setScale(0.2)
        .setAlpha(1)
      this.tweens.add({
        targets: star,
        x: cx + Math.cos(ang) * dist,
        y: cy + Math.sin(ang) * dist,
        scale: 0.65,
        angle: Phaser.Math.Between(-200, 200),
        alpha: 0,
        duration: 550 + Math.random() * 150,
        delay: 120,
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy()
      })
    }
  }

  private showToast(msg: string): void {
    const bg = this.add.rectangle(GAME_WIDTH / 2, 268, GAME_WIDTH - 80, 60, 0x000000, 0.75).setDepth(50)
    const t = this.add
      .text(GAME_WIDTH / 2, 268, msg, {
        fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
        fontSize: '26px',
        color: '#ffffff',
        resolution: TEXT_RES
      })
      .setOrigin(0.5)
      .setDepth(51)
    this.tweens.add({ targets: [bg, t], alpha: 0, duration: 400, delay: 1200, onComplete: () => { bg.destroy(); t.destroy() } })
  }

  // ---------- 提示 ----------

  private onHint(): void {
    if (this.busy) return
    this.verifySync('hint')
    const hint = this.board.findHint()
    if (!hint) {
      this.showToast('暂无可提示的移动')
      return
    }
    this.hintRings.forEach(r => r.destroy())
    this.hintRings = []
    for (const p of hint) {
      const s = this.spriteAt(p)
      if (!s) continue
      const ring = this.add.image(s.x, s.y, 'ring').setDepth(15).setTint(0xffd93d).setScale(0.35)
      this.hintRings.push(ring)
      this.tweens.add({
        targets: [ring, s],
        scale: '+=0.06',
        duration: 300,
        yoyo: true,
        repeat: 3
      })
    }
    this.time.delayedCall(1400, () => {
      this.hintRings.forEach(r => r.destroy())
      this.hintRings = []
      hint.forEach(p => {
        const s = this.spriteAt(p)
        if (s) this.tweens.add({ targets: s, scale: BS, duration: 150 })
      })
    })
  }

  // ---------- 分数 ----------

  private scoreDisplay = { v: 0 }

  private addScore(gained: number): void {
    this.score += gained
    // 数字滚动跳字
    this.tweens.killTweensOf(this.scoreDisplay)
    this.tweens.add({
      targets: this.scoreDisplay,
      v: this.score,
      duration: 420,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.scoreText.setText(`分数 ${Math.round(this.scoreDisplay.v)}`),
      onComplete: () => this.scoreText.setText(`分数 ${this.score}`)
    })
    this.tweens.killTweensOf(this.scoreText)
    this.tweens.add({
      targets: this.scoreText,
      scale: { from: 1.45, to: 1 },
      duration: 300,
      ease: 'Back.easeOut'
    })
    // 大分震屏
    if (gained >= 100) {
      this.cameras.main.shake(160, 0.008)
    }
    if (this.score > this.best) {
      this.best = this.score
      localStorage.setItem(BEST_KEY, String(this.best))
      this.bestText.setText(`最高 ${this.best}`)
      this.tweens.add({ targets: this.bestText, scale: { from: 1.3, to: 1 }, duration: 250, ease: 'Back.easeOut' })
    }
  }
}
