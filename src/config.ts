export const GAME_WIDTH = 720
export const GAME_HEIGHT = 1280

export const ROWS = 8
export const COLS = 8
export const COLOR_COUNT = 5

export const BLOCK_SIZE = 76
export const BLOCK_GAP = 6

export const COLORS: number[] = [
  0xff6b6b, // 红
  0xffd93d, // 黄
  0x6bcb77, // 绿
  0x4d96ff, // 蓝
  0xb983ff  // 紫
]

export const COLOR_NAMES = ['红', '黄', '绿', '蓝', '紫']

export interface Theme {
  id: string
  name: string
  emojis: string[]
  /** 主题按钮上显示的代表角色，默认取 emojis[0] */
  icon?: string
}

/** 图标主题：与 COLORS 一一对应，共 4 组 */
export const THEMES: Theme[] = [
  { id: 'animal', name: '动物', emojis: ['🐷', '🐥', '🐸', '🐧', '🐶'], icon: '🐶' },
  { id: 'fruit', name: '水果', emojis: ['🍓', '🍊', '🍋', '🫐', '🍇'] },
  { id: 'sky', name: '星空', emojis: ['☀️', '🌙', '⭐', '🌈', '❄️'] },
  { id: 'sweet', name: '甜品', emojis: ['🍩', '🍪', '🧁', '🍫', '🍦'] }
]

export const THEME_KEY = 'match3-theme'

export const SCORE_PER_BLOCK = 10

export const boardPixelWidth = COLS * (BLOCK_SIZE + BLOCK_GAP) + BLOCK_GAP
export const boardPixelHeight = ROWS * (BLOCK_SIZE + BLOCK_GAP) + BLOCK_GAP
export const boardOriginX = (GAME_WIDTH - boardPixelWidth) / 2
export const boardOriginY = 320

export const cellX = (col: number) => boardOriginX + BLOCK_GAP + col * (BLOCK_SIZE + BLOCK_GAP) + BLOCK_SIZE / 2
export const cellY = (row: number) => boardOriginY + BLOCK_GAP + row * (BLOCK_SIZE + BLOCK_GAP) + BLOCK_SIZE / 2
