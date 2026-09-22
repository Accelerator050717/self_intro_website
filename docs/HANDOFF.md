# 当前交接：GradientWaves 全站背景

当前分支为 `feat/gradient-waves-background`，基于已交付视觉分支继续。启动方式、指定参数、全站控制、实际截图/录屏/性能及验证边界见 [GRADIENT-WAVES.md](GRADIENT-WAVES.md)。原人物、联系方式、页面功能和此前证据均保留。

## 上一轮 Glacial Spectrum 视觉升级交接

当前分支为 `feat/ice-visual-upgrade`。访问/启动、维护入口、保留范围与Git边界见 [HANDOFF-VISUAL.md](HANDOFF-VISUAL.md)，前后截图、真实录屏和性能对照见 [VISUAL-UPGRADE.md](VISUAL-UPGRADE.md)。本地地址仍为 `http://127.0.0.1:4321/en/` 和 `/zh/`，启动仍为 `npm.cmd ci` 后 `.\start-site.ps1`。

以下保留**上一轮人物修复交接**；其中 `main`、旧证据和旧轮范围是历史记录，不代表当前视觉升级分支的测试结果。

## 上一轮增量交接 · 2026-09-22

英文预览：http://127.0.0.1:4321/en/ ，中文：http://127.0.0.1:4321/zh/ 。仅本机访问。根目录运行 `.\start-site.ps1` 可重建并启动/复用预览，新环境先执行 `npm.cmd ci`。开发模式用 `npm.cmd run dev -- --port 4321`。

本轮保留已有版式、双语内容、主题、首页冰积木、六个项目及详情、About、Résumé、打印、联系和404。在修改前已留本机忽略快照，没有重新搭建或清理未知用户文件。未升级技术栈或锁文件。

人物现在由身体、头、上臂、前臂和手五张同坐标图片组成。肩、肘、手腕和头部独立运动，脚固定；招呼约2.6秒并复位。只在当前会话首次可见且素材与场景准备好后自动欢迎一次。显式按钮及人物均支持点击、键盘、触屏；快速连续点击不堆叠。暂停与减少动态效果优先；离屏/隐藏取消并复位。原四视图栏已移除，运行时不加载侧背图。

Play 的路由、导航、首页CTA、文案、独占组件/状态/样式均删除；旧地址落入正常404。只清除旧实验存储键，不清空用户其他浏览器偏好。联系统一从 `src/data/site-config.ts` 读取 `yumin050717@gmail.com`。

## 审查入口

- `src/components/Avatar.tsx`：分层、输入、会话、暂停及失败边界。
- `src/lib/avatar-motion.ts`：关節配置校验和动作时间线。
- `public/images/avatar/rig/`：可独立控制的衍生图与元数据；使用原角色正面素材制作。
- `src/components/ice/HeroBricks.tsx`：首帧确认/降级通知，避免首次场景初始化打断招呼。
- `src/data/site-config.ts`：联系配置；`src/data/content.ts` 为原有事实内容。
- `tests/avatar.spec.ts`：实际关节变化、复位、会话和异常边界；`tests/site.spec.ts` 为全站回归。

## 证据

- [桌面动作录屏](evidence/avatar-desktop.webm) / [手机触屏录屏](evidence/avatar-mobile.webm)。每份包含两次招呼。
- [桌面连续动作图](screenshots/revision/avatar-desktop-sequence.jpg) / [手机连续动作图](screenshots/revision/avatar-mobile-sequence.jpg)。
- [桌面首页](screenshots/revision/desktop-home.png) / [手机首页](screenshots/revision/mobile-home.png)。
- [本轮验收记录](ACCEPTANCE.md) / [动作实现说明](REVISION-AVATAR.md) / [素材处理说明](REVISION-ASSETS.md)。
- `docs/reports/` 为精简机器可读结果；本机大体积 Lighthouse 原始报告和 Playwright trace 不提交。

中英文打印验收 PDF 位于 `screenshots/revision/resume-print-en.pdf` 与 `resume-print-zh.pdf`，只是公开网页内容的打印样本，不作为正式简历下载。若以后提供正式简历，可放 `public/resume.pdf` 并重新构建。

## Git 与部署

授权源码仓库为 https://github.com/Accelerator050717/self_intro_website ，初次交付分支 `main`。最终 SHA 和实际远端核对结果随交付回复提供；后续可用 `git rev-parse HEAD` 与 `git ls-remote origin refs/heads/main` 对照。

原图、私人提示词和本地快照保留在忽略范围。公开仓库只含本网站的必要源码、衍生素材、处理说明和精选证据，不含公司实现、患者记录、令牌或真实环境配置。

未公开部署，未启用 GitHub Pages，未更改仓库可见性；本地 noindex 配置保留。未验证真实手机、Safari/Firefox、人工屏幕阅读器、邮件实际发送、纸质打印、公网/域名/CDN。桌面 Chromium 的模拟视口和自动审计不能代表这些环境。
