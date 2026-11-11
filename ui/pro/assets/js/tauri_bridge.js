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
    async function resolveLocalImageElement(img) {
        if (!img || img.dataset.rbwResolved === "1") return;
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
            img.dataset.rbwResolved = "1";
            try {
                const dataUrl = await callInvoke("rbw_pro_load_image", { url: rawSrc });
                if (dataUrl && typeof dataUrl === "string" && dataUrl.startsWith("data:")) {
                    img.src = dataUrl;
                }
            } catch (_) {}
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
                    if (!v.startsWith("data:")) {
                        m.target.dataset.rbwResolved = "0";
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
})();

