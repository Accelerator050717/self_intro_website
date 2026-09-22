# GradientWaves 全站背景 · 2026-09-22

本轮在 `feat/ice-visual-upgrade` 已交付的 `593833462abaa21e301160a389b6682b9908dae7` 上创建 `feat/gradient-waves-background`。开始时唯一未跟踪文件为本地运行日志；原样保留且排除公开提交。没有回退 main、重建项目或覆盖用户改动。

## 实际接入

采用用户完整提供的 React Bits GradientWaves（JavaScript + CSS）源码，添加 TypeScript 类型及站点生命周期管理。`gradient-waves-shaders.ts` 的 vertex/fragment 字符串与固定官方版本逐字一致（仅统一换行），波形函数、raymarch、镜头、颜色混合、透明度和噪声算法没有改画。

通过 npm 安装并锁定 `ogl@1.0.11`。官方来源、固定版本及完整 React Bits MIT + Commons Clause / OGL Unlicense 见 [VISUAL-SOURCES.md](VISUAL-SOURCES.md) 和 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。没有搜索或加入替代背景组件。

`Layout.astro` 加载 `SiteWaves` React island，每个文档只有一个固定于视口的波浪画布。首页、Work、About、12个项目详情、网页简历和404使用相同背景；画布尺寸跟随视口，不随长页面高度增加。内容正常滚动，背景保持可见。导航、正文和人物分别位于上层，背景 `pointer-events:none`，鼠标视差监听 window，不拦截按钮、链接或触摸滚动。

浅色桌面参数完整保持为：

```jsx
horizonColor="#27cbff" waveColor="#9fe3ff" crestColor="#9de4e2"
speed={0.4} amplitude={2.5} waveScale={0.6} waveRatio={0.9}
swell={35} turbulence={20} tilt={1.11} zoom={1.0} height={5.5}
fogDepth={15} detail="medium" brightness={1.0} opacity={1.0}
mouseInteraction={true} parallaxStrength={0.5} grain={true} grainIntensity={0.05}
```

`height={5.5}` 只控制 shader 地平线，不是 CSS 高度。初次真实 GL draw 已写入指定三色，没有默认紫粉/白色闪帧。深色仅改三色为 `#126a95`、`#174d70`、`#328b9e`，其余形态参数不变，不使用反色滤镜。手机/窄屏使用 low（40 steps）、DPR上限1并关闭鼠标视差，仍实时显示波浪。

先实际测试了原始桌面1440×1000全分辨率：本机浏览器的10秒窗口只有108次波浪draw、RAF中位83.4ms，滚动响应变慢，原始数据保留于 `initial-full-resolution-motion.json`。据此增加自适应像素密度：从原分辨率开始，每18个活动帧测平均间隔；超过38ms才按实测比例降低DPR，倍率最低0.5，不上调震荡，不改桌面medium、参数或shader。暂停时间不进入采样窗口；正常快设备可保持原分辨率，所有支持设备仍是动态波浪。最终实际分辨率与持续测量见下表。

旧人物环境光 DOM 已移除，旧联系区装饰光片停用。项目封面与正文密集区域使用有边界的局部阅读底板，页面/section 没有增加遮满波浪的不透明背景或全屏白色蒙层。

## 与人物、冰积木及暂停的关系

人物五张原衍生图、肩肘腕头部关节时间线、轻微鼠标回应和归零策略保持。邮件仍唯一配置为 `yumin050717@gmail.com`；语言深链、两主题、六作品筛选、详情、复制反馈、简历、打印和旧 Play 404 保留。

冰场景最终屏幕使用透明清屏。既有光场只在 Three transmission render target 中写入颜色，主 framebuffer 不写入背景，因此能保留明亮的折射光，空白画布显示全站波浪。没有把动态波浪复制成第二套冰场景 shader。移除旧边缘遮罩；收窄原柔阴影的投影范围，使其在画布边界内自然归零，砖体厚度、圆柱凸点和实体几何未变。

页头在所有页面提供暂停/恢复，和人物旁的控制共享 `ice-paused` 及事件。暂停、减少动态、隐藏、打印或页面离开时取消持续 RAF；模拟时间、噪声和鼠标位置冻结。主题/尺寸变化允许必要的单次静帧重绘；隐藏时不绘制。恢复累计活动时间，不把暂停时长加入 `iTime`。BFCache 进入时暂停，返回时读取最新保存偏好；真正退出/卸载时清理 observer、事件、RAF、几何缓冲、shader、program及上下文。

WebGL2 不支持、初始化/链接失败、context lost 或 `?webgl=0` 都回到静态波浪图。`public/images/waves/{light,dark}.webp` 是本轮实际 shader 静帧的压缩副本，只供加载前、失败和无 JS 使用，不是正常设备的替代实现。打印 CSS 移除整层背景，运行时停止绘制。

## 截图和真实录屏

修改前与修改后分开保存在 `screenshots/gradient-waves/before/` 和 `after/`；旧 `visual-upgrade` 和人物修复的证据不覆盖。

可直接查看[桌面前后并排](screenshots/gradient-waves/comparison-desktop.jpg)和[手机前后并排](screenshots/gradient-waves/comparison-mobile.jpg)，均来自相同视口、语言与主题的真实页面截图。

| 场景 | 修改前 | 修改后 |
| --- | --- | --- |
| 英文桌面首屏 | [截图](screenshots/gradient-waves/before/desktop-home.png) | [截图](screenshots/gradient-waves/after/desktop-home.png) |
| 桌面项目区 | [截图](screenshots/gradient-waves/before/desktop-projects.png) | [截图](screenshots/gradient-waves/after/desktop-projects.png) |
| 桌面页脚 | [截图](screenshots/gradient-waves/before/desktop-footer.png) | [截图](screenshots/gradient-waves/after/desktop-footer.png) |
| 中文深色手机 | [全页](screenshots/gradient-waves/before/mobile-zh-dark-full.png) | [全页](screenshots/gradient-waves/after/mobile-zh-dark-full.png) |

相同目录也包含 Work、About、AI 详情与网页简历。动态截图是某个实际瞬间，不声称相同相位；正文、主题、视口和路由保持可比较。录屏、实际动作连续帧及像素变化统计见本轮 `reports/gradient-waves/`。

[桌面实际录屏](evidence/gradient-waves-desktop.webm) 40.003秒；[手机触控模拟录屏](evidence/gradient-waves-mobile.webm) 40.007秒。录制使用正常时间轴与真实 wheel / CDP touch drag / 点击，经过首屏、项目区、页脚，再操作主题和暂停/恢复。手机还进入项目详情并返回。已从最终 WebM 解码多个时间点目视，避免只以脚本事件宣布完成。

[桌面动作连续帧](screenshots/gradient-waves/after/character-desktop-sequence.jpg)与[手机动作连续帧](screenshots/gradient-waves/after/character-mobile-sequence.jpg)记录抬臂、腕部往复、落臂与复位；身体矩阵在这组动作中保持固定。另从实际 WebGL draw 后取得4帧画布像素，在不移动鼠标的窗口中验证大尺度波浪变化；比较先模糊2px，再采用每通道8/255阈值，避免把噪点变化当作波浪运动。

完整证据数据在 [recordings.json](reports/gradient-waves/recordings.json)。录制期间裁剪截图曾干扰 Chromium screencast；已改为全视口截图后离线裁图，并重录两端，失败录像仅保留本机私有目录。公开录像均为修正后真实采集，没有合成替代动画或改变速度。

全页长截图中固定背景只绘制在浏览器截图时的视口范围，这是全页截图机制的限制；运行时滚动后的背景覆盖与运动以视口截图及连续录屏验收。

## 本轮性能与验收

同一生产预览地址、Chromium 153.0.8010.12、Lighthouse 13.5.0，修改前/后各三次桌面与三次模拟手机；独占浏览器采样，全部样本保留：

| 加载指标（3次中位数） | 桌面修改前 → 后 | 手机模拟修改前 → 后 |
| --- | --- | --- |
| Performance | 71 → 70（后68–70） | 66 → 65（后64–66） |
| LCP | 565 → 590 ms | 2578 → 2783 ms |
| TBT | 1127 → 815 ms | 4812 → 2256 ms |
| CLS | 0.00318 → 0.00338 | 0 → 0 |
| JS传输 | 315346 → 332596 B | 315346 → 332596 B |
| JS执行 | 376 → 260 ms | 1598 → 986 ms |

桌面视口1350×940/DPR1、CPU1×；手机412×823/DPR1.75、CPU4×，原始网络参数与每次运行配置见 [before-performance.json](reports/gradient-waves/before-performance.json) / [after-performance.json](reports/gradient-waves/after-performance.json)。新增脚本传输17250B（16.8KiB），LCP分别增加约25ms/206ms，总分各下降1分。TBT和脚本执行降低是这些样本的观测，不单独归因于某项代码修改，也不等同于真实设备INP；六次最终采样均无runtimeError和warning。性能报告只覆盖本机实验条件。

正常动态、无CPU/网络节流，桌面1440×1000与390×844触控模拟分别持续10秒；采样中实际滚动八次：

| 持续指标 | 桌面修改前 → 后 | 手机模拟修改前 → 后 |
| --- | --- | --- |
| RAF间隔中位 / p95 | 16.7 / 16.8 → 16.7 / 33.4 ms | 16.7 / 33.4 → 16.7 / 33.3 ms |
| 长任务数量 / 总时长 | 11 / 1411 → 11 / 837 ms | 26 / 1691 → 2 / 130 ms |
| 实际生效滚动输入 | 8/8 → 8/8 | 8/8 → 8/8 |
| 新波浪绘制调用 / 采样时长 | 459 / 10.003秒（约45.9次/秒） | 537 / 10.001秒（约53.7次/秒） |
| 最终波浪绘图缓冲区 | 720×500，medium | 312×675，low |

加入真正 raymarch 背景增加了桌面持续绘制负担，p95间隔从16.8ms增加到33.4ms；没有宣称无性能成本。上述自适应像素密度已把原始全分辨率桌面83.4ms中位间隔改善到16.7ms，仍保留全部桌面示例参数和动态波形。GL调用数不等于呈现帧率；降低后的像素密度会牺牲部分细节，实际截图与录屏可直接评估。原始全分辨率与最终测量都保留，未隐藏慢样本。

| 验收项 | 本轮实际结果 |
| --- | --- |
| Astro check / ESLint | 37文件，0错误/警告/hints；Lint exit0 |
| Vitest / 生产构建 | 20/20；24 HTML，exit0 |
| 浏览器功能回归 | 82个不同用例最终覆盖通过；首次81项为78通过/3失败，修正测试定位与就绪等待后定点复测，详见下段 |
| 冰场景 / 合成像素专项 | 6/6；桌面/手机×浅/深4/4，画布两像素周边alpha全部0，砖体采样无黑像素 |
| axe | 22场景，0自动规则违规；不等于完整人工无障碍认证 |
| 静态 / 运行时资源 | 24 HTML引用与边界检查通过；6路由未请求外部资源、私人文件或退役人物视图 |
| 干净安装 | 导出审查中的Git index到新空目录，npm ci与24页build通过，依赖审计0漏洞；最终53项构建输入与该快照内容一致 |
| 打印 | 中英文真实PDF各1页，全文/六作品/邮箱/链接/边界/150dpi渲染目视通过；打印期间背景隐藏、连续绘制停止 |

本轮浏览器测试没有跳过。首次两个双语减少动态用例因新增同名页头控制而出现严格定位歧义，现明确定位人物区域并检查页头同步状态。另一个人物暂停/刷新用例的轨迹显示招呼已开始，随后自动平滑滚动令人物离屏并正常取消；在刷新后补上与既有 `openReady` 一致的场景就绪等待，连续三次独立复测通过，未修改人物运行时/关节时间线。还补测shader初始化失败，实际回退可用。完整首轮、失败处理和定点结果保存在 [browser-tests.json](reports/gradient-waves/browser-tests.json)，不将它们伪称为一次82项全绿运行。

暂停、减少动态、隐藏、主题、打印、失败与卸载测试直接探测真实GL draw/uniform/资源删除；暂停后鼠标移动不绘制，恢复无时间跳变。光标输入与背景视差、粗指针低质量动态、页脚继续绘制、重复导航单画布、同页主题复用context、无JS可阅读均有对应断言。全局控制、原人物、邮箱复制、筛选、语言深链和Play 404也在实际回归覆盖中。

[validation.json](reports/gradient-waves/validation.json) 汇总各项证据。保留的非阻断提示：原Three.js chunk超过Vite的500kB提示阈值；固定版本ESLint在干净安装时有弃用提示；PDF解析器报告FontBBox descriptor warning，但全文、字符边界、链接及实际渲染均通过。未为消除提示擅自升级既有工具链。

原始 Lighthouse HTML/trace、本机日志及私有测试路径保留在忽略目录 `.verification/gradient-waves/`。公开 JSON 为提取的实际指标与必要诊断，不含绝对个人路径。

修改前有效持续动画测量结束于 18:59:14Z，两端8/8滚动输入均实际生效。随后一次追加 GL 计数采集与构建时间重叠，整组已隔离、未并入基线。该追加采集覆盖了有效桌面原始 RAF 数组：桌面仅恢复当次工具实际输出的完整摘要，移动原始数据完整。此证据缺口已写入 `before-motion.json`，没有将补采数据冒充修改前结果。Lighthouse 六次和修改前截图完整保留。

尚未验证实体 iOS/Android、Safari/Firefox、人工屏幕阅读器、真实操作系统后台调度、实际邮件发送、纸张打印或公网/CDN。隐藏/BFCache处理器有明确事件注入测试，不等同于真实系统调度。RAF间隔和GL调用数不是真实GPU呈现帧率，自动化输入延迟也不是INP。

## 启动、复验与 Git

项目根目录运行：

```powershell
npm.cmd ci
.\start-site.ps1
```

本地地址：[中文](http://127.0.0.1:4321/zh/) / [英文](http://127.0.0.1:4321/en/)。已有依赖时可直接运行启动脚本；服务仅绑定127.0.0.1。

```powershell
$env:REPORT_DIRECTORY='docs/reports/gradient-waves'
$env:SCREENSHOT_DIRECTORY='docs/screenshots/gradient-waves/after'
npm.cmd run check
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
node tests/ice-browser-check.mjs
node scripts/audit-site.mjs
node scripts/check-static.mjs
node scripts/check-runtime-assets.mjs
node scripts/check-print.mjs
node scripts/capture-gradient-waves.mjs after
node scripts/record-gradient-waves.mjs
node scripts/measure-gradient-motion.mjs after
node scripts/audit-gradient-performance.mjs after
```

性能测量应独立运行，不并行争抢GPU。不要把当前源码重新采样为修改前基线。只推 `feat/gradient-waves-background` 到授权仓库 `Accelerator050717/self_intro_website`；不覆盖 main、不强推、不公开部署。最终 commit 与远端一致性以实际交付查询为准。
