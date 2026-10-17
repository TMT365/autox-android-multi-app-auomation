# 更新日志

本项目的所有重要变更都会记录在此文件。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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

### [1.2.0] - 计划中
- 可选的多选题 / 单选题自动切换（基于题型检测）
- 答案预览确认（粘贴前先弹 Toast 确认）
- 多机型坐标预设（小米 / 华为 / OPPO / vivo）

### [2.0.0] - 长期
- 模块化拆分（`config.js` / `utils.js` / `doubao.js` / `xuexitong.js`）
- 支持 `engines.execScriptFile` 项目模式
- 内置布局分析工具（自动获取控件坐标）

---

## 历史版本

无更早版本。