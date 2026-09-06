import { Board } from '../src/core/Board'
import { ROWS, COLS } from '../src/config'

let passed = 0
let failed = 0

function assert(cond: boolean, msg: string): void {
  if (cond) {
    passed++
    console.log(`  ✓ ${msg}`)
  } else {
    failed++
    console.error(`  ✗ ${msg}`)
  }
}

console.log('--- 初始棋盘 ---')
{
  for (let i = 0; i < 100; i++) {
    const b = new Board()
    assert(b.findMatches().count === 0, `第${i}次生成无初始三连`)
    assert(b.hasValidMove(), `第${i}次生成存在可行移动`)
    if (b.findMatches().count !== 0) break
  }
}

console.log('--- 消除判定 ---')
{
  const b = new Board()
  // 手工构造横向三连
  b.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0))
  b.grid[0][0] = 1; b.grid[0][1] = 1; b.grid[0][2] = 1
  b.grid[0][3] = 2
  // (4,0)(4,1)(4,2) 全是 0，纵向 0-7 列都是 0，先只测局部
  const m = b.findMatches()
  assert(m.count > 0, '检测到匹配')

  // 纯净构造：背景 (c+2r)%5 横向+1、纵向+2 循环，保证无三连
  const b2 = new Board()
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) b2.grid[r][c] = (c + 2 * r) % 5
  assert(b2.findMatches().count === 0, '背景本身无三连')
  b2.grid[3][2] = 4; b2.grid[3][3] = 4; b2.grid[3][4] = 4
  const m2 = b2.findMatches()
  assert(m2.count === 3, `精确检测三个横连 (实际 ${m2.count})`)
  assert(m2.cells.some(p => p.row === 3 && p.col === 2), '包含 (3,2)')

  // L 型检测：横3+竖3 交叉 = 5 格（背景无三连）
  const b3 = new Board()
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) b3.grid[r][c] = (c + 2 * r) % 5
  assert(b3.findMatches().count === 0, 'L测试背景无三连')
  b3.grid[2][2] = 3; b3.grid[2][3] = 3; b3.grid[2][4] = 3
  b3.grid[3][2] = 3; b3.grid[4][2] = 3
  const m3 = b3.findMatches()
  assert(m3.count === 5, `L型检测为5格 (实际 ${m3.count})`)
}

console.log('--- 交换与回退 ---')
{
  const b = new Board()
  b.grid = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => (r * 11 + c * 13) % 5))
  const snapshot = JSON.stringify(b.grid)
  const a = { row: 0, col: 0 }
  const d = { row: 0, col: 1 }
  const v0 = b.get(0, 0)
  const v1 = b.get(0, 1)
  b.swap(a, d)
  assert(b.get(0, 0) === v1 && b.get(0, 1) === v0, 'swap 生效')
  b.swap(a, d)
  assert(JSON.stringify(b.grid) === snapshot, 'swap 回退还原')
  assert(v0 === b.get(0, 0), '颜色一致')
}

console.log('--- 重力下落 ---')
{
  const b = new Board()
  b.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null))
  b.grid[0][0] = 1 // 顶部
  b.grid[5][0] = 2 // 中部
  b.grid[7][0] = 3 // 底部
  const moves = b.applyGravity()
  // 重力保持堆叠顺序：3 不动，2 落在 3 上(row6)，1 落在 2 上(row5)
  assert(b.grid[7][0] === 3, '底部方块不动')
  assert(b.grid[6][0] === 2, '中部方块落在其上')
  assert(b.grid[5][0] === 1, '顶部方块落在第二格')
  assert(b.grid[4][0] === null && b.grid[0][0] === null, '上方清空')
  assert(moves.length === 2, `移动数量 2 (实际 ${moves.length})`)
  const filled = b.refill()
  assert(filled.length === ROWS * COLS - 3, `填充数量正确 (实际 ${filled.length})`)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (b.grid[r][c] === null) {
        assert(false, `(${r},${c}) 未填充`)
      }
    }
  }
  assert(true, '全部格子已填充')
}

console.log('--- 完整消除循环 ---')
{
  const b = new Board()
  for (let i = 0; i < 50; i++) {
    b.reset()
    // 随机执行消除循环直到稳定
    let guard = 0
    while (guard++ < 100) {
      const m = b.findMatches()
      if (m.count === 0) break
      b.removeCells(m.cells)
      b.applyGravity()
      b.refill()
    }
    let hasNull = false
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (b.grid[r][c] === null) hasNull = true
      }
    }
    assert(!hasNull, `第${i}轮循环后棋盘完整`)
    if (hasNull) break
  }
}

console.log('--- 洗牌 ---')
{
  const b = new Board()
  b.shuffle()
  assert(b.findMatches().count === 0, '洗牌后无现成三连')
  assert(b.hasValidMove(), '洗牌后有解')
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)
