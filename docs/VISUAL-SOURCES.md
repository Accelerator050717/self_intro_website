# 视觉组件来源与实现边界

## 2026-10-12 增量：项目浏览与页面动效

本轮从用户指定的 [Codrops Demos](https://tympanus.net/codrops/demos/)、[Motion](https://motion.dev/)、[GSAP](https://gsap.com/) 和 [React Bits](https://reactbits.dev/) 官方入口研究局部交互。以下为文档与源码机制参考，不将浏览文档记作真实演示操作或本站验收。继续使用 Astro 服务端页面、普通 CSS、原生 DOM 和 Web Animations API，没有增加 Motion、GSAP、Barba 或其他动画运行依赖，也没有新增背景 shader。

| 位置 | 官方参考 | 本站实现与范围 |
| --- | --- | --- |
| Work 分类切换 | Codrops [Animating Responsive Grid Layout Transitions with GSAP Flip](https://tympanus.net/codrops/2026/01/20/animating-responsive-grid-layout-transitions-with-gsap-flip/)；GSAP [Flip 的状态测量与布局切换](https://gsap.com/docs/v3/Plugins/Flip/)；Motion [布局动画](https://motion.dev/docs/react-layout-animations) | 自编 FLIP：测量当前位置、立即更新真实 `hidden`/数量/`aria-pressed`、以 WAAPI transform 从旧位置落到新位置。新入项目使用短 opacity/位移。连续选择取消前一次动画并采用当前视觉位置；不锁按钮，不复制 Codrops 的随机延迟、全格模糊或亮度效果。 |
| 项目封面 | React Bits [Spotlight Card](https://reactbits.dev/components/spotlight-card)、[Tilted Card](https://reactbits.dev/components/tilted-card) | 在下文已归属的 Spotlight 改写上增量维护：夹紧局部鼠标坐标、原有最大约 3° 倾斜、内部 SVG 最大水平 5px/垂直 4px 视差。普通 CSS 负责短缓动，rAF 仅合并输入事件；链接外框、标题和点击区域不随指针漂移。触屏、减少动态、全站暂停与打印回到静态。未复制新的 React/Motion 组件。 |
| 页面进入 | Motion 布局文档对布局连续性的说明；Chrome [跨文档 View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document) | 自编原生跨文档 View Transition 样式与生命周期保护，仅给 `main` 命名并作 220ms 短进入；根快照不做背景淡入或位移。按照浏览器文档，首帧偏好与 `pagereveal` 保护需要同步 head 脚本，不依赖延迟模块抢在首次捕获前运行。没有客户端路由拦截、离场遮罩或等待动画才跳转的逻辑。不支持该 API 时继续正常文档导航。 |
| 项目详情阅读 | Motion [scroll 文档](https://motion.dev/docs/scroll) 对滚动关联与进入触发的区分 | 复用既有目录锚点，以阅读线位置设置 `aria-current="location"` 和静态边线。每次滚动最多合并一帧测量，不持续运行动画时钟，不接管滚动，不新增导航功能。 |

渲染预算参考 Motion [Performance](https://motion.dev/docs/performance)：布局切换一次集中读取几何位置，后续只动画 transform/opacity；封面光仍限制在原有有界区域。本文不承诺合成线程执行或具体帧率，这些应由本轮生产预览的独立实测确认。

导航首帧与取消另按 Chrome 的上述跨文档文档、MDN [`ViewTransition.ready`](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition/ready) 和 Chromium [跳过原因实现](https://chromium.googlesource.com/chromium/src/+/bed98a9780b75372c1974d8aa0e48f1433082e2f%5E%21/)核查。接收页尚未启用过渡时，Chromium 会以 `kOptInDisabled` 中止并让 `pagereveal` 不携带过渡对象；因此启用规则现在是 Layout head 中唯一的同步内联普通 CSS，不依赖外链样式抵达时机。head 同步注册 `pageswap`/`pagereveal` 偏好保护，分别处理 `ready` 的拒绝；后加载模块继续负责活动过渡集合与完成清理。正常跳过时 `finished` 可以成功而 `ready` 失败，两者不能互相代替。以上是针对浏览器生命周期的实现处理，没有拦截链接，也没有全局屏蔽错误事件；延迟外链样式、延迟模块与主动跳过的实际导航由回归测试单独验证。

许可与分发边界：Codrops [许可页](https://tympanus.net/codrops/licensing/) 将可下载演示标为 MIT（个别说明除外），本轮没有复制演示代码或图片。Motion 官网标注开源 MIT，但没有安装或分发 Motion 代码。GSAP 使用其 [Standard “No Charge” License](https://gsap.com/community/standard-license/)，不能写作 MIT；此处只参考公开 Flip 机制，没有分发 GSAP 库或插件。既有 React Bits 改写继续适用下文固定版本的 **MIT + Commons Clause**，完整通知保留在 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。本轮没有借研究名义替换 GradientWaves 算法、参数或 OGL，也没有更改旧轮次的完成统计。

实现文件：`src/scripts/visual-effects.ts`、`src/styles/spectrum.css`、`src/layouts/Layout.astro` 和 `src/pages/[lang]/[page].astro`。所有正文、六个项目事实和原有 SVG 示意内容保持原样。研究、源码实现、浏览器实测与最终验收分别记录；本来源说明不代表新增交互已经通过浏览器验证。

### 人物动作引擎与参考边界

本轮另核查 [GSAP Timeline 官方文档](https://gsap.com/docs/v3/GSAP/Timeline/)、Rive 官方仓库的 [Runtimes Quick Start](https://github.com/rive-app/help-center/blob/master/runtimes/quick-start.md) 与 [State Machines](https://github.com/rive-app/help-center/blob/master/runtimes/state-machines.md)，以及 MDN 的 [Animation.finished](https://developer.mozilla.org/en-US/docs/Web/API/Animation/finished)。GSAP Timeline 提供轨道定位、重叠和统一播放控制；Rive 通过运行时加载 `.riv` 文件，再驱动文件中配置好的状态机及输入。这些能力适合各自工作流，但本站已有注册好的独立图层与 SVG 关节，不需要新增动画文件格式或运行依赖。

因此人物继续使用本站自编 WAAPI 动作：肩、肘、腕和头部各有独立关键帧与错峰时序，共用一次动作起点；正常周期约 `3400ms`，按准备、抬臂、挥手、恢复四阶段执行。完成条件以 `Promise.all` 等待本次所有关节的 `Animation.finished`，再清理动画并回到空闲；取消路径单独恢复原位，不用单一固定计时器冒充真实完成。人物按钮是唯一主动触发入口，动作中同步锁住重复指令，不排队；背景暂停仍允许用户主动触发有限人物动作，减少动态或资源回退时使用短静态回应。这是当前源码的设计说明，实际阶段、关节姿态、重复输入和取消行为由本轮测试另行验证。

本轮已实际取得并查看十张 `1024 × 1536` 清晰参考图，能支持的视觉观察是：画面左侧手臂抬起，开放掌心靠近脸侧。图像不包含完整收手过程、可靠帧时间或精确三维关节数据；本站抬臂幅度、缓动、短挥手与复位时序属于适配设计。现有 rig 的动作臂位于画面右侧，采用镜像方向约束并保持原人物身份、注册图层和独立关节，不宣称逐帧重建参考动作。

本节只记录机制研究与本站实现选择，没有复制 GSAP/Rive 示例源码、引入其库或分发 `.riv` 素材，也不将“研究 Timeline / State Machines”写成已经集成 GSAP 或 Rive。GSAP 的许可条件仍按上文说明；已有第三方通知范围保持原样。

## 既有增量：用户指定的 GradientWaves

核查日期：2026-09-22。此次明确采用 React Bits **GradientWaves 的 JavaScript + 普通 CSS** 源码和 OGL，不以其他背景组件或 CSS 近似替代。下方 Glacial Spectrum 研究记录保留为上一轮历史；其中“未引入 OGL”只描述上一轮状态。

- 官方页面：[Gradient Waves](https://reactbits.dev/backgrounds/gradient-waves)。官方仓库固定 commit：`c5df8610c0b47d7cd805cda480baba402f7267c1`，提交时间 `2026-09-22T14:45:55Z`。
- 指定变体：[GradientWaves.jsx](https://github.com/DavidHDev/react-bits/blob/c5df8610c0b47d7cd805cda480baba402f7267c1/src/content/Backgrounds/GradientWaves/GradientWaves.jsx) 与 [GradientWaves.css](https://github.com/DavidHDev/react-bits/blob/c5df8610c0b47d7cd805cda480baba402f7267c1/src/content/Backgrounds/GradientWaves/GradientWaves.css)。不是 TS-CSS、Tailwind 或其他组件变体。
- 原始 UTF-8 源码 SHA-256：JSX 为 `92cf6aa408e3b7fe98474c6465441ecea7a7810250bbcc4a92b905e6848ae24f`；CSS 为 `4a3a19cd7977d5ddd128658750a007be8632c6fd9a66fa0c280eec2187927d65`。这两个指纹用于区分上游原文与站点生命周期适配，不代表修改后的文件哈希。
- 上游许可仍为 **MIT + Commons Clause License Condition v1.0**，与本站已有完整通知逐字一致；新增 GradientWaves 也在该通知的适用范围内，见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。

上游以 OGL 的 `Renderer`、`Program`、`Mesh`、`Triangle` 绘制 GLSL ES 3.00 全屏三角形。波形、`plasma`、`raymarch`、雾化/颜色混合和颗粒 shader 属于指定源码，不能换成简化算法。站点适配范围为 Astro 挂载、参数在首帧前赋值、单背景实例、可见性/全站暂停/减少动态/打印、输入策略、尺寸管理、错误回退和卸载清理。

用户指定源码在本站拆为 `src/components/waves/gradient-waves-shaders.ts`、`GradientWaves.tsx`、`GradientWaves.css`，由 `SiteWaves.tsx` 设置参数。已按 LF 统一换行后比较：**vertex 与 fragment 字符串分别与固定版本逐字一致**，SHA-256 分别为 `427d4b9827b17bd6a699b4f7a6c48b9b072549ae625face5f159414c404f2f95` 与 `2a42dd89921e9d970e2b1bd835cfb71adde89de569562a190c7d92611410e9fa`。CSS 原四项容器声明保留，追加站点定位、点击穿透与打印规则。React 生命周期包装已经适配，因此不宣称完整 JSX 文件逐字未改。

浅色使用用户指定的 `#27cbff / #9fe3ff / #9de4e2`，有别于上游默认紫粉白；深色独立为 `#126a95 / #174d70 / #328b9e`。桌面保留示例数值：speed `0.4`、amplitude `2.5`、waveScale `0.6`、waveRatio `0.9`、swell `35`、turbulence `20`、tilt `1.11`、zoom `1`、height `5.5`、fogDepth `15`、medium `70` 步、brightness/opacity `1`、parallaxStrength `0.5`、grainIntensity `0.05`，鼠标与颗粒启用。手机/粗指针仅调整运行质量：low `40` 步、DPR 上限 `1`、关闭鼠标视差；不改 shader 波形算法。

站点另增加自适应像素密度：每累计 `18` 个活动帧间隔，若平均间隔超过 `38ms`，按测得间隔降低 DPR 的缩放系数，最低为初始 DPR 的 `0.5` 倍；一次页面实例内只降低、不自动回升。桌面基础 DPR 上限 `2`，手机/粗指针基础上限 `1`，再乘该系数。暂停时间不计入这些活动帧间隔。这是本站的运行质量适配，只调整实际绘图缓冲区尺寸，不改桌面 medium `70` 步、波形/颗粒 shader、颜色或上述视觉参数；实际流畅度结果仍以独立性能记录为准。

需由运行测试验证的上游边界：原文 `setSize()` 在颜色属性 effect 之前先绘制，颜色 uniform 初始是白色；原文 `iTime = (t - t0) * 0.001` 包括暂停间隔；原文尺寸回调会直接绘制。全站暂停不能只把 speed 置零或取消常规 rAF，还需覆盖其他绘制入口：稳定暂停和鼠标移动不产生新帧；可见状态的主题或尺寸变化允许必要的静态重绘，但不恢复连续动画；隐藏状态不重绘。此来源核查本身不证明站点首帧、暂停或性能已通过。

### OGL 版本、类型与释放接口

精确 npm 版本为 [`ogl@1.0.11`](https://www.npmjs.com/package/ogl/v/1.0.11)，registry 的 `gitHead` 为 `b9e653ccac8e08211ce0678695d0a01f722e1fc2`。该固定版本 [package.json](https://github.com/oframe/ogl/blob/b9e653ccac8e08211ce0678695d0a01f722e1fc2/package.json) 声明 ESM 入口 `src/index.js`、自带类型 `types/index.d.ts` 和 **Unlicense**，不是旧版 MIT 标记。完整 Unlicense 位于该版本 [README](https://github.com/oframe/ogl/blob/b9e653ccac8e08211ce0678695d0a01f722e1fc2/README.md#unlicense)，本站通知另保留该原文。

- [`Renderer` 实现](https://github.com/oframe/ogl/blob/b9e653ccac8e08211ce0678695d0a01f722e1fc2/src/core/Renderer.js) 与 [类型](https://github.com/oframe/ogl/blob/b9e653ccac8e08211ce0678695d0a01f722e1fc2/types/core/Renderer.d.ts)：`new Renderer(options)`、`setSize(width, height)`、`render({ scene })`、`isWebgl2`；没有 `dispose()` 或 `destroy()`。`webgl: 2` 仍会尝试 WebGL1 回退，而指定 shader 需要 WebGL2，应检查实际上下文和 shader 链接结果。
- [`Geometry.remove()`](https://github.com/oframe/ogl/blob/b9e653ccac8e08211ce0678695d0a01f722e1fc2/src/core/Geometry.js) 删除 VAO 和属性缓冲；`Triangle` 继承这一接口。
- [`Program.remove()`](https://github.com/oframe/ogl/blob/b9e653ccac8e08211ce0678695d0a01f722e1fc2/src/core/Program.js) 删除 WebGL program。适配层还应停止 rAF、断开 observer、移除监听与 canvas；必要时使用可选 `WEBGL_lose_context` 扩展释放独立背景上下文。

本机安装的 Renderer、Program、Geometry 及 Renderer 类型已与上述固定 commit 源码比对一致。这里只研究用户指定的 GradientWaves 和所需 OGL；没有搜索或选择替代背景。

## 上一轮：Glacial Spectrum 来源记录

核查日期：2026-09-22。上一轮保持 Astro 静态页面、普通 CSS 与已有 React islands。该轮没有新增 Motion、GSAP、OGL、Paper Shaders、Tailwind、shadcn 或 next-themes 运行依赖；没有安装 AI Kit/MCP、使用付费源码或复制演示业务内容。

## 实际采用

| 效果与位置 | 上游与固定版本 | 本项目处理 | 项目文件 |
| --- | --- | --- | --- |
| 项目封面的单层局部冰蓝光 | React Bits Spotlight Card，TS-CSS；`c5df8610c0b47d7cd805cda480baba402f7267c1` | **站点专用源码改写**：保留相对指针坐标 → CSS 变量 → radial-gradient 的机制；改为 Astro/DOM 增强、单帧合并更新、两主题色彩、输入/暂停/减少动态保护。没有复制 React wrapper。完整 MIT + Commons Clause 条款见根目录通知。 | `src/scripts/visual-effects.ts`、`src/styles/spectrum.css`、`src/components/ProjectCard.astro` |
| 仅项目封面的小角度空间反馈 | React Bits Tilted Card，TS-CSS；同一 commit | **行为参考、原生重写**：指针相对封面中心决定小角度旋转，只变换封面内部图形；正文和链接命中区稳定。未复制 Motion springs、tooltip、演示数据或组件。 | `src/scripts/visual-effects.ts`、`src/styles/spectrum.css` |
| 内容首次进入的短淡入/小位移 | React Bits Fade Content，TS-CSS；同一 commit | **节奏参考、自编实现**：IntersectionObserver + WAAPI，HTML 初始可见；没有复制当前上游 GSAP/ScrollTrigger timeline、SSR `visibility:hidden` 或自动消失逻辑。 | `src/scripts/visual-effects.ts` |
| 人物与冰体附近的冰蓝—青—浅紫环境光，联系区静态光场 | Paper Mesh Gradient；`43cd68db79fa0b1759f72ffc941b3238e2a3954c`，仓库包版本 `0.0.81` | **视觉参考、自编 CSS 近似**：静态渐变与有界光片，环境层只做慢速 transform/opacity。没有复制 GLSL、运行 Paper shader、引入第二个背景 WebGL，也没有把官网截图用于产品。 | `src/styles/spectrum.css`、`src/components/Avatar.tsx`；与已有冰场景主题衔接 |

人物仍使用已有五层保真图与 WAAPI 关节动作，不属于第三方组件改写。项目封面是基于已授权高层项目内容的自编 SVG 概念图，不是上游演示图或真实业务系统截图，见 `src/components/ProjectArt.astro` 与 `src/styles/project-art.css`。字体、图标、人物处理与既有环境资源另见 [ASSETS.md](ASSETS.md)。

现有 Three.js 场景内的静态折射背景与主题对应也为本项目自编，涉及 `src/components/ice/IceScene.tsx`、`studio-palette.ts`、`IceBrick.tsx`、`SceneFallback.tsx` 与 `ice.css`；与 DOM 光场统一色彩，不是 Paper GLSL 的复制或第二个 shader runtime。

## React Bits：所读变体、许可与精确源文件

官方仓库：[DavidHDev/react-bits](https://github.com/DavidHDev/react-bits)。读取 commit：`c5df8610c0b47d7cd805cda480baba402f7267c1`，提交时间 2026-09-22T14:45:55Z。采用的研究变体是 `src/ts-default/`，即 TypeScript + 普通 CSS；官网演示自身使用 JS-CSS 变体，演示观感与移植源码分别核查。

- Spotlight Card：[官方演示](https://reactbits.dev/components/spotlight-card)、[TSX](https://github.com/DavidHDev/react-bits/blob/c5df8610c0b47d7cd805cda480baba402f7267c1/src/ts-default/Components/SpotlightCard/SpotlightCard.tsx)、[CSS](https://github.com/DavidHDev/react-bits/blob/c5df8610c0b47d7cd805cda480baba402f7267c1/src/ts-default/Components/SpotlightCard/SpotlightCard.css)。上游除 React/CSS 无额外运行依赖；本站改写不增加 React 卡片 island。
- Tilted Card：[官方演示](https://reactbits.dev/components/tilted-card)、[TSX](https://github.com/DavidHDev/react-bits/blob/c5df8610c0b47d7cd805cda480baba402f7267c1/src/ts-default/Components/TiltedCard/TiltedCard.tsx)、[CSS](https://github.com/DavidHDev/react-bits/blob/c5df8610c0b47d7cd805cda480baba402f7267c1/src/ts-default/Components/TiltedCard/TiltedCard.css)。上游依赖 `motion/react`；本站未使用其 runtime。
- Fade Content：[官方演示](https://reactbits.dev/animations/fade-content)、[TSX](https://github.com/DavidHDev/react-bits/blob/c5df8610c0b47d7cd805cda480baba402f7267c1/src/ts-default/Animations/FadeContent/FadeContent.tsx)。该版本实际依赖 GSAP 与 ScrollTrigger，不按旧教程把它记为纯 IntersectionObserver。
- Aurora：[官方演示](https://reactbits.dev/backgrounds/aurora)、[TSX](https://github.com/DavidHDev/react-bits/blob/c5df8610c0b47d7cd805cda480baba402f7267c1/src/ts-default/Backgrounds/Aurora/Aurora.tsx)、[CSS](https://github.com/DavidHDev/react-bits/blob/c5df8610c0b47d7cd805cda480baba402f7267c1/src/ts-default/Backgrounds/Aurora/Aurora.css)。已研究 OGL/GLSL 与持续 rAF 实现，只保留色带/渐隐方向参考；现有冰体已有 WebGL，未加第二套渲染器。

上述固定版本的许可是 **MIT + Commons Clause License Condition v1.0**，版权为 Copyright (c) 2026 David Haz，不是无附加条件的 MIT。完整原文保存在 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)，与[固定版本上游许可](https://github.com/DavidHDev/react-bits/blob/c5df8610c0b47d7cd805cda480baba402f7267c1/LICENSE.md)一致。Spotlight 改写嵌入本网站，不作为独立组件、组件包或移植库分发。

## 其他候选：实际核查与未使用原因

### Paper Shaders

[Mesh Gradient 官方页](https://shaders.paper.design/mesh-gradient)、[固定 GLSL 源码](https://github.com/paper-design/shaders/blob/43cd68db79fa0b1759f72ffc941b3238e2a3954c/packages/shaders/src/shaders/mesh-gradient.ts)、[React 包装](https://github.com/paper-design/shaders/blob/43cd68db79fa0b1759f72ffc941b3238e2a3954c/packages/shaders-react/src/shaders/mesh-gradient.tsx)、[ShaderMount](https://github.com/paper-design/shaders/blob/43cd68db79fa0b1759f72ffc941b3238e2a3954c/packages/shaders/src/shader-mount.ts)。

真实演示中查看默认色场，并在官方控件试了冰蓝配色与低速流动；宽色斑、弯曲亮带与柔和混色是本轮视觉参考。上游通过独立 WebGL2 canvas 实现，当前 ShaderMount 已有离屏/隐藏暂停，speed=0 会停止持续 rAF；仍有初始化、像素尺寸和第二图形上下文成本，所以没有接入 runtime。

许可为 [Apache-2.0](https://github.com/paper-design/shaders/blob/43cd68db79fa0b1759f72ffc941b3238e2a3954c/LICENSE)，附 [NOTICE](https://github.com/paper-design/shaders/blob/43cd68db79fa0b1759f72ffc941b3238e2a3954c/NOTICE)。本次没有分发其源码、生成的 shader 资产或官网截图；静态 CSS 光场不能标注成“Paper shader 已接入”。

### Magic UI

[Magic Card 官方页](https://magicui.design/docs/components/magic-card)、[固定组件](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/magicui/magic-card.tsx)、[registry](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/public/r/magic-card.json)、[MIT 许可](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/LICENSE.md)。读取 commit：`d7207e5692d14c00dceafa8488d6d01f197fa0e4`。

已实际操作浅/深色默认卡片的鼠标局部光和边缘高光，以及 orb 模式进入/离开。当前组件本体直接依赖 Motion、next-themes、Tailwind 样式与 cn helper；next-themes 在这一版本已不只是 demo 依赖。与选中的 Spotlight Card 功能重复，orb 又有额外弹簧、大面积 blur 和混合模式，因此不复制/接入。Next Link、登录表单与演示人物不属于本项目。Shimmer/Border Beam 非必要，未选用，也不声明已完整研究或使用。

### Aceternity UI

[Spotlight 官方页](https://ui.aceternity.com/components/spotlight)、[官方 registry](https://ui.aceternity.com/registry/spotlight.json)、[licence 页面](https://ui.aceternity.com/licence)。已查看加载后的定向柔光演示，并读取 React/SVG 与 CSS 单次入场实现；该 Spotlight 不直接依赖 Motion。

没有核实到此组件的官方公开 GitHub commit。2026-09-22 取得的 registry SHA-256 为 `8fb8ccb5bff388c48df583cd15be9562f4d8adf3f7223d8a636a51c52f6f1d7e`。registry 未声明 license；官网 licence 标题针对 Pro 且包含源码再分发限制，不能据此把免费组件武断记作 MIT。单束舞台光与所选局部光场重复，故只评估，不复制 SVG/源码到本站。

### Motion

已读 [React](https://motion.dev/docs/react)、[Performance](https://motion.dev/docs/performance)、[AI Kit](https://motion.dev/docs/ai-kit)、[AI Kit Install](https://motion.dev/docs/ai-kit-install)。源码核查版本 `823947dcc1703fb7a99e9801dddafb423c34fa76`，该仓库的 [motion package](https://github.com/motiondivision/motion/blob/823947dcc1703fb7a99e9801dddafb423c34fa76/packages/motion/package.json) 为 `13.4.1`，[React 入口](https://github.com/motiondivision/motion/blob/823947dcc1703fb7a99e9801dddafb423c34fa76/packages/motion/src/react.ts) 转出 framer-motion，原许可为 [MIT](https://github.com/motiondivision/motion/blob/823947dcc1703fb7a99e9801dddafb423c34fa76/LICENSE.md)。这不是本项目安装版本。

本轮采用其公开性能指导：优先 transform/opacity、控制图层面积、避免持续布局与重绘，实际测量而不承诺固定帧率。人物和小型交互继续使用现有 WAAPI/CSS。免费文档/最佳实践与 Motion+ 的 CSS spring、审计、编辑器和付费源码分开判断；没有安装或购买。

## 证据与归属边界

所有候选都读取了指定组件页和实际源文件；Paper、Magic Card、Aceternity 与 React Bits 的官方 demo 另做真实浏览器观察。研究快照、上游演示截图与临时脚本仅保留本地忽略目录，不打包为站点资产。正式本网站截图、动作录屏、性能对照与回归结果以本轮验收文档为准；官方 demo 能运行不代表本站验收通过。

本文件记录的是上游来源、处理方式与依赖边界；完整软件许可仍以对应原文为准。
