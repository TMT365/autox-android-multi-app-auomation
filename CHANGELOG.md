# 更新日志

本项目的所有重要变更都会记录在此文件。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.7.0] - 2026-10-19

### 新架构：识别与定位分离

```
config.controls / config.aiControls   ← 语义层：这条策略识别“是什么控件”
            ↓ 扫描
page_cache.json                       ← 坐标层：记录 bounds 中心点 (x, y)
            ↓ 点击
click(x, y)                           ← 不再依赖每次实时查找
```

### 新增
- `scanPage(appId, merge)`：扫描当前页面全部角色，覆盖写入
  `page_cache.json`；`merge=true` 时增量更新（用于展开的菜单等瞬态页面）
- `ensurePageScanned(appId)`：用**题干文字指纹**判断页面是否变化，
  变化则自动重扫（覆盖上一题坐标）
- `clickNextQuestionAndRescan()`：点"下一题"后立即失效缓存并重扫
- `clickRoleCached()` / `clickRoleOrFallback()`：缓存坐标优先，失败回退实时查找
- **悬浮窗新增 `⟳` 按钮**：随时重新识别当前页面控件，
  网络波动 / 页面错乱后可一键恢复
- `config.aiControls`：豆包扫描角色 `inputBox` / `attachBtn` /
  `albumOption` / `photoConfirm` / `sendBtn`
- 选择题点选优先使用缓存坐标（`getCachedOption`），缺失时回退实时定位
- 打开豆包附件菜单后增量扫描，记录"相册"选项坐标
- `ensureScreenCapture()`：启动时申请屏幕截图权限（MediaProjection），
  截图失败时自动尝试请求一次
- `page_cache.json` 含每页控件坐标，加入 `.gitignore`

### 使用说明
- 每次执行单题流程前，脚本自动扫描当前作业页并覆盖 `page_cache.json`
- 手动翻页 / 网络波动后，点悬浮窗 `⟳` 重新识别即可
- 学习通改版时，只需修改 `config.json` 里的 `controls` 匹配策略，
  无需改动代码

---

## [1.6.1] - 2026-10-19

### 根据真机 dump 校准（学习通 v6.x / WebView）

实测控件树关键发现：

| 控件 | 实际形态 |
|---|---|
| 下一题 | `android.view.View`，文字 `"下一题 "`（**带尾随空格**） |
| 上一题 | `android.view.View`，文字 `" 上一题"`（带前导空格） |
| 选项 | `android.view.View [clickable]`，子 `TextView` 只有字母 `A/B/C/D`，**选项正文不在无障碍树** |
| 题干 | `android.widget.TextView`，文本可读 |
| 选择题页面 | **没有 EditText**，答案只能点选 |

### 修改
- `nextButton` 首选策略改为 `textMatches("^\\s*下一题\\s*$")`，兼容前后空格
- 新增 `questionStem` 控件策略：可见 TextView + `minTextLength: 6` + `pick: longestText`
- `option` 策略改为精确匹配单个字母 `^[ABCD]$`
- 新增 `pick: "longestText"`、`minTextLength` / `maxTextLength` 过滤
- **新增选择题自动点选**：
  - `parseChoiceAnswer()` 解析纯选项答案（`A` / `AB` / `A,B` / `答案：A`）
  - `findOptionByLetter()` / `applyChoiceAnswer()` 点选对应选项
  - 选项字母节点不可点时由 `clickNodeSafe()` 向上找 clickable 父 View
  - 非纯选项答案（简答题）仍走原有粘贴流程
  - 开关 `config.autoAnswerChoice`（默认 true）
- `.gitignore` 忽略 `layout_dump.txt`（含题目内容，不应提交）

---

## [1.6.0] - 2026-10-19

### 新增
- **通用控件查找 `findControl(spec, timeout)`**：多策略按序尝试，每条策略支持
  `text / textContains / textMatches / desc / id / className` 匹配，
  `clickable / visibleToUser / enabled` 过滤，`region` 相对区域过滤，
  `pick` 多候选裁决（bottomMost / rightMost / largest / first）
- **安全点击 `clickNodeSafe(node)`**：自身可点 → 向上找可点击祖先（6 层）→
  节点实时 `bounds` 中心坐标点击；不再依赖硬编码坐标
- **`config.controls` 配置段**：`nextButton` / `answerInput` / `option`
  三类控件的默认策略，可被 `config.json` 覆盖
- **`layout_dump.js` 控件树导出工具**：一键导出当前页面完整控件树到
  `layout_dump.txt` + 剪贴板 + 控制台，解决"手机上看不到/复制不了控件属性"

### 适配
- 学习通新版按钮使用 `android.view.View` 绘制文字，`id` / `desc` 为空，
  新策略以 `text + clickable + visibleToUser` 组合定位
- 选项 ABCD 为 `android.widget.TextView`，用 `textMatches("^[ABCD][.、．\\s]")` 匹配
- `clickSmart()` 内部改用 `clickNodeSafe()`

---

## [1.5.0] - 2026-10-19

### 新增
- 悬浮窗 **▶ 开始按钮** + `STATE.ready` 状态机：未启动时按钮绿色高亮，
  音量减被忽略；点开始后按钮变灰"下一题"
- 悬浮窗**缩小按钮** `btn_min`（`−` / `+` 切换），最小化后只保留标题栏
- 拖拽监听改挂 `title_bar`，加 5px 阈值，避免与按钮点击冲突
- 视觉强化：窗口 220×320、标题 🎓 + 黄色 13sp、开始按钮 40dp

---

## [1.4.0] - 2026-10-19

### 简化部署
- **统一部署要求**：`autox_homework_helper.js`、`floater.xml`、`config.json` 三文件必须在同一目录
- 脚本启动时通过 `files.cwd()` 自动取得 `SCRIPT_DIR`，`FLOATER_XML_PATH` 和 `CONFIG_JSON_PATH` 自动派生
- 删除 `resolveFloaterLayoutPath()` 多路径查找函数（约 25 行删除）
- 删除 `loadConfig()` 内 6 路径候选列表（约 12 行删除）
- 删除 `config.floaterXmlPath` 字段（已弃用），`config.example.json` 同步精简
- 失败时错误日志直接指向 `SCRIPT_DIR`，提示更明确

### 兼容
- `config.json` 不存在 → 用 `DEFAULT_CONFIG`（行为与 v1.3 一致）
- `config.json` 解析失败 → WARN + 回退默认，绝不抛错
- floater.xml 不存在 → ERROR + 提示路径，不再静默降级到按键模式

---

## [1.3.0] - 2026-10-19

### 新增
- 外部配置文件 `config.json`（v1 schema）：`apps` 应用注册表、`timeouts`、
  `delays`、`coords`
- `loadConfig()`：配置缺失 / 解析失败 / 版本不符时 WARN + 回退 `DEFAULT_CONFIG`
- 新增应用（如替换 AI 应用）只需扩展 `apps.<id>` 并改 `homeworkApp` / `aiApp`

---

## [1.2.0] - 2026-10-19

### 新增
- **悬浮窗控制面板** (`floater.xml` + 4 个 floater 函数)：
  - `loadFloaterLayout()` 读取外部 XML 布局
  - `initFloater()` `floaty.window` 渲染、缓存 view、绑定 5 个按钮
  - `updateFloaterUi()` 实时状态同步，250ms 节流，`ui.run` 跨线程安全
  - `destroyFloater()` 优雅关闭，二次调用幂等
- **顶部全局开关** `ENABLE_FLOATER` / `ENABLE_HOTKEY`，false 时回退到 v1.1 行为
- **`STATE` 状态对象**：`current` / `lastDuration` / `paused` 驱动悬浮窗显示
- **5 个手动控制按钮**：下一题 / 暂停 / 停止 / 复制答案 / 打开日志
- **任意位置长按并拖动悬浮窗**（`setOnTouchListener` 全手势捕获）
- **错误显示**：自动从 `STATS.lastError` 同步，无需手动镜像

### 部署要求
- `floater.xml` 需与脚本一同推到手机 `/sdcard/AutoX/`
- AutoX 需授予 **"显示在其他应用上层"** 权限
- 最低支持 AutoX v6.5+（`floaty.window` 返回 `JsWindow` 才能 `setPosition`/`setOnTouchListener`/`close`）

### 修复
- 豆包预检：发现并修复 v1.1 中学习通预检条件写反（`!app.getPackageName && !(app.getAppName && ...)`），现在两个 APP 都真实检测后才打印

---

## [1.1.0] - 2026-10-17

### 新增
- `SCRIPT_VERSION` 常量，便于版本追踪
- `preflightCheck()` 启动预检：
  - 校验无障碍服务是否开启
  - 校验学习通 / 豆包 APP 是否安装
- `log()` / `logDebug()` 带级别的日志函数
- `DEBUG` 调试开关（顶部常量，true 时输出详细日志）
- `STATS` 运行时统计对象：累计 `runs` / `success` / `fail` / `lastError`
- 资源清理钩子：`events.on("exit")` 自动删除临时截图
- `processOneQuestion` 失败时记录具体 `lastError`，Toast 提示更精准

### 改进
- `main()` 入口先用 `preflightCheck()` 再继续，避免运行时才发现问题
- `onTriggerNextQuestion` 异常时记录 `lastError`，Toast 直接告知失败原因

---

## [1.0.0] - 2026-10-17

### 新增
- 完整单题答题流程：
  1. 启动学习通 → 截图
  2. 启动豆包 → 上传截图 + 提示词
  3. 等待 AI 回复 → 抓取文本 → 写入剪贴板
  4. 切回学习通 → 长按输入框 → 粘贴答案
- 按键触发循环（默认 `volume_down`）
- 多策略控件查找：`id → desc → text` 优先级
- 坐标降级方案（1080×2400 设计基准）
- 集中化配置区（顶部 1.8 节）
- Toast 异常提示
- 使用说明 / 风险提示（控制台输出）

---

## 路线图

### [2.0.0] - 长期
- 模块化拆分（`config.js` / `utils.js` / `doubao.js` / `xuexitong.js`）
- 支持 `engines.execScriptFile` 项目模式
- 内置布局分析工具（自动获取控件坐标）
- 悬浮窗多机位预设（位置记忆 + 不同 ROM 主题色）
- 可选的多选题 / 单选题自动切换（基于题型检测）
- 答案预览确认（粘贴前先弹 Toast 确认）
- 多机型坐标预设（小米 / 华为 / OPPO / vivo）

---

## 历史版本

无更早版本。