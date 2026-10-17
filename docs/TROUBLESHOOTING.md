# 故障排查

> 本文档按"症状 → 原因 → 解决方案"组织，对照着排查即可。

---

## 1. 启动阶段

### 1.1 启动脚本后立刻 Toast "请先开启 AutoX 无障碍服务"

**原因**：未授权 AutoX 的无障碍服务

**解决**：
1. AutoX.js → 菜单 → 无障碍服务 → 找到 "AutoX.js AccessibilityService" → 开启
2. 或 系统设置 → 辅助功能 → 已安装的服务 → AutoX.js AccessibilityService → 开启
3. 部分 ROM（MIUI / EMUI）需额外授权："自启动 + 后台运行"

---

### 1.2 Toast "未检测到学习通 APP（com.chaoxing.mobile）"

**原因**：
- 学习通未安装
- 包名与你安装的版本不一致（不同渠道包名可能不同）

**解决**：
1. 桌面长按学习通 → 应用信息 → 看到真实包名（可能是 `com.chaoxing.mobile`
   / `com.ewt.client` / 其他）
2. 修改脚本 `PACKAGE.XUEXITONG` 为真实包名

---

### 1.3 Toast "未检测到豆包 APP（com.litchi.bytebread）"

**原因**：同上

**解决**：
1. 桌面长按豆包 → 应用信息 → 看真实包名
2. 修改 `PACKAGE.DOUBAO`（常见值：`com.litchi.bytebread` /
   `com.bytedance.doubao` / `com.bytedance.ai`）

---

### 1.4 启动后 Toast "脚本就绪"，按键没反应

**原因 A**：按键事件没监听成功

**排查**：
```javascript
// 临时在 main() 末尾加：
events.onKeyDown("volume_down", function(e) {
    console.log("key event action=" + e.getAction());
});
```

**原因 B**：AutoX 在后台被系统冻结

**解决**：见 [`INSTALL.md §4`](../INSTALL.md) 的"防杀后台"设置。

**原因 C**：音量键被系统占用（如通话 / 媒体音量）

**解决**：修改 `NEXT_QUESTION_KEY` 为 `"enter"`（回车键）或 `"back"`（返回键）

---

## 2. 截图阶段

### 2.1 Toast "截图失败，请检查存储权限"

**原因**：存储权限未授权，或 Android 11+ 作用域存储限制

**解决**：

**方法 1**：授予存储权限
- AutoX → 菜单 → 存储 → 授予
- 或 系统设置 → 应用 → AutoX → 权限 → 存储 → 允许

**方法 2**（Android 11+）：授予"所有文件访问权限"
- 设置 → 应用 → AutoX → 权限 → 文件和媒体 → **所有文件访问权限**

**方法 3**（仍失败）：改用应用专属目录
```javascript
var SCREENSHOT_PATH = files.join(
    context.getExternalFilesDir(null).getAbsolutePath(),
    "AutoX_Screenshot.png"
);
```

---

### 2.2 截图成功但豆包上传时显示"图片不存在"

**原因**：路径权限问题

**解决**：用 AutoX 内部路径：
```javascript
var SCREENSHOT_PATH = files.join(files.getSdcardPath(), "Pictures", "AutoX_Screenshot.png");
```

---

## 3. 豆包阶段

### 3.1 Toast "查找控件超时：豆包附件按钮"

**原因**：豆包版本更新，按钮 id/desc 变了

**解决**：见 [`ADAPTATION.md §4.1`](ADAPTATION.md)

---

### 3.2 Toast "找不到'相册'菜单"

**原因**：附件菜单的菜单项改了名称

**解决**：修改 `SELECTOR.DOUBAO.ALBUM_DESC` / `ALBUM_TEXT`，或修改 `COORD.DOUBAO.ALBUM_OPTION` 坐标

---

### 3.3 Toast "查找控件超时：豆包输入框"

**原因 A**：豆包没在聊天界面（在首页 / 话题页 / 设置页等）

**解决**：手动进入聊天界面，再运行脚本

**原因 B**：id/desc 失效

**解决**：用布局分析定位新 id，修改 `SELECTOR.DOUBAO.INPUT_BOX_ID`

---

### 3.4 Toast "豆包回复超时（90s）"

**原因**：
- 网络慢，AI 处理超时
- 豆包账号被风控，要求手动验证
- 截图上传失败但没报错（豆包没收到图片）

**解决**：
1. 检查网络（4G/5G/WiFi 都试）
3. 检查豆包 APP 是否有未读消息 / 验证码
4. 把 `TIMEOUT.AI_RESPONSE` 调大（如 120000 = 120s）

---

### 3.5 Toast "抓取豆包回复为空"

**原因**：抓取文本的三层策略都失败了

**排查**：
1. 开 `DEBUG = true`，看控制台有没有 "AI 消息 descMatches 数 / tv_msg 数"
2. 在豆包里**手动**确认 AI 确实回了（不是网络问题）
3. 用布局分析查看 AI 消息气泡的 `class` / `id` / `desc`，修改 `doubaoWaitResponse()` 的策略 1

---

### 3.6 上传图片后豆包没反应 / 卡在"生成中"

**原因**：豆包识别失败，或图片太大

**解决**：
1. 检查截图大小（`files.size(SCREENSHOT_PATH)`）
2. 如果 > 5MB，改用压缩后的截图：

```javascript
// 在 takeScreenshot 末尾加：
var img = images.read(path);
var resized = images.resize(img, [1080, 1920]);  // 缩放
images.save(resized, path);
img.recycle();
resized.recycle();
```

---

## 4. 学习通阶段

### 4.1 Toast "找不到答题输入框"

**原因 A**：当前不是答题页面（在题目列表 / 已提交页 / 讨论区）

**解决**：手动进入"作业答题"页面（能看到输入框的那一页）

**原因 B**：id/desc 失效

**解决**：见 [`ADAPTATION.md §4.5`](ADAPTATION.md)

---

### 4.2 长按输入框没有"粘贴"菜单

**原因 A**：长按时长不够

**解决**：增大 `DELAY.LONG_PRESS`（如 1500ms）

**原因 B**：学习通用了富文本编辑器，长按弹出的是工具栏而非系统菜单

**解决**：改用键盘快捷键粘贴（需要 AutoX 开启输入法权限）：

```javascript
// 替换 pasteIntoInput 中的长按逻辑
inputBox.click();            // 聚焦
sleep(DELAY.AFTER_CLICK);
inputBox.setText(getClip()); // 直接 setText 剪贴板内容
```

---

### 4.3 粘贴后输入框显示"复制"提示框，要再点一次

**原因**：某些学习通版本弹了"是否粘贴"二次确认

**解决**：在 `pasteIntoInput` 末尾加：

```javascript
// 二次确认（如果有"粘贴"按钮弹窗）
sleep(500);
clickSmart(
    ["btn_paste_confirm"],
    ["粘贴", "确定"],
    ["粘贴", "确定"],
    { x: 540, y: 1500 },   // 按本机调整
    "粘贴二次确认"
);
```

---

### 4.4 答案粘贴了但格式乱（换行丢失）

**原因**：剪贴板换行符在 `setText` 时被吃掉

**解决**：在 `copyToClipboard` 后追加 `replace('\n', ' ')`，或者让用户手动调整

---

## 5. 按键 / 流程控制

### 5.1 按音量减触发，但脚本"上次流程未结束"

**原因**：上一次流程还没跑完（豆包回复慢）

**解决**：
- 等待当前 Toast "本题已完成" 出现
- 或等豆包回复完再按
- 或调大 `TIMEOUT.AI_RESPONSE`

---

### 5.2 按了音量减但没触发任何动作

**排查步骤**：

1. **AutoX 控制台看日志**：是否有 `key event action=0`？
2. **是否授权无障碍服务**：见 §1.1
3. **是否被系统杀后台**：见 §1.4 原因 B
4. **按键被其他应用占用**：改 `NEXT_QUESTION_KEY = "enter"` 试试
5. **手机处于锁屏状态**：先解锁

---

## 6. 性能问题

### 6.1 流程跑得很慢（>5 分钟一题）

**排查**：

| 环节 | 优化 |
|---|---|
| 切 APP 慢 | 减小 `DELAY.AFTER_LAUNCH`（如 1500ms） |
| 豆包回复慢 | 网络问题，无解 |
| 控件轮询慢 | 减小 `DELAY.POLL_INTERVAL`（如 300ms） |
| 长按等待慢 | 减小 `DELAY.LONG_PRESS`（如 800ms） |

**注意**：调小延时会增加误判风险，先观察再微调。

---

### 6.2 跑着跑着手机发热严重

**原因**：AutoX 持续在后台运行

**解决**：
- 完成作业后立刻关闭无障碍服务
- 不要连续答题 30+ 道，间歇休息

---

## 7. 收集诊断信息

如果以上都不能解决，按以下模板收集信息后求助：

```
【机型】   例：小米 13 Pro
【Android 版本】 例：Android 13
【AutoX.js 版本】 例：v6.6.0
【学习通版本】   例：v9.4.4
【豆包版本】     例：v2.0.0

【复现步骤】
1. 打开学习通 → X 页
2. 打开豆包 → X 页
3. 运行脚本
4. 按音量减
5. Toast: X

【AutoX 控制台日志】（贴最近 20 行）

【布局分析截图】（失效的控件位置）
```

---

## 8. 最后

90% 的问题都是这三类：

1. **权限没开全** → 回 [`INSTALL.md §3`](../INSTALL.md)
2. **APP 版本变了** → 用 [`ADAPTATION.md`](ADAPTATION.md) 更新 ID
3. **屏幕比例不同** → 修改坐标

如果都不是，可以提 GitHub Issue 附上 §7 信息。