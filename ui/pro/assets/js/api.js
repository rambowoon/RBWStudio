const Api = {
    async fetch(action, options = {}) {
        const url = `api.php?action=${action}`;
        const res = await fetch(url, options);
        return await res.json();
    },

    async getCategories(strict = false) {
        return this.fetch(`listCategories${strict ? '&strict=true' : ''}`);
    },

    async getProjects(category) {
        return this.fetch(`listProjects&category=${encodeURIComponent(category || '')}`);
    },

    async calculateCategorySizes(category = '') {
        return this.fetch(`calculateCategorySizes&category=${encodeURIComponent(category || '')}`);
    },

    async saveConfig(name, config, category = '') {
        return this.fetch('saveConfig', {
            method: 'POST',
            body: JSON.stringify({ name, config, category })
        });
    },

    async deploy(name) {
        return this.fetch('deploy', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
    },

    async getProjectConfig(name, category = '') {
        return this.fetch(`getProjectConfig&name=${encodeURIComponent(name || '')}&category=${encodeURIComponent(category || '')}`);
    },

    async getProjectSchemaList(name, category = App.currentCategory) {
        return this.fetch(`getProjectSchemaList&name=${encodeURIComponent(name || '')}&category=${encodeURIComponent(category || '')}`);
    },

    async loadModuleSchema(name, file, category = App.currentCategory) {
        return this.fetch(`loadModuleSchema&name=${encodeURIComponent(name || '')}&file=${encodeURIComponent(file || '')}&category=${encodeURIComponent(category || '')}`);
    },

    async getTypeImageSize(name, type, category = App.currentCategory) {
        const normalizeTypeKey = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const targetKey = normalizeTypeKey(type);
        try {
            const cat = category || "";
            const cacheKey = `${name}::${cat}`;
            let images =
                typeof WebpManager !== "undefined" &&
                WebpManager._cache &&
                Array.isArray(WebpManager._cache[cacheKey])
                    ? WebpManager._cache[cacheKey]
                    : null;
            if (!images) {
                const listRes = await this.fetch(
                    `listProjectImages&name=${encodeURIComponent(name || "")}&category=${encodeURIComponent(cat)}`,
                );
                if (listRes && listRes.status === "success" && Array.isArray(listRes.data)) {
                    images = listRes.data;
                    if (typeof WebpManager !== "undefined" && WebpManager._cache) {
                        WebpManager._cache[cacheKey] = images;
                    }
                }
            }
            if (Array.isArray(images) && targetKey) {
                const matched = images.find((img) => {
                    if (!img || !img.name) return false;
                    const base = img.name.replace(/\.[^.]+$/, "");
                    return normalizeTypeKey(base) === targetKey && Number(img.width) > 0 && Number(img.height) > 0;
                });
                if (matched) {
                    return {
                        status: "success",
                        data: {
                            file: matched.name,
                            width: Number(matched.width),
                            height: Number(matched.height),
                        },
                    };
                }
            }
        } catch (_) {}
        return this.fetch(
            `getTypeImageSize&name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}&category=${encodeURIComponent(category || "")}`,
        );
    },

    async setupLocalSource(name, category, forceOverwriteDb = null) {
        return this.fetch('setupLocalSource', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category, forceOverwriteDb })
        });
    },

    async reindexProjects() {
        return this.fetch('reindexProjects');
    },

    async captureScreenshot(name, category = '', url = null) {
        return this.fetch('captureScreenshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category, url })
        });
    },

    async batchCaptureScreenshots(category = '') {
        return this.fetch('batchCaptureScreenshots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category })
        });
    },

    async checkCategoryDeployStatus(category, name = null) {
        return this.fetch('checkCategoryDeployStatus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, name })
        });
    },

    async autoLoginAdmin(name, category = '', env = 'local') {
        return this.fetch('autoLoginAdmin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category, env })
        });
    },

    async setProjectDemoConfig(data) {
        return this.fetch('setProjectDemoConfig', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async testDemoConnection(data) {
        return this.fetch('testDemoConnection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    }
};
