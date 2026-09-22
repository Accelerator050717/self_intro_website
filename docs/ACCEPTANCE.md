# 本轮真实验收 · 2026-09-22

本轮为既有网站的增量修复：人物独立抬臂、删除 Play、统一联系邮箱，并准备同步授权的公开源码仓库。旧报告与修改前文件已留在本机忽略快照；以下数字全部来自本轮运行。

## 最终结果

| 检查 | 实际结果 |
| --- | --- |
| `npm.cmd run check` | 30 个文件，0 errors / warnings / hints |
| `npm.cmd run lint` | exit 0，0警告 |
| `npm.cmd test` | 2个文件，20/20单元测试通过 |
| `npm.cmd run build` | exit 0，24个HTML；保持本地noindex |
| `npm.cmd run test:e2e` | 54/54，0失败、0跳过、0 flaky，193.8秒 |
| `node tests/ice-browser-check.mjs` | 6/6 Hero专项通过，0页面异常、0控制台错误 |
| `node scripts/audit-site.mjs` | 22个页面/主题/暂停/尺寸场景，axe 0 violations |
| `node scripts/check-static.mjs` | 24 HTML / 20内容页，0静态问题；链接、素材、robots正确 |
| `node scripts/check-runtime-assets.mjs` | 6路由通过；无外网/私有资源/侧背图加载；正文页不加载3D |
| `node scripts/record-avatar.mjs` | 桌面和390px触屏各两次真实动作，各9帧，关节/复位断言通过 |
| `node scripts/check-print.mjs` + PDF提取/渲染检查 | 中英文各1页A4，全文及邮件链接正确，逐页目视通过 |
| 从Git暂存源码导出到空目录，`npm.cmd ci`、`npm.cmd run build` | 安装586包，audit 587包，0 vulnerabilities；24页构建成功 |

类型、Lint、单元、构建检查使用 Windows / Node.js 24.14.1 / npm 11.11.0。主要端到端浏览器为 Playwright Chromium 153.0.8010.12；打印专项另用已安装 Chrome，实际版本在打印报告中。没有用上轮数字替代本轮执行。

## 人物动作目视验收

这是五层图片+SVG关节的二维动画，身体和脚固定，肩/肘/手腕及头部独立运动。保留原蓝发黑衣公仔，原手为微握姿态。动作约2.6秒，手腕两摆后恢复相同待机姿势。

实际查看 [桌面9帧](screenshots/revision/avatar-desktop-sequence.jpg) 与 [手机9帧](screenshots/revision/avatar-mobile-sequence.jpg)：待机、抬臂、三次不同腕姿、放下、复位、再抬臂、再复位。肩肘腕相连，身体底图没有残留另一条原手，原头发/皮肤/双鞋保留，峰值动作不裁切。数据报告所有帧的body矩阵相同；肩肘实际旋转、手腕正负变化和两次归零同时通过。

- [桌面实际录屏](evidence/avatar-desktop.webm)：英文浅色，1440×1000，约1.14 MB。
- [手机实际录屏](evidence/avatar-mobile.webm)：中文深色，390×844触屏模拟，约0.68 MB。
- `reports/avatar-motion.json`：真实关节矩阵和采集时间。

录屏由真实点击/触屏触发；没有seek动画、调速或仅修改状态来伪造动作。只录网站视口，不含系统桌面和通知。关键帧已实际目视；录屏文件也由浏览器完成写入，不是网站运行时播放素材。

修复中确实发现并处理了：素材袖肘突角、腕/领口细缝、躯干右缘尖边；首次GPU初始化让手腕中段跳帧；场景初始化前点击造成只有文字回应。最终使用首次场景就绪/降级门控、准备期间暂禁招呼输入，以及挥手期间暂停展台更新。相关失败用例修复后重新运行，最终54项全通过。

## 覆盖与证据边界

15项人物专项覆盖首次会话欢迎、跨语言/返回不自动重播、实际肩肘腕变换、第二次动作、连续点击不叠加、键盘焦点、暂停/恢复/刷新、指针仅转头、reduced-motion、图层失败、可选3D模块失败、存储禁用、退休存储只删自身键、320/390触屏深色及手部边界。

39项保留页面回归覆盖中英文主页面与12详情直接访问/刷新、Work筛选、语言深链、主题保持、移动导航、320/360/390/768/1024/1440宽度的6路由无横向滚动、复制成功/失败/缺API、网页打印、无JS、WebGL降级、旧Play路径实际HTTP404、构建中无退休入口或旧联系邮箱。

正常路径无未处理异常、控制台错误或失败资源。故意阻断图层/3D模块、WebGL上下文等失败场景用于验证降级，不把故障注入产生的预期错误算作真实网络成功。隐藏页面检查是注入 `document.hidden` 和真实visibility事件处理器的机制测试；离屏通过真实滚动验证。未声称验证了原生浏览器所有后台调度行为。

Hero额外覆盖首帧SVG保护、真实WebGL draw、暂停/reduced/隐藏/离屏0额外draw、上下文丢失、损坏环境数据、强制SVG与无JS。确认 `onSettled` 各出口，挥手期间400ms新增WebGL draw为0。不是只靠Canvas存在判定3D渲染成功。

axe覆盖中英文、浅深主题、桌面/手机、暂停开关和保留内容页。0 violations不等于无障碍完全合规；键盘动作另实测，人工屏幕阅读器尚未验收。

## 打印

重新输出两份A4 PDF并逐页渲染查看：均1页，6项目和末尾工具完整，无孤行标题、截断、重叠、乱码或空白页。提取全文与浏览器打印正文忽略空白后相同，PDF注释链接为正确 `mailto:yumin050717@gmail.com`。Chrome打印和PDF解析报告见 `reports/print.json`、`reports/print-pdf-inspection.json`。PDF是网页验收样本，不是正式简历，也没有实际纸质打印。

## 性能

独立运行 `node scripts/audit-performance.mjs`，未并发执行其他浏览器测试。使用相同本机、Lighthouse 13.5.0、Chromium153、英文主页、本地生产预览、桌面配置与默认模拟移动配置。保持禁止索引，不为了SEO分数移除noindex。

| 指标 | 本轮桌面 | 本轮模拟移动 |
| --- | ---: | ---: |
| Performance | 85 | 68 |
| Accessibility / Best Practices | 100 / 100 | 100 / 100 |
| SEO | 66 | 66 |
| FCP | 323 ms | 1056 ms |
| LCP | 463 ms | 2558 ms |
| TBT | 353 ms | 2277 ms |
| CLS | 0.000106 | 0 |

两次采样均无runtimeError和runWarnings。修改前归档的同配置单次样本为桌面80、模拟移动70；本轮桌面提高，模拟移动低2分，移动LCP仍有改善空间，不能将单次波动宣称统计性进步。现有Three.js懒加载chunk仍超过构建器500kB告警阈值；未隐藏警告、升级锁文件或新增大型动画依赖。安装保留的ESLint9版本出现上游弃用提示，安装/检查成功且npm audit为0漏洞。

## 公开内容审查与复现

公开内容限于网站源码、优化运行素材及合适证据。首次提交前检查完整暂存文件清单、差异及模式秘密扫描；原始PNG/私人提示词/环境真值/本机快照/模型/依赖/dist/trace/原始机器报告均忽略。`public` 仅保留实际必要的正面、头像、5图层、冰环境和分享图等素材。高层项目介绍是用户授权的网站内容，不带公司实现或真实患者数据。

从Git index导出到空目录后实际 `npm ci` 与构建通过，不依赖未提交原始参考图或Python环境。见 `reports/clean-install.json`、`reports/public-content-audit.json`。扫描是模式检查结合文件级人工审查，不是对所有未知秘密格式的绝对保证。

## 未验证或未执行

- 真实iOS/Android、Safari/Firefox、人工屏幕阅读器和真实后台tab调度。
- 公网部署、域名/CDN、GitHub Pages：本轮没有执行；源码公开不代表网站上线。
- 邮件客户端实际发送与真实收件；本轮验证mailto与Clipboard精确内容。
- 正式简历文件和实际纸质打印；当前仅网页及其验收PDF。
- 本网站的项目介绍不代表对原项目的公司服务、临床效果、硬件或真实交易重新验收。

本地功能交付不需要额外素材。当前访问、维护与Git审查入口见 [HANDOFF.md](HANDOFF.md)。
