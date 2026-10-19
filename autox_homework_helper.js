/**
 * ====================================================================
 *  AutoX.js 安卓无障碍自动化脚本 —— 学习通作业助手  v1.1
 * ====================================================================
 *
 *  【核心流程】
 *    1) 启动"学习通"APP → 截图作业题保存到手机本地
 *    2) 启动"豆包"APP   → 上传截图 + 发送内置提示词
 *    3) 等待豆包 AI 回复 → 抓取答案文本 → 写入系统剪贴板
 *    4) 切回"学习通"APP → 长按答案输入框 → 一键粘贴
 *    5) 暂停等待用户按键 → 重复执行下一题
 *
 *  【前置条件】
 *    · 用户需先手动登录学习通，并进入"作业答题页面"
 *    · 用户需先打开豆包，并进入"聊天对话界面"（能看到输入框）
 *    · 本脚本不负责登录、作业列表跳转
 *
 *  【适配版本】
 *    · AutoX.js v6.0+（不依赖 Pro 7 收费 API）
 *    · Android 9.0+（Android 11+ 需授予"所有文件访问权限"或专用目录）
 *
 *  【v1.3 新增】
 *    · 外部配置文件 config.json（multi-path 查找：/sdcard/AutoX/AutoX 私有目录/cwd/Download/Documents）
 *    · 配置缺失/解析失败时 WARN + 回退硬编码 DEFAULT_CONFIG（行为与 v1.2 完全一致）
 *    · DEFAULT_CONFIG/apps/homeworkApp+aiApp 解耦，新增应用只需扩 apps.{id}
 *    · 顶层参数：floaterEnabled/hotkeyEnabled/triggerKey/floaterXmlPath/screenshotPath
 *    · timeouts/delays/coords 完整暴露（每调用点换成 config.*，便于机型调优）
 *    · 旧的 PACKAGE/TIMEOUT/DELAY/SELECTOR/COORD/NEXT_QUESTION_KEY/ENABLE_FLOATER/
 *      ENABLE_HOTKEY/FLOATER_XML_PATH 全部下沉为 DEFAULT_*（仅作回退数据源，不再被运行时引用）
 *
 *  【v1.4 简化】
 *    · 部署要求统一：autox_homework_helper.js、floater.xml、config.json 三个文件必须在同一目录
 *    · floaterXmlPath 字段已弃用,config.json 不再需要指定
 *    · SCRIPT_DIR 在脚本启动时通过 files.cwd() 取得,所有资源文件路径自动派生
 *
 *  【v1.2 新增】(原本被误标 v1.3)
 *    · 悬浮窗控制面板（floaty.window + 外部 floater.xml 布局）
 *    · ENABLE_FLOATER / ENABLE_HOTKEY 全局开关（顶部常量，false 时回退到 v1.1 行为）
 *    · STATE 状态对象（current / lastDuration / lastError / paused）+ updateFloaterUi() 实时同步
 *    · initFloater / destroyFloater 生命周期管理（含 250ms UI 节流）
 *    · 五个控制按钮：下一题 / 暂停 / 停止 / 复制答案 / 打开日志
 *    · 任意位置长按拖拽悬浮窗
 *
 *  【v1.1 新增】
 *    · SCRIPT_VERSION 版本号常量
 *    · preflightCheck() 启动前检查（无障碍服务 + 两 APP 是否安装）
 *    · log() 带时间戳的日志函数（DEBUG 模式下输出详细日志）
 *    · STATS 统计对象（累计运行/成功/失败次数）
 *    · 资源清理钩子（脚本退出前清理临时文件）
 *
 *  ====================================================================
 *    ⚠️  风险提示  ⚠️
 *    本脚本仅用于无障碍 API 与 AutoX.js 编程技术的学习研究。
 *    严禁用于：作业/考试作弊、代刷网课、违规牟利等任何违反
 *    学校规定或法律法规的行为。使用本脚本产生的一切后果
 *    （含账号封禁、学术处分、法律追责）均由使用者本人承担，
 *    与脚本作者无关。
 *  ====================================================================
 */

// ==================== 版本 & 全局开关 ====================

var SCRIPT_VERSION = "1.4.0";           // 当前脚本版本
var DEBUG = false;                      // 调试模式：true 时输出详细日志
var STATS = { runs: 0, success: 0, fail: 0, lastError: "" };  // 运行时统计

// === v1.4 简化：脚本所在目录为唯一部署位置 ===
// 要求 .js / .xml / .json 三个文件必须在同一目录下(由 files.cwd() 取得)
var SCRIPT_DIR = (function () {
    try { var d = files.cwd(); if (d) return d; } catch (e) {}
    log("WARN", "无法获取脚本所在目录,默认 /sdcard/AutoX");
    return "/sdcard/AutoX";
})();
var FLOATER_XML_PATH = files.join(SCRIPT_DIR, "floater.xml");   // 悬浮窗布局（与脚本同目录）
var CONFIG_JSON_PATH = files.join(SCRIPT_DIR, "config.json");   // 用户配置文件（与脚本同目录）
var STATE = {
    current:      "空闲",
    lastDuration: 0,
    paused:       false
    // 注意：错误信息统一从 STATS.lastError 读取，processOneQuestion 各失败分支
    // 直接写 STATS.lastError 即可，updateFloaterUi 会自动同步到悬浮窗。
};
var floater = null;
var views   = {};
var _lastUiUpdateAt = 0;


/* ====================================================================
 *  第一部分：默认配置（DEFAULT_CONFIG）+ 外部配置加载
 *  —— v1.3 新增：脚本顶部所有可调参数已下沉为 DEFAULT_CONFIG。
 *     用户可用 /sdcard/AutoX/config.json 覆盖任意字段；解析失败时回退此处。
 *  —— 扩展新应用：只需在 DEFAULT_CONFIG.apps 下加 <id> 块，并在 apps 列表里
 *     写好 package/prompt/selectors（参考 xuexitong/doubao）。
 * ================================================================== */

// ---- 1.0 默认配置（deep-copy 源，运行时不会修改） ----
var DEFAULT_CONFIG = {
    version: 1,

    // 顶层字符串
    //   floaterXmlPath 字段已弃用,v1.4 起 floater.xml 强制与 .js 同目录(SCRIPT_DIR)
    screenshotPath: "/sdcard/Pictures/AutoX_Screenshot.png",
    triggerKey:     "volume_down",                  // 物理按键触发

    // 顶层开关
    floaterEnabled: true,
    hotkeyEnabled:  true,

    // 选中的 app id（apps 下的键名）
    homeworkApp: "xuexitong",
    aiApp:       "doubao",

    // 应用清单（新增应用只需在这里加 <id> 块 + 调整 homeworkApp/aiApp）
    apps: {
        xuexitong: {
            package:     "com.chaoxing.mobile",
            name:        "xuexitong",
            displayName: "学习通",
            selectors: {
                answerInputId:   ["editText2", "answer_content_et", "et_content", "rich_editor"],
                answerInputDesc: ["作答区", "请输入答案", "题目作答"],
                submitDesc:      ["提交答案", "保存"]
            }
        },
        doubao: {
            package:     "com.larus.nova",
            name:        "doubao",
            displayName: "豆包",
            prompt: [
                "识别图片中的所有试题，区分题型：",
                "①选择题（单选/多选）：只输出选项答案，不要任何解析、不要多余文字。示例：A 或 AB",
                "②简答题：精简答案，去除废话，答案排版干净，方便一键复制；不要多余解释",
                "所有答案输出不要多余开场白，直接输出答案内容。"
            ].join("\n"),
            selectors: {
                inputBoxId:    ["msg_et", "et_message", "input_edit"],
                inputBoxDesc:  ["输入消息", "输入框", "请输入消息"],
                sendBtnDesc:   ["发送"],
                sendBtnId:     ["send_btn", "iv_send", "btn_send"],
                attachBtnId:   ["iv_plus", "iv_more", "btn_more"],
                attachBtnDesc: ["更多功能", "附件"],
                albumDesc:     ["相册", "图片", "从相册选择", "从手机相册选择"],
                albumText:     ["相册", "图片"],
                loadingDesc:   ["生成中", "正在生成", "停止生成"],
                finishedDesc:  ["重新生成", "复制", "已生成"]
            }
        }
    },

    // 超时（ms）
    timeouts: {
        appLaunch:   20000,
        screenshot:   8000,
        controlFind: 10000,
        aiResponse:  90000,
        pasteMenu:    5000
    },

    // 延时（ms）
    delays: {
        afterLaunch:  2500,
        afterClick:    500,
        afterInput:   1000,
        afterPaste:   1500,
        pollInterval:  600,
        finalSettle:  1200,
        longPress:    1000
    },

    // 坐标（按 1080×2400 比例设计，可按比例换算）
    coords: {
        xuexitong: {
            answerInput: { x: 540, y: 1900 },
            pasteMenu:   { x: 540, y: 1400 }
        },
        doubao: {
            attachBtn:    { x:  60, y: 2200 },
            inputBox:     { x: 540, y: 2200 },
            sendBtn:      { x: 990, y: 2200 },
            albumOption:  { x: 180, y: 1900 },
            firstPhoto:   { x: 120, y:  500 },
            photoConfirm: { x: 990, y:  100 }
        }
    }
};


// ---- 1.1 shallowCopy / loadConfig ----
function shallowCopy(o) {
    var out = {};
    if (!o) return out;
    for (var k in o) {
        if (!o.hasOwnProperty(k)) continue;
        var v = o[k];
        if (Array.isArray(v)) out[k] = v.slice();
        else if (v && typeof v === "object") out[k] = shallowCopy(v);
        else out[k] = v;
    }
    return out;
}

// v1.3: 外部配置文件加载（multi-path 容错，缺少/损坏时回退默认值）
function loadConfig() {
    // v1.4 简化：只在 SCRIPT_DIR 找 config.json
    if (!files.exists(CONFIG_JSON_PATH)) {
        return DEFAULT_CONFIG;                                              // 不存在 = 用默认值
    }
    var raw;
    try { raw = files.read(CONFIG_JSON_PATH); }
    catch (e) { log("WARN", "config.json 读取失败: " + (e.message || e)); return DEFAULT_CONFIG; }
    if (raw && raw.charCodeAt && raw.charCodeAt(0) === 0xFEFF) raw = raw.substring(1);

    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) {
        log("WARN", "config.json JSON.parse 失败: " + (e.message || e));
        return DEFAULT_CONFIG;
    }
    if (!parsed || typeof parsed !== "object") {
        log("WARN", "config.json 顶层不是对象"); return DEFAULT_CONFIG;
    }
    if (parsed.version !== 1) {
        log("WARN", "config.json version != 1（当前=" + parsed.version + "）"); return DEFAULT_CONFIG;
    }

    // 深拷贝后逐字段宽容合并
    var cfg = shallowCopy(DEFAULT_CONFIG);
    try {
        // floaterXmlPath 已弃用,v1.4 起 floater.xml 强制与 .js 同目录
        if (typeof parsed.screenshotPath  === "string") cfg.screenshotPath  = parsed.screenshotPath;
        if (typeof parsed.triggerKey      === "string" && parsed.triggerKey) cfg.triggerKey = parsed.triggerKey;
        if (typeof parsed.floaterEnabled  === "boolean") cfg.floaterEnabled = parsed.floaterEnabled;
        if (typeof parsed.hotkeyEnabled   === "boolean") cfg.hotkeyEnabled  = parsed.hotkeyEnabled;
        if (typeof parsed.homeworkApp     === "string")  cfg.homeworkApp    = parsed.homeworkApp;
        if (typeof parsed.aiApp           === "string")  cfg.aiApp          = parsed.aiApp;

        if (parsed.apps && typeof parsed.apps === "object") {
            for (var aid in cfg.apps) {
                if (!cfg.apps.hasOwnProperty(aid)) continue;
                var src = parsed.apps[aid]; var dst = cfg.apps[aid];
                if (!src || typeof src !== "object") continue;
                if (typeof src.package === "string") dst.package = src.package;
                if (typeof src.name === "string") dst.name = src.name;
                if (typeof src.displayName === "string") dst.displayName = src.displayName;
                if (typeof src.prompt === "string") dst.prompt = src.prompt;
                if (src.selectors && typeof src.selectors === "object") {
                    for (var sk in dst.selectors) {
                        if (!dst.selectors.hasOwnProperty(sk)) continue;
                        var sv = src.selectors[sk];
                        if (Array.isArray(sv) || typeof sv === "string") dst.selectors[sk] = sv;
                    }
                }
            }
        }
        if (parsed.timeouts && typeof parsed.timeouts === "object") {
            for (var k in cfg.timeouts) {
                if (!cfg.timeouts.hasOwnProperty(k)) continue;
                var v = parsed.timeouts[k];
                if (typeof v === "number" && v > 0) cfg.timeouts[k] = v;
            }
        }
        if (parsed.delays && typeof parsed.delays === "object") {
            for (var k2 in cfg.delays) {
                if (!cfg.delays.hasOwnProperty(k2)) continue;
                var v2 = parsed.delays[k2];
                if (typeof v2 === "number" && v2 >= 0) cfg.delays[k2] = v2;
            }
        }
        if (parsed.coords && typeof parsed.coords === "object") {
            for (var ck in cfg.coords) {
                if (!cfg.coords.hasOwnProperty(ck)) continue;
                var csrc = parsed.coords[ck], cdst = cfg.coords[ck];
                if (!csrc || typeof csrc !== "object") continue;
                for (var kk in cdst) {
                    if (!cdst.hasOwnProperty(kk)) continue;
                    var cv = csrc[kk];
                    if (cv && typeof cv.x === "number" && typeof cv.y === "number") cdst[kk] = cv;
                }
            }
        }
    } catch (e) {
        log("WARN", "config 字段合并异常: " + (e.message || e));
        return DEFAULT_CONFIG;
    }
    log("INFO", "已加载外部配置: " + CONFIG_JSON_PATH);
    return cfg;
}


// ---- 1.2 v1.3: 模块级配置（外部 config.json 加载后的运行时单例） ----
var config = loadConfig();


/* ====================================================================
 *  第二部分：工具函数
 * ================================================================== */

/**
 * 带时间戳的日志输出（DEBUG 模式下生效，普通模式只输出关键信息）
 * AutoX.js 控制台默认按时间排序，本函数补一个易读的本地时间戳
 */
function log(level, msg) {
    var line = "[" + level + "] " + msg;
    if (level === "ERROR") console.error(line);
    else if (level === "WARN") console.warn(line);
    else console.log(line);
    updateFloaterUi();
}

/**
 * 调试日志：仅在 DEBUG 模式下输出
 */
function logDebug(msg) {
    if (DEBUG) log("DEBUG", msg);
}

/**
 * 弹出一个 Toast 提示
 * @param {string} msg        提示内容
 * @param {string} duration   可选 "long" 表示长提示（3.5s），默认短提示（2s）
 */
function showToast(msg, duration) {
    // 优先用 AutoX 内置 toast()，最稳；某些 v6.6.x 沙箱下 android.* 不可见
    try {
        if (typeof toast === "function") {
            toast(String(msg));
            return;
        }
    } catch (e) {}
    try {
        var d = duration === "long" ? 1 : 0;
        android.widget.Toast.makeText(context, String(msg), d).show();
    } catch (e) {
        // 兜底：写到控制台
        log("TOAST", msg);
    }
}

/**
 * 通过 Android PackageManager 检测指定包名是否已安装
 * 这是 v6.6.x 上最可靠的检测方式——app.getPackageName/pkg 在不同构建里语义不一致
 * @param {string} pkgName  包名
 * @returns {boolean}
 */
function isPackageInstalled(pkgName) {
    if (!pkgName) return false;
    try {
        var pm = context.getPackageManager();
        pm.getPackageInfo(String(pkgName), 0);
        return true;
    } catch (e1) {
        return false;
    }
}

/**
 * 启动前预检：检查无障碍服务 + 两个目标 APP 是否已安装
 * @returns {boolean} 全部通过返回 true
 */
function preflightCheck() {
    log("INFO", "=== 启动预检 (v" + SCRIPT_VERSION + ") ===");

    // 1. 无障碍服务
    if (!auto.service) {
        showToast("请先开启 AutoX 无障碍服务", "long");
        try { app.openAppSetting(context.packageName); } catch (e) {}
        return false;
    }
    log("INFO", "✓ 无障碍服务已开启");

    // 2. 学习通是否安装（v6.6.x 上用 PackageManager 最可靠）
    var hwPkg = config.apps[config.homeworkApp].package;
    if (!isPackageInstalled(hwPkg)) {
        showToast("未检测到作业 APP（" + hwPkg + "）", "long");
        return false;
    }
    log("INFO", "✓ 作业 APP 已安装：" + hwPkg);

    // 3. 豆包是否安装（v6.6.x 上用 PackageManager 最可靠）
    var aiPkg = config.apps[config.aiApp].package;
    if (!isPackageInstalled(aiPkg)) {
        showToast("未检测到 AI APP（" + aiPkg + "）", "long");
        return false;
    }
    log("INFO", "✓ AI APP 已安装：" + aiPkg);

    log("INFO", "=== 预检通过 ===");
    return true;
}

/**
 * 资源清理：脚本退出前调用，删除临时截图等
 */
function cleanup() {
    try {
        if (files.exists(config.screenshotPath)) files.remove(config.screenshotPath);
        log("INFO", "已清理临时截图：" + config.screenshotPath);
    } catch (e) {
        log("WARN", "清理临时文件失败：" + e.message);
    }
    // 打印本次运行的统计
    log("INFO",
        "本次运行统计：runs=" + STATS.runs +
        " success=" + STATS.success +
        " fail=" + STATS.fail +
        " lastError=" + STATS.lastError
    );
    destroyFloater();
}

/* --- v1.2 悬浮窗相关函数（v1.4 简化为同目录单路径） --- */
function loadFloaterLayout() {
    // v1.4 简化：floater.xml 必须与 .js 同目录
    if (!files.exists(FLOATER_XML_PATH)) {
        log("ERROR", "floater 布局文件不存在: " + FLOATER_XML_PATH);
        log("ERROR", "请把 floater.xml 与 autox_homework_helper.js 放在同一目录 " + SCRIPT_DIR);
        return null;
    }
    log("INFO", "floater 布局: " + FLOATER_XML_PATH);
    try {
        var content = files.read(FLOATER_XML_PATH);
        // 1) 去掉 UTF-8 BOM（Windows 编辑器常加）
        if (content && content.charCodeAt && content.charCodeAt(0) === 0xFEFF) {
            content = content.substring(1);
        }
        // 2) 剥除所有 leading non-element 内容（XML 声明 + 注释 + 空白）
        //    Rhino new XML() 只接受单 root element,任何 leading PI / 注释都会让它
        //    报 "XML objects may contain at most one node"
        content = String(content).replace(
            /^\s*(?:<\?xml[^?]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*/,
            ""
        );
        // 3) 转成 Rhino XML 对象 —— floaty.window() 期望 XML 对象,直接传字符串会 NPE
        try {
            return new XML(content);
        } catch (e1) {
            log("WARN", "floater XML 解析失败,降级字符串: " + (e1.message || e1));
            return content;
        }
    } catch (e) {
        log("ERROR", "读取 floater 布局失败 (" + FLOATER_XML_PATH + "): " + (e.message || e));
        return null;
    }
}
function initFloater() {
    if (!config.floaterEnabled) { log("INFO", "config.floaterEnabled=false, 跳过悬浮窗初始化"); return; }
    var xml = loadFloaterLayout();
    if (!xml) return;
    var posX = 80, posY = 200;
    // ⚠️ 关键：必须在脚本主线程创建,不能套 ui.run()
    // AutoX v6.6.x 上 ui.run 回调所在线程没有 RhinoJavaScriptEngine 上下文,
    // floaty.window() 内部要 engine.getRuntime(),会抛 NullPointerException。
    try {
        floater = floaty.window(xml);
        floater.setPosition(posX, posY);
    } catch (e) {
        log("ERROR", "创建悬浮窗失败: " + (e.message || e));
        floater = null;
        return;
    }
    var ids = ["title_text","state_text","stats_text","duration_text",
               "btn_next","btn_pause","btn_stop","btn_clipboard","btn_log","error_text"];
    for (var i = 0; i < ids.length; i++) {
        var v = null;
        try { v = floater.findView(ids[i]); } catch (e) {}
        views[ids[i]] = v;
    }
    var AD=android.view.MotionEvent.ACTION_DOWN, AM=android.view.MotionEvent.ACTION_MOVE,
        AU=android.view.MotionEvent.ACTION_UP, AC=android.view.MotionEvent.ACTION_CANCEL;
    var downX=0, downY=0;
    try {
        floater.setOnTouchListener(function (view, event) {
            var a = event.getAction();
            if (a === AD) { downX = event.getRawX(); downY = event.getRawY(); return true; }
            if (a === AM) {
                posX += event.getRawX() - downX; posY += event.getRawY() - downY;
                try { floater.setPosition(posX, posY); } catch (e) {}
                downX = event.getRawX(); downY = event.getRawY(); return true;
            }
            if (a === AU || a === AC) return true;
            return false;
        });
    } catch (e) { log("WARN", "setOnTouchListener 失败: " + (e.message || e)); }
    if (views.btn_next) views.btn_next.on("click", function () { log("INFO","[floater] 下一题按钮"); onTriggerNextQuestion(); });
    if (views.btn_pause) views.btn_pause.on("click", function () {
        STATE.paused = !STATE.paused;
        showToast(STATE.paused ? "已暂停" : "已恢复");
        updateFloaterUi();
    });
    if (views.btn_stop) views.btn_stop.on("click", function () {
        showToast("脚本即将停止"); try { destroyFloater(); } catch (e) {} exit();
    });
    if (views.btn_clipboard) views.btn_clipboard.on("click", function () {
        try {
            var cm = context.getSystemService(context.CLIPBOARD_SERVICE);
            var clip = cm.getPrimaryClip();
            var txt = "";
            if (clip && clip.getItemCount() > 0) {
                var item = clip.getItemAt(0);
                if (item && item.getText) txt = item.getText().toString();
            }
            setClip(txt); showToast("剪贴板已刷新 " + txt.length + " 字"); STATE.current = "已复制";
        } catch (e) { STATS.lastError = "复制失败: " + (e.message || e); }
        updateFloaterUi();
    });
    if (views.btn_log) views.btn_log.on("click", function () {
        showToast("请打开 AutoX 控制台查看日志");
        try { app.startActivity(context.packageName); } catch (e) {}
    });
    updateFloaterUi();
    log("INFO", "悬浮窗已就绪 v" + SCRIPT_VERSION);
}
function updateFloaterUi() {
    if (!floater) return;
    var now = Date.now();
    if (now - _lastUiUpdateAt < 250) return;
    _lastUiUpdateAt = now;
    var apply = function () {
        try {
            if (views.title_text) views.title_text.setText("学习通助手 v" + SCRIPT_VERSION);
            if (views.state_text) views.state_text.setText("状态:" + STATE.current + (STATE.paused ? "（已暂停）" : ""));
            if (views.stats_text) views.stats_text.setText("已答 " + STATS.runs + "  成功 " + STATS.success + "  失败 " + STATS.fail);
            if (views.duration_text) {
                var sec = Math.round(STATE.lastDuration / 1000);
                views.duration_text.setText("耗时:" + (sec > 0 ? sec + "s" : "--"));
            }
            if (views.error_text) {
                if (STATS.lastError) {
                    views.error_text.setText("⚠ " + STATS.lastError);
                    views.error_text.setVisibility(android.view.View.VISIBLE);
                } else {
                    views.error_text.setText("");
                    views.error_text.setVisibility(android.view.View.GONE);
                }
            }
        } catch (e) {}
    };
    try { ui.run(apply); } catch (e) { apply(); }
}
function destroyFloater() {
    if (!floater) return;
    try {
        if (typeof floater.close === "function") floater.close();
        else if (typeof floater.exit === "function") floater.exit();
        else floater.setVisibility(android.view.View.GONE);
    } catch (e) { log("WARN", "关闭悬浮窗失败: " + (e.message || e)); }
    floater = null;
    views   = {};
}

// 注册退出钩子（Android 杀进程时不一定触发，仅作善后）
events.on("exit", cleanup);

/**
 * 按 id → desc → text 优先级尝试查找控件
 * @returns {UiObject|null}  找到则返回控件；否则返回 null
 */
function findByPriority(ids, descs, texts) {
    var i, w;
    if (ids) {
        for (i = 0; i < ids.length; i++) {
            try { w = id(ids[i]).findOnce(); if (w) return w; } catch (e) {}
        }
    }
    if (descs) {
        for (i = 0; i < descs.length; i++) {
            try { w = desc(descs[i]).findOnce(); if (w) return w; } catch (e) {}
        }
    }
    if (texts) {
        for (i = 0; i < texts.length; i++) {
            try { w = text(texts[i]).findOnce(); if (w) return w; } catch (e) {}
        }
    }
    return null;
}

/**
 * 等待控件出现，最多 timeout 毫秒；超时返回 null 并弹 Toast
 */
function waitForControl(ids, descs, texts, name_desc) {
    var t0 = Date.now();
    while (Date.now() - t0 < config.timeouts.controlFind) {
        var w = findByPriority(ids, descs, texts);
        if (w) return w;
        sleep(config.delays.pollInterval);
    }
    showToast("查找控件超时：" + (name_desc || "未知目标"), "long");
    return null;
}

/**
 * 智能点击：优先用控件，失败则点击坐标；返回是否成功
 */
function clickSmart(ids, descs, texts, coord, desc) {
    var w = findByPriority(ids, descs, texts);
    if (w) {
        try {
            // 优先调用控件自身的 click()
            if (w.click && w.clickable && w.clickable()) {
                w.click();
                return true;
            }
            // 否则按控件中心点击
            var b = w.bounds();
            if (b) {
                click(b.centerX(), b.centerY());
                return true;
            }
        } catch (e) {
            console.warn("控件点击失败，降级到坐标：" + (desc || ""), e.message);
        }
    }
    // 降级：使用坐标
    if (coord) {
        click(coord.x, coord.y);
        return true;
    }
    showToast("无法点击：" + (desc || "未知目标"), "long");
    return false;
}

/**
 * 启动 / 切回指定 APP，并等待其进入前台
 * @returns {boolean} 是否成功进入前台
 */
function launchAndWait(pkg, label) {
    showToast("正在切换到 " + label + "…");
    try {
        app.launchPackage(pkg);
    } catch (e) {
        showToast("启动 " + label + " 失败：" + e.message, "long");
        return false;
    }
    // 轮询直到前台包名匹配
    var t0 = Date.now();
    while (Date.now() - t0 < config.timeouts.appLaunch) {
        if (currentPackage() === pkg) break;
        sleep(config.delays.pollInterval);
    }
    if (currentPackage() !== pkg) {
        showToast(
            "切换 " + label + " 超时，当前前台：" + currentPackage(),
            "long"
        );
        return false;
    }
    sleep(config.delays.afterLaunch); // 给页面渲染留时间
    return true;
}

/**
 * 截图并保存到本地（先删除旧文件，避免豆包收到历史缓存）
 * @returns {string|null}  截图路径；失败返回 null
 */
function takeScreenshot(path) {
    try { if (files.exists(path)) files.remove(path); } catch (e) {}
    var t0 = Date.now();
    while (Date.now() - t0 < config.timeouts.screenshot) {
        try {
            // 方案 A：captureScreen 直接保存为文件
            if (captureScreen(path)) {
                sleep(500); // 等待文件写入磁盘
                if (files.exists(path) && files.size(path) > 1024) return path;
            }
        } catch (e1) {
            // 方案 B：拿到 Image 对象再保存
            try {
                var img = captureScreen();
                if (img) {
                    images.save(img, path);
                    if (files.exists(path) && files.size(path) > 1024) return path;
                }
            } catch (e2) {
                console.warn("截图异常：", e1.message, "|", e2.message);
            }
        }
        sleep(config.delays.pollInterval);
    }
    showToast("截图失败，请检查存储权限", "long");
    return null;
}

/**
 * 把文本写入系统剪贴板
 */
function copyToClipboard(text) {
    try {
        setClip(text);
        return true;
    } catch (e) {
        // 兼容降级：通过系统 ClipboardManager
        try {
            var cm = context.getSystemService(context.CLIPBOARD_SERVICE);
            cm.setPrimaryClip(android.content.ClipData.newPlainText("autojs", text));
            return true;
        } catch (e2) {
            showToast("写入剪贴板失败：" + e.message, "long");
            return false;
        }
    }
}

/**
 * 长按输入框，等待"粘贴"菜单出现并点击
 */
function pasteIntoInput(inputBox, coordFallback) {
    var x, y;
    if (inputBox) {
        var b = inputBox.bounds();
        if (b) { x = b.centerX(); y = b.centerY(); }
    }
    if (!x && coordFallback) { x = coordFallback.x; y = coordFallback.y; }
    if (!x) {
        showToast("找不到答题输入框", "long");
        return false;
    }

    // 优先调用控件的 longClick
    var longClicked = false;
    if (inputBox && inputBox.longClick) {
        try { inputBox.longClick(); longClicked = true; } catch (e) {}
    }
    if (!longClicked) {
        // 退化：使用 press 模拟长按
        press(x, y, config.delays.longPress);
    }
    sleep(config.delays.afterClick * 2);

    // 点击"粘贴"菜单（先按控件查找，找不到再坐标点击）
    clickSmart(
        ["paste_text", "tv_paste", "menu_paste"],
        ["粘贴", "Paste"],
        ["粘贴"],
        config.coords.xuexitong.pasteMenu,
        "粘贴菜单"
    );
    sleep(config.delays.afterPaste);
    return true;
}


/* ====================================================================
 *  第三部分：业务模块
 * ================================================================== */

/**
 * 模块 A：豆包 - 上传图片 + 发送提示词
 * @returns {boolean} 是否成功提交
 */
function doubaoUploadAndAsk() {
    var aiSel = config.apps[config.aiApp].selectors;
    var aiCo  = config.coords[config.aiApp];
    // A0. 如果不在聊天界面，先尝试进入（点"新建对话"）
    if (!findByPriority(aiSel.inputBoxId, aiSel.inputBoxDesc, null)) {
        console.log("AI APP 当前不在聊天界面，尝试新建对话…");
        var newChat = findByPriority(null,
            ["新建对话", "开始聊天", "发起对话", "发消息", "新建聊天"], null);
        if (newChat) {
            newChat.click();
            sleep(config.delays.afterLaunch);
        } else {
            showToast("请手动进入 " + config.apps[config.aiApp].displayName + " 聊天界面", "long");
            return false;
        }
    }

    // A1. 点击附件"+"按钮
    if (!clickSmart(
            aiSel.attachBtnId,
            aiSel.attachBtnDesc,
            null,
            aiCo.attachBtn,
            (config.apps[config.aiApp].displayName || "AI") + "附件按钮"
    )) return false;
    sleep(config.delays.afterClick * 2);

    // A2. 在弹出的菜单中点击"相册/图片"
    if (!clickSmart(
            null,
            aiSel.albumDesc,
            aiSel.albumText,
            aiCo.albumOption,
            (config.apps[config.aiApp].displayName || "AI") + "相册菜单"
    )) {
        showToast("找不到'相册'菜单，请检查 APP 版本或修改坐标", "long");
        return false;
    }
    sleep(config.delays.afterClick * 3); // 等待系统相册加载

    // A3. 选择截图（点相册中第一张图）
    var firstPhoto = id("iv_photo").findOnce() ||
        className("android.widget.ImageView").findOnce();
    if (firstPhoto) {
        var pb = firstPhoto.bounds();
        if (pb) click(pb.centerX(), pb.centerY());
        else click(aiCo.firstPhoto.x, aiCo.firstPhoto.y);
    } else {
        click(aiCo.firstPhoto.x, aiCo.firstPhoto.y);
    }
    sleep(config.delays.afterClick * 2);

    // A4. 确认选择（点击"完成"或"发送"）
    var confirmClicked = clickSmart(
        null,
        ["完成", "确定", "发送"],
        ["完成", "确定"],
        aiCo.photoConfirm,
        "相册确认按钮"
    );
    if (!confirmClicked) {
        // 某些版本选择后自动回到聊天界面，无需手动确认
        console.warn("未找到'完成'按钮，假设已自动确认");
    }
    sleep(config.delays.afterClick * 3);

    // A5. 等待回到聊天界面，输入框重新可见
    var inputBox = waitForControl(
        aiSel.inputBoxId,
        aiSel.inputBoxDesc,
        null,
        (config.apps[config.aiApp].displayName || "AI") + "输入框"
    );
    if (!inputBox) return false;

    // A6. 在输入框中设置文本（先点击使其获得焦点）
    try {
        inputBox.click();
        sleep(config.delays.afterClick);
        inputBox.setText(config.apps[config.aiApp].prompt);
    } catch (e) {
        showToast("输入文本失败：" + e.message, "long");
        return false;
    }
    sleep(config.delays.afterInput);

    // A7. 发送
    if (!clickSmart(
            aiSel.sendBtnId,
            aiSel.sendBtnDesc,
            null,
            aiCo.sendBtn,
            (config.apps[config.aiApp].displayName || "AI") + "发送按钮"
    )) return false;
    return true;
}

/**
 * 模块 B：豆包 - 等待回复并抓取答案文本
 * @returns {string|null} 答案文本；失败返回 null
 */
function doubaoWaitResponse() {
    var t0 = Date.now();
    var sawLoading = false;
    var sawFinish = false;
    var aiSel = config.apps[config.aiApp].selectors;
    var aiName = config.apps[config.aiApp].displayName || "AI";

    // B1. 先等待"生成中"出现（表示 AI 正在处理）
    while (Date.now() - t0 < config.timeouts.aiResponse / 2) {
        var loading = findByPriority(null, aiSel.loadingDesc, null);
        if (loading) { sawLoading = true; break; }
        // 如果 AI 回复极快，可能直接看到完成特征
        var finish = findByPriority(null, aiSel.finishedDesc, null);
        if (finish) { sawFinish = true; break; }
        sleep(config.delays.pollInterval);
    }

    // B2. 等待"生成中"消失（表示生成完成）
    if (sawLoading) {
        while (Date.now() - t0 < config.timeouts.aiResponse) {
            var stillLoading = findByPriority(null, aiSel.loadingDesc, null);
            if (!stillLoading) { sawFinish = true; break; }
            sleep(config.delays.pollInterval);
        }
        if (!sawFinish) {
            showToast(
                aiName + "回复超时（" + Math.round(config.timeouts.aiResponse / 1000) + "s）",
                "long"
            );
            return null;
        }
    }

    // 额外等待文本完全稳定
    sleep(config.delays.finalSettle);

    // B3. 抓取最新一条 AI 消息文本（按优先级尝试多种策略）
    var answer = "";

    // 策略 1：按 desc 匹配 AI 消息气泡（最常见）
    var aiMsgs = descMatches(/AI|豆包|回复|助手/).find();
    if (aiMsgs.length > 0) {
        answer = aiMsgs[aiMsgs.length - 1].text() || "";
    }

    // 策略 2：按 id "tv_msg" 抓取
    if (!answer) {
        var tvMsgs = id("tv_msg").find();
        if (tvMsgs.length > 0) {
            answer = tvMsgs[tvMsgs.length - 1].text() || "";
        }
    }

    // 策略 3：所有 TextView 中内容最长的（兜底，可能误中）
    if (!answer) {
        var allTvs = className("android.widget.TextView").find();
        var maxLen = 0;
        for (var i = 0; i < allTvs.length; i++) {
            var t = allTvs[i].text();
            if (t && t.length > maxLen && t.length < 5000 && t.length > 5) {
                maxLen = t.length;
                answer = t;
            }
        }
    }

    if (!answer) {
        showToast("抓取豆包回复为空，请手动复制", "long");
        return null;
    }
    return answer;
}

/**
 * 模块 C：单题答题全流程
 * @returns {boolean} 流程是否完整跑完
 */
function processOneQuestion() {
    STATS.runs += 1;
    log("INFO", "===== 开始第 " + STATS.runs + " 题 =====");

    var hwLabel = config.apps[config.homeworkApp].displayName || "作业APP";
    var aiLabel = config.apps[config.aiApp].displayName || "AI";
    var hwPkg = config.apps[config.homeworkApp].package;
    var aiPkg = config.apps[config.aiApp].package;

    // 1) 切到作业 APP
    if (!launchAndWait(hwPkg, hwLabel)) {
        STATS.fail += 1; STATS.lastError = "切" + hwLabel + "失败";
        return false;
    }

    // 2) 截图
    showToast("正在截图…");
    var imgPath = takeScreenshot(config.screenshotPath);
    if (!imgPath) {
        STATS.fail += 1; STATS.lastError = "截图失败";
        return false;
    }
    log("INFO", "截图已保存：" + imgPath);

    // 3) 切到 AI APP
    if (!launchAndWait(aiPkg, aiLabel)) {
        STATS.fail += 1; STATS.lastError = "切" + aiLabel + "失败";
        return false;
    }

    // 4) 上传图片 + 发送提问
    showToast("正在上传图片并提问…");
    if (!doubaoUploadAndAsk()) {
        STATS.fail += 1; STATS.lastError = "豆包上传失败";
        return false;
    }

    // 5) 等待豆包回复并抓取文本
    showToast("等待豆包 AI 回复…");
    var answer = doubaoWaitResponse();
    if (!answer) {
        STATS.fail += 1; STATS.lastError = "豆包回复超时/抓取失败";
        return false;
    }
    log("INFO", "豆包答案（前 80 字）：" + answer.substring(0, 80));

    // 6) 写入剪贴板
    if (!copyToClipboard(answer)) {
        STATS.fail += 1; STATS.lastError = "剪贴板写入失败";
        return false;
    }
    showToast("答案已写入剪贴板");

    // 7) 切回作业 APP
    if (!launchAndWait(hwPkg, hwLabel)) {
        STATS.fail += 1; STATS.lastError = "返回" + hwLabel + "失败";
        return false;
    }

    // 8) 长按输入框 → 粘贴
    showToast("正在粘贴答案…");
    var hwSel = config.apps[config.homeworkApp].selectors;
    var hwCo  = config.coords[config.homeworkApp];
    var inputBox = waitForControl(
        hwSel.answerInputId,
        hwSel.answerInputDesc,
        null,
        hwLabel + "答案输入框"
    );
    if (!inputBox) {
        STATS.fail += 1; STATS.lastError = "找不到答题输入框";
        showToast("找不到答题输入框，请手动粘贴", "long");
        return false;
    }
    if (!pasteIntoInput(inputBox, hwCo.answerInput)) {
        STATS.fail += 1; STATS.lastError = "粘贴失败";
        return false;
    }

    STATS.success += 1;
    log("INFO", "===== 第 " + STATS.runs + "题完成 =====");
    return true;
}


/* ====================================================================
 *  第四部分：入口与按键监听
 * ================================================================== */

// 模块级状态：是否正在执行流程，防止按键被重复触发
var _busy = false;

/**
 * 按键事件处理：异步执行单题流程（不阻塞事件循环）
 */
function onTriggerNextQuestion() {
    if (_busy) {
        log("WARN", "上一次答题流程仍在执行中，忽略本次按键");
        return;
    }
    _busy = true;
    threads.start(function () {
        try {
            var ok = processOneQuestion();
            if (ok) {
                showToast(
                    "本题已完成 ✓\n答案已粘贴到输入框。\n" +
                    "请检查无误后，按 " + config.triggerKey + " 进入下一题",
                    "long"
                );
            } else {
                showToast(
                    "本题流程未完成\n失败原因：" + STATS.lastError + "\n请查看日志重试",
                    "long"
                );
            }
        } catch (e) {
            STATS.lastError = (e.message || String(e));
            showToast("流程异常：" + STATS.lastError, "long");
            log("ERROR", "流程异常：" + STATS.lastError);
        } finally {
            _busy = false;
        }
    });
}

/**
 * 入口
 */
function main() {
    // 0) v1.3: 加载外部配置（DEFAULT_CONFIG 已被覆盖，模块顶部已有 var config = loadConfig()）
    log("INFO", "脚本就绪配置：app=" + config.apps[config.homeworkApp].displayName +
                " -> AI=" + config.apps[config.aiApp].displayName +
                " triggerKey=" + config.triggerKey);
    // 1) 启动预检（无障碍服务 + 两 APP 是否安装）
    if (!preflightCheck()) {
        log("ERROR", "预检未通过，脚本退出");
        exit();
    }

    // 2) 打印使用说明与风险提示到 AutoX 控制台
    printUsage();
    printRiskWarning();

    // 2.5) v1.2: 初始化悬浮窗
    try { initFloater(); }
    catch (e) { log("WARN", "initFloater 失败: " + (e.message || e)); }

    // 3) 注册按键监听（v1.3: config.hotkeyEnabled=false 时跳过物理按键，仅靠悬浮窗按钮触发）
    if (config.hotkeyEnabled) {
        events.observeKey();
        events.onKeyDown(config.triggerKey, function (event) {
            // 仅响应"按下"瞬间；忽略抬起与长按重复
            if (event.getAction() === 0) {
                onTriggerNextQuestion();
            }
        });
    } else {
        log("INFO", "config.hotkeyEnabled=false, 跳过物理按键监听（仅靠悬浮窗按钮触发）");
    }

    // 4) 提示就绪
    var readyMsg =
        "脚本就绪 v" + SCRIPT_VERSION + "\n" +
        "DEBUG=" + DEBUG + "\n" +
        "请按 " + config.triggerKey + " 开始第一题";
    showToast(readyMsg, "long");

    // 5) 主线程保持运行（setInterval 是无副作用保活）
    setInterval(function () {}, 1000);
}


/* ====================================================================
 *  第五部分：使用说明 & 风险提示（控制台输出）
 *  —— 启动时会自动打印到 AutoX 控制台，方便用户查看
 * ================================================================== */

/**
 * 打印脚本使用说明
 */
function printUsage() {
    var lines = [
        "",
        "=========================================================",
        "                    使 用 说 明",
        "=========================================================",
        "【1】需要开启的权限（AutoX.js APP 内的菜单 → 权限）",
        "  ① 无障碍权限（AutoX） - 必需，本脚本依赖无障碍控件查找",
        "  ② 悬浮窗权限         - 必需，用于显示 Toast/布局分析",
        "  ③ 存储权限           - 必需，用于保存截图到 /sdcard/",
        "    （Android 11+ 还需授予\"所有文件访问权限\"）",
        "",
        "【2】手机系统设置建议（防止无障碍服务被系统杀掉）",
        "  ① 关闭电池优化：设置 → 应用 → AutoX → 电池 → 不优化",
        "  ② 允许自启动：设置 → 应用 → AutoX → 自启动 → 开",
        "  ③ 后台任务上锁：最近任务 → 下拉 AutoX 卡片 → 点锁定图标",
        "  ④ 锁定通知渠道：通知管理 → AutoX → 允许通知",
        "",
        "【3】脚本局限性",
        "  ① APP 版本更新会导致控件 ID 变化 → 脚本失效",
        "     解决：抓取新 ID 后修改 config.json 对应应用的 selectors 字段",
        "  ② 弹窗、广告、版本升级提示会干扰控件查找",
        "     解决：使用前手动关闭所有弹窗广告",
        "  ③ 学习通等平台已上线'无障碍自动化'检测模型",
        "     风险：可能触发风控、账号封禁、学术不端认定",
        "  ④ 不同机型屏幕比例不同，坐标需自行实测修改",
        "     解决：开启 AutoX 布局分析悬浮窗定位坐标",
        "  ⑤ 单次流程仅处理一题，多题需按 " + config.triggerKey + " 重复触发",
        "=========================================================",
        ""
    ];
    for (var i = 0; i < lines.length; i++) console.log(lines[i]);
}

/**
 * 打印风险提示（独立段落，单独醒目强调）
 */
function printRiskWarning() {
    var lines = [
        "",
        "#########################################################",
        "#                                                       #",
        "#              ⚠️  风 险 提 示  ⚠️                       #",
        "#                                                       #",
        "#  本脚本仅用于无障碍 API 与 AutoX.js 编程技术的        #",
        "#  学习研究。严禁将本脚本用于：                         #",
        "#                                                       #",
        "#      × 作业 / 考试作弊                                #",
        "#      × 代刷网课 / 刷学时                              #",
        "#      × 违规牟利（售卖、转租账号等）                   #",
        "#      × 其他违反学校规定或法律法规的行为               #",
        "#                                                       #",
        "#  使用本脚本产生的一切后果                            #",
        "#  （含账号封禁、学术处分、法律追责）                  #",
        "#  均由使用者本人承担，与脚本作者无关。                #",
        "#                                                       #",
        "#########################################################",
        ""
    ];
    for (var i = 0; i < lines.length; i++) console.log(lines[i]);
}


// =================== 启动入口 ===================
main();