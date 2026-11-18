(function () {
    "use strict";

    function getInvoke() {
        if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
            return window.__TAURI__.core.invoke;
        }
        if (window.parent && window.parent.__TAURI__ && window.parent.__TAURI__.core && window.parent.__TAURI__.core.invoke) {
            return window.parent.__TAURI__.core.invoke;
        }
        return null;
    }

    function callInvoke(cmd, args) {
        const inv = getInvoke();
        if (!inv) return Promise.reject(new Error("Tauri invoke unavailable"));
        return new Promise((resolve, reject) => {
            inv(cmd, args).then(
                (val) => window.setTimeout(() => resolve(val), 0),
                (err) => window.setTimeout(() => reject(err), 0)
            );
        });
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const res = String(reader.result || "");
                const idx = res.indexOf(",");
                resolve(idx >= 0 ? res.slice(idx + 1) : res);
            };
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
        });
    }

    async function serializeBody(body) {
        if (!body) return { bodyType: "none", body: null };
        if (typeof body === "string") {
            return { bodyType: "string", body: body };
        }
        if (body instanceof URLSearchParams) {
            const obj = {};
            for (const [k, v] of body.entries()) {
                obj[k] = v;
            }
            return { bodyType: "urlencoded", body: obj };
        }
        if (typeof FormData !== "undefined" && body instanceof FormData) {
            const fields = {};
            const files = [];
            for (const [key, val] of body.entries()) {
                if (typeof File !== "undefined" && val instanceof File) {
                    const b64 = await fileToBase64(val);
                    files.push({
                        field: key,
                        name: val.name,
                        type: val.type || "application/octet-stream",
                        size: val.size || 0,
                        data: b64,
                    });
                } else {
                    if (fields[key] !== undefined) {
                        if (!Array.isArray(fields[key])) fields[key] = [fields[key]];
                        fields[key].push(String(val));
                    } else {
                        fields[key] = String(val);
                    }
                }
            }
            return { bodyType: "formdata", body: { fields, files } };
        }
        return { bodyType: "json", body: body };
    }

    // =========================================================================
    // Order-preserving PHP Schema Parser & Exporter (Hot-load bypass for Rust BTreeMap)
    // =========================================================================
    function parsePhpConfigArray(rawPhp) {
        const src = String(rawPhp || "").replace(/^\uFEFF/, "");
        let pos = 0;
        const len = src.length;

        function skipWsAndComments() {
            while (pos < len) {
                const ch = src[pos];
                if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
                    pos++;
                    continue;
                }
                if (ch === "/" && src[pos + 1] === "/") {
                    pos += 2;
                    while (pos < len && src[pos] !== "\n") pos++;
                    continue;
                }
                if (ch === "#") {
                    pos++;
                    while (pos < len && src[pos] !== "\n") pos++;
                    continue;
                }
                if (ch === "/" && src[pos + 1] === "*") {
                    pos += 2;
                    while (pos < len && !(src[pos] === "*" && src[pos + 1] === "/")) pos++;
                    if (pos < len) pos += 2;
                    continue;
                }
                break;
            }
        }

        function readSingleQuoted() {
            pos++; // skip '
            let out = "";
            while (pos < len) {
                const ch = src[pos];
                if (ch === "\\") {
                    const next = src[pos + 1];
                    if (next === "'" || next === "\\") {
                        out += next;
                        pos += 2;
                        continue;
                    }
                    out += ch;
                    pos++;
                    continue;
                }
                if (ch === "'") {
                    pos++;
                    return out;
                }
                out += ch;
                pos++;
            }
            return out;
        }

        function readDoubleQuoted() {
            pos++; // skip "
            let out = "";
            while (pos < len) {
                const ch = src[pos];
                if (ch === "\\") {
                    const next = src[pos + 1];
                    if (next === "n") { out += "\n"; pos += 2; continue; }
                    if (next === "r") { out += "\r"; pos += 2; continue; }
                    if (next === "t") { out += "\t"; pos += 2; continue; }
                    if (next === '"' || next === "\\" || next === "$") { out += next; pos += 2; continue; }
                    out += ch;
                    pos++;
                    continue;
                }
                if (ch === '"') {
                    pos++;
                    return out;
                }
                out += ch;
                pos++;
            }
            return out;
        }

        function skipBalancedParens() {
            if (src[pos] !== "(") return;
            let depth = 0;
            while (pos < len) {
                const ch = src[pos];
                if (ch === "'") { readSingleQuoted(); continue; }
                if (ch === '"') { readDoubleQuoted(); continue; }
                if (ch === "/" && src[pos + 1] === "/") { while (pos < len && src[pos] !== "\n") pos++; continue; }
                if (ch === "/" && src[pos + 1] === "*") {
                    pos += 2;
                    while (pos < len && !(src[pos] === "*" && src[pos + 1] === "/")) pos++;
                    if (pos < len) pos += 2;
                    continue;
                }
                if (ch === "(") depth++;
                else if (ch === ")") {
                    depth--;
                    pos++;
                    if (depth <= 0) return;
                    continue;
                }
                pos++;
            }
        }

        function skipTernaryFalseBranch() {
            let bDepth = 0;
            let pDepth = 0;
            while (pos < len) {
                skipWsAndComments();
                if (pos >= len) break;
                const ch = src[pos];
                if (ch === "'") { readSingleQuoted(); continue; }
                if (ch === '"') { readDoubleQuoted(); continue; }
                if (ch === "[") { bDepth++; pos++; continue; }
                if (ch === "]") {
                    if (bDepth === 0) break;
                    bDepth--;
                    pos++;
                    continue;
                }
                if (ch === "(") { pDepth++; pos++; continue; }
                if (ch === ")") {
                    if (pDepth === 0) break;
                    pDepth--;
                    pos++;
                    continue;
                }
                if ((ch === "," || ch === ";") && bDepth === 0 && pDepth === 0) break;
                pos++;
            }
        }

        function parseValue() {
            skipWsAndComments();
            if (pos >= len) return null;
            const ch = src[pos];
            if (ch === "[") return parseArray("]");
            if (src.slice(pos, pos + 5).toLowerCase() === "array" && !/[a-z0-9_]/i.test(src[pos + 5] || "")) {
                const saved = pos;
                pos += 5;
                skipWsAndComments();
                if (src[pos] === "(") return parseArray(")");
                pos = saved;
            }
            if (ch === "'") return readSingleQuoted();
            if (ch === '"') return readDoubleQuoted();
            if (ch === "(") {
                skipBalancedParens();
                skipWsAndComments();
                if (src[pos] === "?") {
                    pos++;
                    const truthyVal = parseValue();
                    skipWsAndComments();
                    if (src[pos] === ":") {
                        pos++;
                        skipTernaryFalseBranch();
                    }
                    return truthyVal;
                }
                return null;
            }

            // Number or identifier (true, false, null, constant)
            const m = src.slice(pos).match(/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/);
            if (m && (!src[pos + m[0].length] || !/[a-z_]/i.test(src[pos + m[0].length]))) {
                pos += m[0].length;
                return Number(m[0]);
            }
            const idm = src.slice(pos).match(/^[a-zA-Z_\\][a-zA-Z0-9_\\]*/);
            if (idm) {
                pos += idm[0].length;
                const low = idm[0].toLowerCase();
                if (low === "true") return true;
                if (low === "false") return false;
                if (low === "null") return null;
                return idm[0];
            }
            return null;
        }

        function parseArray(closeChar) {
            pos++; // skip [ or (
            const assoc = {};
            const list = [];
            let hasKeys = false;
            let count = 0;

            while (pos < len) {
                skipWsAndComments();
                if (pos >= len) break;
                if (src[pos] === closeChar) {
                    pos++;
                    break;
                }

                const item = parseValue();
                skipWsAndComments();
                if (src[pos] === "=" && src[pos + 1] === ">") {
                    pos += 2;
                    hasKeys = true;
                    const val = parseValue();
                    const key = item === null || item === undefined ? String(count) : String(item);
                    assoc[key] = val;
                    count++;
                } else {
                    assoc[String(count)] = item;
                    list.push(item);
                    count++;
                }

                skipWsAndComments();
                if (src[pos] === ",") {
                    pos++;
                } else if (src[pos] !== closeChar) {
                    // Recover cleanly to next comma or closing delimiter if unexpected token
                    while (pos < len && src[pos] !== "," && src[pos] !== closeChar) pos++;
                    if (src[pos] === ",") pos++;
                }
            }

            if (count === 0 || hasKeys) return assoc;
            return list;
        }

        // Locate top-level `return` statement outside strings/comments
        while (pos < len) {
            const ch = src[pos];
            if (ch === "'") { readSingleQuoted(); continue; }
            if (ch === '"') { readDoubleQuoted(); continue; }
            if (ch === "/" && src[pos + 1] === "/") { while (pos < len && src[pos] !== "\n") pos++; continue; }
            if (ch === "#") { while (pos < len && src[pos] !== "\n") pos++; continue; }
            if (ch === "/" && src[pos + 1] === "*") {
                pos += 2;
                while (pos < len && !(src[pos] === "*" && src[pos + 1] === "/")) pos++;
                if (pos < len) pos += 2;
                continue;
            }
            if (
                src.slice(pos, pos + 6).toLowerCase() === "return" &&
                (pos === 0 || !/[a-z0-9_$]/i.test(src[pos - 1])) &&
                !/[a-z0-9_]/i.test(src[pos + 6] || "")
            ) {
                pos += 6;
                const parsed = parseValue();
                return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
            }
            pos++;
        }

        return {};
    }

    function escapePhpSingleQuote(str) {
        return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    }

    function formatPhpValue(val, level) {
        if (val === null || val === undefined) return "null";
        if (typeof val === "boolean") return val ? "true" : "false";
        if (typeof val === "number") return Number.isFinite(val) ? String(val) : "0";
        if (typeof val === "string") return `'${escapePhpSingleQuote(val)}'`;

        const indent = "    ".repeat(level);
        const childIndent = "    ".repeat(level + 1);

        if (Array.isArray(val)) {
            if (val.length === 0) return "[]";
            const lines = val.map((item) => `${childIndent}${formatPhpValue(item, level + 1)},`);
            return `[\n${lines.join("\n")}\n${indent}]`;
        }

        if (typeof val === "object") {
            const entries = Object.entries(val).filter(([k]) => k !== "sync_with_main");
            if (entries.length === 0) return "[]";
            const lines = entries.map(
                ([k, v]) => `${childIndent}'${escapePhpSingleQuote(k)}' => ${formatPhpValue(v, level + 1)},`
            );
            return `[\n${lines.join("\n")}\n${indent}]`;
        }

        return `'${escapePhpSingleQuote(String(val))}'`;
    }

    function exportPhpConfigFile(fileName, dataObj) {
        const fnLower = String(fileName || "").toLowerCase();
        const isNews = fnLower.includes("news");
        const isStatic = fnLower.includes("static");
        const source = dataObj && typeof dataObj === "object" ? dataObj : {};

        let paymentModule = null;
        const lines = [];

        for (const [modKey, rawVal] of Object.entries(source)) {
            if (modKey === "brand" || modKey === "default") continue;
            if (isNews && modKey === "hinh-thuc-thanh-toan") {
                paymentModule = rawVal;
                continue;
            }
            let modVal = rawVal;
            if ((isNews || isStatic) && modVal && typeof modVal === "object" && !Array.isArray(modVal)) {
                const filtered = {};
                for (const [k, v] of Object.entries(modVal)) {
                    if (k !== "brand" && k !== "sync_with_main") filtered[k] = v;
                }
                modVal = filtered;
            }
            lines.push(`    '${escapePhpSingleQuote(modKey)}' => ${formatPhpValue(modVal, 1)},`);
        }

        if (isNews && paymentModule && typeof paymentModule === "object") {
            lines.push(
                `    'hinh-thuc-thanh-toan' => (!empty($configSetting['order'])) ? ${formatPhpValue(paymentModule, 1)} : [],`
            );
        }

        if (lines.length === 0) {
            return "<?php\n\nreturn [];\n";
        }
        return `<?php\n\nreturn [\n${lines.join("\n")}\n];\n`;
    }

    const schemaSiteCache = new Map();

    function resolveProjectCategory(project, explicitCategory) {
        if (explicitCategory) return String(explicitCategory);
        const appRef = typeof App !== "undefined" ? App : window.App;
        if (appRef) {
            if (appRef.currentCategory) return String(appRef.currentCategory);
            if (Array.isArray(appRef.projects)) {
                const match = appRef.projects.find((p) => p && p.name === project);
                if (match && match.category) return String(match.category);
            }
        }
        return "";
    }

    function buildSiteNameCandidates(project, category) {
        const cat = resolveProjectCategory(project, category).replace(/^[/\\]+|[/\\]+$/g, "");
        const proj = String(project || "").replace(/^[/\\]+|[/\\]+$/g, "");
        const list = [];
        const pushUnique = (s) => {
            if (s && !list.includes(s)) list.push(s);
        };
        if (cat) pushUnique(`${cat}/${proj}`);
        pushUnique(proj);
        if (cat) pushUnique(`../${cat}/${proj}`);
        if (cat) pushUnique(`../../www/${cat}/${proj}`);
        return list;
    }

    function normalizeSchemaRelPaths(file) {
        const clean = String(file || "").replace(/\\/g, "/").replace(/^\/+/, "");
        if (!clean) return [];
        if (clean.startsWith("config/") || clean.startsWith("libraries/type/")) {
            return [clean];
        }
        return [`config/${clean}`, `libraries/type/${clean}`];
    }

    async function handleSchemaAction(action, query, serialized) {
        if (action === "loadModuleSchema") {
            const project = query.name || "";
            const file = query.file || "";
            const category = query.category || "";
            if (!project || !file) return null;

            const cacheKey = `${resolveProjectCategory(project, category)}::${project}`;
            const cached = schemaSiteCache.get(cacheKey);
            const candidates = cached
                ? [cached, ...buildSiteNameCandidates(project, category).filter((c) => c !== cached)]
                : buildSiteNameCandidates(project, category);
            const relPaths = normalizeSchemaRelPaths(file);

            for (const siteName of candidates) {
                for (const relPath of relPaths) {
                    try {
                        const rawPhp = await callInvoke("pro_read_schema", { siteName, relPath });
                        schemaSiteCache.set(cacheKey, siteName);
                        return { status: "success", data: parsePhpConfigArray(rawPhp) };
                    } catch (_) {
                        // Try next candidate
                    }
                }
            }
            return null;
        }

        if (action === "saveModuleSchema") {
            let payload = {};
            if (serialized.bodyType === "string" && typeof serialized.body === "string") {
                try { payload = JSON.parse(serialized.body); } catch (_) { payload = {}; }
            } else if (serialized.bodyType === "formdata" && serialized.body && serialized.body.fields) {
                payload = serialized.body.fields;
            } else if (serialized.body && typeof serialized.body === "object") {
                payload = serialized.body;
            }

            const project = payload.name || query.name || "";
            const file = payload.file || query.file || "";
            const category = payload.category || query.category || "";
            let config = payload.config ?? payload.schema_data ?? payload.data ?? {};
            if (typeof config === "string") {
                try { config = JSON.parse(config); } catch (_) { config = {}; }
            }
            if (!project || !file) return null;

            const sbRef = typeof SchemaBuilder !== "undefined" ? SchemaBuilder : window.SchemaBuilder;
            const ordered =
                sbRef && typeof sbRef.reorderKeys === "function"
                    ? sbRef.reorderKeys(config, "root")
                    : config;
            const phpContent = exportPhpConfigFile(file, ordered);

            const cacheKey = `${resolveProjectCategory(project, category)}::${project}`;
            const cached = schemaSiteCache.get(cacheKey);
            const candidates = cached
                ? [cached, ...buildSiteNameCandidates(project, category).filter((c) => c !== cached)]
                : buildSiteNameCandidates(project, category);
            const relPaths = normalizeSchemaRelPaths(file);
            const targetRelPath = relPaths[0] || `config/${file}`;

            // Verify existing project directory first via pro_list_schemas or cached siteName
            for (const siteName of candidates) {
                try {
                    const existingFiles = await callInvoke("pro_list_schemas", { siteName });
                    schemaSiteCache.set(cacheKey, siteName);
                    const fileBase = targetRelPath.split("/").pop();
                    const matched = Array.isArray(existingFiles)
                        ? existingFiles.find((f) => f && (f.fileName === fileBase || f.relPath === file))
                        : null;
                    const saveRelPath = matched && matched.relPath ? matched.relPath : targetRelPath;
                    await callInvoke("pro_save_schema", {
                        siteName,
                        relPath: saveRelPath,
                        content: phpContent,
                    });
                    return { status: "success", message: "Đã lưu cấu hình Schema thành công!" };
                } catch (_) {
                    // Try next siteName candidate
                }
            }
            return null;
        }

        return null;
    }

    // =========================================================================
    // Auto Media (scan_images.php) Matching Engine - 1:1 with RBWManager / AutoMediaPipeline
    // =========================================================================
    const MEDIA_SYNONYMS = {
        social: ['mxh', 'mangxahoi', 'mang-xa-hoi', 'social', 'facebook', 'fb', 'zalo', 'youtube', 'yt', 'instagram', 'tiktok', 'twitter', 'messenger', 'google', 'pinterest'],
        mangxahoi: ['mxh', 'mangxahoi', 'mang-xa-hoi', 'social', 'facebook', 'fb', 'zalo', 'youtube', 'yt', 'instagram', 'tiktok', 'twitter', 'messenger', 'google', 'pinterest'],
        slideshow: ['slide', 'slideshow', 'slider', 'silde', 'silder'],
        slide: ['slide', 'slideshow', 'slider', 'silde', 'silder'],
        gioithieu: ['gt', 'gioithieu', 'gioi-thieu', 'about'],
        tintuc: ['tt', 'tintuc', 'tin-tuc', 'news'],
        sanpham: ['sp', 'sanpham', 'san-pham', 'product'],
        duan: ['da', 'duan', 'du-an', 'project'],
        dichvu: ['dv', 'dichvu', 'dich-vu', 'service'],
        doitac: ['dt', 'doitac', 'doi-tac', 'partner'],
        lienhe: ['lh', 'lienhe', 'lien-he', 'contact'],
        chinhsach: ['cs', 'chinhsach', 'chinh-sach', 'policy'],
        'logo-footer': ['logo-footer', 'logo_footer', 'logofooter', 'footer-logo', 'footer_logo', 'footerlogo', 'logo-ft'],
    };

    function stripAccentsJs(str) {
        const map = {
            a: 'á|à|ả|ã|ạ|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ',
            d: 'đ',
            e: 'é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ',
            i: 'í|ì|ỉ|ĩ|ị',
            o: 'ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ',
            u: 'ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự',
            y: 'ý|ỳ|ỷ|ỹ|ỵ',
        };
        let res = String(str || '');
        for (const [ascii, pat] of Object.entries(map)) {
            res = res.replace(new RegExp('(' + pat + ')', 'gi'), ascii);
        }
        return res;
    }

    function isRatioMatchJs(imgW, imgH, targetW, targetH, tolerance = 12) {
        if (imgW <= 0 || imgH <= 0 || targetW <= 0 || targetH <= 0) return false;
        const pct = tolerance > 1 ? tolerance / 100.0 : tolerance;
        const ratioImg = imgW / imgH;
        const ratioTarget = targetW / targetH;
        const diff = Math.abs(ratioImg - ratioTarget);
        return diff <= ratioTarget * pct;
    }

    function extractSubtypeRatioJs(node) {
        if (!node || typeof node !== 'object') return null;
        const candidates = [];
        if (node.images && typeof node.images === 'object') {
            if (node.images.photo && typeof node.images.photo === 'object') candidates.push(node.images.photo);
            candidates.push(node.images);
        }
        candidates.push(node);

        for (const c of candidates) {
            if (!c || typeof c !== 'object') continue;
            let w = Number(c.width || c.photo_width || c.width_photo || 0);
            let h = Number(c.height || c.photo_height || c.height_photo || 0);
            if ((!w || !h) && (c.thumb || c.thumb_photo)) {
                const m = String(c.thumb || c.thumb_photo).match(/(\d+)x(\d+)/);
                if (m) {
                    w = Number(m[1]);
                    h = Number(m[2]);
                }
            }
            if (w > 0 && h > 0) return { width: w, height: h };
        }

        for (const v of Object.values(node)) {
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                const r = extractSubtypeRatioJs(v);
                if (r) return r;
            }
        }
        return null;
    }

    function getCandidateKeysForSubTypeJs(subKey, cfgNode) {
        const candidates = [subKey];
        if (cfgNode && cfgNode.title_main && typeof cfgNode.title_main === 'string' && cfgNode.title_main.trim()) {
            candidates.push(cfgNode.title_main.trim());
        }
        const extra = [];
        for (const c of candidates) {
            const cClean = String(c).trim().toLowerCase();
            extra.push(cClean);
            extra.push(cClean.replace(/-/g, ''));
            extra.push(cClean.replace(/-/g, '_'));

            const noAccent = stripAccentsJs(cClean);
            extra.push(noAccent);
            extra.push(noAccent.replace(/-/g, ''));
            extra.push(noAccent.replace(/-/g, '_'));
        }

        const allText = extra.join(' ');
        for (const [kw, syns] of Object.entries(MEDIA_SYNONYMS)) {
            if (allText.includes(kw)) {
                for (const s of syns) {
                    extra.push(s);
                    extra.push(s.replace(/-/g, ''));
                    extra.push(s.replace(/-/g, '_'));
                }
            }
        }
        return Array.from(new Set(extra.filter(Boolean)));
    }

    function escapeRegexStr(str) {
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function buildPrefixRegexJs(candidates) {
        const parts = [];
        for (const k of candidates) {
            const clean = String(k).trim().toLowerCase();
            if (!clean) continue;
            parts.push(escapeRegexStr(clean));
            parts.push(escapeRegexStr(clean.replace(/-/g, '')));
            parts.push(escapeRegexStr(clean.replace(/-/g, '_')));
            parts.push(escapeRegexStr(clean.replace(/ /g, '_')));
        }
        const unique = Array.from(new Set(parts.filter(Boolean)));
        if (unique.length === 0) return null;
        unique.sort((a, b) => b.length - a.length);
        return new RegExp('^(' + unique.join('|') + ')', 'i');
    }

    async function handleScanImagesAction(query) {
        const appRef = typeof App !== 'undefined' ? App : window.App;
        const project = query.project_name || query.project || query.name || (appRef && appRef.currentProject) || '';
        const mainKey = query.main_key || query.mainKey || 'type-photo';
        const category = query.category || resolveProjectCategory(project, '') || '';
        if (!project) return null;

        // 1. Get images from assets/images/images via listProjectImages
        let imageList = [];
        try {
            const listRes = await callInvoke('rbw_pro_dispatch', {
                req: {
                    endpoint: 'api.php',
                    method: 'GET',
                    query: { action: 'listProjectImages', name: project, category },
                    bodyType: 'none',
                    body: null,
                },
            });
            if (listRes && Array.isArray(listRes.data)) {
                imageList = listRes.data;
            }
        } catch (_) {}

        // 2. Read type config file
        const cacheKey = `${resolveProjectCategory(project, category)}::${project}`;
        const cached = schemaSiteCache.get(cacheKey);
        const candidates = cached
            ? [cached, ...buildSiteNameCandidates(project, category).filter((c) => c !== cached)]
            : buildSiteNameCandidates(project, category);
        const relPaths = normalizeSchemaRelPaths(`${mainKey}.php`);

        let configData = null;
        for (const siteName of candidates) {
            for (const relPath of relPaths) {
                try {
                    const rawPhp = await callInvoke('pro_read_schema', { siteName, relPath });
                    configData = parsePhpConfigArray(rawPhp);
                    schemaSiteCache.set(cacheKey, siteName);
                    break;
                } catch (_) {}
            }
            if (configData) break;
        }

        if (!configData || typeof configData !== 'object') {
            return null; // Fallback to Rust backend
        }

        // 3. Extract subTypes and ratios
        const subKeys = Object.keys(configData).filter(
            (k) => k && typeof k === 'string' && k !== 'brand' && k !== 'default'
        );
        const subTypes = {};
        const subTypeRatios = {};
        const grouped = {};

        for (const subKey of subKeys) {
            const cfgNode = configData[subKey] && typeof configData[subKey] === 'object' ? configData[subKey] : {};
            const cands = getCandidateKeysForSubTypeJs(subKey, cfgNode);
            const regex = buildPrefixRegexJs(cands);
            subTypes[subKey] = {
                candidates: cands,
                regex: regex,
                node: cfgNode,
            };
            subTypeRatios[subKey] = extractSubtypeRatioJs(cfgNode);
            grouped[subKey] = [];
        }

        const sortedSubKeys = subKeys.slice().sort((a, b) => b.length - a.length);

        // Project relative path for preview images
        const catNorm = category ? String(category).replace(/^[/\\]+|[/\\]+$/g, '') : '';
        const projNorm = String(project).replace(/^[/\\]+|[/\\]+$/g, '');
        const relPrefix = catNorm ? `${catNorm}/${projNorm}` : projNorm;

        // 4. Classify each image
        for (const img of imageList) {
            const f = img.name;
            const ext = String(img.ext || '').toLowerCase();
            const size = img.size || 0;
            const w = img.width || 0;
            const h = img.height || 0;
            const previewUrl = `/${relPrefix}/assets/images/images/${encodeURIComponent(f)}`;

            const lastDot = f.lastIndexOf('.');
            const base = lastDot >= 0 ? f.slice(0, lastDot) : f;
            const baseClean = stripAccentsJs(base).toLowerCase();
            const normBase = baseClean.replace(/[^a-z0-9]/g, '');

            const detectedSubTypes = [];

            // Pass 1: Strict prefix match using regex
            for (const subKey of sortedSubKeys) {
                const reg = subTypes[subKey].regex;
                if (reg && reg.test(base)) {
                    detectedSubTypes.push(subKey);
                }
            }

            // Pass 2: Smart substring / keyword match
            for (const subKey of sortedSubKeys) {
                if (detectedSubTypes.includes(subKey)) continue;
                const cands = subTypes[subKey].candidates || [subKey];
                let matched = false;
                for (const c of cands) {
                    const cClean = stripAccentsJs(c).toLowerCase();
                    if (!cClean) continue;
                    if (cClean.length > 3) {
                        if (baseClean.includes(cClean)) {
                            matched = true;
                            break;
                        }
                    } else {
                        const words = baseClean.split(/[^a-z0-9]+/);
                        if (words.includes(cClean)) {
                            matched = true;
                            break;
                        }
                    }
                }
                if (matched) {
                    detectedSubTypes.push(subKey);
                }
            }

            // Ratio check on name matches (matches RBWManager scan_images.php)
            const nameMatches = [];
            for (const detectedSubType of detectedSubTypes) {
                const isAlbumOrGallery = detectedSubType.includes('album') || detectedSubType.includes('gallery');
                const rr = isAlbumOrGallery ? null : subTypeRatios[detectedSubType];
                let ratioOk = true;

                if (rr && rr.width > 0 && rr.height > 0) {
                    let minW = rr.width * 0.4;
                    let maxW = rr.width * 5.0;
                    if (rr.width <= 50) maxW = 150;

                    if (w < minW || w > maxW) {
                        ratioOk = false;
                    } else {
                        const isTargetSquare = Math.abs(rr.width - rr.height) <= 5;
                        const isImageSquare = w > 0 && h > 0 && Math.abs(w - h) <= Math.max(10, w * 0.2);

                        if (rr.width > 50 || rr.height > 50) {
                            const exactMatch = w === rr.width && h === rr.height;
                            const ratioMatch = isRatioMatchJs(w, h, rr.width, rr.height, 12);
                            if (!exactMatch && !ratioMatch) ratioOk = false;
                        } else if (isTargetSquare && !isImageSquare) {
                            ratioOk = false;
                        }
                    }
                }

                if (ratioOk) {
                    nameMatches.push(detectedSubType);
                }
            }

            const matchedSubTypes = [];

            if (nameMatches.length > 0) {
                if (nameMatches.length > 1) {
                    const scoreFn = (subKey) => {
                        const cleanKey = stripAccentsJs(subKey).toLowerCase();
                        const normKey = cleanKey.replace(/[^a-z0-9]/g, '');
                        const cands = subTypes[subKey].candidates || [subKey];
                        let bestScore = 0;
                        for (const cand of cands) {
                            const cleanCand = stripAccentsJs(cand).toLowerCase();
                            const normCand = cleanCand.replace(/[^a-z0-9]/g, '');
                            if (baseClean === cleanCand || normBase === normCand) {
                                bestScore = Math.max(bestScore, 5000 + cleanCand.length * 10);
                            } else if (new RegExp('^' + escapeRegexStr(cleanCand) + '([^a-z0-9]|$)', 'i').test(baseClean)) {
                                bestScore = Math.max(bestScore, 3000 + cleanCand.length * 10);
                            } else if (normBase.startsWith(normCand)) {
                                bestScore = Math.max(bestScore, 2000 + normCand.length * 10);
                            } else if (baseClean.includes(cleanCand)) {
                                bestScore = Math.max(bestScore, 1000 + cleanCand.length * 10);
                            }
                        }
                        return bestScore;
                    };

                    nameMatches.sort((a, b) => {
                        const sA = scoreFn(a);
                        const sB = scoreFn(b);
                        if (sA !== sB) return sB - sA;
                        const rrA = subTypeRatios[a];
                        const rrB = subTypeRatios[b];
                        const diffA = rrA ? Math.abs(w - rrA.width) + Math.abs(h - rrA.height) : 9999;
                        const diffB = rrB ? Math.abs(w - rrB.width) + Math.abs(h - rrB.height) : 9999;
                        return diffA - diffB;
                    });
                }

                matchedSubTypes.push({
                    sub_type: nameMatches[0],
                    match_source: 'name',
                });
            }

            // Ratio match fallback across ALL compatible subtypes (50% - 500% size, 12% ratio tolerance)
            if (matchedSubTypes.length === 0) {
                for (const subKey of subKeys) {
                    const rr = subTypeRatios[subKey];
                    if (rr && rr.width > 0 && rr.height > 0) {
                        const exactMatch = w === rr.width && h === rr.height;
                        const ratioMatch = isRatioMatchJs(w, h, rr.width, rr.height, 12);
                        if (exactMatch || ratioMatch) {
                            const minW = rr.width * 0.5;
                            const maxW = rr.width * 5.0;
                            if (w >= minW && w <= maxW) {
                                matchedSubTypes.push({
                                    sub_type: subKey,
                                    match_source: 'ratio',
                                });
                            }
                        }
                    }
                }
            }

            for (const match of matchedSubTypes) {
                if (grouped[match.sub_type]) {
                    grouped[match.sub_type].push({
                        file: f,
                        sub_type: match.sub_type,
                        ext: ext,
                        size: size,
                        width: w,
                        height: h,
                        preview_url: previewUrl,
                        match_source: match.match_source,
                    });
                }
            }

            // Special rule for favicon in type-photo: scans any png/ico image named 'logo'
            if (
                mainKey === 'type-photo' &&
                grouped['favicon'] &&
                ['png', 'ico'].includes(ext) &&
                baseClean === 'logo' &&
                !matchedSubTypes.some((m) => m.sub_type === 'favicon')
            ) {
                grouped['favicon'].push({
                    file: f,
                    sub_type: 'favicon',
                    ext: ext,
                    size: size,
                    width: w,
                    height: h,
                    preview_url: previewUrl,
                    match_source: 'name',
                });
            }
        }

        return {
            status: 'success',
            main_key: mainKey,
            project_name: project,
            groups: grouped,
        };
    }

    const origFetch = window.fetch.bind(window);

    window.fetch = async function (input, init) {
        let urlStr = typeof input === "string" ? input : (input && input.url ? input.url : String(input));
        const invoke = getInvoke();

        // Check if this is a local PHP endpoint call
        const matchPhp = urlStr.match(/(?:^|\/)(api\.php|scan_images\.php|auto_update\.php|seed_images\.php|converter\.php|ai_checker\.php)(?:\?(.*))?$/i);
        if (matchPhp && invoke) {
            const endpoint = matchPhp[1].toLowerCase();
            const queryString = matchPhp[2] || "";
            const query = {};
            if (queryString) {
                const sp = new URLSearchParams(queryString);
                for (const [k, v] of sp.entries()) {
                    query[k] = v;
                }
            }
            const method = (init && init.method ? init.method : "GET").toUpperCase();
            const serialized = await serializeBody(init ? init.body : null);

            try {
                if (endpoint === "api.php" && (query.action === "loadModuleSchema" || query.action === "saveModuleSchema")) {
                    const schemaRes = await handleSchemaAction(query.action, query, serialized);
                    if (schemaRes) {
                        return new Response(JSON.stringify(schemaRes), {
                            status: 200,
                            headers: { "Content-Type": "application/json; charset=utf-8" },
                        });
                    }
                }

                if (endpoint === "scan_images.php") {
                    const scanRes = await handleScanImagesAction(query);
                    if (scanRes) {
                        return new Response(JSON.stringify(scanRes), {
                            status: 200,
                            headers: { "Content-Type": "application/json; charset=utf-8" },
                        });
                    }
                }

                const res = await callInvoke("rbw_pro_dispatch", {
                    req: {
                        endpoint,
                        method,
                        query,
                        bodyType: serialized.bodyType,
                        body: serialized.body,
                    },
                });

                // Special binary response (e.g. getFontFile or converter download)
                if (res && res.__binary_b64) {
                    const binStr = atob(res.__binary_b64);
                    const len = binStr.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binStr.charCodeAt(i);
                    }
                    return new Response(bytes.buffer, {
                        status: res.__status || 200,
                        headers: {
                            "Content-Type": res.__mime || "application/octet-stream",
                        },
                    });
                }

                const jsonText = typeof res === "string" ? res : JSON.stringify(res);
                return new Response(jsonText, {
                    status: 200,
                    headers: { "Content-Type": "application/json; charset=utf-8" },
                });
            } catch (err) {
                const errJson = JSON.stringify({
                    status: "error",
                    message: String(err),
                });
                return new Response(errJson, {
                    status: 200,
                    headers: { "Content-Type": "application/json; charset=utf-8" },
                });
            }
        }

        return origFetch(input, init);
    };

    // Intercept image src attributes that point to local project paths or data/screenshots or seed_images.php
    const EMPTY_IMG_DATA = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const imageCache = (window.__rbwImageCache = window.__rbwImageCache || new Map());
    const inFlightLoads = (window.__rbwImageInFlight = window.__rbwImageInFlight || new Map());
    const loadQueue = [];
    const queuedImgs = new WeakSet();
    let activeLoads = 0;
    const MAX_CONCURRENT_IMAGE_LOADS = 16;
    const MAX_IMAGE_CACHE_SIZE = 500;

    function resolveAbsFilePath(rawSrc) {
        if (!rawSrc || typeof rawSrc !== "string") return null;
        if (rawSrc.includes("seed_images.php") && rawSrc.includes("path=")) {
            const qIdx = rawSrc.indexOf("?");
            if (qIdx >= 0) {
                const sp = new URLSearchParams(rawSrc.slice(qIdx + 1));
                const p = sp.get("path");
                if (p && (/^[a-zA-Z]:[\\/]/.test(p) || p.startsWith("/"))) {
                    return p;
                }
            }
        }
        if (rawSrc.startsWith("/")) {
            let clean = rawSrc.split("?")[0].split("#")[0];
            try { clean = decodeURIComponent(clean); } catch (_) {}
            const relUrl = clean.replace(/^\/+/, "");
            const projects = (window.App && Array.isArray(window.App.projects)) ? window.App.projects : [];
            let wwwRoot = null;
            for (let i = 0; i < projects.length; i++) {
                const p = projects[i];
                if (!p || !p.path) continue;
                const pPath = String(p.path).replace(/\\/g, "/").replace(/\/+$/, "");
                const relNorm = String(p.relPath || p.rel_path || p.name || "")
                    .replace(/\\/g, "/")
                    .replace(/^\/+|\/+$/g, "");
                if (!relNorm) continue;
                if (relUrl === relNorm || relUrl.startsWith(relNorm + "/")) {
                    const sub = relUrl.slice(relNorm.length).replace(/^\/+/, "");
                    return sub ? `${pPath}/${sub}` : pPath;
                }
                if (!wwwRoot && pPath.toLowerCase().endsWith("/" + relNorm.toLowerCase())) {
                    wwwRoot = pPath.slice(0, pPath.length - relNorm.length - 1);
                }
            }
            if (wwwRoot) {
                return `${wwwRoot}/${relUrl}`;
            }
        }
        return null;
    }

    function guessImageMime(pathOrUrl) {
        const clean = String(pathOrUrl || "").split("?")[0].split("#")[0].toLowerCase();
        if (clean.endsWith(".webp")) return "image/webp";
        if (clean.endsWith(".png")) return "image/png";
        if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
        if (clean.endsWith(".gif")) return "image/gif";
        if (clean.endsWith(".svg")) return "image/svg+xml";
        if (clean.endsWith(".ico")) return "image/x-icon";
        if (clean.endsWith(".bmp")) return "image/bmp";
        if (clean.endsWith(".avif")) return "image/avif";
        return "image/png";
    }

    function b64ToBlobUrl(b64, mime) {
        try {
            if (!b64) return null;
            const bin = atob(b64);
            const len = bin.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = bin.charCodeAt(i);
            }
            if (mime === "image/svg+xml") {
                return `data:image/svg+xml;base64,${b64}`;
            }
            const blob = new Blob([bytes], { type: mime || "image/png" });
            return URL.createObjectURL(blob);
        } catch (_) {
            return null;
        }
    }

    function extractImageCacheKey(rawSrc) {
        if (rawSrc.includes("seed_images.php") && rawSrc.includes("path=")) {
            const qIdx = rawSrc.indexOf("?");
            if (qIdx >= 0) {
                const sp = new URLSearchParams(rawSrc.slice(qIdx + 1));
                const p = sp.get("path");
                const ver = sp.get("v") || sp.get("t") || sp.get("_") || "";
                if (p) return "path:" + p.toLowerCase() + (ver ? "?v=" + ver : "");
            }
        }
        return "url:" + rawSrc;
    }

    window.__rbwClearImageCache = function (prefix) {
        const normPrefix = prefix ? String(prefix).toLowerCase() : "";
        for (const [k, val] of imageCache.entries()) {
            if (!normPrefix || String(k).toLowerCase().includes(normPrefix)) {
                imageCache.delete(k);
                if (val && typeof val === "string" && val.startsWith("blob:")) {
                    try { URL.revokeObjectURL(val); } catch (_) {}
                }
            }
        }
        inFlightLoads.clear();
    };

    function dataUrlToFastSrc(dataUrl) {
        try {
            if (!dataUrl || !dataUrl.startsWith("data:") || !dataUrl.includes(";base64,")) {
                return dataUrl;
            }
            const commaIdx = dataUrl.indexOf(",");
            const header = dataUrl.slice(5, commaIdx);
            const mime = header.split(";")[0] || "image/png";
            if (mime === "image/svg+xml") return dataUrl;
            const b64 = dataUrl.slice(commaIdx + 1);
            return b64ToBlobUrl(b64, mime) || dataUrl;
        } catch (_) {
            return dataUrl;
        }
    }

    function setCachedImage(key, fastSrc) {
        if (imageCache.size >= MAX_IMAGE_CACHE_SIZE) {
            const oldestKey = imageCache.keys().next().value;
            const oldestVal = imageCache.get(oldestKey);
            imageCache.delete(oldestKey);
            if (oldestVal && typeof oldestVal === "string" && oldestVal.startsWith("blob:")) {
                try { URL.revokeObjectURL(oldestVal); } catch (_) {}
            }
        }
        imageCache.set(key, fastSrc);
    }

    function fetchImageWithDedup(rawSrc, cacheKey) {
        if (imageCache.has(cacheKey)) {
            return Promise.resolve(imageCache.get(cacheKey));
        }
        if (inFlightLoads.has(cacheKey)) {
            return inFlightLoads.get(cacheKey);
        }
        const absPath = resolveAbsFilePath(rawSrc);
        const fastReadPromise = absPath
            ? callInvoke("rbw_pro_dispatch", {
                  req: {
                      endpoint: "api.php",
                      method: "GET",
                      query: { action: "getFontFile", path: absPath },
                      bodyType: "none",
                      body: null,
                  },
              })
                  .then((res) => {
                      if (res && typeof res.__binary_b64 === "string" && res.__binary_b64.length > 0) {
                          const blobUrl = b64ToBlobUrl(res.__binary_b64, guessImageMime(absPath));
                          if (blobUrl) {
                              setCachedImage(cacheKey, blobUrl);
                              return blobUrl;
                          }
                      }
                      return null;
                  })
                  .catch(() => null)
            : Promise.resolve(null);

        const promise = fastReadPromise
            .then((fastUrl) => {
                if (fastUrl) {
                    inFlightLoads.delete(cacheKey);
                    return fastUrl;
                }
                return callInvoke("rbw_pro_load_image", { url: rawSrc }).then((dataUrl) => {
                    inFlightLoads.delete(cacheKey);
                    if (dataUrl && typeof dataUrl === "string" && dataUrl.startsWith("data:")) {
                        const fastSrc = dataUrlToFastSrc(dataUrl);
                        setCachedImage(cacheKey, fastSrc);
                        return fastSrc;
                    }
                    return null;
                });
            })
            .catch(() => {
                inFlightLoads.delete(cacheKey);
                return null;
            });
        inFlightLoads.set(cacheKey, promise);
        return promise;
    }

    window.__rbwPrefetchImageUrl = function (rawSrc) {
        if (!rawSrc || typeof rawSrc !== "string") return Promise.resolve(null);
        if (rawSrc.startsWith("data:") || rawSrc.startsWith("blob:") || rawSrc.startsWith("http")) {
            return Promise.resolve(rawSrc);
        }
        const cacheKey = extractImageCacheKey(rawSrc);
        return fetchImageWithDedup(rawSrc, cacheKey);
    };

    function pumpImageQueue() {
        while (activeLoads < MAX_CONCURRENT_IMAGE_LOADS && loadQueue.length > 0) {
            const img = loadQueue.shift();
            if (!img || !img.isConnected) continue;
            const rawSrc = img.dataset.rbwRawSrc;
            const cacheKey = img.dataset.rbwCacheKey;
            if (!rawSrc || !cacheKey) continue;

            if (imageCache.has(cacheKey)) {
                img.dataset.rbwResolved = "1";
                img.src = imageCache.get(cacheKey);
                continue;
            }

            activeLoads++;
            fetchImageWithDedup(rawSrc, cacheKey)
                .then((fastSrc) => {
                    if (fastSrc && img.isConnected && img.dataset.rbwCacheKey === cacheKey) {
                        img.dataset.rbwResolved = "1";
                        img.src = fastSrc;
                    }
                })
                .finally(() => {
                    activeLoads = Math.max(0, activeLoads - 1);
                    pumpImageQueue();
                });
        }
    }

    function enqueueImageLoad(img) {
        if (!img || !img.isConnected || img.dataset.rbwResolved === "1" || queuedImgs.has(img)) {
            return;
        }
        const cacheKey = img.dataset.rbwCacheKey;
        if (cacheKey && imageCache.has(cacheKey)) {
            img.dataset.rbwResolved = "1";
            img.src = imageCache.get(cacheKey);
            return;
        }
        queuedImgs.add(img);
        loadQueue.push(img);
        pumpImageQueue();
    }

    const imageIntersectionObserver =
        typeof IntersectionObserver !== "undefined"
            ? new IntersectionObserver(
                  (entries) => {
                      for (const entry of entries) {
                          if (entry.isIntersecting) {
                              imageIntersectionObserver.unobserve(entry.target);
                              enqueueImageLoad(entry.target);
                          }
                      }
                  },
                  { rootMargin: "350px 250px", threshold: 0.01 }
              )
            : null;

    async function resolveLocalImageElement(img) {
        if (!img || img.dataset.rbwResolved === "1" || img.dataset.rbwResolved === "queued") return;
        const rawSrc = img.getAttribute("src") || "";
        if (!rawSrc || rawSrc.startsWith("data:") || rawSrc.startsWith("blob:") || rawSrc.startsWith("http://") || rawSrc.startsWith("https://")) {
            return;
        }
        if (rawSrc.includes("favicon.png") || rawSrc.startsWith("assets/")) {
            return;
        }
        const invoke = getInvoke();
        if (!invoke) return;

        if (
            rawSrc.startsWith("data/screenshots/") ||
            rawSrc.startsWith("/") ||
            rawSrc.startsWith("seed_images.php")
        ) {
            const cacheKey = extractImageCacheKey(rawSrc);
            if (imageCache.has(cacheKey)) {
                img.dataset.rbwResolved = "1";
                img.dataset.rbwCacheKey = cacheKey;
                img.src = imageCache.get(cacheKey);
                return;
            }
            img.dataset.rbwRawSrc = rawSrc;
            img.dataset.rbwCacheKey = cacheKey;
            img.dataset.rbwResolved = "queued";
            // Thay src bằng pixel rỗng trong lúc chờ hàng đợi để tránh WebView2 phát request 404 hàng loạt
            img.src = EMPTY_IMG_DATA;
            enqueueImageLoad(img);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === "childList") {
                    m.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            if (node.tagName === "IMG") resolveLocalImageElement(node);
                            node.querySelectorAll && node.querySelectorAll("img").forEach(resolveLocalImageElement);
                        }
                    });
                } else if (m.type === "attributes" && m.target && m.target.tagName === "IMG" && m.attributeName === "src") {
                    const v = m.target.getAttribute("src") || "";
                    if (v && !v.startsWith("data:") && !v.startsWith("blob:")) {
                        m.target.dataset.rbwResolved = "0";
                        queuedImgs.delete(m.target);
                        resolveLocalImageElement(m.target);
                    }
                }
            }
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["src"],
        });
    });

    // Intercept download links to converter.php?action=download
    document.addEventListener("click", async (e) => {
        const a = e.target && e.target.closest ? e.target.closest("a") : null;
        if (!a) return;
        const href = a.getAttribute("href") || "";
        if (href.includes("converter.php?action=download")) {
            e.preventDefault();
            e.stopPropagation();
            const invoke = getInvoke();
            if (!invoke) return;
            const sp = new URLSearchParams(href.split("?")[1] || "");
            const file = sp.get("file") || "converted_images.zip";
            try {
                const res = await callInvoke("rbw_pro_dispatch", {
                    req: {
                        endpoint: "converter.php",
                        method: "GET",
                        query: { action: "download", file },
                        bodyType: "none",
                        body: null,
                    },
                });
                if (res && res.__binary_b64) {
                    const binStr = atob(res.__binary_b64);
                    const bytes = new Uint8Array(binStr.length);
                    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
                    const blob = new Blob([bytes], { type: "application/zip" });
                    const blobUrl = URL.createObjectURL(blob);
                    const tempA = document.createElement("a");
                    tempA.href = blobUrl;
                    tempA.download = file;
                    document.body.appendChild(tempA);
                    tempA.click();
                    tempA.remove();
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
                }
            } catch (err) {
                console.error(err);
            }
        }
    }, true);
    // Intercept external window.open calls so browser tabs open outside WebView2
    const origWindowOpen = window.open ? window.open.bind(window) : null;
    window.open = function (url, target, features) {
        const strUrl = url ? String(url) : "";
        if (strUrl.startsWith("http://") || strUrl.startsWith("https://")) {
            const inv = getInvoke();
            if (inv) {
                inv("open_browser", { url: strUrl }).catch(() => {});
                return { closed: false, close() {}, focus() {} };
            }
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: "rbw-open-url", url: strUrl }, "*");
                return { closed: false, close() {}, focus() {} };
            }
        }
        return origWindowOpen ? origWindowOpen(url, target, features) : null;
    };
})();

