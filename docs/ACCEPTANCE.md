# 当前验收：人物动作与整站交互 · 2026-10-12

本轮从 `feat/gradient-waves-background` 的 `119a81967023030e18809fefc6ba0ae676294ee7` 和当前工作区增量修订，分支 `codex/avatar-interaction-revision`。当前行为、动作参考边界、前后录像、关键帧和实际性能见 [AVATAR-INTERACTION.md](AVATAR-INTERACTION.md)，机器结果独立保存在 `reports/avatar-interaction/`。以下旧轮数字和首次自动欢迎行为是历史记录，不代表当前实现。

人物只允许本体点击/触摸、键盘 Enter/Space 主动触发；无自动欢迎、Say Hi、人物独立暂停和可见 Hello 气泡。3.4秒独立关节动作包含预备、错峰抬臂、停顿、腕部减速往复和收手。严格同步锁定，所有关节复位及动画释放后解锁，隐藏/离屏/异常可取消。继续保留顶栏背景暂停和减少动态偏好。

本轮 Astro check 39文件0错误/警告/提示，Lint通过，单元20/20，24页构建及静态检查通过，运行资源6/6。最终完整浏览器回归103/103，0失败/跳过/flaky，约11.4分钟。初次101项100通过/1失败，修正历史返回的测试时序后定点连续3次通过；随后录制发现真实原生导航异常，修复首帧opt-in及ready拒绝处理、新增2项回归，再执行完整103项。首次失败及双浏览器复测保留。冰场景7/7、axe22场景0违规；中英文实际打印PDF各1页，全文/链接/边界及渲染目视通过。最终正常路径无未处理页面异常。

已下载并逐张检查十张1024×1536参考姿态，采用关键姿态及遮挡约束，没有做十帧幻灯片。仍为原人物二维分层、画面右侧手臂和微握手型，参考画面左侧开放掌心仅作镜像约束；没有完整收手时序或三维重建数据。手机为本机触控模拟，实体手机、Safari/Firefox、人工屏幕阅读器和实机打印尚未验收。源码交付不包含公开部署。

## 历史验收：GradientWaves 全站背景

该轮证据见 [GRADIENT-WAVES.md](GRADIENT-WAVES.md) 和 `reports/gradient-waves/`，交付分支 `feat/gradient-waves-background`。下方数据保留为历史记录，不能代替当前执行。

本轮：Astro check 37文件无错误/警告，Lint通过，Vitest20/20，24页生产构建和隔离npm ci/build通过。82个不同浏览器用例最终覆盖通过；首次81项78通过/3失败，修正测试控制定位及刷新后场景就绪等待，定点复测及人物暂停恢复连续3次通过。全部首轮结果与修正过程保留，不宣称一次82项全绿。冰场景6/6、合成4/4、axe22场景0违规、静态与6路由资源检查通过。中英文实际PDF各1页，正文与链接、画面及打印停止绘制均通过。

前后截图、40秒桌面/手机真实录屏及像素/关节动作证据见[本轮文档](GRADIENT-WAVES.md)。Lighthouse各3次中位桌面71→70、模拟手机66→65；持续动画最终RAF间隔中位两端16.7ms，桌面p95由16.8增至33.4ms。完整成本、原始桌面基线数组缺口与实体设备等未验收范围已明确记录。

## 上一轮 Glacial Spectrum 视觉升级

本轮独立的前后对照、性能采样、测试与局限记录在 [VISUAL-UPGRADE.md](VISUAL-UPGRADE.md)，机器结果位于 `reports/visual-upgrade/`。当前交付分支为 `feat/ice-visual-upgrade`；下方保留上一轮人物修复的验收记录，其数字和录屏不能代替本轮执行。

本轮执行：Astro check 33 文件无错误/警告，Lint 通过，Vitest 20/20，生产构建 24 HTML，浏览器 63/63（0失败/跳过/flaky），冰场景 6/6，axe 22 场景 0违规，静态及6路由资源检查通过。全新隔离目录 npm ci / build 通过。中英文实际 PDF 各一页，全文/邮箱/渲染均通过。调整证据输出路径后的2项测试额外重跑通过。

已实际查看[桌面前后](screenshots/visual-upgrade/comparison-desktop.jpg)、[手机前后](screenshots/visual-upgrade/comparison-mobile.jpg)、[桌面动作关键帧](screenshots/visual-upgrade/after/motion-desktop-sequence.jpg)及[手机动作关键帧](screenshots/visual-upgrade/after/motion-mobile-sequence.jpg)。本轮[桌面录屏](evidence/visual-upgrade-desktop.webm)22秒、[手机触控录屏](evidence/visual-upgrade-mobile.webm)21.8秒；动作与卡片/主题反馈均来自实际浏览器输入。

同配置修改前/后各3次 Lighthouse：桌面中位82→91，模拟移动70→75。首次异常慢样本和不确定原因也完整保留，详见本轮视觉文档，不能用最终分数代表真实设备。未公开部署；真实手机、Safari/Firefox、人工屏幕阅读器、实体打印及真实邮件发送未验收。

## 上一轮人物修复验收 · 2026-09-22

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
