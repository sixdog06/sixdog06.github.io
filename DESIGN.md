# sixdog06.github.io 门户站 · 设计笔记

> 本文档记录门户网站的设计思路与设计风格，供后续调整时参考。
> 正式规格见 `docs/superpowers/specs/2026-07-25-portal-site-design.md`，实现计划见 `docs/superpowers/plans/2026-07-25-portal-site.md`。

## 1. 项目定位

个人门户静态站，部署在 GitHub Pages（`https://sixdog06.github.io`），作为三块内容的导航中心：

- **博客** → 外链 Notion [SixDog Space](https://sixdog.notion.site/SixDog-Space-402a93949b3e4a69a9ae24c2d7d8a9d6)（不自建博客系统）
- **自我介绍** → 站内 `about.html`
- **游戏** → 站内 `games/` 展示页（持续添加，第一个：坦克大战）

## 2. 需求决策记录

| 问题 | 决策 |
|------|------|
| 博客自建还是外链？ | 外链 Notion，主页只放入口 |
| 自我介绍内容 | 极简：昵称"小拳头" + GitHub @sixdog06，无多余文案 |
| 推进方式 | 先做门户 + 游戏页；博客系统不做 |
| 技术形态 | 纯手写 HTML/CSS/JS，零依赖、零构建、无 CDN/外部字体 |
| 部署方式 | `gh` CLI 建仓库 + PR 合并上线 |
| 旧站点处理 | 远程仓库原有 Hugo 博客被覆盖（旧内容保留在 git 历史中可恢复） |

## 3. 站点结构

```
index.html               # 门户主页：终端窗口 + 打字机 + 三入口菜单
about.html               # 自我介绍（极简）
games/index.html         # 游戏展示页（卡片列表）
games/tank-battle/       # 坦克大战（单文件游戏，原样复制）
assets/style.css         # 全站设计系统（所有页面共用）
assets/main.js           # 主页打字机动效
test/check-links.js      # 链接/结构检查（node test/check-links.js）
```

设计要点：每个页面独立 URL（`/about.html`、`/games/`），后续加游戏 = 加一个目录 + 复制一个卡片块。

## 4. 设计风格（设计系统）

**基调**：深色终端极客风——让人一眼感到"技术力"。

- **配色**：近黑底 `#0a0a0f`；卡片底 `#101018`；边框 `#1e1e2e`；正文 `#c9d1d9`；弱化文字 `#6b7280`；主强调色终端绿 `#33ff66`；辅助青 `#22d3ee`
- **字体**：系统等宽字体栈（`ui-monospace, SF Mono, Cascadia Code, Menlo, Consolas`），零外部字体请求
- **背景**：CSS 绘制的细网格（32px，绿色 4% 透明度）+ 扫描线纹理（`body::before/::after` 伪元素，无图片）
- **主页构图**：居中的"终端窗口"卡片——红黄绿三点标题栏 + 打字机输出 `$ whoami → 小拳头` + 菜单逐项浮现，光标闪烁
- **菜单交互**：hover 时文字变绿、左边框亮起、右移 6px、发光 `text-shadow`、浅绿底色
- **内页**（about/games）：同一设计系统的简洁页面，命令式标题（`$ cat about.txt`、`$ ls ~/games`）+ 面包屑返回
- **游戏卡片**：ASCII 像素坦克（等宽字符 + 绿色发光）+ 名称 + 一句话简介，整卡可点击，hover 边框发光
- **响应式**：≤520px 时收窄边距、游戏卡片纵向排列
- **健壮性**：`<noscript>` 兜底（禁用 JS 时菜单直接显示，主页不会变死路）
- **动效**：全部 CSS + 16 行原生 JS（打字机），无第三方库

## 5. 部署与维护

- 本地仓库 `~/sixdog06.github.io`，远程 `sixdog06/sixdog06.github.io`（默认分支 `master`，本地分支 `main` 与之对应）
- 上线流程：改代码 → `node test/check-links.js` 验证 → 提交 → 推送 → GitHub Pages 自动构建（约 1 分钟）
- **加新游戏**：
  1. 游戏文件放 `games/<名字>/index.html`
  2. `games/index.html` 里复制一个 `<a class="card-link">` 卡片块，改名称/简介/ASCII 图案
  3. 跑链接检查，推送

## 6. 已知可改进点（终审记录，均未做）

- `prefers-reduced-motion`：未尊重系统减弱动效偏好（光标闪烁/打字机可加媒体查询关闭）
- 无 favicon（浏览器会 404 请求 `/favicon.ico`，可加内联 SVG 保持零外部请求）
- 无 `<meta name="description">`（SEO/分享预览）
- `test/check-links.js` 不校验外链的 `target="_blank" rel="noopener"` 属性（可加一条正则）
- 旧 Hugo 博客：如需找回，在 PR #1 合并前的 `master` 历史中
