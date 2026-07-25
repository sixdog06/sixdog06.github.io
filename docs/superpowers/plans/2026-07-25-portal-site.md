# 门户站点（sixdog06.github.io）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 纯手写零依赖的个人门户静态站（主页 + 自我介绍 + 游戏展示页 + 坦克大战），部署到 GitHub Pages。

**Architecture:** 多页静态站点，仓库根即站点根。共享一套设计系统（`assets/style.css` + `assets/main.js`），深色终端风。验证靠 Node 链接检查脚本 + 本地静态服务器 curl 冒烟。

**Tech Stack:** 原生 HTML/CSS/JS，Node（仅用于检查脚本），GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-07-25-portal-site-design.md`

## Global Constraints

- 零依赖零构建：无第三方库、无外部字体/图片请求；博客/GitHub 等外链一律 `target="_blank" rel="noopener"`。
- 深色终端风：近黑底 `#0a0a0f`，等宽字体栈，强调色终端绿 `#33ff66`，辅助青 `#22d3ee`。
- 所有页面 `<html lang="zh-CN">` 且有 `<title>`。
- 自我介绍内容仅：昵称"小拳头" + GitHub @sixdog06，保持极简，不加额外文案。
- 博客入口外链 Notion：`https://sixdog.notion.site/SixDog-Space-402a93949b3e4a69a9ae24c2d7d8a9d6`。
- 坦克大战游戏文件从 `/Users/sixdog/tank-battle/tank-battle.html` 原样复制，零修改。

## 文件结构

- `assets/style.css` — 全站设计系统（Task 1）
- `assets/main.js` — 主页打字机动效（Task 1）
- `index.html` — 门户主页（Task 1）
- `about.html` — 自我介绍（Task 2）
- `games/index.html` — 游戏展示页（Task 2）
- `games/tank-battle/index.html` — 游戏本体（Task 3，复制）
- `test/check-links.js` — 链接/结构检查脚本（Task 1，之后每个任务都跑）

---

### Task 1: 检查脚本 + 设计系统 + 门户主页

**Files:**
- Create: `test/check-links.js`
- Create: `assets/style.css`
- Create: `assets/main.js`
- Create: `index.html`

**Interfaces:**
- Produces: CSS 类约定 `.terminal/.terminal-bar/.dot/.terminal-body/.prompt/.menu/.cursor/.footer/.page/.crumb/.title/.card/.card-link/.inline-link`（Task 2 复用）；检查命令 `node test/check-links.js`。
- Consumes: 无

- [ ] **Step 1: 写检查脚本并确认失败**

创建 `test/check-links.js`：

```js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let failures = 0;
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || ['node_modules', 'docs', 'test'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const htmlFiles = walk(ROOT);
if (htmlFiles.length === 0) { console.error('no html files found'); process.exit(1); }
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  if (!/<title>.+<\/title>/.test(html)) { console.error(`FAIL ${rel}: missing <title>`); failures++; }
  if (!html.includes('lang="zh-CN"')) { console.error(`FAIL ${rel}: missing lang="zh-CN"`); failures++; }
  const re = /(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1];
    if (/^(https?:|mailto:|#)/.test(url)) continue;
    const target = path.resolve(path.dirname(file), url.split('#')[0]);
    if (!fs.existsSync(target) && !fs.existsSync(path.join(target, 'index.html'))) {
      console.error(`FAIL ${rel}: broken link -> ${url}`); failures++;
    }
  }
}
console.log(failures ? `${failures} failure(s)` : `all links ok (${htmlFiles.length} pages)`);
process.exit(failures ? 1 : 0);
```

Run: `node test/check-links.js`
Expected: FAIL（`no html files found`，退出码 1）

- [ ] **Step 2: 写设计系统 `assets/style.css`**

```css
/* ========== sixdog06.github.io 设计系统 ========== */
:root {
  --bg: #0a0a0f;
  --bg-card: #101018;
  --border: #1e1e2e;
  --text: #c9d1d9;
  --dim: #6b7280;
  --accent: #33ff66;
  --accent2: #22d3ee;
  --mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: var(--mono);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56px 16px;
}
/* 网格背景 + 扫描线 */
body::before {
  content: "";
  position: fixed; inset: 0;
  background-image:
    linear-gradient(rgba(51, 255, 102, .04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(51, 255, 102, .04) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
}
body::after {
  content: "";
  position: fixed; inset: 0;
  background: repeating-linear-gradient(0deg, rgba(255, 255, 255, .02) 0 1px, transparent 1px 3px);
  pointer-events: none;
}
/* 终端窗口卡片 */
.terminal {
  width: min(680px, 100%);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 0 40px rgba(51, 255, 102, .08), 0 20px 60px rgba(0, 0, 0, .5);
  overflow: hidden;
}
.terminal-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  background: #15151f;
  border-bottom: 1px solid var(--border);
}
.dot { width: 12px; height: 12px; border-radius: 50%; }
.dot.r { background: #ff5f57; }
.dot.y { background: #febc2e; }
.dot.g { background: #28c840; }
.terminal-title { margin-left: 8px; color: var(--dim); font-size: 13px; }
.terminal-body { padding: 28px 24px 32px; line-height: 1.9; font-size: 15px; }
/* 提示符与光标 */
.prompt { color: var(--accent); }
.cursor {
  display: inline-block; width: 9px; height: 18px;
  background: var(--accent);
  vertical-align: text-bottom;
  animation: blink 1s steps(1) infinite;
}
@keyframes blink { 50% { opacity: 0; } }
/* 菜单 */
.menu { list-style: none; margin-top: 18px; }
.menu a {
  display: block; padding: 6px 10px;
  color: var(--text); text-decoration: none;
  border-left: 2px solid transparent;
  transition: all .15s;
}
.menu a:hover, .menu a:focus-visible {
  color: var(--accent);
  border-left-color: var(--accent);
  transform: translateX(6px);
  background: rgba(51, 255, 102, .05);
  text-shadow: 0 0 12px rgba(51, 255, 102, .6);
  outline: none;
}
.menu .hint { color: var(--dim); font-size: 13px; margin-left: 12px; }
/* 页脚 */
.footer { margin-top: 40px; color: var(--dim); font-size: 12px; }
/* 内页（about / games） */
.page { width: min(680px, 100%); }
.crumb { margin-bottom: 24px; font-size: 14px; }
.crumb a { color: var(--accent2); text-decoration: none; }
.crumb a:hover { text-decoration: underline; }
.title { color: var(--accent); font-size: 22px; font-weight: 600; margin-bottom: 20px; }
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 24px;
  margin-bottom: 16px;
  line-height: 2;
  transition: border-color .15s, box-shadow .15s;
}
.card-link { display: block; color: inherit; text-decoration: none; }
.card-link:hover .card {
  border-color: var(--accent);
  box-shadow: 0 0 24px rgba(51, 255, 102, .12);
}
.inline-link { color: var(--accent2); text-decoration: none; }
.inline-link:hover { text-decoration: underline; }
/* 游戏卡片 */
.game-card { display: flex; gap: 20px; align-items: center; }
.ascii-tank { color: var(--accent); font-size: 14px; line-height: 1.2; text-shadow: 0 0 10px rgba(51, 255, 102, .4); }
.game-name { color: var(--text); font-size: 16px; margin-bottom: 6px; }
.game-desc { color: var(--dim); font-size: 13px; line-height: 1.6; }
/* 手机适配 */
@media (max-width: 520px) {
  body { padding: 32px 12px; }
  .terminal-body { padding: 20px 16px 24px; font-size: 14px; }
  .game-card { flex-direction: column; align-items: flex-start; }
}
```

- [ ] **Step 3: 写主页动效 `assets/main.js`**

```js
(function () {
  'use strict';
  var text = '$ whoami  →  小拳头 // developer & game maker';
  var el = document.getElementById('typed');
  var menu = document.getElementById('menu');
  if (!el || !menu) return;
  var i = 0;
  (function tick() {
    if (i <= text.length) {
      el.textContent = text.slice(0, i++);
      setTimeout(tick, 45);
    } else {
      menu.hidden = false;
    }
  })();
})();
```

- [ ] **Step 4: 写门户主页 `index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>sixdog — home</title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
  <div class="terminal">
    <div class="terminal-bar">
      <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
      <span class="terminal-title">sixdog06.github.io — zsh</span>
    </div>
    <div class="terminal-body">
      <div><span class="prompt">sixdog@github:~$</span> <span id="typed"></span><span class="cursor"></span></div>
      <ul class="menu" id="menu" hidden>
        <li><a href="https://sixdog.notion.site/SixDog-Space-402a93949b3e4a69a9ae24c2d7d8a9d6" target="_blank" rel="noopener"><span class="prompt">&gt;</span> blog<span class="hint"># Notion · SixDog Space</span></a></li>
        <li><a href="about.html"><span class="prompt">&gt;</span> about<span class="hint"># 自我介绍</span></a></li>
        <li><a href="games/"><span class="prompt">&gt;</span> games<span class="hint"># 我做的小游戏</span></a></li>
      </ul>
    </div>
  </div>
  <div class="footer">© 2026 小拳头 · hand-crafted · zero dependencies</div>
  <script src="assets/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: 运行检查确认脚本工作**

Run: `node test/check-links.js`
Expected: 恰好 2 个 failure——`broken link -> about.html` 和 `broken link -> games/`。这证明检查脚本工作正常；这两个链接目标由 Task 2 补齐。

- [ ] **Step 6: Commit**

```bash
git add test/check-links.js assets/ index.html
git commit -m "feat: design system, terminal-style home page, link checker"
```

---

### Task 2: 自我介绍页 + 游戏展示页

**Files:**
- Create: `about.html`
- Create: `games/index.html`
- Test: `test/check-links.js`（已有）

**Interfaces:**
- Consumes: Task 1 的 CSS 类（`.page/.crumb/.title/.card/.card-link/.inline-link/.game-card/.ascii-tank/.game-name/.game-desc`）
- Produces: `/about.html`、`/games/` 两个可访问页面

- [ ] **Step 1: 写 `about.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>sixdog — about</title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
  <div class="page">
    <div class="crumb"><a href="index.html">~/</a> about</div>
    <h1 class="title">$ cat about.txt</h1>
    <div class="card">
      <p><span class="prompt">name&nbsp;&nbsp;:</span> 小拳头</p>
      <p><span class="prompt">github:</span> <a class="inline-link" href="https://github.com/sixdog06" target="_blank" rel="noopener">@sixdog06</a></p>
    </div>
  </div>
  <div class="footer">© 2026 小拳头 · hand-crafted · zero dependencies</div>
</body>
</html>
```

- [ ] **Step 2: 写 `games/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>sixdog — games</title>
<link rel="stylesheet" href="../assets/style.css">
</head>
<body>
  <div class="page">
    <div class="crumb"><a href="../index.html">~/</a> games</div>
    <h1 class="title">$ ls ~/games</h1>
    <a class="card-link" href="./tank-battle/">
      <div class="card game-card">
        <pre class="ascii-tank" aria-hidden="true">   ██
 ██████
████████
██ ██ ██</pre>
        <div>
          <div class="game-name">坦克大战 Tank Battle</div>
          <div class="game-desc">FC 经典复刻：保护基地老鹰，消灭一波波敌军坦克。方向键/WASD 移动，空格开火，共 3 关。</div>
        </div>
      </div>
    </a>
  </div>
  <div class="footer">© 2026 小拳头 · hand-crafted · zero dependencies</div>
</body>
</html>
```

（后续新游戏：复制一个 `<a class="card-link">` 卡片块即可。）

- [ ] **Step 3: 运行检查确认链接修复**

Run: `node test/check-links.js`
Expected: 剩 1 个 failure（`games/index.html: broken link -> ./tank-battle/`，Task 3 补齐）；about.html 相关 failure 消失。

- [ ] **Step 4: Commit**

```bash
git add about.html games/index.html
git commit -m "feat: about page and games listing page"
```

---

### Task 3: 部署坦克大战游戏本体 + 全站验证

**Files:**
- Create: `games/tank-battle/index.html`（复制自 `/Users/sixdog/tank-battle/tank-battle.html`，零修改）
- Test: `test/check-links.js`

**Interfaces:**
- Consumes: `/Users/sixdog/tank-battle/tank-battle.html`（已存在的完整单文件游戏）
- Produces: `/games/tank-battle/` 可直接游玩；全站链接检查全绿

- [ ] **Step 1: 复制游戏文件**

```bash
mkdir -p games/tank-battle
cp /Users/sixdog/tank-battle/tank-battle.html games/tank-battle/index.html
```

校验零修改：

```bash
diff /Users/sixdog/tank-battle/tank-battle.html games/tank-battle/index.html && echo identical
```

Expected: `identical`

- [ ] **Step 2: 链接检查全绿**

Run: `node test/check-links.js`
Expected: `all links ok (4 pages)`

- [ ] **Step 3: 本地服务器冒烟**

```bash
python3 -m http.server 8123 & SERVER_PID=$!
sleep 1
for p in / /about.html /games/ /games/tank-battle/; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8123$p")
  echo "$p -> $code"
done
kill $SERVER_PID
```

Expected: 四个路径均 `-> 200`。（若系统没有 python3，用 `npx --yes http-server -p 8123` 替代。）

- [ ] **Step 4: Commit**

```bash
git add games/tank-battle/index.html
git commit -m "feat: deploy tank battle game under /games/tank-battle/"
```

---

### Task 4: 推送 GitHub Pages 并线上验证

**前置条件（用户操作）**：用户已在终端完成 `gh auth login` 并登录账号 sixdog06。未登录则先提示用户登录，本任务才能开始。

**Files:**
- 无新文件；远程仓库创建与推送

- [ ] **Step 1: 确认 gh 登录态**

```bash
gh auth status
```

Expected: 显示已登录 github.com 账号 sixdog06。否则停止并提示用户先 `gh auth login`。

- [ ] **Step 2: 创建远程仓库并推送**

```bash
cd /Users/sixdog/sixdog06.github.io
gh repo create sixdog06.github.io --public --source . --push
```

Expected: 远程仓库创建成功，`main` 分支推送成功。

- [ ] **Step 3: 开启 GitHub Pages 并等待生效**

```bash
gh api repos/sixdog06/sixdog06.github.io/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

（用户级站点 `<username>.github.io` 通常自动启用 Pages；若上一条报 409/已存在则说明已启用，跳过即可。）等待 1~2 分钟。

- [ ] **Step 4: 线上验证**

```bash
for p in / /about.html /games/ /games/tank-battle/; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://sixdog06.github.io$p")
  echo "$p -> $code"
done
```

Expected: 四个路径均 `-> 200`。若 404 是 Pages 构建延迟，等 1 分钟重试。

- [ ] **Step 5: 人工验收（用户完成）**

浏览器访问 `https://sixdog06.github.io`：打字机动效正常、三个入口可达、博客外链新开标签页到 Notion、坦克大战可玩、手机窄屏不破版。
