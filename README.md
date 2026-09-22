# Mingyang Yu · Ice Bricks

Astro + TypeScript 双语个人网站，React 仅用于首页互动。保留用户原蓝发黑衣人物，使用五张保真分层图片实现肩、肘、手腕和头部独立动作；展台是带实体厚度、圆柱凸点和透射材质的 Three.js 冰积木。

当前视觉为 Glacial Spectrum：青蓝与少量紫蓝环境光、六项目原创概念图、局部卡片光照、仅封面小角度反馈。静态正文不依赖 JS；没有新增动画库或第二个 WebGL 背景。来源与许可见 [VISUAL-SOURCES.md](docs/VISUAL-SOURCES.md)，前后对照与本轮验证见 [VISUAL-UPGRADE.md](docs/VISUAL-UPGRADE.md)。

## 本地启动

已验证环境：Windows、Node.js 24.14.1、npm 11.11.0。使用 Node.js 24 LTS，在项目根目录执行：

```powershell
npm.cmd ci
.\start-site.ps1
```

默认地址为 `http://127.0.0.1:4321/en/`，中文为 `/zh/`。脚本会构建、检查本项目已有服务并输出实际地址；端口被其他程序占用时选择空闲端口。服务只绑定本机。开发或手动预览：

```powershell
npm.cmd run dev -- --port 4321
# 或先构建再预览
npm.cmd run build
npm.cmd run preview -- --port 4321
```

Astro 后台服务可在项目目录用 `npx.cmd astro preview status` / `npx.cmd astro preview stop` 查询或停止；开发模式对应 `astro dev status/stop`。

## 内容和结构

24 个 HTML：中英文首页、Work、About、Résumé、六个项目详情、各语言 404，另有根跳转页和根 404。导航为 Work / About / Résumé。Play 已删除，旧地址返回本地 404；GoldenCamp 和 Experiments 项目分类保留。

| 维护项 | 文件 |
| --- | --- |
| 双语个人事实、经历、六个项目 | `src/data/content.ts` |
| 唯一公开联系配置 | `src/data/site-config.ts` |
| 界面文字与语言路由 | `src/i18n/ui.ts` |
| 人物状态、资源降级、输入响应 | `src/components/Avatar.tsx` |
| 2.6 秒肩肘腕头部时间线 | `src/lib/avatar-motion.ts` |
| 五层衍生图和关节点 | `public/images/avatar/rig/` |
| 首页实体冰积木及 SVG 降级 | `src/components/ice/` |
| 主题、响应式、打印 | `src/styles/global.css` |
| 冰川色彩、环境光与交互样式 | `src/styles/spectrum.css` |
| 项目概念图与两套主题 | `src/components/ProjectArt.astro`、`src/styles/project-art.css` |
| 卡片指针、首次入场与全站暂停 | `src/scripts/visual-effects.ts` |

人物首次加载并可见、场景初始化完成后，每次浏览器会话自动欢迎一次；点击人物或“打个招呼 / Say hello”可重复触发。初始化期间保留完整静态人物。暂停、减少动态效果、隐藏与离屏会停止动作；恢复不补播队列。资源失败保留原正面图，3D 失败保留 SVG 展台。角色是二维分层动画，不是三维人体模型；手保持原图微握造型。

联系邮箱统一为 `yumin050717@gmail.com`，支持真实 mailto、精确复制与失败时选中文本。简历提供浏览器打印；没有虚构正式 PDF 下载。其他内容不连接公司后端、不含患者资料或业务源码。

## 验证

```powershell
npm.cmd run check
npm.cmd run lint
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
node scripts/record-avatar.mjs
node tests/ice-browser-check.mjs
node scripts/audit-site.mjs
node scripts/check-static.mjs
node scripts/check-runtime-assets.mjs
node scripts/check-print.mjs
node scripts/audit-performance.mjs
```

本轮新增证据脚本（基线应在修改前运行，勿把当前版本写为旧基线）：

```powershell
node scripts/capture-visual-upgrade.mjs after
node scripts/record-visual-upgrade.mjs
node scripts/audit-visual-performance.mjs after
```

为保留旧轮审计文件，可设置 `$env:REPORT_DIRECTORY='docs/reports/visual-upgrade'`、`$env:SCREENSHOT_DIRECTORY='docs/screenshots/visual-upgrade/after'`，再运行 ice-browser-check、audit-site、check-static、check-runtime-assets 和 check-print。新脚本的输出位置已固定到本轮目录。完整手势测试仍在 `test:e2e` 中；新增 visual-upgrade 测试覆盖轻量视觉增强和异常。

浏览器审计使用本机 4321 服务。录屏是实际点击/触屏触发，不对动画时间轴跳帧或加速。性能采样应单独运行，避免并发测试争抢 CPU。当前视觉升级结果、环境和限制见 [VISUAL-UPGRADE.md](docs/VISUAL-UPGRADE.md)；历次验收入口见 [ACCEPTANCE.md](docs/ACCEPTANCE.md)。

## 公开边界

仅同步此网站源码、必要优化网页素材和精选验收证据。原始 PNG、私人提示词、环境真值、本机快照、模型、依赖、构建输出、巨大的浏览器 trace 均忽略，不进入仓库。直接 clone 后只需 Node/npm 即可构建；不需要私有原图、Python 或抠图模型。可选素材复现见 [ASSETS.md](docs/ASSETS.md) 和 [REVISION-ASSETS.md](docs/REVISION-ASSETS.md)。

本轮只推送 `feat/ice-visual-upgrade` 源码分支，不覆盖 `main`、不部署网站。未配置 `SITE_URL` 时维持 `noindex, nofollow` 和 robots 禁止抓取，无 sitemap/canonical。真实域名与公开部署需要另行确定；不要用测试域名冒充上线。

动作证据和后续维护入口见 [HANDOFF.md](docs/HANDOFF.md)、[REVISION-AVATAR.md](docs/REVISION-AVATAR.md)。
