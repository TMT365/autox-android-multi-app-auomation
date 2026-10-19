# 更新日志

本项目的所有重要变更都会记录在此文件。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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