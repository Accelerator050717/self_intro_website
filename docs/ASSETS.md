# 素材来源与处理

程序化冰材质环境另见 [ICE_ENVIRONMENT.md](ICE_ENVIRONMENT.md)：由项目使用的 Three.js RoomEnvironment 在本机预烘焙，包含可复现脚本、精确尺寸/校验、341,829字节压缩资源及MIT归属。它不是外部人物或远程HDR素材。

## 当前人物素材与公开边界（2026-09-22）

人物仅来自用户提供的四张 1086×1448 PNG：正面、面向画面右方、背面、面向画面左方。最初已逐张目视检查方向和耳钉差异；没有从其他项目寻找人物，没有生成、换脸或镜像替代人物。四张原始图仅保留在非公开的 `assets/originals/`，用于本地制作参考，不随网站或公开仓库默认分发。用户提供这些文件用于本网站；本站不宣称拥有其独占版权。

本轮首页采用从原正面衍生图制作的五层二维角色：头部、身体、画面右侧上臂、前臂和手。肩、肘、腕独立累计旋转，头部单独轻歪；2.6 秒招呼动作会抬手、摆腕两次并回到原位。身体底图中的原挥手侧手臂已移除，袖肩、领口和腋下只补足运动露出的最小纹理区域。手保留原图微握姿态。当前互动不再切换四视图，也不再以整张人物图倾斜或弹跳表示挥手。

处理方法、枢轴、遮挡顺序、时间线和实际内部动作检查见 [REVISION-ASSETS.md](REVISION-ASSETS.md)。五层来自本地遮罩与原纹理补足，不是三维人物模型，也没有重绘脸或头发。页面运行所需人物素材如下；侧面和背面图片不再是运行依赖，也不预加载：

| 文件（相对于 `public/images/avatar/`） | 尺寸 | 当前用途 |
| --- | --- | --- |
| `front-960.webp` | 720×960 | 完整正面静态底图、加载中及失败降级 |
| `front-480.webp` | 360×480 | 正面静态图的响应式小尺寸 |
| `avatar-128.webp` | 128×128 | 正面头部头像 |
| `rig/body.webp`、`rig/head.webp`、`rig/upper-arm.webp`、`rig/forearm.webp`、`rig/hand.webp` | 各 720×960 | 原画布注册对齐的五个独立图层，合计 99,516 字节 |
| `rig/rig.json` | JSON | 坐标、层序、2,600 ms 时间线及图层校验清单 |

文件名中的 960/480 表示高度；`srcset` 的 `w` 描述符使用实际宽度 `720w` / `360w`。原图、处理缓存、模型和内部动作原型不属于运行资源。正式站点保留 Work / About / Résumé 及对应中文页面和联系入口，不提供 Play 页面或相关 CTA。

## 当前分层脚本与依赖

`scripts/process-avatar-rig.py` 只读取项目内已有正面 WebP，通过 Pillow / NumPy / SciPy 处理，再写入项目内图层目录与忽略的验证目录。它不导入网络客户端、不调用外部程序、不请求模型或图片服务，路径以脚本所在项目根目录为基准，没有硬编码个人主目录、临时附件位置或用户名。生成 HTML 中的 `http://www.w3.org/2000/svg` 是 SVG 命名空间标识，图片以内嵌 data URL 使用，不是网络下载。

本机已安装依赖的许可依据来自对应安装包元数据和附带 LICENSE：

| 依赖 | 本轮已用版本 | 安装包声明 / 主项目许可 |
| --- | --- | --- |
| Pillow | 12.3.0 | `MIT-CMU` |
| NumPy | 2.5.3 | `BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0`，包含随包组件许可 |
| SciPy | 1.18.1 | 主项目 BSD 3-Clause；安装包附带第三方组件 notices |

这些 Python 包仅用于本地素材制作，不打包进静态网站。日常 npm 安装、构建和网页运行直接使用已生成的优化图层，不需要 Python 或模型下载。

## 初始抠图方法（历史：2026-09-21）

可复现入口：`scripts/process-avatar.ps1` / `scripts/process-avatar.py`。处理依赖使用项目独立的 Python 3.12 `.venv-assets`，与网站的 Node/npm 构建隔离。`scripts/process-avatar-requirements.txt` 记录本次安装版本。网页运行和构建不需要 Python 或模型下载。

处理流水线：

1. 读取本地原图，通过 `rembg` 的 `birefnet-general` ONNX 模型在 CPU 上生成软 alpha 遮罩。逐张运行，禁用 ONNX 大块内存池，并在边缘处理前释放模型；本次在 16GB 内存的 Windows 环境中完成。
2. 使用 rembg 的边缘色污染处理，减少原灰底在半透明轮廓上留下的色边；alpha≥250 的不透明内部像素恢复为原图 RGB，保护衣服与面部的原始细节。没有全图白色/灰色阈值抠图，也没有把 mask 强制二值化。
3. 以大于 2/255 的 alpha 计算人物包围盒；仅这一裁切测量忽略极低透明度噪声，人物内部颜色和形态不被重绘。
4. 保持纵横比，统一为 720×960 透明画布，人物包围盒高 892px，脚底基线 y=924，顶部 32px / 底部 36px 留白，水平居中。
5. 使用 Lanczos 缩放生成 360×480，WebP quality=91、method=6、保留 alpha。128×128 头像由正面头部真实裁切得到。

模型只在首次运行时从 rembg 的公开 GitHub release 下载到 `.venv-assets/rembg/`，推理和图片处理均在本机完成。没有调用第三方抠图 API，也没有上传人物图片。使用的模型是明确指定的 BiRefNet-General，并未依赖 rembg 的可变默认模型。

工具依据：[rembg 官方项目](https://github.com/danielgatis/rembg)、[BiRefNet 官方项目](https://github.com/ZhengPeng7/BiRefNet)、[BiRefNet MIT 许可](https://github.com/ZhengPeng7/BiRefNet/blob/main/LICENSE)。模型权重不随静态网站发布。

复现命令（在项目根目录的 PowerShell）：

```powershell
.\scripts\process-avatar.ps1
# 原图未变化时复用本地遮罩；强制重新推理：
.\scripts\process-avatar.ps1 -Refresh
```

需要已安装 Python 3.12。首次运行安装所需依赖并下载模型，之后原图未变时可直接用缓存生成网页衍生图；这不影响网站的正常安装、启动或构建。

## 初始抠图检查（历史：2026-09-21）

初始处理曾生成四视图的 720×960 和 360×480 衍生图以及 128×128 头像，共 9 个文件。以下仅保留当日制作事实，不是本轮人物运行清单，也不表示当前首页仍显示四视图。原图校验与对照图作为非公开本地处理记录保存。

2026-09-21 实际完成检查：

- 四份原图副本与用户提供的原始输入 SHA256 全部一致。
- `python scripts/process-avatar.py` 最终退出码 0，生成全部 9 个文件，总计 397,984 字节（约 388.7KiB）。最大的完整人物图为 `front-960.webp`，77,496 字节；小图 `front-480.webp` 为 32,822 字节。
- 所有网页衍生图均检查 RGBA 模式、具有完全透明区域及完全不透明人物区域、四条画布边缘透明。四张 720×960 图的 alpha 包围盒顶部均为 y=32、底部均为 y=924。
- 实际查看了四张 960 高度衍生图、128px 头像，以及全部四视图在雪白与深海蓝底上的对照图。浅蓝头顶发束、侧边发梢、原有耳钉与完整鞋子保留，未见灰色背景矩形、明显缺发或裁鞋，未采用背景融合降级。
- PowerShell 启动脚本通过 PowerShell AST 语法解析检查。当日四视图展示已经在 2026-09-22 的角色动作修订中退出首页。

## 展示边界

人物采用五张保真二维分层图和肩、肘、腕、颈关节，可以完成已验证的正面招呼和小幅歪头。没有人物 GLB、完整三维表面、手指张合、眨眼素材或连续 360° 旋转。发束高光、脸、服饰和鞋子均源于用户原图。页面上的程序化积木、示意图与图标和人物图片属于不同的素材来源，不代表实机项目截图。

## 本地分享图

`public/images/share.png` 是本项目原创的 1200×630 PNG 分享图。使用雪白/冰蓝背景、深蓝英文文字、手写 SVG 等轴测冰积木和真实来源的 `front-960.webp` 合成。积木包含顶面、两个厚度侧面和独立圆柱凸点；人物仅按比例缩放，未重新生成或改脸，头顶与双鞋完整可见。它是专门制作的社交分享设计图，不是任何项目的产品截图或实机截图。

生成脚本为 `scripts/generate-share.mjs`：

```powershell
node scripts/generate-share.mjs
```

脚本用 Sharp 0.35.4 绘制原创建模示意 SVG、缩放现有人物并合成 PNG。文字使用项目已有的 Manrope WOFF2；由于本机 Sharp 的文字后端不能正确注册该变量 WOFF2，脚本通过本机 Chrome 的无头模式离线栅格化手写 SVG 文字，并确认字体加载成功，再由 Sharp 完成合成。字体直接从本地依赖读取为 data URL，浏览器网络请求被阻止，没有打开外部网站，没有上传人物。复现需要项目 npm 依赖及本机 Chrome；正常网站构建直接使用已生成 PNG，无需启动这套生成流程。

2026-09-21 已运行生成脚本并实际查看最终分享图，确认 1200×630、人物和字样完整、文字使用 Manrope；输出为 327,376 字节。`npx eslint scripts/generate-share.mjs --max-warnings 0` 通过。分享图中的英文只有以下三项，换行不改变文意：

- Mingyang Yu
- Building ideas, one block at a time.
- UC Irvine · Computer Science

## 字体、图标与程序化图形

- 字体：本地自托管的 `@fontsource-variable/manrope@5.3.0`，Manrope Variable；随安装包提供 SIL Open Font License 1.1，版权归 Manrope Project Authors。网站不依赖在线字体请求。
- 图标：`lucide-react`，安装包附带 ISC License；使用统一图标体系，没有把它们称为本项目原创图标。
- 项目流程与概念示意：本项目自行编写的 SVG / CSS，按页面说明标为示意图，不冒充真实业务截图或游戏实机素材。
- 冰积木：本站自行设计几何与布局，通过 Three.js / React Three Fiber 展示；分享图和 favicon 使用自编矢量形状。没有使用 LEGO Logo 或外部积木模型，没有官方联名暗示。
