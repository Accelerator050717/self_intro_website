# 人物动作与整站交互修订

本轮日期：2026-10-12。继续已有 Astro 双语网站、五层人物 rig、Three.js 冰积木和 React Bits GradientWaves 背景，改进主动人物动作与局部页面反馈。没有新增运行依赖或替换背景算法。六个项目正文、公开联系配置及中英文路由沿用现有内容。

本轮从 `feat/gradient-waves-background` 的 `119a81967023030e18809fefc6ba0ae676294ee7` 和现有工作区继续，交付分支为 `codex/avatar-interaction-revision`。未提交的用户 JSON 保留原状并明确排除公开提交。没有回退 `main` 或重建网站。先前轮次的统计不作为本轮结果，历史记录保留于 [GRADIENT-WAVES.md](GRADIENT-WAVES.md)、[VISUAL-UPGRADE.md](VISUAL-UPGRADE.md) 和 [REVISION-AVATAR.md](REVISION-AVATAR.md)。

## 本轮行为

人物只通过点击或触摸人物本体，以及键盘聚焦后的 Enter / Space 触发。取消自动欢迎、人物区的 Say Hi 和独立暂停控件、可见文字气泡；屏幕阅读器通过隐藏的状态区域收到简短回应。人物素材就绪与冰积木 WebGL 初始化分别处理。

正常动作按 `idle → preparing → raising → waving → recovering → idle` 执行，总长约 3.4 秒。先微小预备，320ms 开始抬臂，1140ms 进入挥手，2500ms 开始收手。肩、肘、腕与头部保持独立时序和各段缓动；腕部正负往复逐次减小，收手先下肩并保留屈肘，随后展开，避免初版恢复中高位水平伸臂。肩 3400ms、肘 3280ms、腕 2780ms、头 3340ms 分别归零。输入入口先同步锁定，执行期间忽略重复指令，不追加队列。完成路径等待各关节的真实动画完成、恢复原位并释放动画，再解锁；阶段计算本身不能返回 `idle`。页面隐藏、人物离屏、打印、卸载、动态偏好改变或动画异常走取消与复位路径，故障看门狗释放停滞的动画。

顶栏“暂停背景动画”控制波浪、冰场景和页面装饰动效，仍允许用户主动触发有限人物动作。减少动态或人物资源降级时提供约 500ms 的静态回应，不旋转关节。全站暂停的保存、跨页恢复及主题切换继续使用现有机制。

| 位置 | 当前实现 | 保留的交互边界 |
| --- | --- | --- |
| Work 分类 | 实际卡片位置的短 FLIP 过渡；新入卡片短淡入与位移 | 点击时立即更新 `hidden`、结果数量和 `aria-pressed`；连续选择取消旧动画，不锁按钮或链接 |
| 项目封面 | 内部图形小角度倾斜，SVG 最大水平 5px / 垂直 4px 视差及局部光 | 链接外框与正文位置不跟随指针；粗指针、减少动态、暂停和打印保留静态封面 |
| 页面导航 | 支持的浏览器对 `main` 作 220ms 原生跨文档进入 | 正常锚点导航；根背景不做淡入、位移或第二层波浪；不支持时直接导航 |
| 首次进入与阅读 | 内容首次进入时短位移/淡入，既有详情目录显示当前位置 | SSR 内容可见；目录继续使用原生锚点，不接管滚动，暂停后仍提供语义位置反馈 |
| 冰积木 | 在现有实体几何和透射材质上改进局部指针反馈 | 仍由独立冰场景测试验证，保留静态与 WebGL 失败回退 |

## 参考、实现与许可

研究来源和适配范围详见 [VISUAL-SOURCES.md](VISUAL-SOURCES.md) 的 2026-10-12 小节。Codrops / GSAP Flip 与 Motion 官方文档用于研究布局连续性、局部反馈和渲染预算；现有 React Bits Spotlight / Tilted Card 归属继续保留。页面动效为本站 DOM、CSS 与 WAAPI 实现，没有安装 GSAP、Motion 或 Rive，也未复制新的演示图片或业务内容。既有第三方代码的完整许可保留在 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。

人物引擎比较核查了 GSAP Timeline、Rive 官方运行时与状态机资料，以及 MDN `Animation.finished`。最终继续使用既有独立关节与原生 WAAPI，以 `Promise.all` 协调完成和释放；不把机制研究写成第三方引擎集成。

已从用户提供的 [ChatGPT 分享页](https://chatgpt.com/s/m_6acd852808b481919df2333e9ecad9ab) 取得并逐张查看十张不同的 1024 × 1536 原图。第一张待机，第二张伸臂屈肘，第三、四张转入抬臂；第五至十张为画面左侧、人物右臂开放掌心在脸旁的不同姿态。身体大致朝前，肩、肘被宽袖遮住，手在脸侧而非覆盖脸。采用待机、预备、屈肘抬臂、脸侧挥动等约束，未按图数切换角色。

参考不提供完整收手、可靠帧时间或精确三维数据，不能直接提取完整连续动作。本站保留原人物与画面右侧动作臂，采用镜像方向约束；动作时长、缓动和收手属于本站适配设计。手部仍是原图微握造型，没有精确重建参考的开放掌心。肩肘接缝使用原服装色背片衔接，仍是二维注册图层动画，不具有三维体积或真实骨骼透视。十图的尺寸、哈希、姿态观察和素材边界见 [reference-inspection.json](reports/avatar-interaction/reference-inspection.json)；原图只保存在私有验证目录，不进入仓库。

## 验证与证据

本轮统一写入 `docs/reports/avatar-interaction/`、`docs/screenshots/avatar-interaction/` 和本轮精选录像路径。原始 trace、机器日志、私有提示词、原始人物素材及参考图不进入公开交付。测试配置和脚本使用 `REPORT_DIRECTORY` / `SCREENSHOT_DIRECTORY` 隔离本轮输出，不能覆盖旧报告。

| 验收项 | 最终结果与证据 |
| --- | --- |
| `npm run check`、`npm run lint`、`npm test` | Astro 39 文件，0 errors / warnings / hints；ESLint 0警告；2个文件、20/20单元测试 |
| `npm run build` 与静态 HTML / 运行资源检查 | 24 HTML 构建；静态0问题，运行资源6/6；本轮没有重做隔离 npm ci，不沿用旧轮隔离安装作为新结果 |
| 全套 `npm run test:e2e` | 最终完整103/103通过，0失败/跳过/flaky，约11.4分钟；初次101项的100通过/1失败及其定点3次复测保留，录制发现真实导航异常后修产品并新增2用例，再执行完整103项 |
| 人物状态、真实关节、连续输入、取消 / 复位 | 24项人物用例；真实 SVG 矩阵、错峰与腕部正负变化、每个锁定阶段快速10次可信点击、最后关节复位后再触发、键盘与触屏、取消/异常/看门狗等通过 |
| FLIP、封面边界、阅读目录、原生页面过渡 | 12项 `site-motion.spec.ts` 通过；含真实布局变换与 SVG 位移、快速筛选、暂停/减少动态、原生导航、延迟样式/模块与阅读位置 |
| 波浪首帧、真实 draw、暂停时间、失败与释放 | 19项 GradientWaves 用例通过，保留桌面示例参数及 GLSL 哈希、单画布、真实绘制/像素、暂停时间、失败与清理断言 |
| 既有路由、语言、主题、过滤、复制、打印、无 JS 和响应式 | 中英文路由/12详情、复制成功和失败、320–1440px、语言深链、主题保持、无JS与退休Play 404等回归通过；打印实际PDF另见下文 |
| 冰场景专项与无障碍审计 | 冰场景7/7；4种主题/尺寸透明边缘alpha均0、冰材质黑像素占比0；axe22场景0违规，自动工具结果不是完整无障碍合规声明 |
| 中英文打印 PDF | 各1页A4；全文、6项目、共享邮箱/链接、页面边界和150dpi逐页渲染目视通过；打印期间0新增背景GL绘制；PDF项目链接指向本机预览，没有实机打印 |
| 截图与正常时间轴录像 | 桌面1440×1000、手机390×844；每端16次可信输入/7轮接受、rapid10只增加1、最终idle；13个实际视频关键帧/端；EN/ZH×light/dark四张干净截图 |

本轮环境为 Windows、Node.js 24.14.1、npm 11.11.0、Playwright 1.63.0。完整回归和性能采样使用 bundled Chromium 153.0.8010.12；前后录像使用 installed Chrome 154.0.8037.98，导航修复另在两版核验。均针对本机生产预览 `http://127.0.0.1:4321` 执行。构建保留 Three.js 分块超过500KB的既有提示；没有删除这一实际成本或降成默认静态背景。

首次101项全套测试的唯一失败发生于历史返回后 hover：浏览器仍在恢复滚动，卡片目标移动，实际滚动清理了已开始的指针反馈。调查记录实际滚动 Y=145→437→515；稳定后再移动鼠标即正常。仅修改测试等待字体、有限动画和连续4次RAF稳定几何，再发送真实指针，并增加实际 SVG 位移断言。该次修正未改产品，定点连续3次通过。详见 [history-retest.json](reports/avatar-interaction/history-retest.json)。后续另修复下段的真实导航异常，并重跑完整103项，最终包括该历史返回项均通过。

随后第一次完整手机录制发现真正的页面异常 `ViewTransition opt-in disabled`，没有在录制脚本里过滤。目的 Work 页的 `pagereveal` 无过渡对象，但页面内容仍完成导航；153版最小操作也复现。官方 Chromium 失败路径与接收页 opt-in 尚未可用相符，初次探测没有直接观测目的 CSS 到达时刻，根因判断包含这一推断。修复把唯一 opt-in 普通 CSS 声明放在解析时即可获得的 head 内；head 同步注册两阶段事件，在主动取消前处理 `ready` 的拒绝，增强模块继续处理释放。没有接管锚点或添加全局错误过滤。

根据 [Chrome 官方跨文档说明](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document)，接收事件必须在首次绘制前处理，而且旧页 `ready` 拒绝与 `finished` 解决可同时发生。新增两项真实导航回归分别控制延迟外部样式及延迟客户端模块；后者不由测试读取或捕获 `ready`，验证产品自己的取消处理。定向6项通过；原手机操作顺序在153和154两版各复测一轮，4次接收页过渡均完整结束、0页面异常。首次失败录像和原探测保留在私有验证目录，公开摘要见 [navigation-retest.json](reports/avatar-interaction/navigation-retest.json)。

冰材质第一次验证发现 `envMapIntensity` 被 Three.js 场景环境值覆盖，换成实际 roughness 反馈；装饰线的默认宽射线命中也让坐标变化失真，现只让实体积木/凸点提供命中。最终 GPU uniform 实测 roughness 0.060→0.04072→0.03604，离开恢复0.060，抬升0.055；暂停、粗指针、隐藏和离屏稳定观测窗口均0新增draw。角色初次镜头也实际发现收手高位水平伸臂，调整收肩/展开肘的先后后重新查看浅深两主题10帧。失败和修正都保留在 [rig-visual-review.json](reports/avatar-interaction/rig-visual-review.json)。

隐藏、pagehide和错误路径包含故障注入，离屏、键盘、点击、触控和滚动使用真实浏览器输入。注入 `document.hidden` 或 `pagehide.persisted` 不等于已经验证所有操作系统后台调度或真实 BFCache。正常路径没有未处理页面异常；故意阻断资源或上下文的预期失败单列。

## 实际动作与前后对比

- [修改前桌面完整录像](evidence/avatar-interaction-before-desktop.webm)、[修改前手机完整录像](evidence/avatar-interaction-before-mobile.webm)。基线为 `119a819`，在实施前独立保存；基线HTML哈希保持不变，见 [before-baseline.json](reports/avatar-interaction/before-baseline.json)。
- [修改后桌面完整录像](evidence/avatar-interaction-after-desktop.webm)：49.76秒；[修改后手机完整录像](evidence/avatar-interaction-after-mobile.webm)：52.16秒。单次、快速10次、复位后再次、Enter、Space、顶栏暂停下有限动作、减少动态回应，以及实际主题、滚动、Work/Home导航都在录像中。两个profile均无页面异常或控制台错误；返回首页也验证所切主题/语言保持、接受计数为0，没有自动欢迎。
- [桌面同时间点前后对照](screenshots/avatar-interaction/comparison-desktop.png)、[手机同时间点前后对照](screenshots/avatar-interaction/comparison-mobile.png)。共同名义时点为0/300/650/1000/1400/1800/2400/3000/4500ms；新版另提取320/1140/2500/3400ms阶段边界，共13帧/端。
- [新版桌面动作序列](screenshots/avatar-interaction/after/desktop-action-contact-sheet.png)、[新版手机动作序列](screenshots/avatar-interaction/after/mobile-action-contact-sheet.png)。具体真实输入、关节采样、编码尺寸与动作阶段见 [after-recordings.json](reports/avatar-interaction/after-recordings.json)。
- 语言与主题：[EN浅](screenshots/avatar-interaction/after/home-en-light.png)、[EN深](screenshots/avatar-interaction/after/home-en-dark.png)、[中文浅](screenshots/avatar-interaction/after/home-zh-light.png)、[中文深](screenshots/avatar-interaction/after/home-zh-dark.png)。

关键帧从实际连续录像解码，不 seek 动画、不改 playbackRate。录制临时DOM在左下角显示明确标记的QA计时条，观察可信输入和实际RAF，干净截图与人物裁剪不含该条。旧版0点按首次可见文字回应对齐，新版按实际可信本体输入的QA码对齐；25fps仅为标称40ms录制间隔，重复帧、绘制和采集延迟会使实际选帧误差更大。每张新版对照标出实际解码时间，误差按该时间与名义时点之差计算，不能把标称帧率或自动化调用耗时当作精确输入延迟。

最终13个时点中，桌面名义/解码时间的最大偏差27ms，手机37ms。前一采集尝试桌面最大偏差137ms且存在重复帧，已私有保留，不能以最终值覆盖这一历史事实。采集脚本最初在每次导航时重设主题，也已修正为仅首次空存储设置；这是取证注入问题，不是网站主题逻辑故障，没有因此改产品。

最终公有录像每端首轮87个连续编码帧的关节局部、13个全身时点和11个全程场景采样均已实际目视；另检查四张语言/主题截图与两张前后对照。未观察到断臂、多手、袖口破口或末尾残留姿态；保留原宽袖的圆润折叠，不把它写成三维重建。首5秒125个QA码和首87个编码帧未测得相邻完全重复，但该有限窗口不能证明记录了全部GPU显示帧。VP8压缩偶有短暂柔化或块状纹理；视频用于连续动作证据，清晰静态细节以PNG为准。

为控制公开仓库体积，完整原始master仅保存在私有验证目录。公开两段采用libvpx VP8、CRF28有损空间/码率重编码：桌面1152×800（原1440×1000），手机390×844；文件约3.71MB与2.31MB。公开视频与各自master时长均一致，编码不裁时间、不加速、不主动丢录制帧；这不是无损视频或每个屏幕刷新都有记录的声明。原图、完整trace、未脱敏机器报告和失败master不公开。

## 性能比较

修改前与后分别执行桌面、手机模拟 Lighthouse 各三次，没有挑选较高分数替换。两轮使用同一 bundled Chromium 153.0.8010.12 和一致的 Lighthouse 配置；具体工具版本、视口 / DPR、网络与 CPU 配置保留在 [before-performance.json](reports/avatar-interaction/before-performance.json)、[after-performance.json](reports/avatar-interaction/after-performance.json)。下表为原始两轮观察，中位数不是实体手机结果。

| 指标 | 桌面修改前 → 后 | 手机模拟修改前 → 后 |
| --- | --- | --- |
| 三次 Performance 分数 | 76 / 74 / 74 → 66 / 67 / 67 | 66 / 67 / 67 → 64 / 62 / 63 |
| 分数中位数 | 74 → 67 | 67 → 63 |
| LCP 中位数 | 591.8 → 767.0ms | 2787.1 → 2805.2ms |
| TBT 中位数 | 560.5 → 3092.4ms | 1687.0 → 7995.4ms |
| JS 执行中位数 | 228.1 → 665.1ms | 872.2 → 2309.0ms |
| JS 传输中位数 | 332596 → 333421 bytes | 332596 → 333421 bytes |

原始后测确实观察到更高阻塞和 JS 执行成本，不能写成性能提升。同一机器的 Lighthouse `benchmarkIndex` 也从修改前3317.5–3918降到后测1453.5–1908；该指数变化提示环境条件不一致，但单凭它不能证明原因。最长任务主要归属保留的波浪脚本，前后 `SiteWaves.DJATx1cZ.js` 构建哈希相同。没有因此更改用户指定的波形或默认换为静态背景。各次执行明细、配置比较和长任务归属见 [performance-comparison.json](reports/avatar-interaction/performance-comparison.json)。

持续动画另外在实际滚动的约10秒窗口测量，加载和稳定运行成本分别记录：

| 连续窗口指标 | 桌面修改前 → 后 | 手机模拟修改前 → 后 |
| --- | --- | --- |
| RAF 间隔中位数 / p95 | 16.7 / 50.0 → 33.4 / 116.6ms | 16.7 / 33.3 → 16.7 / 50.0ms |
| 长任务数量 / 总时间 | 13 / 1349 → 38 / 4250ms | 11 / 650 → 18 / 1585ms |
| 波浪 GL draw 调用 / 秒 | 36.29 → 18.69 | 52.34 → 45.93 |
| 波浪绘图缓冲区 | 720×500 → 720×500 | 234×506 → 195×422 |
| 8次滚动输入各自可归属的事件 | 8 → 7 | 8 → 8 |

桌面后测实际记录8个滚动事件，滚动范围0→1680→0，但第一轮 wheel 调用耗时941ms，其事件不能与第二轮独立归属，不能声称8/8逐次对应，也不能据此断言丢失实体鼠标输入。手机缓冲区改变来自既有自适应分辨率，不是本轮改波形算法。两端无页面异常。原始报告见 [before-motion.json](reports/avatar-interaction/before-motion.json)、[after-motion.json](reports/avatar-interaction/after-motion.json)。脚本的 `passed` 表示采样与它的输入条件完成，不能代表流畅度达标或性能相当。RAF 是主线程调度间隔，GL 调用不是 GPU 完成 / 显示帧率；模拟 TBT 也不是实体设备 INP。

为核对变慢是否只发生于新版，又把准确的 `119a819` Git 跟踪源码归档到全新私有目录，在相同依赖与锁文件下构建独立诊断预览，固定执行各三次加载与两端连续窗口。当前分支、暂存区、用户文件及原4321产物没有切换或覆盖；诊断预览完成后停止。该独立构建路径的产物哈希不同，不宣称与历史构建逐字节一致；准确源码身份与依赖、产物指纹见 [source.json](reports/avatar-interaction/current-condition-baseline/source.json)。

| 当前机器条件下的旧版对照 | 桌面 | 手机模拟 |
| --- | --- | --- |
| 三次分数 / 中位数 | 61 / 62 / 62；62 | 58 / 58 / 60；58 |
| LCP / TBT 中位数 | 717.6 / 3253.5ms | 2812.0 / 10611.1ms |
| JS 执行中位数 | 678.0ms | 3004.4ms |
| 连续 RAF 中位数 / p95 | 33.4 / 116.7ms | 16.7 / 50.0ms |
| 长任务数量 / 总时间 | 24 / 3989ms | 29 / 2108ms |
| 波浪 draw / 秒与缓冲区 | 18.60；720×500 | 47.29；195×422 |
| 8次滚动各自可归属的事件 | 7 | 8 |

对照与原两轮的浏览器、Lighthouse 13.5.0及两套审计配置一致；对照 `benchmarkIndex` 1271–1692。同一旧源码在后来的条件下也复现高阻塞、桌面慢调度和7/8滚动归属，说明原始后测变慢并非新版独有。原新版分数与TBT在这组后续对照中较好，仍不能据此宣称产品优化：这是顺序对照而非随机同期 A/B，不能分离产品贡献，也未直接测量温度、驱动或竞争进程。完整三组数据和局限见 [comparison.json](reports/avatar-interaction/current-condition-baseline/comparison.json)。所有样本单独保留，没有择高分替换原始结果。当前环境的桌面持续动画仍有明显长帧，实体设备流畅度未验证。

## 验收边界与维护

本机 Chromium 自动化和手机视口 / 触控模拟不能替代实体手机、跨浏览器及真实屏幕阅读器验证；未执行的设备或服务范围需在最终结论中明确保留。角色是二维原图分层，参考图没有提供的动作细节不声称已精确还原。源码分支交付与网站公开部署分开处理，本轮不部署网站。

主要维护入口：人物状态在 `src/components/Avatar.tsx`，关节时序在 `src/lib/avatar-motion.ts`，接缝背片在 `src/components/AvatarJointSurface.tsx`；页面增强在 `src/scripts/visual-effects.ts` 与 `src/styles/spectrum.css`，Work 数据标记在 `src/pages/[lang]/[page].astro`，初帧偏好在 `src/layouts/Layout.astro`。参考源码不属于用户个人事实；内容仍以既有公开数据和 `src/data/site-config.ts` 为准。
