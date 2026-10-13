# Mingyang Yu · Ice Bricks

Astro + TypeScript 双语个人网站，React 用于全站波浪背景及首页互动。保留用户原蓝发黑衣人物，使用五张保真分层图片实现肩、肘、手腕和头部独立动作；展台是带实体厚度、圆柱凸点和透射材质的 Three.js 冰积木。

当前全站使用用户指定的 React Bits GradientWaves + OGL：单个固定视口背景、原样波形 GLSL、青蓝波浪和独立深色配色。桌面浅色严格使用用户示例参数；手机保留动态并使用 low 质量。六项目内容与两套主题保留。本轮改进人物动作与锁定、作品筛选的连续位置过渡、封面细微视差、正文阅读导航及冰积木指针反馈。来源与许可见 [VISUAL-SOURCES.md](docs/VISUAL-SOURCES.md)，当前验收见 [AVATAR-INTERACTION.md](docs/AVATAR-INTERACTION.md)；[GradientWaves 交付记录](docs/GRADIENT-WAVES.md)和[上一轮视觉记录](docs/VISUAL-UPGRADE.md)保留。

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
| 3.4 秒独立关节、阶段与速度变化 | `src/lib/avatar-motion.ts` |
| 原服装色肩肘接缝背片 | `src/components/AvatarJointSurface.tsx` |
| 五层衍生图和关节点 | `public/images/avatar/rig/` |
| 首页实体冰积木及 SVG 降级 | `src/components/ice/` |
| 主题、响应式、打印 | `src/styles/global.css` |
| 既有冰川色彩与卡片交互 | `src/styles/spectrum.css` |
| 全视口波浪、GL 生命周期与示例参数 | `src/components/waves/` |
| 内容层叠、局部阅读底板与打印 | `src/styles/waves-site.css` |
| 项目概念图与两套主题 | `src/components/ProjectArt.astro`、`src/styles/project-art.css` |
| 卡片指针、首次入场与全站暂停 | `src/scripts/visual-effects.ts` |

人物只通过点击／触摸本体，或键盘聚焦后 Enter／Space 触发，没有自动欢迎或人物区独立按钮。严格经历 idle → preparing → raising → waving → recovering → idle；同步锁定后，动作中输入无效，最后一个关节归零并释放动画后才能再触发。人物素材就绪独立于冰积木 WebGL。顶栏暂停控制长期背景，仍允许主动的有限人物动作；减少动态效果提供有限静态回应。隐藏、离屏、打印、卸载和动画异常清理关节与锁定。角色是二维原图分层动画，手保持原图微握造型，十张参考图用于姿态与遮挡约束，未逐图切换、未宣称三维动作提取。

联系邮箱统一为 `yumin050717@gmail.com`，支持真实 mailto、精确复制与失败时选中文本。简历提供浏览器打印；没有虚构正式 PDF 下载。其他内容不连接公司后端、不含患者资料或业务源码。

## 验证

```powershell
$env:REPORT_DIRECTORY='docs/reports/avatar-interaction'
$env:SCREENSHOT_DIRECTORY='docs/screenshots/avatar-interaction/after'
npm.cmd run check
npm.cmd run lint
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
node tests/ice-browser-check.mjs
node scripts/audit-site.mjs
node scripts/check-static.mjs
node scripts/check-runtime-assets.mjs
node scripts/check-print.mjs
```

本轮新增证据脚本（基线应在修改前运行，勿把当前版本写为旧基线）：

```powershell
node scripts/record-avatar-interaction.mjs after
node scripts/measure-gradient-motion.mjs after
node scripts/audit-gradient-performance.mjs after
```

为保留历史审计文件，使用上面的 avatar-interaction 输出目录。录制脚本只对本轮独立目录输出，已完成的录屏不会覆盖；提取视频帧需要可用 ffmpeg，详见脚本。完整手势与页面动效测试均在 `test:e2e` 中。旧 capture/record-visual-upgrade、record-avatar、record-gradient-waves 脚本为各自历史版本的复现工具，不代表当前人物控件。

浏览器审计使用本机 4321 服务。录屏是实际点击/触屏触发，不对动画时间轴跳帧或加速。性能采样应单独运行，避免并发测试争抢 CPU；使用当前 REPORT_DIRECTORY 保存本轮各三次 Lighthouse 和连续动画测量。实际结果、环境和限制见 [AVATAR-INTERACTION.md](docs/AVATAR-INTERACTION.md)；历次验收入口见 [ACCEPTANCE.md](docs/ACCEPTANCE.md)。

## 公开边界

仅同步此网站源码、必要优化网页素材和精选验收证据。原始 PNG、私人提示词、环境真值、本机快照、模型、依赖、构建输出、巨大的浏览器 trace 均忽略，不进入仓库。直接 clone 后只需 Node/npm 即可构建；不需要私有原图、Python 或抠图模型。可选素材复现见 [ASSETS.md](docs/ASSETS.md) 和 [REVISION-ASSETS.md](docs/REVISION-ASSETS.md)。

本轮从 `feat/gradient-waves-background` 的 `119a819` 及当前工作区继续，只推送 `codex/avatar-interaction-revision` 源码分支，不覆盖 `main`、不部署网站。未配置 `SITE_URL` 时维持 `noindex, nofollow` 和 robots 禁止抓取，无 sitemap/canonical。真实域名与公开部署需要另行确定；不要用测试域名冒充上线。

当前动作与维护入口见 [AVATAR-INTERACTION.md](docs/AVATAR-INTERACTION.md)。[HANDOFF.md](docs/HANDOFF.md)、[REVISION-AVATAR.md](docs/REVISION-AVATAR.md)保留为早期人物修订记录。
