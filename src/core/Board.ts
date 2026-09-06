import { ROWS, COLS, COLOR_COUNT } from '../config'

export interface Pos {
  row: number
  col: number
}

export interface MatchResult {
  cells: Pos[]
  count: number
}

export interface GravityMove {
  from: Pos
  to: Pos
}

/**
 * 纯数据棋盘逻辑，不依赖渲染。
 * grid[row][col] = 颜色索引 | null
 */
export class Board {
  grid: (number | null)[][] = []

  constructor() {
    this.reset()
  }

  reset(): void {
    do {
      this.grid = Array.from({ length: ROWS }, () => Array<number | null>(COLS).fill(null))
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          this.grid[r][c] = this.randomColorAvoidingMatch(r, c)
        }
      }
    } while (this.countValidMoves() < 3) // 开局保证至少 3 个可行移动
  }

  /** 生成颜色时避开已形成的三连 */
  private randomColorAvoidingMatch(row: number, col: number): number {
    const banned = new Set<number>()
    // 横向左两格同色
    if (col >= 2) {
      const a = this.grid[row][col - 1]
      const b = this.grid[row][col - 2]
      if (a !== null && b !== null && a === b) banned.add(a)
    }
    // 纵向上两格同色
    if (row >= 2) {
      const a = this.grid[row - 1][col]
      const b = this.grid[row - 2][col]
      if (a !== null && b !== null && a === b) banned.add(a)
    }
    const candidates: number[] = []
    for (let i = 0; i < COLOR_COUNT; i++) {
      if (!banned.has(i)) candidates.push(i)
    }
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  get(row: number, col: number): number | null {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null
    return this.grid[row][col]
  }

  swap(a: Pos, b: Pos): void {
    const tmp = this.grid[a.row][a.col]
    this.grid[a.row][a.col] = this.grid[b.row][b.col]
    this.grid[b.row][b.col] = tmp
  }

  isAdjacent(a: Pos, b: Pos): boolean {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
  }

  /** 检测一个交换是否会产生消除（不真正落盘） */
  wouldMatch(a: Pos, b: Pos): boolean {
    if (!this.isAdjacent(a, b)) return false
    this.swap(a, b)
    const m = this.findMatches()
    this.swap(a, b)
    return m.count > 0
  }

  /** 扫描全部行列，返回所有成三消的格子（去重） */
  findMatches(): MatchResult {
    const matched = new Map<string, Pos>()
    const addRun = (run: Pos[]) => {
      if (run.length >= 3) run.forEach(p => matched.set(`${p.row},${p.col}`, p))
    }
    // 横向扫描
    for (let r = 0; r < ROWS; r++) {
      let run: Pos[] = []
      for (let c = 0; c <= COLS; c++) {
        const cur = c < COLS ? this.grid[r][c] : null
        const prev = run.length > 0 ? this.grid[r][run[run.length - 1].col] : null
        if (cur !== null && prev !== null && cur === prev) {
          run.push({ row: r, col: c })
        } else {
          addRun(run)
          run = cur !== null ? [{ row: r, col: c }] : []
        }
      }
      addRun(run)
    }
    // 纵向扫描
    for (let c = 0; c < COLS; c++) {
      let run: Pos[] = []
      for (let r = 0; r <= ROWS; r++) {
        const cur = r < ROWS ? this.grid[r][c] : null
        const prev = run.length > 0 ? this.grid[run[run.length - 1].row][c] : null
        if (cur !== null && prev !== null && cur === prev) {
          run.push({ row: r, col: c })
        } else {
          addRun(run)
          run = cur !== null ? [{ row: r, col: c }] : []
        }
      }
      addRun(run)
    }
    const cells = [...matched.values()]
    return { cells, count: cells.length }
  }

  removeCells(cells: Pos[]): void {
    for (const p of cells) {
      this.grid[p.row][p.col] = null
    }
  }

  /**
   * 重力下落：每列非空方块贴底，返回移动列表。
   * 顶部空缺保持 null，由 refill 填充。
   */
  applyGravity(): GravityMove[] {
    const moves: GravityMove[] = []
    for (let c = 0; c < COLS; c++) {
      let writeRow = ROWS - 1
      for (let r = ROWS - 1; r >= 0; r--) {
        const v = this.grid[r][c]
        if (v !== null) {
          if (writeRow !== r) {
            this.grid[writeRow][c] = v
            this.grid[r][c] = null
            moves.push({ from: { row: r, col: c }, to: { row: writeRow, col: c } })
          }
          writeRow--
        }
      }
    }
    return moves
  }

  /** 顶部填充新方块，返回 [位置, 颜色] 列表 */
  refill(): { pos: Pos; color: number }[] {
    const filled: { pos: Pos; color: number }[] = []
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (this.grid[r][c] === null) {
          const color = Math.floor(Math.random() * COLOR_COUNT)
          this.grid[r][c] = color
          filled.push({ pos: { row: r, col: c }, color })
        }
      }
    }
    // 体贴机制：稳态（无现成三连）却无解时，重roll 新方块颜色，尽量保证有解
    let tries = 0
    while (this.findMatches().count === 0 && !this.hasValidMove() && tries < 12) {
      for (const f of filled) {
        const color = Math.floor(Math.random() * COLOR_COUNT)
        f.color = color
        this.grid[f.pos.row][f.pos.col] = color
      }
      tries++
    }
    return filled
  }

  /** 是否存在至少一个可消除的交换 */
  hasValidMove(): boolean {
    return this.findHint() !== null
  }

  /** 统计可行移动数量 */
  countValidMoves(): number {
    let n = 0
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const a = { row: r, col: c }
        if (c + 1 < COLS && this.wouldMatch(a, { row: r, col: c + 1 })) n++
        if (r + 1 < ROWS && this.wouldMatch(a, { row: r + 1, col: c })) n++
      }
    }
    return n
  }

  /** 找一个可行移动作为提示 */
  findHint(): [Pos, Pos] | null {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const a = { row: r, col: c }
        const right = { row: r, col: c + 1 }
        const down = { row: r + 1, col: c }
        if (c + 1 < COLS && this.wouldMatch(a, right)) return [a, right]
        if (r + 1 < ROWS && this.wouldMatch(a, down)) return [a, down]
      }
    }
    return null
  }

  /** 死局洗牌：保留颜色数量，随机重排，直到无现成匹配且有解 */
  shuffle(): void {
    const pool: number[] = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = this.grid[r][c]
        if (v !== null) pool.push(v)
      }
    }
    let tries = 0
    do {
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[pool[i], pool[j]] = [pool[j], pool[i]]
      }
      let idx = 0
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          this.grid[r][c] = pool[idx++]
        }
      }
      tries++
    } while ((this.findMatches().count > 0 || !this.hasValidMove()) && tries < 200)
  }
}
