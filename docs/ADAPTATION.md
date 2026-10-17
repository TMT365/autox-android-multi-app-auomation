# 适配新版本 APP

> 当学习通或豆包更新后，控件 ID 改变导致脚本失效时，本文档指导你如何快速
> 适配。本项目设计为**配置驱动**，绝大多数适配只需修改脚本顶部 `SELECTOR`
> 与 `COORD`，无需改动业务逻辑。

---

## 1. 适配流程总览

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 1. 打开布局   │ →  │ 2. 定位失效点  │ →  │ 3. 记录新 ID │
│    分析悬浮窗 │    │    (Toast报错) │    │   与新坐标    │
└──────────────┘    └──────────────┘    └──────────────┘
                                              ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 6. 提交 PR    │ ← │ 5. 验证一次    │ ← │ 4. 修改      │
│   (可选)      │    │    完整流程    │    │   SELECTOR   │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## 2. 第一步：打开布局分析悬浮窗

**AutoX.js → 菜单 → 悬浮窗 → 启用"布局分析"**

启用后，屏幕上每个控件会显示：

```
┌─[class:android.widget.Button]─┐
│ id: send_btn                   │
│ desc: 发送                     │
│ text: 发送                     │
│ bounds: [990,2200][1080,2400] │
└────────────────────────────────┘
```

这些信息就是你需要的"新 ID / 新坐标"。

---

## 3. 第二步：定位失效点

看 Toast 报错信息，常见的有：

| Toast | 失效环节 | 详见 |
|---|---|---|
| `查找控件超时：豆包附件按钮` | doubaoUploadAndAsk 第 1 步 | §4.1 |
| `查找控件超时：豆包相册菜单` | doubaoUploadAndAsk 第 2 步 | §4.2 |
| `查找控件超时：豆包输入框` | doubaoUploadAndAsk 第 5 步 | §4.3 |
| `查找控件超时：豆包发送按钮` | doubaoUploadAndAsk 第 7 步 | §4.4 |
| `查找控件超时：学习通答案输入框` | processOneQuestion 第 8 步 | §4.5 |

---

## 4. 第三步：逐一适配

### 4.1 豆包附件按钮失效

**症状**：点不到"+"按钮

**修复**：

1. 打开豆包聊天界面
2. 启用布局分析，看"+按钮"附近的控件信息
3. 找到 `id` / `desc` / `bounds`

修改脚本：

```javascript
// 原来
ATTACH_BTN_ID:   ["iv_plus", "iv_more", "btn_more"],
ATTACH_BTN_DESC: ["更多功能", "附件"],

// 适配后（举例：id 改成 iv_add_btn）
ATTACH_BTN_ID:   ["iv_add_btn", "iv_plus", "iv_more"],   // 新值放最前
ATTACH_BTN_DESC: ["更多功能", "附件"],
```

或者只改坐标：

```javascript
DOUBAO: {
    ATTACH_BTN: { x: 80, y: 2230 },   // ← 改成布局分析里看到的 bounds
}
```

### 4.2 豆包相册菜单失效

**症状**：弹出菜单后找不到"相册"项

**修复**：

```javascript
// 原来
ALBUM_DESC:      ["相册", "图片", "从相册选择", "从手机相册选择"],
ALBUM_TEXT:      ["相册", "图片"],

// 适配后（举例：desc 改成"选择图片"）
ALBUM_DESC:      ["选择图片", "相册", "图片", "从相册选择", "从手机相册选择"],
ALBUM_TEXT:      ["相册", "图片"],
```

或修改坐标：

```javascript
DOBAO: {
    ALBUM_OPTION: { x: 200, y: 1850 },  // ← 改成布局分析里看到的
}
```

### 4.3 豆包输入框失效

**症状**：找不到输入消息的 EditText

**修复**：

```javascript
INPUT_BOX_ID:    ["msg_et", "et_message", "input_edit"],   // ← 加新 ID
INPUT_BOX_DESC:  ["输入消息", "输入框", "请输入消息"],
```

### 4.4 豆包发送按钮失效

**症状**：输入完文字后点不到"发送"

```javascript
SEND_BTN_DESC:   ["发送"],
SEND_BTN_ID:     ["send_btn", "iv_send", "btn_send"],   // ← 加新 ID
```

### 4.5 学习通答案输入框失效

**症状**：长按没有"粘贴"菜单

**修复**：

```javascript
XUEXITONG: {
    ANSWER_INPUT_ID:   ["editText2", "answer_content_et", "et_content", "rich_editor"],
    ANSWER_INPUT_DESC: ["作答区", "请输入答案", "题目作答"],
}
```

或修改坐标：

```javascript
XUEXITONG: {
    ANSWER_INPUT: { x: 540, y: 1900 },   // ← 改成布局分析里看到的
}
```

---

## 5. 坐标比例换算

如果你要适配不同分辨率的机型，按比例换算：

```
设计基准 = 1080 × 2400（脚本中 COORD 默认基于此）
本机分辨率 = W × H

实际 X = (W / 1080) × 设计 X
实际 Y = (H / 2400) × 设计 Y
```

例如：本机 1440×3200，豆包发送按钮设计是 `(990, 2200)`：

```
实际 X = (1440 / 1080) × 990 = 1320
实际 Y = (3200 / 2400) × 2200 = 2933.33 ≈ 2933
```

但**强烈推荐**用布局分析直接读 `bounds` 中心点，更准。

---

## 6. 验证适配

修改完，跑一次完整流程：

1. 重启 AutoX.js（避免缓存）
2. 运行脚本
3. 按音量减
4. 观察 AutoX 控制台：
   - 无 "查找超时" Toast → 通过
   - 有 Toast → 看哪个环节失败，回 §4

也可以开 DEBUG 模式：

```javascript
var DEBUG = true;
```

`logDebug()` 调用会输出更详细的步骤日志。

---

## 7. 常见误判

### 7.1 "id 不存在但 desc 还在"

部分 APP 会改 id 但保留 desc（contentDescription）。优先用 desc，更稳定。

### 7.2 "多个相同 desc/text 存在"

比如 "发送" 文字在多个按钮里。**优先用 id**，因为 id 是唯一的。

### 7.3 "bounds 显示但 click 不响应"

可能因为控件被遮挡 / 不可点击区域。降级方案：直接点 `bounds.centerX/Y`：

```javascript
// 修改 clickSmart 调用前的代码
var b = findByPriority(...).bounds();
click(b.centerX(), b.centerY());
```

---

## 8. 进阶：完全自定义流程

如果你想加入新逻辑（比如"自动判断题型"），建议：

1. 在 Part 3 加新函数（如 `detectQuestionType()`）
2. 在 Part 4 `processOneQuestion()` 中调用
3. 新函数的返回值也用 boolean，遵循同样的"成功/失败"模式

详细代码组织建议参考 [`ARCHITECTURE.md`](ARCHITECTURE.md) §3 设计决策。

---

## 9. 贡献你的适配

如果你适配了新机型 / 新 APP 版本，欢迎：

1. Fork 本项目
2. 把 `SELECTOR` / `COORD` 的更新提交为 PR
3. 在 PR 描述中写明：
   - 你的机型 / 分辨率
   - 学习通 / 豆包的具体版本号
   - 修改的字段与原因

项目维护者会合并合理的适配。

> ⚠️ 不要在 PR 中提交"绕过 APP 风控"的代码。