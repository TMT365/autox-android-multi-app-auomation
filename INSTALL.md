# 安装指南

> 本文档介绍 AutoX.js 脚本的安装步骤、权限开通、手机系统设置建议。

---

## 1. 安装 AutoX.js

### 1.1 下载 AutoX.js

- 官方 GitHub：[autox-community/AutoX v6.6.8](https://github.com/autox-community/AutoX/releases/tag/v6.6.8)
- 推荐版本：**v6.6.0+**（不需要 Pro 7 的收费 API）

> ⚠️ 注意区分"AutoX.js"和"Auto.js Pro"。本脚本不依赖 Pro 收费功能。

### 1.2 安装到手机

- 下载 APK 后直接安装（需打开"未知来源应用"权限）
- 国内用户若 GitHub 访问不便，可在第三方平台搜索"AutoX.js v6"

---

## 2. 脚本文件传输

把 `autox_homework_helper.js` 传到手机任意目录：

| 方式 | 操作 |
|---|---|
| USB + 文件管理 | 把文件复制到手机的 `Download` 或 `AutoX` 目录 |
| 微信文件传输助手 | 电脑端微信 → 文件传输助手 → 发送 .js 文件 → 手机端保存 |
| 网盘 | 上传到网盘 → 手机下载 |
| AutoX 内置编辑器 | 直接在 AutoX 里新建文件，把代码粘贴进去 |

> 📁 推荐放在 `/sdcard/AutoX/` 或 `/sdcard/Download/` 下，方便定位。

---

## 3. 权限配置

启动 AutoX.js 后，**必须**开通以下权限：

### 3.1 无障碍服务（必需）

> 这是脚本的核心，没有它无法执行任何自动化操作。

**路径**：AutoX.js APP → 主界面 → 左侧菜单 → **无障碍服务** → 找到 "AutoX.js
AccessibilityService" → 开启

或在系统设置中：
**设置 → 辅助功能 → 已安装的服务 → AutoX.js AccessibilityService → 开启**

### 3.2 悬浮窗权限（必需）

> 用于显示 Toast 提示与 AutoX 控制台悬浮窗。

**路径**：AutoX.js → 菜单 → **悬浮窗** → 授予

或在系统设置中：
**设置 → 应用 → AutoX.js → 权限 → 显示在其他应用上层 → 允许**

### 3.3 存储权限（必需）

> 用于保存截图到 `/sdcard/Pictures/`。

**路径**：AutoX.js → 菜单 → **存储** → 授予

**Android 11+ 额外操作**：
- 设置 → 应用 → AutoX.js → 权限 → 文件和媒体 → **所有文件访问权限**
- 或在脚本中改用应用专属目录（修改 `SCREENSHOT_PATH` 常量）

### 3.4 后台弹出界面（部分机型必需）

> 部分国产 ROM 默认禁止后台应用启动其他 APP，需手动开启。

**路径**：设置 → 应用 → AutoX.js → 自启动 / 后台启动 → **允许**

---

## 4. 手机系统设置（防止脚本被系统杀掉）

AutoX.js 是依赖**无障碍服务**长期运行的，Android 系统经常会"优化"杀掉后台
服务。以下设置可以极大降低被杀概率：

### 4.1 关闭电池优化

**设置 → 电池 → 应用启动管理 / 耗电保护 → 找到 AutoX.js → 设为"不优化" / "允许后台运行"**

不同厂商路径：

| 厂商 | 路径 |
|---|---|
| MIUI（小米） | 设置 → 电池 → 应用后台管理 → AutoX → 无限制 |
| EMUI / HarmonyOS（华为） | 设置 → 电池 → 启动管理 → AutoX → 手动管理 → 全部勾选 |
| ColorOS（OPPO） | 设置 → 电池 → 更多设置 → 关闭"睡眠待机优化" |
| FuntouchOS（vivo） | 设置 → 电池 → 后台高耗电 → AutoX → 允许 |
| OneUI（三星） | 设置 → 电池 → 后台使用限制 → AutoX → 不优化 |
| 原生 Android | 设置 → 应用 → AutoX → 电池 → 不优化 |

### 4.2 锁定后台任务

打开最近任务界面 → 找到 AutoX.js 的卡片 → **下拉 / 长按 → 点击锁定图标**

这样清理后台时 AutoX 不会被杀。

### 4.4 允许通知 / 锁定通知

**设置 → 通知管理 → AutoX → 允许通知 + 设为重要通知**

部分 ROM 杀掉后台时会先静默"无通知应用"。

### 4.5 允许自启动

部分 ROM 需要单独开启"自启动"权限：
**设置 → 应用 → AutoX → 自启动 → 开**

---

## 5. 配置脚本参数

打开 `autox_homework_helper.js`，根据你的实际环境修改以下配置（详见脚本
顶部"第一部分"）：

### 5.1 包名确认

桌面长按学习通 / 豆包 APP 图标 → 应用信息 → 即可看到包名

```javascript
var PACKAGE = {
    XUEXITONG: "com.chaoxing.mobile",   // ← 改成你的实际包名
    DOUBAO:    "com.litchi.bytebread"   // ← 改成你的实际包名
};
```

### 5.2 截图路径（Android 11+）

```javascript
var SCREENSHOT_PATH = "/sdcard/Pictures/AutoX_Screenshot.png";
```

若出现"截图失败"，改为：
```javascript
var SCREENSHOT_PATH = files.join(files.getSdcardPath(), "Pictures", "AutoX_Screenshot.png");
```
或使用 AutoX 应用专属目录：
```javascript
var SCREENSHOT_PATH = files.join(context.getExternalFilesDir(null).getAbsolutePath(), "AutoX_Screenshot.png");
```

---

## 6. 首次运行

1. **手动**登录学习通 → 进入作业答题页面（脚本不负责登录）
2. **手动**打开豆包 → 进入聊天对话界面（确保看到输入框）
3. 在 AutoX.js 中打开 `autox_homework_helper.js`
4. 点击 ▶️ 运行按钮
5. 观察 AutoX 控制台：应打印"=== 启动预检 (v1.1.0) ==="
6. 手机弹出 Toast：`脚本就绪 v1.1.0`
7. 按**音量减**键 → 脚本开始单题流程

---

## 7. 验证

第一次使用时，建议配合 AutoX 控制台观察：

- **AutoX.js 主界面** → 右上角菜单 → **日志** → 查看实时输出
- 关键日志关键字：
  - `=== 启动预检 (v1.1.0) ===` —— 预检开始
  - `预检通过` —— 通过
  - `开始第 N 题` —— 答题流程
  - `截图已保存` —— 截图成功
  - `豆包答案` —— 抓到回复
  - `第 N 题完成` —— 全流程成功
  - `失败原因：xxx` —— 失败定位

---

## 8. 卸载 / 停止

- **临时停止**：在 AutoX 控制台点击 ⏹ 停止按钮，或关闭无障碍服务
- **彻底清理**：卸载 AutoX.js APP（注意脚本可能未被删除，可手动删除 .js 文件）
- **资源清理**：脚本退出钩子会自动删除 `/sdcard/Pictures/AutoX_Screenshot.png`

---

## 9. 下一步

- 配置完成后看 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) 了解代码结构
- 遇到问题看 [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)
- ID 失效看 [`docs/ADAPTATION.md`](docs/ADAPTATION.md)