// floater_test.js —— 极简悬浮窗自测脚本
// 用法：把此文件推到手机任意目录(推荐 /sdcard/AutoX/ 或 /sdcard/Download/),
//      在 AutoX.js 中打开运行,看控制台输出。
//
// 跑通 = 基础悬浮窗 OK,问题在主脚本代码或 XML 布局。
// 跑不通 = 设置问题(99% 是"显示在其他应用上层"权限没开)。

// ==================== 自检开始 ====================

console.log("=== Floaty 自检 ===");
console.log("[INFO] 脚本位置: " + (typeof $cwd !== "undefined" ? $cwd : (function(){try{return files.cwd();}catch(e){return "(未知)";}})()));

// 1) AutoX 版本
try {
    var v = auto.version || (context.getPackageManager().getPackageInfo(context.packageName, 0).versionName);
    console.log("[INFO] AutoX 版本: " + v);
} catch (e) {
    console.log("[WARN] 无法读取 AutoX 版本: " + e);
}

// 2) Android 版本(影响作用域存储)
try {
    console.log("[INFO] Android SDK: " + android.os.Build.VERSION.SDK_INT +
        " (" + android.os.Build.VERSION.RELEASE + ")");
} catch (e) {}

// 3) 无障碍服务
if (!auto.service) {
    console.error("[FAIL] 未开启无障碍服务。请到 AutoX → 菜单 → 无障碍服务 开启");
    toast("请先开启 AutoX 无障碍服务");
    exit();
}
console.log("[OK] 无障碍服务已开启");

// 4) 关键权限:Settings.canDrawOverlays
//    v6.6.x 上 floaty.window 必须有"显示在其他应用上层"权限
var hasOverlay = false;
try {
    hasOverlay = android.provider.Settings.canDrawOverlays(context);
} catch (e) {
    console.log("[WARN] 无法检测悬浮窗权限: " + e);
}
console.log("[INFO] 显示在其他应用上层: " + (hasOverlay ? "已授权" : "未授权"));
if (!hasOverlay) {
    console.error("[FAIL] '显示在其他应用上层'权限是悬浮窗的硬性要求");
    console.error("       开启路径:设置 → 应用 → AutoX.js → 显示在其他应用上层 → 允许");
    console.error("       或者:AutoX.js → 菜单 → 悬浮窗 → 授予");
    toast("请授予'显示在其他应用上层'权限");
    // 主动跳到对应设置页
    try {
        var intent = new android.content.Intent(
            android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            android.net.Uri.parse("package:" + context.packageName)
        );
        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    } catch (e) {
        console.error("[FAIL] 跳转设置页失败,请手动去设置");
    }
    exit();
}

// 5) floaty 全局对象是否可用
console.log("[INFO] typeof floaty = " + typeof floaty);
if (typeof floaty === "undefined") {
    console.error("[FAIL] floaty 全局对象不存在,此 AutoX 版本不支持悬浮窗 API");
    console.error("       需要 AutoX.js v6.5+(官方 v6.6.8 已验证支持)");
    exit();
}

// 6) floaty.window() 本身是否可用
console.log("[INFO] typeof floaty.window = " + typeof floaty.window);
if (typeof floaty.window !== "function") {
    console.error("[FAIL] floaty.window 不是函数,版本不兼容");
    exit();
}

// ==================== 核心测试:创建悬浮窗 ====================

console.log("--- 开始创建悬浮窗 ---");

// 测试 A:最简内联 XML(只一个 text)
var winA = null;
try {
    winA = floaty.window(
        <frame id="root" w="200dp" h="100dp" bg="#CC1E1E1E" padding="8dp">
            <text id="msg" w="*" h="*" text="Test A OK" textColor="#FF00FF00" textSize="16sp" gravity="center"/>
        </frame>
    );
    console.log("[OK] 测试 A 通过:内联 XML 窗口已创建");
} catch (e) {
    console.error("[FAIL] 测试 A 失败: " + (e.message || e));
    console.error("       排查清单:");
    console.error("       1) 上面 'hasOverlay' 是否 true?(必须是)");
    console.error("       2) 是否给了 AutoX 通知权限?(部分 ROM 强制要求)");
    console.error("       3) AutoX 是否被系统杀后台?(近期国产 ROM 频繁触发)");
    exit();
}

if (winA) {
    try {
        winA.setPosition(50, 300);
        console.log("[OK] setPosition 成功");
    } catch (e) {
        console.warn("[WARN] setPosition 失败: " + e);
    }
}

// 测试 B:复用主脚本的 floater.xml(多路径搜索)
console.log("--- 测试 B:加载外部 floater.xml ---");
var sdcard, appPriv, cwd;
try { sdcard = files.getSdcardPath(); } catch (e) {}
try { appPriv = context.getExternalFilesDir(null).getAbsolutePath(); } catch (e) {}
try { cwd = files.cwd(); } catch (e) {}

var candidates = [
    "/sdcard/AutoX/floater.xml",
    appPriv ? files.join(appPriv, "floater.xml") : null,
    cwd ? files.join(cwd, "floater.xml") : null,
    sdcard ? files.join(sdcard, "Download", "floater.xml") : null,
    sdcard ? files.join(sdcard, "Documents", "floater.xml") : null
];
console.log("[INFO] 已尝试路径列表(用下方 '命中' 或 '都失败' 判断):");
var xml = null;
var hitPath = null;
for (var i = 0; i < candidates.length; i++) {
    var p = candidates[i];
    if (!p) continue;
    console.log("       " + p);
    try { if (files.exists(p)) { hitPath = p; xml = files.read(p); break; } } catch (e) {}
}

if (xml) {
    console.log("[OK] 命中: " + hitPath + " (" + xml.length + " 字节)");
    // 关掉测试 A 的窗口
    try { if (winA && winA.close) winA.close(); else if (winA && winA.exit) winA.exit(); } catch (e) {}

    var winB = null;
    try {
        winB = floaty.window(xml);
        console.log("[OK] 测试 B 通过:外部 XML 窗口已创建");
        winB.setPosition(50, 300);
    } catch (e) {
        console.error("[FAIL] 测试 B 失败: " + (e.message || e));
        console.error("       XML 内容可能有问题,贴给我看");
    }

    if (winB) {
        console.log("[OK] === 自检全部通过 ===");
        console.log("[OK] 屏幕上应能看到完整 v1.2 悬浮窗(含 5 个按钮)");
        console.log("[OK] 15 秒后自动关闭");

        setTimeout(function () {
            try {
                if (winB && winB.close) winB.close();
                else if (winB && winB.exit) winB.exit();
            } catch (e) {}
            console.log("[INFO] 窗口已关闭,脚本退出");
            exit();
        }, 15000);
    }
} else {
    console.warn("[WARN] floater.xml 在所有候选路径都找不到");
    console.warn("       (这是预期的 — 此测试脚本只验证 API 是否可用)");
    console.log("[OK] === 测试 A 通过(API 可用),测试 B 跳过(无 floater.xml) ===");
    console.log("[OK] 屏幕上应能看到一个绿色 'Test A OK' 文字的简单窗口");
    console.log("[OK] 15 秒后自动关闭");

    setTimeout(function () {
        try {
            if (winA && winA.close) winA.close();
            else if (winA && winA.exit) winA.exit();
        } catch (e) {}
        console.log("[INFO] 窗口已关闭,脚本退出");
        exit();
    }, 15000);
}