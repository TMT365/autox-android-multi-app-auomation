# 代码架构

> 本文档面向**想理解 / 修改脚本**的开发者，详细讲解 800+ 行单文件脚本的
> 模块划分、数据流、关键设计决策。

---

## 1. 整体结构

脚本分为 **5 大部分**，顺序固定（前面的代码会在后面被引用）：

```
┌────────────────────────────────────────────────────────┐
│ Part 0   版本 & 全局开关                                │
│          SCRIPT_VERSION / DEBUG / STATS                │
├────────────────────────────────────────────────────────┤
│ Part 1   可配置参数（CONFIG 区）                        │
│          PACKAGE / TIMEOUT / DELAY /                   │
│          SCREENSHOT_PATH / DOUBAO_PROMPT /             │
│          SELECTOR / COORD / NEXT_QUESTION_KEY          │
├────────────────────────────────────────────────────────┤
│ Part 2   工具函数                                        │
│          log / logDebug / showToast /                  │
│          preflightCheck / cleanup /                    │
│          findByPriority / waitForControl / clickSmart /│
│          launchAndWait / takeScreenshot /              │
│          copyToClipboard / pasteIntoInput              │
├────────────────────────────────────────────────────────┤
│ Part 3   业务模块                                        │
│          doubaoUploadAndAsk (模块 A)                   │
│          doubaoWaitResponse  (模块 B)                  │
│          processOneQuestion  (模块 C - 编排)           │
├────────────────────────────────────────────────────────┤
│ Part 4   入口 & 按键监听                                │
│          _busy / onTriggerNextQuestion / main()        │
├────────────────────────────────────────────────────────┤
│ Part 5   使用说明 & 风险提示（启动时打印到控制台）        │
│          printUsage / printRiskWarning                 │
└────────────────────────────────────────────────────────┘
```

---

## 2. 数据流（单题答题）

```
  用户按 NEXT_QUESTION_KEY
          │
          ▼
  onTriggerNextQuestion()        ← 防重入（_busy 标志）
          │
          ▼ (新建线程)
  processOneQuestion()
          │
          ├─→ launchAndWait(PACKAGE.XUEXITONG)         → 学习通前台
          ├─→ takeScreenshot()                          → 本地 PNG
          ├─→ launchAndWait(PACKAGE.DOUBAO)            → 豆包前台
          ├─→ doubaoUploadAndAsk()                      → 发送图片+提示词
          │       ├─ clickSmart(ATTACH_BTN)
          │       ├─ clickSmart(ALBUM_OPTION)
          │       ├─ click(FIRST_PHOTO)
          │       ├─ clickSmart(PHOTO_CONFIRM)
          │       ├─ waitForControl(INPUT_BOX)
          │       └─ clickSmart(SEND_BTN)
          ├─→ doubaoWaitResponse()                      → 抓取 AI 文本
          │       ├─ 轮询 LOADING_DESC 出现
          │       ├─ 轮询 LOADING_DESC 消失
          │       ├─ 三层策略抓取文本（desc → id → 最长 TextView）
          ├─→ copyToClipboard()                         → 剪贴板
          ├─→ launchAndWait(PACKAGE.XUEXITONG)         → 回到学习通
          └─→ pasteIntoInput()                          → 长按 → 粘贴
                    ├─ longClick()
                    └─ clickSmart(PASTE_MENU)
          │
          ▼
  Toast "本题已完成"
          │
          ▼
  STATS.success++ / STATS.fail++  ← 统计
          │
          ▼
  _busy = false    ← 释放，下次按键可触发
```

---

## 3. 关键设计决策

### 3.1 为什么单文件而不是多模块？

**理由**：
- AutoX.js 用户最常见的使用方式是把单文件 `.js` 复制到 AutoX 目录运行
- 单文件无需 `engines.execScriptFile()` 或 `$project` 项目模式
- 调试时一目了然，不需要跳文件

**代价**：
- 800+ 行单文件略长，但分成 5 个清晰的部分后仍可读
- 修改时全文件搜索（可以用 IDE 的 outline 功能缓解）

**未来扩展**：v2.0 计划拆分为多文件 + Node 构建脚本（详见 `CHANGELOG.md`）。

### 3.2 为什么"控件优先 + 坐标降级"？

| 策略 | 优点 | 缺点 |
|---|---|---|
| 仅控件（id/desc/text） | 抗屏幕比例变化、点击位置精确 | 依赖 APP 内部实现，版本一改就失效 |
| 仅坐标 | 与 APP 内部实现解耦 | 屏幕分辨率一变就失效 |
| **控件优先 + 坐标降级** | 兼顾两者 | 配置稍复杂 |

**实现**：`clickSmart(ids, descs, texts, coord, desc)`
- 先按 `id → desc → text` 优先级查找
- 找到就点控件（控件 `click()` 或点击 `bounds.centerX/Y`）
- 找不到 / 控件不可点击 → 用 `coord` 坐标
- 都没有 → Toast 报错

### 3.3 为什么按"等待控件出现"而不是 `sleep()`？

- `sleep(5000)` 写死的延时：网络慢时会失败，网络快时浪费
- `waitForControl(timeout)`：
  - 每 `POLL_INTERVAL` 毫秒轮询一次
  - 找到立即返回（快）
  - 超时才放弃（容错）
  - 时间随设备性能自适应

### 3.4 为什么用按键触发而不是自动循环？

**设计意图**：避免脚本被滥用为"无人值守刷作业机"。

- 单题 = 一次按键：用户必须**在屏幕前**确认每题的答案
- 用音量减键：不会被误触（普通用户不会按）
- 退出脚本：直接关闭 AutoX 或无障碍服务即可

### 3.5 为什么 `STATS` 用全局对象而不是返回值？

- AutoX 的事件回调（`onKeyDown`）在新线程中执行
- 多线程间共享状态最简单的方式就是全局变量
- `STATS` 在 `main()` 启动时初始化，`onTriggerNextQuestion` 中累加
- 脚本退出时由 `cleanup()` 打印统计

### 3.6 为什么有三层抓取 AI 回复的策略？

豆包 APP 的 UI 在不同版本 / 不同主题下：

| 策略 | 适用版本 | 失败模式 |
|---|---|---|
| `descMatches(/AI|豆包|回复/)` | 新版本（带无障碍标注） | 老版本 desc 不存在 |
| `id("tv_msg")` | 部分定制版本 | ID 改了就失效 |
| 找最长 TextView | 终极兜底 | 可能误中输入框里的文字 |

按顺序尝试，任一成功即返回。

---

## 4. 关键 API 速查

| AutoX API | 用途 | 备注 |
|---|---|---|
| `app.launchPackage(pkg)` | 启动 APP | 等同 `launchApp()` |
| `currentPackage()` | 当前前台包名 | 用于校验切换成功 |
| `auto.service` | 无障碍服务状态 | 启动前必检 |
| `id("x").findOnce()` | 查单个控件 | 不阻塞 |
| `id("x").findOne()` | 阻塞查控件 | 默认 1000ms 超时 |
| `desc("x").exists()` | 控件是否存在 | 立即返回 bool |
| `click(x, y)` | 坐标点击 | 降级方案 |
| `clickCenter(w)` | 点击控件中心 | `w.bounds().centerX/Y` |
| `w.longClick()` | 控件长按 | 触发上下文菜单 |
| `press(x, y, ms)` | 模拟长按 | 控件 longClick 失败时降级 |
| `setClip(text)` | 写剪贴板 | Pro 7 收费，免费版 OK |
| `getClip()` | 读剪贴板 | |
| `captureScreen(path)` | 截图直接存盘 | v6+ 支持 |
| `captureScreen()` | 截图为 Image 对象 | 配合 `images.save()` |
| `images.save(img, path)` | 保存图片 | |
| `events.observeKey()` | 启用按键监听 | |
| `events.onKeyDown(key, cb)` | 按键按下回调 | `event.getAction() === 0` 是按下 |
| `events.on("exit", cb)` | 退出钩子 | 清理资源用 |
| `threads.start(fn)` | 新线程 | 不阻塞当前线程 |
| `sleep(ms)` | 阻塞等待 | 仅用于已知固定延时 |
| `app.openAppSetting(pkg)` | 跳 APP 设置页 | 引导用户开权限 |
| `console.log/warn/error` | 日志输出 | AutoX 控制台可见 |
| `exit()` | 退出脚本 | 立即终止 |

---

## 5. 修改脚本的"安全清单"

修改任意函数前，请确认：

- [ ] **不破坏顺序依赖**：Part 2 的工具函数被 Part 3/4 调用，不要重排
- [ ] **保留 const 语义**：`PACKAGE / TIMEOUT / DELAY / SCREENSHOT_PATH` 等
      配置在 Part 1，被全局引用
- [ ] **保留返回 boolean**：所有 Part 3 业务函数都返回 boolean，Part 4 据此判断
- [ ] **新增超时参数**：加到 `TIMEOUT`，不要硬编码
- [ ] **新增坐标参数**：加到 `COORD`，标注设计基准分辨率
- [ ] **新增 ID 候选**：加到 `SELECTOR` 数组（多版本 fallback）
- [ ] **修改后跑一次语法检查**：`node --check autox_homework_helper.js`

---

## 6. 调试技巧

### 6.1 打开详细日志

```javascript
var DEBUG = true;
```

`logDebug()` 调用会输出到控制台。

### 6.2 查看控件树

在 AutoX 主界面 → 启用"布局分析"悬浮窗，会在屏幕上显示每个控件的：
- `class`（类名）
- `id`（资源 ID）
- `desc`（contentDescription）
- `text`（显示文本）
- `bounds`（坐标矩形）

### 6.3 单步执行

AutoX 控制台支持 `console.trace()` 输出调用栈。把脚本中关键步骤前后加：

```javascript
console.trace("=== 步骤 4: doubaoUploadAndAsk 开始 ===");
// ... 业务代码
```

### 6.4 仅测试某一步

把 `main()` 改为：

```javascript
// 注释掉 onTriggerNextQuestion 注册
events.observeKey();
events.onKeyDown(NEXT_QUESTION_KEY, function(e) {
    if (e.getAction() === 0) {
        // 只测截图
        threads.start(function() {
            var img = takeScreenshot(SCREENSHOT_PATH);
            console.log("截图：" + img);
        });
    }
});
```

---

## 7. 性能与稳定性

- **CPU / 电量**：每次单题流程约 1-3 分钟，主要时间花在豆包 AI 处理
- **流量**：单次截图约 200-500KB，发给豆包约 1-3MB（含 AI 回复）
- **成功率**：取决于 APP 版本未变、无障碍服务稳定运行

**已知不稳定场景**：
1. 豆包更新后图片选择器变化 → 修改 `COORD.DOUBAO`
2. 学习通弹出"版本更新"提示 → 先手动关掉
3. 手机锁屏导致无障碍服务暂停 → 保持解锁状态

---

## 8. 后续演进

如果脚本要扩展，建议演进路径：

```
v1.x  单文件 + 注释完善
  ↓
v2.x  拆分为多文件 + Node 构建
  ↓
v3.x  引入 TypeScript 类型定义（仅 IDE 辅助，不上运行）
```

但**当前 v1.x** 已能完整演示 AutoX.js 编程范式，不必急于重构。