# Glacial Spectrum · 增量视觉升级

2026-09-22。基于实际检查的 `main` / `15581693a08c39c1eed7c0a552acecf2fae5d76e` 创建 `feat/ice-visual-upgrade`；开始时工作区仅有新需求附件。没有重建工程、回退用户文件或改变原人物素材。源码公开与网站部署分开：本轮只同步分支，预览仍只在本机。

## 视觉变化与组件选择

主阅读区是雪白 `#f5faff` / 深海 `#0d1d32`，青色 `#74dceb`、蓝色 `#3d7fe8` 和少量紫蓝 `#b9b4f5` 形成局部光场。主标题仅一段静态蓝色强调，保留本地 Manrope、姓名、正文与两项入口的清楚关系。

- **首屏**：有方向的折射光片与柔和色场围绕原公仔。原肩、肘、手腕、头部动作与身体固定策略保留；挥手时环境动态暂停。桌面光晕只慢速移动/改变透明度，手机使用完整静态色场。
- **冰积木**：继续使用真实实体和圆柱凸点；场景与 DOM 共用 paper 色和青蓝紫体系。保留场景内透射背景、首帧 SVG 保护、主题切换和图形失败回退。独立检查边缘融合，不能用透明 Canvas 代替可折射的场景背景。
- **项目封面**：营地与矿石、资料到共享上下文及输出、测量记录到报告、数据到时间划分/模型/评估，均为原创 SVG 概念图。六个项目、两语言和示意标签保留；不使用业务截图或虚构指标。GoldenCamp 只用局部金色表达矿石。
- **反馈**：采用 React Bits Spotlight Card TS-CSS 的坐标/局部光机制，改写为 Astro DOM 增强；封面相对中心最多约 3° 倾斜。整个链接矩形、标题和描述不移动；触屏、暂停和减少动态不追踪鼠标。
- **进入与导航**：分组首次进入时 14px / 520ms 淡入；正文初始可见。导航统一蓝色焦点/当前状态，联系区采用静态光片，邮件动作仍是真实 mailto/复制。

实际读取和操作了 React Bits 四项、Paper Mesh Gradient、Magic Card、Aceternity Spotlight 的官方演示和源码；Motion 的性能/React/AI Kit 文档也已核查。Paper 是视觉参考下的自编轻量近似，不是 shader 集成。没有加入 Motion、GSAP、OGL、Paper、Tailwind、shadcn、next-themes 或付费工具。Magic Card 与所选卡片效果重复；Aurora 会增加独立图形运行时；Fade Content 当前源码依赖 GSAP 并默认隐藏内容，未照搬。精确 commit、变体和许可见 [VISUAL-SOURCES.md](VISUAL-SOURCES.md)，React Bits 的 MIT + Commons Clause 完整原文见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。

## 动效与失败边界

普通交互 180ms、封面复位 320ms、进入 520ms、环境 18s；缓动 `cubic-bezier(.2,.7,.2,1)`，环境用 ease-in-out。卡片 pointermove 每帧最多合并一次 CSS 变量更新，不通过 React state 重渲染，也没有永久 rAF。环境只处理 transform/opacity，渐变与遮罩不逐帧改半径。

既有 `ice-paused` 统一控制人物、新背景、入场和卡片；跨页面读取，跨标签存储事件同步。减少动态、页面隐藏和离屏停止活动效果；进入效果离屏即取消。BFCache 返回保留增强，真正退出时清理事件和 observer。无 JS/JS 迟到时静态封面、正文、邮箱和路由仍可读可点。

可选 3D 准备最多等待 10 秒，超时卸载其 island、固定 SVG 展台并恢复人物手势能力，防止迟到 GPU 初始化打断挥手。图层失败仍回到原正面人物；快速点击不叠加问候。

## 同条件前后证据

修改前截图与性能全部在产品源码修改前采集。相同生产 preview、视口、语言、主题和页面路径。静态比较使用 reduced-motion，以相同待机姿势观察颜色；动态录屏另用正常动态偏好与真实输入。

| 场景 | 修改前 | 修改后 |
| --- | --- | --- |
| 1440×1000 英文浅色 | [首屏](screenshots/visual-upgrade/before/desktop-en-light-viewport.png) / [全页](screenshots/visual-upgrade/before/desktop-en-light-full.png) | [首屏](screenshots/visual-upgrade/after/desktop-en-light-viewport.png) / [全页](screenshots/visual-upgrade/after/desktop-en-light-full.png) |
| 1440×1000 中文浅色 | [全页](screenshots/visual-upgrade/before/desktop-zh-light-full.png) | [全页](screenshots/visual-upgrade/after/desktop-zh-light-full.png) |
| 1440×1000 英文深色 | [全页](screenshots/visual-upgrade/before/desktop-en-dark-full.png) | [全页](screenshots/visual-upgrade/after/desktop-en-dark-full.png) |
| 390×844 英文浅色 | [首屏](screenshots/visual-upgrade/before/mobile-en-light-viewport.png) / [全页](screenshots/visual-upgrade/before/mobile-en-light-full.png) | [首屏](screenshots/visual-upgrade/after/mobile-en-light-viewport.png) / [全页](screenshots/visual-upgrade/after/mobile-en-light-full.png) |
| 390×844 中文深色 | [全页](screenshots/visual-upgrade/before/mobile-zh-dark-full.png) | [全页](screenshots/visual-upgrade/after/mobile-zh-dark-full.png) |

同目录还有 320px 首页、英文桌面与中文手机的 AI 项目详情。`before-screenshots.json` / `after-screenshots.json` 保存路径、HTTP状态、viewport/scrollWidth 和页面错误。旧 `screenshots/revision/` 与旧动作视频不覆盖。

## 本轮性能

采样脚本 `scripts/audit-visual-performance.mjs`，每阶段桌面/模拟移动各三次、每次独立 Chromium。正式数据在 `reports/visual-upgrade/before-performance.json` 和 `after-performance.json`。环境为 Windows、Node 24.14.1、Chromium 153.0.8010.12、Lighthouse 13.5.0；桌面使用 Lighthouse desktop config，移动使用默认模拟移动配置，记录完整 throttling 和 screenEmulation。

| 指标（中位数，范围） | 修改前桌面 | 修改后桌面 | 修改前移动模拟 | 修改后移动模拟 |
| --- | ---: | ---: | ---: | ---: |
| Performance | 82 （81–82） | 91 （91–91） | 70 （70–70） | 75 （73–75） |
| LCP | 482 ms（463–546） | 566 ms（565–569） | 2555 ms（2555–2555） | 2555 ms（2554–2556） |
| TBT | 420.0 ms（409–434） | 243.0 ms（240–245） | 1772.0 ms（1754–1817） | 1014.5 ms（994.5–1184） |
| CLS | 0.000027 （0.000027–0.000106） | 0.003184 （0.003184–0.003184） | 0.000000 （0.000000–0.000000） | 0.000000 （0.000000–0.000000） |
| JS 下载 | 305.13 KiB（305.13–305.13） | 307.96 KiB（307.96–307.96） | 305.13 KiB（305.13–305.13） | 307.96 KiB（307.96–307.96） |
| JS 执行 | 195 ms（171–196） | 154 ms（145–155） | 799 ms（779–813） | 626 ms（614–701） |

桌面 LCP 中位增加约83ms，CLS仍很低；模拟移动 LCP基本不变。新增JS传输约2.83KiB。最终连续样本的桌面/移动TBT分别下降约42%/43%；这是本机这一组对照，需结合下面的异常组与软件GPU限制理解。

桌面：1350×940、DPR1、模拟 RTT40ms/10Mbps/CPU×1。移动：412×823、DPR1.75、模拟 RTT150ms/1.6Mbps/CPU×4。两阶段设置完全相同，性能采样未与其他主动浏览器测试并行。

- 修改前 desktop：首屏最长任务 510–537ms，主要归于 IceScene 初始化/首次提交，逐次 URL、起点、执行/主线程分类均在 JSON 中。
- 修改前 mobile：首屏最长任务 2077–2216ms，主要归于 IceScene 初始化/首次提交，逐次 URL、起点、执行/主线程分类均在 JSON 中。
- 修改后 desktop：首屏最长任务 366–370ms，主要归于 IceScene 初始化/首次提交，逐次 URL、起点、执行/主线程分类均在 JSON 中。
- 修改后 mobile：首屏最长任务 1366–1546ms，主要归于 IceScene 初始化/首次提交，逐次 URL、起点、执行/主线程分类均在 JSON 中。

JS 下载量取 Lighthouse resource-summary 的 script transferSize；执行量是 bootup-time 报告条目的 scripting + scriptParseCompile 合计，不代表浏览器全部 CPU 时间。主要长任务/主线程分类随每次样本保存。TBT 是实验室首屏阻塞指标，不是真实 INP 或真实手机结论。分数不是视觉合格的唯一标准。

首轮升级后六次采样曾出现明显回退（桌面中位 71 / TBT 1117.5ms，移动 66 / TBT 5097.5ms），保留在 [initial-performance.json](reports/visual-upgrade/initial-performance.json)。之后在源码与构建未改变时，同入口单次复核变快，禁用 GPU shader 磁盘缓存也未重现；不能据此把原因归咎于缓存。实际 trace 的一次 357ms 首任务中约 299ms 为 Commit 等待，与 SwiftShader 软件 GPU 的约 298ms 任务重合，纹理上传不足 1ms。已确认真实 Canvas 绘制、SVG 撤下，非超时降级刷分。首次异常的单一原因仍不确定；完整事实和限制见 [诊断记录](reports/visual-upgrade/performance-diagnostic.json)。最终表格使用重新连续采集的三次中位数及范围，同时保留异常组，不能将最好单次或此软件 GPU 的实验值泛化到所有设备。

## 实际验收与限制

| 检查 | 本轮实际结果 |
| --- | --- |
| Astro check / ESLint | 33 个文件，0 errors / warnings / hints；Lint exit 0 |
| Vitest | 2 个文件，20/20 通过 |
| 生产 build | 24 HTML，exit 0 |
| Playwright 页面、人物与新视觉 | 63/63，0 失败、跳过或 flaky；215.9 秒 |
| 冰场景专项 | 6/6，真实首帧 116 次 GL draw；暂停、挥手、隐藏与离屏窗口各 0 次额外绘制 |
| axe | 22 个页面/主题/尺寸/动态场景，0 violations |
| 静态 / 运行资源 | 24 HTML / 20 内容页，0 问题；6 路由运行资源检查通过 |
| 同条件截图 | 8 场景，全部 HTTP 200、无页面异常或横向溢出 |
| 真实人物动作 | 桌面/触屏各 7 连续关键帧，身体固定、肩肘腕运动与归零断言通过 |
| 打印 | 中英文各 1 页 A4；实际 PDF 全文与 DOM 一致，邮件链接正确；两页渲染均已目视 |
| 全新目录安装与构建 | 从审阅过的 Git index 导出，npm ci 安装 586 包 / audit 587 包 / 0 vulnerabilities；24 页构建通过 |

完整结果见 [browser-tests.json](reports/visual-upgrade/browser-tests.json)、[ice-browser-results.json](reports/visual-upgrade/ice-browser-results.json)、[axe.json](reports/visual-upgrade/axe.json)、[打印 PDF 检查](reports/visual-upgrade/print-pdf-inspection.json)、[隔离安装](reports/visual-upgrade/clean-install.json)。全量测试后仅调整两个旧截图测试的输出目录，防止覆盖旧轮证据；这两项另行重跑 2/2 通过，Lint 再次通过。最终 46 个产品源码、公开素材和构建配置与干净构建快照一致（7 个文件仅 Windows/Git 换行差异）。

本轮新增 9 项测试覆盖卡片光线坐标、鼠标离开复位、标题/点击区稳定、跨页暂停、动态偏好切换、挥手/离屏/隐藏停动、触屏真实关节、10 秒图形超时、深浅 SVG、无 JS，以及 history/BFCache 生命周期。既有 54 项继续覆盖中英文主页面与 12 详情、筛选、邮箱成功与失败反馈、手机导航、简历、404 和人物动作。

- [桌面实际录屏](evidence/visual-upgrade-desktop.webm)：真实交互约 21.0 秒，容器时长 22.0 秒；人物挥手、卡片进入/离开、导航及主题切换。
- [手机触控实际录屏](evidence/visual-upgrade-mobile.webm)：真实交互约 21.0 秒，容器时长 21.8 秒；触摸招呼、进入详情、菜单与主题切换。
- [桌面动作 7 帧](screenshots/visual-upgrade/after/motion-desktop-sequence.jpg) / [手机动作 7 帧](screenshots/visual-upgrade/after/motion-mobile-sequence.jpg)：已实际目视抬手、不同腕姿、放下和复位。身体底图没有随手臂摇动；峰值手部未裁切。
- [桌面前后拼图](screenshots/visual-upgrade/comparison-desktop.jpg) / [手机前后拼图](screenshots/visual-upgrade/comparison-mobile.jpg)。

录屏由正常速率浏览器实时写入，没有 seek、动画调速或替代视频。另从两个实际 WebM 每 3 秒解码抽帧复核，确认整段含网页内容和上述交互；[motion.json](reports/visual-upgrade/motion.json) 保存实采时刻和关节矩阵。移动覆盖为 Chromium 触控模拟，不是实体手机。

本轮发现并修复：环境光矩形边缘（加入静态径向软遮罩）；保存于 BFCache 后过早失去清理监听（区分 persisted 与真正退出）；极慢图形初始化无限阻塞挥手（10 秒 SVG 降级）；新测试可能覆盖旧截图（新增独立证据目录并恢复历史文件）。修复后的受影响检查均已重跑。

现有非失败提示仍保留：Three 首屏分包大于 500 kB，React Three Fiber 的 THREE.Clock 弃用提示，ESLint 9 安装弃用提示，以及 pdfplumber FontBBox 描述警告。PDF 独立文本提取和实际渲染通过；这些提示未冒充为已修复。

尚未验证真实 iOS/Android、Safari/Firefox、人工屏幕阅读器、真实操作系统后台调度、邮件客户端发送或实际纸张打印。隐藏状态的处理器测试有明确事件注入，不能冒充真实后台设备行为。没有公开部署、域名/CDN 或公司后端验收；不需要新的私人人物素材。

访问与启动：`http://127.0.0.1:4321/en/`、`http://127.0.0.1:4321/zh/`；项目根目录运行 `npm.cmd ci` 后 `.\start-site.ps1`（已有依赖时直接运行启动脚本）。源码锁文件不升级，克隆后不需要私人原图或本机 Python 环境即可构建。
