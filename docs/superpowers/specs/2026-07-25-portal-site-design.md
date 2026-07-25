# sixdog06.github.io 门户站点设计文档

日期：2026-07-25
状态：已获用户确认（用户要求从简）

## 1. 目标与范围

在 GitHub Pages 上部署个人门户站点（`sixdog06.github.io`），作为博客、自我介绍、游戏作品的导航中心。纯手写 HTML/CSS/JS，零依赖零构建，深色极客风，UI 有设计感和技术力。

**本期范围**：
- 门户主页：三个入口（博客 / 自我介绍 / 游戏）
- 自我介绍页：极简（昵称"小拳头" + GitHub @sixdog06 链接）
- 游戏展示页：游戏卡片列表（本期只有坦克大战，结构上支持后续添加）
- 部署坦克大战游戏本体，浏览器直接可玩

**明确不做**：自建博客系统（博客入口直接外链 Notion： https://sixdog.notion.site/SixDog-Space-402a93949b3e4a69a9ae24c2d7d8a9d6 ）、后端、评论、统计。

## 2. 站点结构

仓库根目录即 GitHub Pages 站点根：

```
index.html               # 门户主页：终端风导航中心
about.html               # 自我介绍
games/index.html         # 游戏展示页（卡片列表）
games/tank-battle/index.html   # 坦克大战（复制自 ~/tank-battle/tank-battle.html，零修改）
assets/style.css         # 全站设计系统（门户/关于/游戏页共用）
assets/main.js           # 全站动效
```

## 3. 视觉设计

- **基调**：深色（近黑底 `#0a0a0f`）、等宽字体（系统 monospace 栈）、单一强调色（终端绿 `#33ff66` 系）+ 辅助青色。
- **主页**：居中终端窗口式卡片，打字机效果输出标题与三个菜单项（`> blog` / `> about` / `> games` 风格），背景细网格 + 扫描线动效，菜单项 hover 发光位移。
- **about / games 页**：同一设计系统的简洁内页，顶部返回主页链接。
- **游戏卡片**：封面区（CSS 绘制的迷你像素坦克图案）+ 名称 + 一句话简介 + 进入链接；后续新游戏只需复制一个卡片块。
- **响应式**：桌面为主，手机上单列布局不破版即可。
- 动效全部 CSS + 少量原生 JS（打字机），无第三方库、无外部字体/图片请求；博客/GitHub 等外链一律新标签页打开（`target="_blank" rel="noopener"`）。

## 4. 部署

1. 本地 `~/sixdog06.github.io/` 建仓库、完成全部文件。
2. 用户先执行 `gh auth login` 登录。
3. 用 `gh repo create sixdog06.github.io --public --source . --push` 建远程仓库并推送，GitHub Pages 自动生效于 `https://sixdog06.github.io`。

## 5. 验证

- 静态站点无单测；验证方式：本地起静态服务器（`python3 -m http.server`）逐页人工浏览 + 脚本检查内部链接目标文件全部存在。
- 部署后访问线上地址确认三页可达、游戏可玩。
