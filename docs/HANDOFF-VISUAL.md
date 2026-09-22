# 冰川光谱视觉升级交接

本地英文：<http://127.0.0.1:4321/en/>，中文：<http://127.0.0.1:4321/zh/>。

在项目根目录执行：

```powershell
npm.cmd ci
.\start-site.ps1
```

已有依赖时直接运行启动脚本。它重新构建并检查/复用本项目预览服务；没有公开部署步骤。开发模式：`npm.cmd run dev -- --port 4321`。

## 本轮范围

全站颜色与导航/按钮、首页环境光和冰体背景衔接、六项目概念图、卡片局部光/封面反馈、首次分组入场、联系区。原人物五层素材和肩肘腕头部动作保留。没有新增页面、Play、业务内容或大型动画库。

联系邮箱仍由 `src/data/site-config.ts` 唯一维护；中英文、六详情、过滤、About、网页简历、打印、主题、复制/mailto 与404全部沿用。旧 Play 地址继续404，GoldenCamp和Experiments分类保留。3D准备超时会退为SVG并恢复人物触发，不等待无限加载。

## 维护入口

- `src/styles/spectrum.css`：palette、动效时长、导航、主标题、光晕/遮罩、卡片、联系区与打印保护。
- `src/scripts/visual-effects.ts`：单帧合并鼠标更新、首次进入、全站动态偏好与清理。
- `src/components/ProjectArt.astro` / `src/styles/project-art.css`：两主题概念图，不代表真实产品截图。
- `src/components/ice/`：透射体、场景光场、主题色与SVG降级。
- `src/components/Avatar.tsx` / `src/lib/avatar-motion.ts`：原关节动作、暂停、输入与10秒可选场景准备上限。
- `tests/visual-upgrade.spec.ts`：新增视觉交互边界，既有人物/页面测试保持。

[VISUAL-UPGRADE.md](VISUAL-UPGRADE.md) 提供前后截图、性能及实际验证；[VISUAL-SOURCES.md](VISUAL-SOURCES.md) 提供官方来源/版本/许可；[ACCEPTANCE.md](ACCEPTANCE.md) 为当前验收入口。旧角色动作交接仍在 [REVISION-AVATAR.md](REVISION-AVATAR.md)。

## Git 与边界

授权远端：<https://github.com/Accelerator050717/self_intro_website>，本轮交付分支 `feat/ice-visual-upgrade`。最终SHA以交付消息与实际Git查询为准，不将自己的SHA递归写入同一提交。核验可运行：

```powershell
git rev-parse HEAD
git ls-remote origin refs/heads/feat/ice-visual-upgrade
```

`main` 保持本轮开始时的 `15581693a08c39c1eed7c0a552acecf2fae5d76e`。不强推、不更改仓库可见性、不发布网站。私人附件与原图、环境真值、机器日志、依赖和临时研究源文件均不提交。

未验证真实手机、Safari/Firefox、人工屏幕阅读器、实际邮件收发、纸张打印和公网/CDN。本地浏览器截图/模拟移动与实验室性能不代替这些环境。
