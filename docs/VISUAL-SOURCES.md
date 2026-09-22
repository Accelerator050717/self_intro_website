# 视觉组件来源与实现边界

## 当前增量：用户指定的 GradientWaves

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
