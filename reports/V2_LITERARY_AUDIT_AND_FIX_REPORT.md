# 《今夜宜喂鬼》V2.0「一则关于饥饿与偏爱的荒诞短篇」
## 故障定点修复、3—5分钟主线重构与交付综合整改验收报告

- **日期**：2026-10-27
- **基线版本 SHA**：`f2d261b` (fix: resolve all P0/P1 audit issues and add full verification tests)
- **版本号**：`v2.0` (文学怪诞精简版)
- **目标仓库**：https://github.com/iammuyiyi-lab/tonight-feed-ghost
- **在线 GitHub Pages**：https://iammuyiyi-lab.github.io/tonight-feed-ghost/

---

## 1. 核心故障根因分析与定点修复方案（P0-01、P0-02、P0-03）

### 1.1 P0-01：接糖碰撞判定区与可见幽灵身体错位修复

#### 故障现象
玩家在糖雨关卡中左右拖动半糖接糖时，半糖视觉上位于舞台偏中部（约 52% 高度），而掉落物在掉到靠近舞台底部（约 490px 处）才被判定接住。玩家在视觉上看到糖果穿过半糖身体后几十像素才触发判定，交互极度违和。

#### 源码定位
1. `src/main.ts` 的 `resizeCanvas()` 中将 `this.ghost.y = this.height * 0.52`；且在 `renderCanvas()` 中无论任何场景均使用 `this.ghost.render(ctx, this.ghost.x, this.ghost.y)` 绘制在 52% 高度。
2. `src/games/candyRain.ts` 的 `update()` 却硬编码了 `const ghostCatchY = this.stageHeight - 110` 作为碰撞检测基准，并在此处计算碰撞盒。
3. 物理判定 Y 坐标（~490px）与视觉渲染 Y 坐标（~312px）严重脱节相差近 180 像素。

#### 修复原理与实现
1. **统一数据源与坐标暴露**：
   在 `src/systems/ghost.ts` 的 `GhostActor` 中新增统一计算接口：
   ```typescript
   public getCatchBounds(centerX: number, centerY: number, scaleMultiplier: number = 1.0): CatchBounds {
     const sX = Math.abs(this.scaleX) * this.baseScale * scaleMultiplier;
     const sY = Math.abs(this.scaleY) * this.baseScale * scaleMultiplier;
     const mouthX = centerX + (this.lookX * 6 * 0.4) * sX;
     const mouthY = centerY - 14 * sY;
     const halfWidth = 55 * sX;
     const top = centerY - 102 * sY;
     const bottom = centerY + 102 * sY;
     return { left: centerX - halfWidth, right: centerX + halfWidth, top, bottom, centerX, centerY, mouthX, mouthY, radius: halfWidth };
   }
   ```
2. **糖雨下轨物理与视觉统一**：
   - 在 `src/games/candyRain.ts` 中引入 `ghostActor` 引用，并将下轨高度维护为 `this.ghostY = this.stageHeight - 110`。
   - 在 `src/main.ts` 的 `renderCanvas()` 中，当处于糖雨场景（`P02`, `S10`, `S11`, `S12`）时，幽灵渲染坐标严格指定为 `(this.director.candyRain.ghostX, this.director.candyRain.ghostY)`，与下轨物理判定坐标 100% 共享、严丝合缝。
   - 碰撞检测重构为基于落物半径与幽灵实际穹顶/嘴部边界相交：
     ```typescript
     const itemRadius = item.size * 0.5;
     const inY = item.y + itemRadius >= bounds.top && item.y - itemRadius <= bounds.mouthY + 35;
     const inX = item.x + itemRadius >= bounds.left && item.x - itemRadius <= bounds.right;
     ```
3. **QA 调试轮廓支持**：
   支持 `CandyRainGame.showDebugBounds = true` 或 `GhostActor.showDebugBounds = true`，在开发调试时以绿色虚线绘制实际碰撞 AABB 与红色圆点标记嘴部位置。发布构建默认关闭。

---

### 1.2 P0-02：诗人幽灵完成时卡死在原场景与事件污染修复

#### 故障现象
玩家在第 3 章（`S17_C` 诗人形态）选好 3 个词后，上方显示“这一章我有意见。”或文字播完，页面没有下一步前进按钮，点击幽灵也无响应，游戏发生死锁只能刷新。

#### 源码定位
1. **死锁根因 1（队列消费死锁）**：
   在 `src/systems/director.ts` 中，`skipOrNextDialogue()` 的逻辑为：
   ```typescript
   if (this.isTyping) { ... }
   else if (this.dialogueQueue.length > 0) { this.nextDialogueInQueue(); }
   ```
   当最后一句台词打字完成且 `dialogueQueue.length === 0` 时，玩家再次点击字幕或屏幕，既不处于 `isTyping`，`dialogueQueue.length > 0` 也是 `false`！导致 `nextDialogueInQueue()` 永远不会被调用，内部的 `onQueueComplete()` 回调被永久丢弃，状态永远停滞在当前场景。
2. **死锁根因 2（彩蛋覆盖主线转场）**：
   `showDialogueQueue(lines, onComplete)` 会直接覆盖 `this.dialogueQueue` 与 `this.onQueueComplete`。如果玩家在等待过程中点击幽灵，`handleStageTap()` 调用 `showDialogueQueue(['这一章我有意见。'])`，直接将待执行的 `goToScene` 剧情转场回调抹成 `null`。
3. **风险 3（触控冒泡误戳）**：
   舞台上的词语选择按钮（`.poet-word-chip`）与各种交互控件上的指针事件直接冒泡到舞台 Canvas 容器，导致玩家选词的同时在底层被视作“戳幽灵”。

#### 修复原理与实现
1. **修正对话队列结束消费语义**：
   在 `src/systems/director.ts` 的 `skipOrNextDialogue()` 中增加对待处理 `onQueueComplete` 的显式触发与消费：
   ```typescript
   } else if (this.dialogueQueue.length > 0) {
     this.nextDialogueInQueue();
   } else if (this.onQueueComplete) {
     const cb = this.onQueueComplete;
     this.onQueueComplete = null;
     cb();
   }
   ```
2. **解耦独立气泡与主线对白队列**：
   在 `SceneDirector` 中新增独立的 `showTransientBubble(text: string, duration?: number)` 方法，并通过独立的 DOM 浮层 `#transientBubble` 展现临时台词。任何连续戳幽灵、长按、彩蛋提示均调用 `showTransientBubble`，**绝不触碰** `this.dialogueQueue` 与 `this.onQueueComplete`。
3. **交互层事件隔离**：
   在 `src/main.ts` 中为 `.minigame-overlay` 与 `.bottom-action-row` 添加 `e.stopPropagation()`，彻底杜绝词语卡片点击时穿透误判戳鬼。
4. **显式翻页按钮兜底**：
   在 `poetGame.step === 'recite'` 时，界面展示复古诗稿纸页卡片，并显式渲染醒目的 `<button class="paper-btn accent" id="foldPoemBtn">把诗折起来 →</button>`，玩家点击直接推进到下一屏，双保险保证绝不死锁。

---

### 1.3 P0-03：所有剧情场景通路防死锁排查与自由模式兼容

1. 检查了 `S14`、`S15_A`、`S16_B`、`S18_D`、`S19_E`、`S20`、`S22` 等全部剧情分支，均已适配修正后的 `skipOrNextDialogue()` 消费逻辑。
2. 在通关后的自由模式（`S27`）中，饲养手册回放旧版变身小游戏时，均提供显式可点击退出按钮返回 `S27`，无死锁隐患。

---

## 2. V2.0 纯享 6 屏文学短篇重构（3—5 分钟主线）

依据执行令，将主线压缩为精炼耐读的 6 屏绘本结构，旧版五类形态和长图鉴内容保留至通关后解锁的自由模式（`S27` 半糖的夜班）：

| 屏号 | 章节名称 | 场景 ID | 核心体验与操作 | 实测仿真时长 |
|---|---|---|---|---|
| P00 | 扉页：今晚有鬼借宿 | `P00` | 深夜读物封面，月亮呼吸，点击月亮掉墨屑彩蛋（“月亮正在掉字。”），点击“翻开今晚”翻页 | 15s |
| P01 | 第一页：一个不合格的恐吓者 | `P01` | 半糖举牌“不给糖就捣蛋。”，3s挂机牌翻面“如果方便的话。”，拖动南瓜糖精准投喂 1 颗即达标，出现“继续翻页 →” | 25s |
| P02 | 第二页：糖果气象报告 | `P02` | 天气预报短雨（单一波次约 40s），下轨精准接糖，前 3 颗必为好接糖，接满 3 颗出现“收起雨伞 / 翻页 →”，荒谬吐槽限 2 次 | 40s |
| P03 | 第三页：一首没用的诗 | `P03` | 幽灵戴贝雷帽，三行词库选择，动态生成 3 行荒谬小诗与专属题头，显式展示复古诗稿与“把诗折起来 →”按钮 | 50s |
| P04 | 第四页：幽灵账本 | `P04` | 散落糖纸与钢笔，“收糖：若干；还款能力：零”，3 条原创文学短句任选 1 条印入回礼卡，点击“写在背面 →” | 30s |
| P05 | 尾页：多出来的一颗糖 | `P05` | 幽灵摔倒自嘲，推出额外留下的最后一颗金色糖果，生成《万圣节快乐持有证》，可保存卡片或进入自由模式 | 45s |
| **总计** | **完整单周目首通体验** | **P00—P05** | **一次喂糖、一波短雨、一首真诗、一张糖纸短句、一枚终极纪念小票** | **约 3 分 25 秒** |

---

## 3. 《万圣节快乐持有证》文学卡片定制升级

去除了所有功能原型感与游戏技术排名的文字，呈现一张高质感复古小票：
- **顶部印章**：`MIDNIGHT / 31 OCT 2026` 与月相图案
- **标题**：《万圣节快乐持有证》
- **证明正文**：“兹证明：你在一个普通的夜晚，认真喂饱了一只不太称职的鬼。”
- **中间画芯**：半糖手捧最后一颗闪耀金色糖果的复古矢量插画
- **手写诗句**：展示玩家在 P04 亲自选中的短句（如：“月亮没说什么。它只是一直亮着。”）
- **温和结语**：“愿你也有一点毫无理由的开心，和一点恰到好处的偏爱。”
- **有效期**：“有效期：直到月亮忘记路。”
- **暗红防伪小印章**：`半糖 · 签收` 与 `31 OCT 2026`
- **保存兜底**：支持长按图片弹出系统保存菜单，防止 Safari 拦截下载。

---

## 4. 自动化测试与质量门禁结果

全量测试套件执行：`npm test`（`npx tsx tests/gameVerification.test.js`）

```text
--- 开始全量业务逻辑与规则核验（含发布后审查修复项） ---
测试 1: 验证 12 张糖纸定义
✓ 12 张糖纸定义全部通过
测试 2: 验证 15 个彩蛋定义
✓ 15 个彩蛋定义全部通过
测试 3: 验证诗人幽灵三词真动态成诗机制 (P1-03)
✓ 诗人三词动态成诗核验通过（每一词均产生实质文字变化）
测试 4: 验证温柔行为计分正向性 (P1-04)
✓ 温柔计分语义正向性核验通过
测试 5: 验证接糖游戏波次与状态隔离 (P0-03 & P0-05)
✓ 接糖波次与周目状态隔离核验通过
测试 6: 验证 S20 第二形态非主形态次高候选计算 (P0-04)
✓ S20 第二形态智能候选算法核验通过
测试 7: 验证 S22 糖纸排序与 EGG11 逆序彩蛋 (P1-01)
✓ S22 糖纸排序与逆序彩蛋达成核验通过
测试 8: 验证 startNewRun 周目清零与永久收藏隔离 (P0-03)
✓ 周目清零与永久图鉴隔离核验通过
测试 9: 验证 6 大结局称号判定机制
✓ 6 种结局称号确定性优先级算法全部通过
测试 10: 验证接糖判定区与可见身体坐标对齐 (P0-01)
✓ P0-01 接糖判定区物理与视觉统一核验通过
测试 11: 验证对话队列完成回调与防死锁机制 (P0-02)
✓ P0-02 对话完成回调与防死锁核验通过
测试 12: 验证独立气泡与主线对话队列解耦 (P0-02)
✓ P0-02 独立气泡解耦核验通过（戳鬼绝不破坏剧情跳转）
测试 13: 验证 P03 诗人幽灵新词库与组合生成
✓ P03 诗人幽灵新词库动态创作核验通过
测试 14: 验证 V2 纯享 6 屏主线贯通流水线 (P00-P05)
✓ V2 纯享 6 屏精简主线端到端验证通过
测试 15: 验证首通节奏与时长仿真 (目标 3—5 分钟)
✓ 节奏与时长仿真达标：约 3 分 25 秒（完美契合 3—5 分钟）

========================================
🎉 15 项端到端业务、P0定点修复与V2文学精简版回归测试全部通过！
========================================
```

生产构建执行：`npm run build`
- TypeScript 类型检查：0 错误，0 告警
- 产物尺寸：JS 124.25 kB (gzip: 35.85 kB), CSS 12.14 kB (gzip: 2.94 kB)
- PWA Service Worker：自动注入 9 个离线静态资源至 `dist/sw.js`，缓存版本升级为 `tonight-feed-ghost-v2.0`。

---

## 5. iPhone / Safari / 离线环境验收情况声明

依据执行令“没有真实设备则**写未验证**，禁止写‘真机全部通过’”的诚信要求：

1. **模拟环境验证（已通过）**：
   - 在开发环境以 iPhone 12/13/14 (390×844)、iPhone 14/15 Pro (393×852)、iPhone Pro Max (430×932) 尺寸下验证：
   - 布局均使用 `100dvh` + `env(safe-area-inset-bottom)`，底部按钮均高于 Home Indicator；
   - 接糖下轨与落物接触无肉眼偏差；
   - 选词按钮触控不触发戳鬼；
   - 诗歌折起按钮正常跳转；
   - 离线 Service Worker 缓存清单完备。
2. **真实苹果硬件真机（待用户实机验收，标注为未验证）**：
   - 当前在非 iOS 终端环境执行，未能连入实体 iPhone 真实硬件运行；因此正式标注为：**真实 iPhone 真机待用户实测验证**。

---

## 6. 回滚与部署说明

- **基线分支/标签**：`main` 之前处于 `f2d261b`。
- **回滚方式**：若新版有回归问题，执行 `git checkout f2d261b` 即可秒级恢复。
