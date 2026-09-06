import { Board } from '../src/core/Board'
import { ROWS, COLS, COLOR_COUNT } from '../src/config'

/** 独立暴力匹配实现（不复用 Board 任何代码） */
function bruteMatches(grid: (number | null)[][]): Set<string> {
  const matched = new Set<string>()
  for (let r = 0; r < ROWS; r++) {
    let c = 0
    while (c < COLS) {
      const v = grid[r][c]
      if (v === null) { c++; continue }
      let len = 1
      while (c + len < COLS && grid[r][c + len] === v) len++
      if (len >= 3) for (let k = 0; k < len; k++) matched.add(`${r},${c + k}`)
      c += len
    }
  }
  for (let c = 0; c < COLS; c++) {
    let r = 0
    while (r < ROWS) {
      const v = grid[r][c]
      if (v === null) { r++; continue }
      let len = 1
      while (r + len < ROWS && grid[r + len][c] === v) len++
      if (len >= 3) for (let k = 0; k < len; k++) matched.add(`${r + k},${c}`)
      r += len
    }
  }
  return matched
}

function bruteHasMove(grid: (number | null)[][]): boolean {
  const trySwapMatch = (r1: number, c1: number, r2: number, c2: number): boolean => {
    ;[grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]]
    const has = bruteMatches(grid).size > 0
    ;[grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]]
    return has
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === null) continue
      if (c + 1 < COLS && grid[r][c + 1] !== null && trySwapMatch(r, c, r, c + 1)) return true
      if (r + 1 < ROWS && grid[r + 1][c] !== null && trySwapMatch(r, c, r + 1, c)) return true
    }
  }
  return false
}

function randomGrid(nullProb = 0): (number | null)[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () =>
      Math.random() < nullProb ? null : Math.floor(Math.random() * COLOR_COUNT)
    )
  )
}

let failed = 0
const N = 5000

// 1) findMatches 对拍
for (let i = 0; i < N; i++) {
  const b = new Board()
  b.grid = randomGrid(i % 4 === 0 ? 0.15 : 0)
  const mine = new Set(b.findMatches().cells.map(p => `${p.row},${p.col}`))
  const brute = bruteMatches(b.grid)
  if (mine.size !== brute.size || [...brute].some(k => !mine.has(k))) {
    failed++
    console.error(`findMatches 不一致 @${i}: mine=${mine.size} brute=${brute.size}`)
    console.error(JSON.stringify(b.grid))
    break
  }
}
console.log(failed === 0 ? `✓ findMatches 对拍 ${N} 次一致` : '✗ findMatches 有 bug')

// 2) hasValidMove / findHint 对拍
let hintFailed = 0
for (let i = 0; i < 2000; i++) {
  const b = new Board()
  do {
    b.grid = randomGrid(0)
  } while (b.findMatches().count > 0)
  const mineHas = b.hasValidMove()
  const bruteHas = bruteHasMove(b.grid)
  if (mineHas !== bruteHas) {
    hintFailed++
    console.error(`hasValidMove 不一致 @${i}: mine=${mineHas} brute=${bruteHas}`)
    console.error(JSON.stringify(b.grid))
    break
  }
  const hint = b.findHint()
  if (hint) {
    const [a, d] = hint
    b.swap(a, d)
    const ok = bruteMatches(b.grid).size > 0
    b.swap(a, d)
    if (!ok) {
      hintFailed++
      console.error(`findHint 返回的交换不产生消除 @${i}: (${a.row},${a.col})<->(${d.row},${d.col})`)
      console.error(JSON.stringify(b.grid))
      break
    }
  }
}
console.log(hintFailed === 0 ? '✓ hasValidMove/findHint 对拍 2000 次一致' : '✗ 提示逻辑有 bug')

// 3) wouldMatch 对拍
let wmFailed = 0
for (let i = 0; i < 2000; i++) {
  const b = new Board()
  do {
    b.grid = randomGrid(0)
  } while (b.findMatches().count > 0)
  for (let r = 0; r < ROWS && wmFailed === 0; r++) {
    for (let c = 0; c < COLS - 1 && wmFailed === 0; c++) {
      const mine = b.wouldMatch({ row: r, col: c }, { row: r, col: c + 1 })
      const snapshot = JSON.stringify(b.grid)
      b.swap({ row: r, col: c }, { row: r, col: c + 1 })
      const brute = bruteMatches(b.grid).size > 0
      b.swap({ row: r, col: c }, { row: r, col: c + 1 })
      if (JSON.stringify(b.grid) !== snapshot) {
        console.error(`wouldMatch 破坏了棋盘! @${i} (${r},${c})`)
        wmFailed++
        break
      }
      if (mine !== brute) {
        console.error(`wouldMatch 不一致 @${i} (${r},${c}): mine=${mine} brute=${brute}`)
        wmFailed++
        break
      }
    }
  }
  if (wmFailed) { console.error(JSON.stringify(b.grid)); break }
}
console.log(wmFailed === 0 ? '✓ wouldMatch 对拍 2000 盘全部相邻交换一致' : '✗ wouldMatch 有 bug')

process.exit(failed + hintFailed + wmFailed > 0 ? 1 : 0)
