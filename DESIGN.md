# sixdog06.github.io 门户站 · 设计笔记

> 本文档记录门户网站的设计思路与设计风格，供后续调整时参考。
> 正式规格见 `docs/superpowers/specs/2026-07-25-portal-site-design.md`，实现计划见 `docs/superpowers/plans/2026-07-25-portal-site.md`。

## 1. 项目定位

个人门户静态站，部署在 GitHub Pages（`https://sixdog06.github.io`），作为三块内容的导航中心：

- **博客** → 外链 Notion [SixDog Space](https://sixdog.notion.site/SixDog-Space-402a93949b3e4a69a9ae24c2d7d8a9d6)（不自建博客系统）
- **自我介绍** → 站内 `about.html`
- **有趣的东西** → 站内 `fun/` 展示页（导航叫 "fun"，展示小工具/小玩意儿，持续添加，第一个：坦克大战）

## 2. 需求决策记录

| 问题 | 决策 |
|------|------|
| 博客自建还是外链？ | 外链 Notion，主页只放入口 |
| 自我介绍内容 | 极简：昵称"小拳头" + 一句 bio（"一个喜欢音乐的人"）+ GitHub @sixdog06；不提游戏 |
| 游戏板块命名 | 不叫"游戏"：导航显示 `fun`，hint 为"一些有趣的小玩意儿，have fun"；URL 也用 `/fun/` |
| 推进方式 | 先做门户 + 游戏页；博客系统不做 |
| 技术形态 | 纯手写 HTML/CSS/JS，零依赖、零构建、无 CDN/外部字体 |
| 部署方式 | `gh` CLI 建仓库 + PR 合并上线 |
| 旧站点处理 | 远程仓库原有 Hugo 博客被覆盖（旧内容保留在 git 历史中可恢复） |

## 3. 站点结构

```
index.html               # 门户主页：终端窗口 + 打字机 + 三入口菜单
about.html               # 自我介绍（极简）
fun/index.html           # 游戏展示页（卡片列表）
fun/tank-battle/         # 坦克大战（单文件游戏，原样复制）
assets/style.css         # 全站设计系统（所有页面共用）
assets/main.js           # 主页打字机动效
assets/theme.js          # 亮暗主题切换按钮（所有页面共用）
test/check-links.js      # 链接/结构检查（node test/check-links.js）
```

设计要点：每个页面独立 URL（`/about.html`、`/fun/`），后续加游戏 = 加一个目录 + 复制一个卡片块。

## 4. 设计风格（设计系统）

**基调**：终端极客风——让人一眼感到"技术力"。亮色为默认主题，右上角按钮可一键切换到暗色。

- **配色**（亮色，`:root`）：浅灰底 `#f5f6f8`；卡片底 `#ffffff`；边框 `#e3e5ea`；正文 `#24292f`；弱化文字 `#6b7280`；主强调色深终端绿 `#16a34a`（亮底下保证对比度）；辅助青 `#0891b2`。暗色主题（`[data-theme="dark"]`）保留原配色：近黑底 `#0a0a0f`、荧光绿 `#33ff66`、辅助青 `#22d3ee`。所有主题相关颜色（含网格、扫描线、发光阴影）都是 CSS 变量，两套主题只切换变量值
- **主题切换**：`assets/theme.js` 在右上角注入切换按钮，选择存 `localStorage`；每页 `<head>` 有一行内联脚本在首屏前应用已存主题，避免闪烁
- **字体**：系统等宽字体栈（`ui-monospace, SF Mono, Cascadia Code, Menlo, Consolas`），零外部字体请求
- **背景**：CSS 绘制的细网格（32px，绿色 4% 透明度）+ 扫描线纹理（`body::before/::after` 伪元素，无图片）
- **主页构图**：居中的"终端窗口"卡片——红黄绿三点标题栏 + 打字机输出 `$ whoami → 小拳头 // developer & music lover` + 菜单逐项浮现（blog / about / fun），光标闪烁
- **菜单交互**：hover 时文字变绿、左边框亮起、右移 6px、发光 `text-shadow`、浅绿底色
- **内页**（about/fun）：同一设计系统的简洁页面，命令式标题（`$ cat about.txt`、`$ ls ~/fun`）+ 面包屑返回
- **游戏卡片**：ASCII 像素坦克（等宽字符 + 绿色发光）+ 名称 + 一句话简介，整卡可点击，hover 边框发光
- **响应式**：≤520px 时收窄边距、游戏卡片纵向排列
- **健壮性**：`<noscript>` 兜底（禁用 JS 时菜单直接显示，主页不会变死路）
- **动效**：全部 CSS + 少量原生 JS（打字机、主题切换），无第三方库

## 5. 部署与维护

- 本地仓库 `~/sixdog06.github.io`，远程 `sixdog06/sixdog06.github.io`（只用 `master` 一个分支，本地跟踪 `origin/master`）
- 上线流程：改代码 → `node test/check-links.js` 验证 → 提交 → 推送 → GitHub Pages 自动构建（约 1 分钟）
- **加新游戏**：
  1. 游戏文件放 `fun/<名字>/index.html`
  2. `fun/index.html` 里复制一个 `<a class="card-link">` 卡片块，改名称/简介/ASCII 图案
  3. 跑链接检查，推送

## 6. 已知可改进点（终审记录，均未做）

- `prefers-reduced-motion`：未尊重系统减弱动效偏好（光标闪烁/打字机可加媒体查询关闭）
- 无 favicon（浏览器会 404 请求 `/favicon.ico`，可加内联 SVG 保持零外部请求）
- 无 `<meta name="description">`（SEO/分享预览）
- `test/check-links.js` 不校验外链的 `target="_blank" rel="noopener"` 属性（可加一条正则）
- 旧 Hugo 博客：如需找回，在 PR #1 合并前的 `master` 历史中
