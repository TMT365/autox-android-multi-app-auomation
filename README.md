# AutoX.js 学习通作业助手

> 基于 Android 无障碍 API 的作业流程自动化脚本（学习研究用途）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![AutoX](https://img.shields.io/badge/AutoX.js-v6.0%2B-blue)](https://github.com/kkevsekk1/AutoX)
[![Android](https://img.shields.io/badge/Android-9.0%2B-green)](https://developer.android.com/)
[![Version](https://img.shields.io/badge/version-v1.1.0-orange)](CHANGELOG.md)

> ⚠️ **重要风险提示**：本项目仅用于 AutoX.js 编程技术与 Android 无障碍 API
> 的学习研究。严禁用于任何教育平台的作业/考试作弊、代刷网课等违规用途。
> 详见 [`docs/RISK.md`](docs/RISK.md)。

---

## 项目简介

本项目是一个**单文件 AutoX.js 自动化脚本**，演示了完整的"截图 → AI 识别 →
抓取 → 粘贴"自动化流程。脚本会自动：

1. 启动"学习通"APP → **截图当前作业题**保存到本地
2. 启动"豆包"APP → **上传截图 + 发送内置提示词**
3. 等待豆包 AI 回复 → **抓取答案文本** → 写入系统剪贴板
4. 切回"学习通"APP → **长按答案输入框 → 一键粘贴**

用户按指定按键（默认音量减）即可触发**单题答题循环**。

### 适用场景

- ✅ AutoX.js 编程实践（无障碍 API、控件查找、剪贴板、按键监听）
- ✅ Android `AccessibilityService` 与 UI 自动化原理研究
- ✅ AI 模型集成（OCR + LLM）的端侧流程演示
- ❌ **任何形式的作业/考试作弊**（请阅读 [`docs/RISK.md`](docs/RISK.md)）

---

## 快速开始

```bash
# 1. 把脚本传到手机（任意方式：USB、微信文件传输、网盘等）
# 2. 在手机 AutoX.js 中打开 autox_homework_helper.js
# 3. 开启权限：AutoX → 设置 → 权限 → 无障碍 / 悬浮窗 / 存储
# 4. 手动打开学习通到作业答题页 + 手动打开豆包到聊天界面
# 5. 运行脚本 → 按音量减开始答题
```

完整安装指南请见 [`INSTALL.md`](INSTALL.md)。

---

## 文档导航

| 文档 | 内容 |
|---|---|
| [INSTALL.md](INSTALL.md) | 安装 / 权限 / 手机系统设置 |
| [CHANGELOG.md](CHANGELOG.md) | 版本历史 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 代码架构（5 大模块） |
| [docs/ADAPTATION.md](docs/ADAPTATION.md) | 控件 ID 失效后如何适配新版本 |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | 常见问题与排查 |
| [docs/RISK.md](docs/RISK.md) | ⚠️ 风险提示（必读） |

---

## 主要特性

- 📱 **零 root 依赖**：仅使用 Android 标准无障碍 API
- 🔧 **配置集中**：所有可调参数（包名、超时、坐标、提示词）集中在脚本顶部
- 🛡️ **超时保护**：每个流程步骤都有超时，失败立刻 Toast 提示并终止
- 🎯 **多策略查找**：`id → desc → text` 优先级 + 坐标降级，ID 漂移也有兜底
- 📊 **运行时统计**：`STATS` 跟踪 runs / success / fail / lastError
- 🧹 **资源清理**：脚本退出钩子自动删除临时截图
- ⌨️ **按键触发**：单次按键 = 单题流程，避免无限循环滥用

---

## 项目结构

```
.
├── autox_homework_helper.js   # 主脚本（单文件，可在 AutoX.js 中直接运行）
├── README.md                  # 本文档
├── INSTALL.md                 # 安装指南
├── CHANGELOG.md               # 版本历史
├── LICENSE                    # MIT 许可证 + 风险提示
├── .gitignore
├── .editorconfig
└── docs/
    ├── ARCHITECTURE.md        # 代码架构
    ├── ADAPTATION.md          # 新版本适配
    ├── TROUBLESHOOTING.md     # 故障排查
    └── RISK.md                # ⚠️ 必读风险提示
```

---

## 配置速览

打开 `autox_homework_helper.js`，最顶部第一部分是**所有可配置参数**：

| 常量 | 含义 | 默认值 |
|---|---|---|
| `PACKAGE.XUEXITONG` | 学习通包名 | `com.chaoxing.mobile` |
| `PACKAGE.DOUBAO` | 豆包包名 | `com.litchi.bytebread` |
| `TIMEOUT.APP_LAUNCH` | 启动 APP 超时（ms） | `20000` |
| `TIMEOUT.AI_RESPONSE` | 豆包回复超时（ms） | `90000` |
| `DELAY.POLL_INTERVAL` | 控件轮询间隔（ms） | `600` |
| `SCREENSHOT_PATH` | 截图保存路径 | `/sdcard/Pictures/AutoX_Screenshot.png` |
| `DOUBAO_PROMPT` | 发送给豆包的提示词 | （详见脚本） |
| `SELECTOR.*` | 控件 ID 候选 | （详见脚本） |
| `COORD.*` | 坐标备用 | 1080×2400 设计 |
| `NEXT_QUESTION_KEY` | 触发下一题的按键 | `volume_down` |

---

## 开发与调试

### 打开调试日志

修改脚本顶部：

```javascript
var DEBUG = true;
```

DEBUG 模式下，所有 `logDebug()` 调用会输出到 AutoX 控制台。

### 常见调试流程

1. 打开 AutoX.js 的"布局分析"悬浮窗，定位目标控件的真实 ID
2. 把 ID 填入 `SELECTOR.*` 数组
3. 如 ID 失效，使用坐标降级方案（修改 `COORD.*`）
4. 运行一次完整流程，观察 AutoX 控制台日志

详见 [`docs/ADAPTATION.md`](docs/ADAPTATION.md)。

---

## 局限性

1. **APP 版本敏感**：学习通/豆包每改一次 ID，脚本可能要重新适配
2. **屏幕比例依赖**：坐标按 1080×2400 设计，不同机型需按比例换算
3. **弹窗/广告干扰**：建议运行前手动关闭所有弹窗
4. **风控风险**：学习通等平台已上线"无障碍自动化"检测模型

---

## 贡献

本项目以**学习研究**为初衷，欢迎：

- 报告控件 ID 失效问题（请附 AutoX 布局分析截图）
- 改进坐标方案（请附目标机型分辨率）
- 完善文档、补充常见机型配置

但**不欢迎**：

- 任何"如何作弊不被发现"的提问
- 绕过平台风控的代码
- 把项目改名为"代刷工具"的分发

---

## 许可证

[MIT License](LICENSE)，附带独立的"风险提示"段落。商业使用、修改、分发均需保留
版权声明与风险提示。

---

## 致谢

- [AutoX.js](https://github.com/kkevsekk1/AutoX) —— 强大的 Android 自动化框架
- [豆包 AI](https://www.doubao.com) —— 提供 AI 识图能力
- Android 无障碍服务（AccessibilityService）—— 整个方案的基石

---

<p align="center">
  <strong>请记住：技术是工具，不是目的。把脚本用在正确的地方。</strong>
</p>