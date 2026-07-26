const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// 从单文件 HTML 中提取 <script> 并加载其 module.exports（与坦克大战同模式）
function loadGame() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'fun', 'minesweeper', 'index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no <script> block found');
  const mod = new module.constructor();
  mod._compile(m[1], 'minesweeper.js');
  return mod.exports;
}

// 确定性伪随机数（mulberry32），让雷的位置可复现
function seededRng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('createGame 返回 9x9、10 雷、进行中、未布雷的初始状态', () => {
  const { createGame } = loadGame();
  const g = createGame({ rows: 9, cols: 9, mines: 10, rng: seededRng(1) });
  assert.equal(g.rows, 9);
  assert.equal(g.cols, 9);
  assert.equal(g.mineCount, 10);
  assert.equal(g.status, 'playing');
  assert.equal(g.mines, null); // 首次点击前不布雷
  assert.equal(g.revealed.filter(Boolean).length, 0);
  assert.equal(g.flagged.filter(Boolean).length, 0);
});

test('首次点击后布下恰好 10 颗雷，且点击位置不是雷', () => {
  const { createGame, reveal } = loadGame();
  const g = createGame({ rows: 9, cols: 9, mines: 10, rng: seededRng(42) });
  reveal(g, 4, 4);
  assert.equal(g.mines.size, 10);
  assert.ok(!g.mines.has(4 * 9 + 4), 'clicked cell must be safe');
  assert.equal(g.status, 'playing');
});

test('相邻雷数：3x3 八雷局，中心格的数字是 8', () => {
  const { createGame, reveal } = loadGame();
  const g = createGame({ rows: 3, cols: 3, mines: 8, rng: seededRng(7) });
  reveal(g, 1, 1); // 首击保护 → 中心安全，其余 8 格全是雷
  assert.equal(g.mines.size, 8);
  assert.equal(g.adj[1 * 3 + 1], 8);
});

test('踩雷：翻开有雷的格子判负', () => {
  const { createGame, reveal } = loadGame();
  const g = createGame({ rows: 9, cols: 9, mines: 10, rng: seededRng(42) });
  reveal(g, 4, 4); // 首击安全
  const mineIdx = [...g.mines][0];
  reveal(g, Math.floor(mineIdx / 9), mineIdx % 9);
  assert.equal(g.status, 'lost');
});

test('泛洪展开：5x5 无雷局，点一格翻开整个棋盘', () => {
  const { createGame, reveal } = loadGame();
  const g = createGame({ rows: 5, cols: 5, mines: 0, rng: seededRng(3) });
  reveal(g, 2, 2);
  assert.equal(g.revealed.filter(Boolean).length, 25);
});

test('判胜：3x3 八雷局，翻开唯一的安全格即获胜', () => {
  const { createGame, reveal } = loadGame();
  const g = createGame({ rows: 3, cols: 3, mines: 8, rng: seededRng(7) });
  reveal(g, 1, 1);
  assert.equal(g.status, 'won');
});

test('插旗：旗子保护格子不被翻开，可取消；已翻开的格子不能插旗', () => {
  const { createGame, reveal, toggleFlag } = loadGame();
  const g = createGame({ rows: 9, cols: 9, mines: 10, rng: seededRng(42) });
  toggleFlag(g, 0, 0);
  assert.equal(g.flagged[0], true);
  reveal(g, 0, 0); // 插旗的格子翻不开
  assert.equal(g.revealed[0], false);
  toggleFlag(g, 0, 0); // 取消
  assert.equal(g.flagged[0], false);
  reveal(g, 4, 4);
  toggleFlag(g, 4, 4); // 已翻开，不能插旗
  assert.equal(g.flagged[4 * 9 + 4], false);
});

test('终局后操作无效：判负后翻开和插旗都不再生效', () => {
  const { createGame, reveal, toggleFlag } = loadGame();
  const g = createGame({ rows: 9, cols: 9, mines: 10, rng: seededRng(42) });
  reveal(g, 4, 4);
  const mineIdx = [...g.mines][0];
  reveal(g, Math.floor(mineIdx / 9), mineIdx % 9);
  assert.equal(g.status, 'lost');
  const revealedCount = g.revealed.filter(Boolean).length;
  const safeIdx = 9 * 9 - 1 - mineIdx; // 任意一个其他格子
  reveal(g, Math.floor(safeIdx / 9), safeIdx % 9);
  toggleFlag(g, 0, 0);
  assert.equal(g.revealed.filter(Boolean).length, revealedCount);
  assert.equal(g.flagged[0], false);
});
