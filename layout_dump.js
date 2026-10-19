/**
 * layout_dump.js —— AutoX.js 控件树导出工具（v1.6）
 * ====================================================================
 *
 *  用途：手机上看不到/复制不了完整控件属性时，用它把当前页面的整个
 *        控件树导出成文本，便于排查控件 ID / text / className / bounds。
 *
 *  用法：
 *    1. 把本文件放到与 autox_homework_helper.js 相同的目录
 *    2. 在 AutoX.js 中打开并运行
 *    3. 5 秒内切到目标页面（如学习通答题页）
 *    4. 自动抓取；之后按【音量减】可随时重新抓取，按【音量加】退出
 *
 *  输出：
 *    · 同目录 layout_dump.txt（完整控件树）
 *    · 系统剪贴板（前 50000 字符，可直接粘贴到聊天窗口）
 *    · AutoX 控制台（前 120 行，方便立刻查看）
 *
 *  每行格式：
 *    <缩进><className> text="..." desc="..." id="..."
 *      [clickable] [invisible] [disabled] [scrollable]
 *      bounds=(left,top,right,bottom)
 *
 *  查找控件时可参考：
 *    · text 有值 + clickable  -> 最可靠的组合
 *    · desc / id 为空         -> 学习通新版常见，忽略
 *    · bounds                 -> 只用于判断相对位置，别写死绝对坐标
 */

// ---------- 工具 ----------

function safeGet(fn, def) {
    try { var v = fn(); return (v === undefined || v === null) ? def : v; }
    catch (e) { return def; }
}

function getDumpPath() {
    var dir = "/sdcard/AutoX";
    try { var c = files.cwd(); if (c) dir = c; } catch (e) {}
    return files.join(dir, "layout_dump.txt");
}

function nodeLine(node, depth) {
    var pad = "";
    for (var i = 0; i < depth; i++) pad += "  ";

    var cls = safeGet(function () { return node.className(); }, "");
    var line = pad + (cls || "(unknown)");

    var t = safeGet(function () { return node.text(); }, "");
    var d = safeGet(function () { return node.desc(); }, "");
    var idv = safeGet(function () { return node.id(); }, "");

    if (t) line += ' text="' + String(t).replace(/\n/g, "\\n").substring(0, 80) + '"';
    if (d) line += ' desc="' + String(d).replace(/\n/g, "\\n").substring(0, 80) + '"';
    if (idv) line += ' id="' + idv + '"';

    if (safeGet(function () { return node.clickable(); }, false)) line += " [clickable]";
    if (!safeGet(function () { return node.visibleToUser(); }, true)) line += " [invisible]";
    if (!safeGet(function () { return node.enabled(); }, true)) line += " [disabled]";
    if (safeGet(function () { return node.scrollable(); }, false)) line += " [scrollable]";

    var b = safeGet(function () { return node.bounds(); }, null);
    if (b) line += " bounds=(" + b.left + "," + b.top + "," + b.right + "," + b.bottom + ")";

    return line;
}

function walk(node, depth, out, state) {
    if (!node || depth > 40 || state.count > 3000) return;
    state.count += 1;
    out.push(nodeLine(node, depth));

    var n = safeGet(function () { return node.childCount(); }, 0) || 0;
    for (var i = 0; i < n; i++) {
        var c = safeGet(function () { return node.child(i); }, null);
        if (c) walk(c, depth + 1, out, state);
    }
}

function getRoot() {
    var root = safeGet(function () { return auto.rootInActiveWindow; }, null);
    if (root) return root;
    root = safeGet(function () { return auto.root; }, null);
    if (root) return root;
    var any = safeGet(function () { return classNameMatches(".*").find(); }, null);
    if (any && any.length) return any[0];
    return null;
}

// ---------- 主逻辑 ----------

function dumpNow() {
    var root = getRoot();
    if (!root) {
        toast("找不到活动窗口根节点：请确认无障碍服务已开启");
        console.error("[dump] 无根节点");
        return;
    }

    var out = [];
    out.push("# AutoX layout dump");
    out.push("# screen=" + device.width + "x" + device.height);
    out.push("# package=" + safeGet(function () { return root.packageName(); }, ""));
    out.push("# root=" + safeGet(function () { return root.className(); }, ""));
    out.push("");

    var state = { count: 0 };
    walk(root, 0, out, state);

    var text = out.join("\n");
    var path = getDumpPath();

    try {
        files.write(path, text);
        console.log("[dump] 已写入: " + path);
    } catch (e) {
        console.error("[dump] 写文件失败: " + e);
    }

    try {
        setClip(text.substring(0, 50000));
        console.log("[dump] 已复制到剪贴板（前 50000 字符）");
    } catch (e) {
        console.error("[dump] 写剪贴板失败: " + e);
    }

    toast("已导出 " + state.count + " 个节点");
    console.log("[dump] 共 " + state.count + " 个节点");

    // 控制台输出前 120 行，方便立即查看
    var head = out.slice(0, 120);
    for (var i = 0; i < head.length; i++) console.log(head[i]);
    if (out.length > head.length) {
        console.log("... 其余 " + (out.length - head.length) + " 行见 layout_dump.txt / 剪贴板");
    }
}

// ---------- 入口 ----------

auto.waitFor();  // 等待无障碍服务就绪

if (!auto.service) {
    toast("请先开启 AutoX 无障碍服务");
    exit();
}

toast("5 秒后抓取当前页面；音量减=重新抓取，音量加=退出");
console.log("[dump] 5 秒后自动抓取，请切换到目标页面");

events.observeKey();
events.onKeyDown("volume_down", function (event) {
    if (event.getAction() === 0) {
        toast("重新抓取中...");
        dumpNow();
    }
});
events.onKeyDown("volume_up", function (event) {
    if (event.getAction() === 0) {
        toast("已退出");
        exit();
    }
});

sleep(5000);
dumpNow();

// 保持脚本存活，等待按键
setInterval(function () {}, 1000);
