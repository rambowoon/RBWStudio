var FileManager = {
    currentPath: '/',
    currentEnv: 'demo',
    lastProject: null,
    baseUrl: '',
    rawFiles: [],
    lastFindIndex: -1,
    treeCache: {},
    selectedItems: new Map(), // key: path, val: { path, isDir, name }
    currentRenderedFiles: [],
    lastClickedIndex: -1,

    getDefaultEnv() {
        const config = (typeof App !== 'undefined' && App.currentProjectConfig) ? App.currentProjectConfig : {};
        const prod = config.prod || {};
        const deployedProd = config.deployed?.production || {};
        if (prod.ftp_host || prod.web_domain || prod.ftp_user || prod.da_user || deployedProd.ftp_host || deployedProd.url) {
            return 'prod';
        }
        const ftpHost = document.getElementById('d_ftp_host')?.value?.trim();
        const webDomain = document.getElementById('d_web_domain')?.value?.trim();
        const ftpUser = document.getElementById('d_ftp_user')?.value?.trim();
        if (ftpHost || webDomain || ftpUser) {
            return 'prod';
        }
        return 'demo';
    },

    updateEnvUI(env) {
        document.querySelectorAll('.fm-env-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.background = 'transparent';
            btn.style.color = '#94a3b8';
        });
        const activeBtn = document.getElementById(`fm-env-btn-${env}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.background = (env === 'prod') ? '#f59e0b' : 'var(--primary, #00d2d3)';
            activeBtn.style.color = '#000';
        }
        const desc = document.getElementById('fm-header-desc');
        if (desc) {
            desc.innerHTML = (env === 'prod') 
                ? '<b style="color:#f59e0b;">🚀 ĐANG KẾT NỐI PRODUCTION HOSTING</b> - Chỉnh sửa file trực tiếp trên Server thật'
                : 'Duyệt, chỉnh sửa và quản lý file trực tiếp trên Server Demo';
        }
    },

    resetToDefaultEnv() {
        const defEnv = this.getDefaultEnv();
        this.currentEnv = defEnv;
        this.currentPath = '/';
        this.treeCache = {};
        this.updateEnvUI(defEnv);
    },
    
    init() {
        if (!document.getElementById('detail-project-name')?.innerText || !App.currentCategory) return;
        const currentProject = document.getElementById('detail-project-name')?.innerText;
        if (this.lastProject !== currentProject) {
            this.lastProject = currentProject;
            this.resetToDefaultEnv();
            this.loadTree(false);
        } else if (!document.getElementById('fm-tree-children-root')) {
            this.loadTree(false);
        }
        this.loadCurrentPath();
        this.bindDragDrop();
        this.ensureSelectionStyles();
        this.initMarqueeSelection();
        this.initContextMenu();
        this.initKeyBindings();
    },

    bindDragDrop() {
        const pane = document.querySelector('.fm-main-pane');
        if (!pane || pane.dataset.dndBound === 'true') return;
        pane.dataset.dndBound = 'true';

        let dragCounter = 0;
        pane.addEventListener('dragenter', e => {
            e.preventDefault();
            dragCounter++;
            pane.style.boxShadow = 'inset 0 0 0 2px var(--primary, #00d2d3), 0 0 20px rgba(0,210,211,0.2)';
            pane.style.borderRadius = '10px';
        });
        pane.addEventListener('dragover', e => {
            e.preventDefault();
        });
        pane.addEventListener('dragleave', e => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                pane.style.boxShadow = 'none';
            }
        });
        pane.addEventListener('drop', async e => {
            e.preventDefault();
            dragCounter = 0;
            pane.style.boxShadow = 'none';
            const files = await this.extractFilesFromDataTransfer(e.dataTransfer);
            if (files && files.length > 0) {
                const isFolder = files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
                this.uploadFilesQueue(files, isFolder);
            }
        });
    },

    setEnv(env) {
        if (this.currentEnv === env) return;
        this.currentEnv = env;
        this.updateEnvUI(env);
        this.currentPath = '/';
        this.treeCache = {};
        this.loadTree(true);
        this.loadCurrentPath();
    },

    loadTree(forceRefresh = false) {
        if (forceRefresh) {
            this.treeCache = {};
        }
        const container = document.getElementById('fm-tree-container');
        if (!container) return;
        
        container.innerHTML = `
            <style>
                .fm-tree-node {
                    display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 6px;
                    cursor: pointer; transition: all 0.15s ease; color: var(--text-secondary, #94a3b8);
                    font-family: var(--mono, monospace); font-size: 12px; user-select: none;
                }
                .fm-tree-node:hover { background: rgba(255,255,255,0.06); color: #fff; }
                .fm-tree-node.active {
                    background: rgba(0, 213, 146, 0.12); color: var(--primary, #00d2d3);
                    font-weight: 600; border-left: 2px solid var(--primary, #00d2d3);
                }
                .fm-tree-toggle {
                    width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center;
                    font-size: 9px; color: #64748b; cursor: pointer; transition: transform 0.15s ease;
                }
                .fm-tree-toggle:hover { color: #fff; }
                .fm-tree-icon { font-size: 13px; line-height: 1; }
                .fm-tree-label {
                    flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
            </style>
            <div class="fm-tree-item" id="tree-item-root">
                <div class="fm-tree-node ${this.currentPath === '/' ? 'active' : ''}" data-path="/" onclick="FileManager.selectTreeNode('/', this)">
                    <span class="fm-tree-toggle" onclick="FileManager.toggleTreeNode('/', this, event)">▼</span>
                    <span class="fm-tree-icon">📂</span>
                    <span class="fm-tree-label">root (/)</span>
                </div>
                <div id="fm-tree-children-root" class="fm-tree-children" style="padding-left: 12px;">
                    <div style="padding: 6px 8px; color: var(--text-muted, #888); font-size: 11px;">Đang tải...</div>
                </div>
            </div>
        `;
        
        // If root dirs are already in cache, render immediately
        if (this.treeCache['/'] && this.treeCache['/'].length > 0) {
            this.renderTreeChildren('root', '/', this.treeCache['/']);
        } else if (forceRefresh) {
            this.fetchTreeDirs('/', (dirs) => {
                this.renderTreeChildren('root', '/', dirs);
            });
        }
    },

    fetchTreeDirs(path, callback) {
        if (this.treeCache[path] && this.treeCache[path].length > 0) {
            callback(this.treeCache[path]);
            return;
        }
        
        const projectName = document.getElementById('detail-project-name')?.innerText;
        if (!projectName || !App.currentCategory) {
            callback([]);
            return;
        }
        
        fetch('api.php?action=fmList', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: projectName,
                category: App.currentCategory,
                path: path,
                env: this.currentEnv
            })
        }).then(r => r.json()).then(res => {
            if (res.status === 'success') {
                const dirs = (res.data || []).filter(f => f.is_dir).map(f => ({
                    name: f.name,
                    has_subdirs: f.has_subdirs !== false
                }));
                if (dirs.length > 0) {
                    this.treeCache[path] = dirs;
                }
                callback(dirs);
            } else {
                callback([]);
            }
        }).catch(() => callback([]));
    },

    renderTreeChildren(containerSuffix, parentPath, dirs) {
        const wrap = document.getElementById(`fm-tree-children-${containerSuffix}`);
        if (!wrap) return;
        
        if (!dirs || dirs.length === 0) {
            if (parentPath === '/') {
                wrap.innerHTML = `<div style="padding: 3px 8px; color: var(--text-muted, #64748b); font-size: 11px; font-style: italic;">(Thư mục trống)</div>`;
            } else {
                wrap.innerHTML = '';
                wrap.style.display = 'none';
                const parentItem = wrap.closest('.fm-tree-item');
                if (parentItem) {
                    const toggle = parentItem.querySelector('.fm-tree-toggle');
                    if (toggle) toggle.style.visibility = 'hidden';
                    const icon = parentItem.querySelector('.fm-tree-icon');
                    if (icon) icon.innerText = '📁';
                }
            }
            return;
        }

        const parentItem = wrap.closest('.fm-tree-item');
        if (parentItem) {
            const toggle = parentItem.querySelector('.fm-tree-toggle');
            if (toggle) toggle.style.visibility = 'visible';
        }
        
        dirs.sort((a, b) => {
            const nameA = typeof a === 'object' ? a.name : a;
            const nameB = typeof b === 'object' ? b.name : b;
            return nameA.localeCompare(nameB);
        });
        
        let html = '';
        dirs.forEach(item => {
            const dirName = typeof item === 'object' ? item.name : item;
            const hasSubdirs = typeof item === 'object' ? item.has_subdirs : true;
            const fullPath = (parentPath === '/' ? '' : parentPath) + '/' + dirName;
            const safeId = 'tree-' + fullPath.replace(/[^a-zA-Z0-9_-]/g, '_');
            const isActive = this.currentPath === fullPath;
            
            const toggleVisibility = hasSubdirs ? 'style="visibility: visible;"' : 'style="visibility: hidden;"';
            const toggleAction = hasSubdirs ? `FileManager.toggleTreeNode('${this.escapeHtml(fullPath)}', this, event)` : 'event.stopPropagation()';
            
            html += `
                <div class="fm-tree-item" id="${safeId}">
                    <div class="fm-tree-node ${isActive ? 'active' : ''}" data-path="${this.escapeHtml(fullPath)}" onclick="FileManager.selectTreeNode('${this.escapeHtml(fullPath)}', this)">
                        <span class="fm-tree-toggle" ${toggleVisibility} onclick="${toggleAction}">▶</span>
                        <span class="fm-tree-icon">📁</span>
                        <span class="fm-tree-label" title="${this.escapeHtml(dirName)}">${this.escapeHtml(dirName)}</span>
                    </div>
                    <div id="fm-tree-children-${safeId}" class="fm-tree-children" style="padding-left: 12px; display: none;"></div>
                </div>
            `;
        });
        
        wrap.innerHTML = html;
        this.highlightActiveTreeNode();
    },

    toggleTreeNode(path, el, event) {
        if (event) event.stopPropagation();
        const safeId = path === '/' ? 'root' : ('tree-' + path.replace(/[^a-zA-Z0-9_-]/g, '_'));
        const childrenWrap = document.getElementById(`fm-tree-children-${safeId}`);
        if (!childrenWrap) return;
        
        const isHidden = childrenWrap.style.display === 'none';
        if (isHidden) {
            childrenWrap.style.display = 'block';
            el.innerText = '▼';
            const icon = el.nextElementSibling;
            if (icon && icon.classList.contains('fm-tree-icon')) icon.innerText = '📂';
            
            if (!childrenWrap.dataset.loaded) {
                childrenWrap.innerHTML = `<div style="padding: 4px 8px; color: var(--text-muted, #888); font-size: 11px;">Đang tải...</div>`;
                this.fetchTreeDirs(path, (dirs) => {
                    childrenWrap.dataset.loaded = 'true';
                    if (dirs.length === 0) {
                        el.style.visibility = 'hidden';
                        if (icon && icon.classList.contains('fm-tree-icon')) icon.innerText = '📁';
                        childrenWrap.innerHTML = '';
                        childrenWrap.style.display = 'none';
                    } else {
                        this.renderTreeChildren(safeId, path, dirs);
                    }
                });
            }
        } else {
            childrenWrap.style.display = 'none';
            el.innerText = '▶';
            const icon = el.nextElementSibling;
            if (icon && icon.classList.contains('fm-tree-icon')) icon.innerText = '📁';
        }
    },

    selectTreeNode(path, nodeEl) {
        this.navigateTo(path);
    },

    highlightActiveTreeNode() {
        document.querySelectorAll('.fm-tree-node').forEach(n => {
            if (n.dataset.path === this.currentPath) {
                n.classList.add('active');
            } else {
                n.classList.remove('active');
            }
        });
    },

    loadCurrentPath() {
        const tbody = document.getElementById('fm-file-list');
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--muted);">Đang tải danh sách file...</td></tr>`;
        this.updateBreadcrumb();
        this.highlightActiveTreeNode();
        
        fetch('api.php?action=fmList', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('detail-project-name')?.innerText,
                category: App.currentCategory,
                path: this.currentPath,
                env: this.currentEnv
            })
        }).then(res => res.json()).then(res => {
            if (res.status === 'success') {
                this.baseUrl = res.baseUrl || '';
                this.rawFiles = res.data || [];
                
                // Directly sync directories to treeCache and update the tree node
                const dirs = (this.rawFiles || []).filter(f => f.is_dir).map(f => ({
                    name: f.name,
                    has_subdirs: f.has_subdirs !== false
                }));
                this.treeCache[this.currentPath] = dirs;
                
                const containerSuffix = this.currentPath === '/' ? 'root' : ('tree-' + this.currentPath.replace(/[^a-zA-Z0-9_-]/g, '_'));
                const wrap = document.getElementById(`fm-tree-children-${containerSuffix}`);
                if (wrap) {
                    wrap.dataset.loaded = 'true';
                    this.renderTreeChildren(containerSuffix, this.currentPath, dirs);
                }

                const searchInput = document.getElementById('fm-search-input');
                if (searchInput && searchInput.value) {
                    this.filterList(searchInput.value);
                } else {
                    this.renderList(this.rawFiles);
                }
            } else {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--danger);">${res.message || 'Lỗi tải danh sách file'}</td></tr>`;
            }
        }).catch(err => {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--danger);">Lỗi kết nối</td></tr>`;
        });
    },

    updateBreadcrumb() {
        const wrap = document.getElementById('fm-breadcrumb');
        let html = `<span style="cursor:pointer; color:var(--primary);" onclick="FileManager.navigateTo('/')">/ root</span>`;
        
        let parts = this.currentPath.split('/').filter(p => p.trim() !== '');
        let accumPath = '';
        
        parts.forEach(part => {
            accumPath += '/' + part;
            html += ` <span style="color:var(--muted);">/</span> <span style="cursor:pointer; color:var(--primary);" onclick="FileManager.navigateTo('${accumPath}')">${part}</span>`;
        });
        
        wrap.innerHTML = html;
    },

    navigateTo(path) {
        this.currentPath = path;
        if (!this.currentPath.startsWith('/')) this.currentPath = '/' + this.currentPath;
        const searchInput = document.getElementById('fm-search-input');
        if (searchInput) searchInput.value = '';
        this.highlightActiveTreeNode();
        this.loadCurrentPath();
    },

    filterList(query) {
        if (!query || !query.trim()) {
            this.renderList(this.rawFiles);
            return;
        }
        const q = query.toLowerCase().trim();
        const filtered = (this.rawFiles || []).filter(f => f.name.toLowerCase().includes(q));
        this.renderList(filtered);
    },

    formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    },

    isEditable(filename) {
        const lower = filename.toLowerCase();
        if (lower.startsWith('.') || lower.includes('htaccess') || lower.includes('env')) return true;
        const ext = lower.split('.').pop();
        const textExts = [
            'php', 'html', 'htm', 'css', 'scss', 'less', 'js', 'json', 'txt', 'md', 
            'env', 'htaccess', 'sql', 'xml', 'yml', 'yaml', 'ini', 'conf', 'config',
            'svg', 'sh', 'bat', 'log', 'lock', 'blade', 'phtml'
        ];
        return textExts.includes(ext);
    },

    isImage(filename) {
        const ext = filename.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'avif', 'bmp'].includes(ext);
    },

    getFileMeta(filename, isDir) {
        if (isDir) {
            return {
                badge: '<span style="font-size: 1.25rem;">📁</span>',
                nameColor: 'var(--primary, #00d2d3)',
                isDir: true
            };
        }
        
        const lower = filename.toLowerCase();
        const ext = lower.split('.').pop();
        
        const makeBadge = (label, bg, color, border) => `
            <span style="display:inline-flex; align-items:center; justify-content:center; width:34px; height:22px; border-radius:5px; background:${bg}; color:${color}; border:1px solid ${border}; font-size:10px; font-weight:800; font-family:var(--mono, monospace); letter-spacing:0.5px;">${label}</span>
        `;
        
        if (lower.endsWith('.blade.php') || ext === 'php') {
            return {
                badge: makeBadge('PHP', 'rgba(99,102,241,0.15)', '#818cf8', 'rgba(129,140,248,0.3)'),
                nameColor: '#c7d2fe'
            };
        }
        if (['js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs'].includes(ext)) {
            return {
                badge: makeBadge('JS', 'rgba(245,158,11,0.15)', '#fbbf24', 'rgba(251,191,36,0.3)'),
                nameColor: '#fef08a'
            };
        }
        if (['css', 'scss', 'sass', 'less'].includes(ext)) {
            return {
                badge: makeBadge('CSS', 'rgba(14,165,233,0.15)', '#38bdf8', 'rgba(56,189,248,0.3)'),
                nameColor: '#bae6fd'
            };
        }
        if (['html', 'htm', 'phtml'].includes(ext)) {
            return {
                badge: makeBadge('HTML', 'rgba(249,115,22,0.15)', '#fb923c', 'rgba(251,146,60,0.3)'),
                nameColor: '#fed7aa'
            };
        }
        if (['json', 'lock', 'env', 'config', 'ini', 'yml', 'yaml'].includes(ext) || lower.startsWith('.env') || lower.includes('htaccess')) {
            const label = lower.includes('htaccess') ? 'HTA' : (lower.startsWith('.env') ? 'ENV' : ext.toUpperCase().slice(0, 4));
            return {
                badge: makeBadge(label, 'rgba(16,185,129,0.15)', '#34d399', 'rgba(52,211,153,0.3)'),
                nameColor: '#a7f3d0'
            };
        }
        if (['sql', 'db', 'sqlite', 'dat'].includes(ext)) {
            return {
                badge: makeBadge('SQL', 'rgba(234,179,8,0.15)', '#fde047', 'rgba(253,224,71,0.3)'),
                nameColor: '#fef9c3'
            };
        }
        if (['md', 'txt', 'log', 'pdf', 'doc', 'docx'].includes(ext)) {
            return {
                badge: makeBadge(ext.toUpperCase().slice(0, 3), 'rgba(168,85,247,0.15)', '#c084fc', 'rgba(192,132,252,0.3)'),
                nameColor: '#e9d5ff'
            };
        }
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
            return {
                badge: makeBadge('ZIP', 'rgba(239,68,68,0.15)', '#f87171', 'rgba(248,113,113,0.3)'),
                nameColor: '#fecaca'
            };
        }
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'avif'].includes(ext)) {
            return {
                badge: makeBadge('IMG', 'rgba(236,72,153,0.15)', '#f472b6', 'rgba(244,114,182,0.3)'),
                nameColor: '#fbcfe8'
            };
        }
        
        return {
            badge: makeBadge('FILE', 'rgba(255,255,255,0.06)', '#94a3b8', 'rgba(255,255,255,0.12)'),
            nameColor: '#dfe6e9'
        };
    },

    formatDate(dateStr) {
        if (!dateStr || dateStr === '-') return '-';
        if (dateStr.includes('/')) return dateStr;
        
        const months = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
            'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
        };
        
        const parts = dateStr.trim().split(/\s+/);
        if (parts.length === 3) {
            const m = months[parts[0].toLowerCase()];
            if (m) {
                const day = parts[1].padStart(2, '0');
                if (parts[2].includes(':')) {
                    const currentYear = new Date().getFullYear();
                    return `${day}/${m}/${currentYear} ${parts[2]}`;
                } else {
                    return `${day}/${m}/${parts[2]}`;
                }
            }
        }
        return dateStr;
    },

    ensureSelectionStyles() {
        if (document.getElementById('fm-selection-styles')) return;
        const style = document.createElement('style');
        style.id = 'fm-selection-styles';
        style.textContent = `
            .fm-row-item {
                user-select: none;
                -webkit-user-select: none;
            }
            .fm-row-selected {
                background: rgba(0, 210, 211, 0.12) !important;
                border-left: 3px solid var(--primary, #00d2d3) !important;
            }
            #fm-marquee-box {
                position: absolute;
                border: 1px dashed var(--primary, #00d2d3);
                background: rgba(0, 210, 211, 0.15);
                pointer-events: none;
                z-index: 999;
                border-radius: 4px;
                display: none;
            }
            #fm-context-menu {
                position: fixed;
                z-index: 1000020;
                background: #141923;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 10px;
                box-shadow: 0 16px 40px rgba(0, 0, 0, 0.75), 0 0 20px rgba(0, 0, 0, 0.5);
                padding: 6px;
                min-width: 220px;
                display: none;
                backdrop-filter: blur(12px);
                animation: modalIn 0.12s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .fm-ctx-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 7px 12px;
                font-size: 12.5px;
                font-weight: 500;
                color: #e2e8f0;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s ease;
                gap: 10px;
                user-select: none;
            }
            .fm-ctx-item:hover {
                background: rgba(255, 255, 255, 0.08);
                color: #fff;
            }
            .fm-ctx-item.fm-ctx-danger {
                color: #ff7675;
            }
            .fm-ctx-item.fm-ctx-danger:hover {
                background: rgba(255, 118, 117, 0.15);
                color: #ff7675;
            }
            .fm-ctx-divider {
                height: 1px;
                background: rgba(255, 255, 255, 0.08);
                margin: 4px 6px;
            }
            .fm-ctx-key {
                font-size: 10.5px;
                font-family: var(--mono, monospace);
                color: #64748b;
                background: rgba(255, 255, 255, 0.05);
                padding: 1px 6px;
                border-radius: 4px;
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
        `;
        document.head.appendChild(style);
    },

    renderList(files) {
        const tbody = document.getElementById('fm-file-list');
        this.currentRenderedFiles = files || [];
        
        if (!files || files.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--muted);">Thư mục trống</td></tr>`;
            this.updateSelectionUI();
            return;
        }

        // Sort: folders first, then files by name
        files.sort((a, b) => {
            if (a.is_dir && !b.is_dir) return -1;
            if (!a.is_dir && b.is_dir) return 1;
            return a.name.localeCompare(b.name);
        });

        let html = '';
        files.forEach((f, idx) => {
            const meta = this.getFileMeta(f.name, f.is_dir);
            let icon = meta.badge;
            const size = f.is_dir ? '-' : this.formatBytes(f.size);
            const path = (this.currentPath === '/' ? '' : this.currentPath) + '/' + f.name;
            const fileUrl = this.baseUrl ? (this.baseUrl + (this.currentPath === '/' ? '' : this.currentPath) + '/' + encodeURIComponent(f.name)) : '';
            const displayDate = this.formatDate(f.date);
            const isSelected = this.selectedItems.has(path);
            
            let actions = '';
            const btnStyle = "padding: 4px 10px; font-size: 11.5px; border-radius: 6px; font-weight: 500; transition: all 0.2s ease; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03);";
            
            if (f.is_dir) {
                actions = `
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); FileManager.navigateTo('${path}')" title="Mở" style="${btnStyle} color: #74b9ff;" onmouseover="this.style.background='rgba(116,185,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">📂 Mở</button>
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); FileManager.deleteItem('${path}', true)" title="Xóa" style="${btnStyle} color: #ff7675;" onmouseover="this.style.background='rgba(255,118,117,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">🗑️ Xóa</button>
                `;
            } else {
                if (this.isImage(f.name) && fileUrl) {
                    icon = `<img src="${fileUrl}" style="width:32px; height:32px; object-fit:cover; border-radius:5px; border:1px solid rgba(255,255,255,0.15); cursor:pointer; vertical-align:middle; display:inline-block; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='none'" onclick="event.stopPropagation(); FileManager.previewImage('${fileUrl}', '${this.escapeHtml(f.name)}')" onerror="this.outerHTML='${meta.badge}'">`;
                    actions += `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); FileManager.previewImage('${fileUrl}', '${this.escapeHtml(f.name)}')" title="Xem ảnh" style="${btnStyle} color: #00cec9;" onmouseover="this.style.background='rgba(0,206,201,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">👁️ Xem</button>`;
                }
                if (this.isEditable(f.name)) {
                    actions += `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); FileManager.editFile('${path}')" title="Sửa nhanh" style="${btnStyle} color: #a29bfe;" onmouseover="this.style.background='rgba(162,155,254,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">📝 Sửa</button>`;
                    actions += `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); FileManager.openInEditor('${path}')" title="Mở trong Antigravity IDE" style="${btnStyle} color: #ffeaa7;" onmouseover="this.style.background='rgba(255,234,167,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">⚡ IDE</button>`;
                }
                actions += `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); FileManager.deleteItem('${path}', false)" title="Xóa" style="${btnStyle} color: #ff7675;" onmouseover="this.style.background='rgba(255,118,117,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">🗑️ Xóa</button>`;
            }

            html += `
                <tr class="fm-row-item ${isSelected ? 'fm-row-selected' : ''}" 
                    data-fm-path="${path}" 
                    data-fm-is-dir="${f.is_dir ? '1' : '0'}" 
                    data-fm-name="${this.escapeHtml(f.name)}" 
                    data-fm-index="${idx}"
                    onclick="FileManager.onRowClick(event, '${path}', ${f.is_dir ? 'true' : 'false'}, '${this.escapeHtml(f.name)}', ${idx})"
                    oncontextmenu="FileManager.onRowContextMenu(event, '${path}', ${f.is_dir ? 'true' : 'false'}, '${this.escapeHtml(f.name)}', ${idx}); return false;"
                    style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: all 0.15s ease; cursor: default;" 
                    onmouseover="if(!this.classList.contains('fm-row-selected')) this.style.backgroundColor='rgba(255,255,255,0.03)';" 
                    onmouseout="if(!this.classList.contains('fm-row-selected')) this.style.backgroundColor='transparent';">
                    
                    <td style="padding: 10px 14px; width: 36px; text-align: center; vertical-align: middle;">
                        <input type="checkbox" class="fm-item-checkbox" data-path="${path}" ${isSelected ? 'checked' : ''} onclick="FileManager.onItemCheckboxClick(event, '${path}', ${f.is_dir ? 'true' : 'false'}, '${this.escapeHtml(f.name)}')">
                    </td>
                    <td style="padding: 10px 12px; width: 36px; text-align: center; vertical-align: middle;">${icon}</td>
                    <td style="padding: 10px 14px; font-weight: 500; vertical-align: middle; font-family: var(--mono, monospace); font-size: 13px;">
                        ${f.is_dir ? `<a href="javascript:void(0)" onclick="event.stopPropagation(); FileManager.navigateTo('${path}')" style="color:${meta.nameColor}; text-decoration:none; font-weight:600; transition: opacity 0.15s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">${f.name}</a>` : `<span style="color:${meta.nameColor};">${f.name}</span>`}
                    </td>
                    <td style="padding: 10px 14px; color:#94a3b8; font-size: 0.8rem; vertical-align: middle; font-family: var(--mono, monospace);">${size}</td>
                    <td style="padding: 10px 14px; color:#94a3b8; font-size: 0.8rem; vertical-align: middle; font-family: var(--mono, monospace);">${displayDate}</td>
                    <td style="padding: 10px 14px; text-align: right; white-space: nowrap; vertical-align: middle;">
                        <div style="display: inline-flex; gap: 6px; justify-content: flex-end; align-items: center;">
                            ${actions}
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        this.updateSelectionUI();
    },

    onItemCheckboxClick(event, path, isDir, name) {
        event.stopPropagation();
        if (event.target.checked) {
            this.selectedItems.set(path, { path, isDir, name });
        } else {
            this.selectedItems.delete(path);
        }
        this.updateSelectionUI();
    },

    toggleSelectAll(checked) {
        if (checked) {
            this.currentRenderedFiles.forEach(f => {
                const path = (this.currentPath === '/' ? '' : this.currentPath) + '/' + f.name;
                this.selectedItems.set(path, { path, isDir: f.is_dir, name: f.name });
            });
        } else {
            this.selectedItems.clear();
        }
        this.updateSelectionUI();
    },

    onRowClick(event, path, isDir, name, index) {
        // Skip if clicked on link, button, input, or image preview
        const tag = event.target.tagName.toLowerCase();
        if (['input', 'button', 'a', 'img'].includes(tag) || event.target.closest('button') || event.target.closest('a')) {
            return;
        }

        if (event.ctrlKey || event.metaKey) {
            // Toggle item
            if (this.selectedItems.has(path)) {
                this.selectedItems.delete(path);
            } else {
                this.selectedItems.set(path, { path, isDir, name });
            }
            this.lastClickedIndex = index;
        } else if (event.shiftKey && this.lastClickedIndex !== -1) {
            // Range select
            const start = Math.min(this.lastClickedIndex, index);
            const end = Math.max(this.lastClickedIndex, index);
            for (let i = start; i <= end; i++) {
                const item = this.currentRenderedFiles[i];
                if (item) {
                    const p = (this.currentPath === '/' ? '' : this.currentPath) + '/' + item.name;
                    this.selectedItems.set(p, { path: p, isDir: item.is_dir, name: item.name });
                }
            }
        } else {
            // Single select
            this.selectedItems.clear();
            this.selectedItems.set(path, { path, isDir, name });
            this.lastClickedIndex = index;
        }

        this.updateSelectionUI();
    },

    updateSelectionUI() {
        const selectAllCheckbox = document.getElementById('fm-select-all');
        const count = this.selectedItems.size;
        const total = this.currentRenderedFiles.length;

        if (selectAllCheckbox) {
            selectAllCheckbox.checked = total > 0 && count === total;
            selectAllCheckbox.indeterminate = count > 0 && count < total;
        }

        // Highlight table rows
        document.querySelectorAll('#fm-file-list tr.fm-row-item').forEach(tr => {
            const p = tr.dataset.fmPath;
            const cb = tr.querySelector('.fm-item-checkbox');
            if (this.selectedItems.has(p)) {
                tr.classList.add('fm-row-selected');
                tr.style.backgroundColor = 'rgba(0,210,211,0.12)';
                if (cb) cb.checked = true;
            } else {
                tr.classList.remove('fm-row-selected');
                tr.style.backgroundColor = 'transparent';
                if (cb) cb.checked = false;
            }
        });

        // Update Batch Bar
        const batchBar = document.getElementById('fm-batch-bar');
        const batchCount = document.getElementById('fm-batch-count');
        const batchLabel = document.getElementById('fm-batch-label');

        if (batchBar && batchCount && batchLabel) {
            if (count > 0) {
                let dirCount = 0;
                let fileCount = 0;
                this.selectedItems.forEach(it => {
                    if (it.isDir) dirCount++; else fileCount++;
                });
                batchCount.innerText = count;
                const parts = [];
                if (dirCount > 0) parts.push(`${dirCount} thư mục`);
                if (fileCount > 0) parts.push(`${fileCount} tệp`);
                batchLabel.innerText = `mục đã chọn (${parts.join(', ')})`;
                batchBar.style.display = 'flex';
            } else {
                batchBar.style.display = 'none';
            }
        }
    },

    clearSelection() {
        this.selectedItems.clear();
        this.updateSelectionUI();
    },

    async deleteSelectedItems() {
        const items = Array.from(this.selectedItems.values());
        if (items.length === 0) return;

        let dirCount = 0;
        let fileCount = 0;
        items.forEach(it => { if (it.isDir) dirCount++; else fileCount++; });

        const envLabel = this.currentEnv === 'prod' ? 'Production Server' : 'Demo Server';
        const parts = [];
        if (dirCount > 0) parts.push(`<b>${dirCount} thư mục</b>`);
        if (fileCount > 0) parts.push(`<b>${fileCount} tệp tin</b>`);

        const msg = `Bạn có chắc chắn muốn xóa vĩnh viễn <b style="color:var(--primary);">${items.length} mục đã chọn</b> (${parts.join(', ')}) không?<br><span style="color:var(--danger); font-size:0.85em;">⚠️ Hành động này sẽ xóa trực tiếp trên ${envLabel} và không thể hoàn tác!</span>`;
        const confirmed = (typeof UI !== 'undefined' && UI.confirm) ? await UI.confirm(msg) : confirm(`Bạn có chắc chắn muốn xóa ${items.length} mục đã chọn không?`);
        if (!confirmed) return;

        UI.showLoading(`Đang dọn sạch và xóa ${items.length} mục đã chọn trên máy chủ...`);

        fetch('api.php?action=fmDelete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('detail-project-name')?.innerText,
                category: App.currentCategory,
                env: this.currentEnv,
                items: items
            })
        }).then(res => res.json()).then(res => {
            if (res.status === 'success') {
                UI.showToast(res.message || 'Xóa thành công', 'success');
                this.clearSelection();
                this.loadCurrentPath();
                this.loadTree(true);
            } else {
                UI.showToast('Lỗi: ' + res.message, 'error');
            }
        }).catch(err => {
            UI.showToast('Lỗi kết nối: ' + err.message, 'error');
        }).finally(() => {
            UI.hideLoading();
        });
    },

    async deleteItem(path, isDir) {
        const itemName = path.split('/').pop();
        this.selectedItems.clear();
        this.selectedItems.set(path, { path, isDir, name: itemName });
        this.deleteSelectedItems();
    },

    onRowContextMenu(event, path, isDir, name, index) {
        event.preventDefault();
        event.stopPropagation();
        if (!this.selectedItems.has(path)) {
            this.selectedItems.clear();
            this.selectedItems.set(path, { path, isDir, name });
            this.lastClickedIndex = index;
            this.updateSelectionUI();
        }
        this.showContextMenu(event.clientX, event.clientY);
    },

    initContextMenu() {
        if (document.getElementById('fm-context-menu')) return;
        const menu = document.createElement('div');
        menu.id = 'fm-context-menu';
        document.body.appendChild(menu);

        document.addEventListener('click', () => this.hideContextMenu());
        window.addEventListener('blur', () => this.hideContextMenu());
        window.addEventListener('resize', () => this.hideContextMenu());
    },

    showContextMenu(x, y) {
        const menu = document.getElementById('fm-context-menu');
        if (!menu) return;

        const count = this.selectedItems.size;
        let html = '';

        if (count === 1) {
            const firstItem = Array.from(this.selectedItems.values())[0];
            if (firstItem.isDir) {
                html += `<div class="fm-ctx-item" onclick="FileManager.navigateTo('${firstItem.path}')"><span>📂 Mở thư mục</span></div>`;
            } else {
                if (this.isImage(firstItem.name) && this.baseUrl) {
                    const imgUrl = this.baseUrl + (firstItem.path.startsWith('/') ? '' : '/') + encodeURIComponent(firstItem.name);
                    html += `<div class="fm-ctx-item" onclick="FileManager.previewImage('${imgUrl}', '${this.escapeHtml(firstItem.name)}')"><span>👁️ Xem ảnh</span></div>`;
                }
                if (this.isEditable(firstItem.name)) {
                    html += `<div class="fm-ctx-item" onclick="FileManager.editFile('${firstItem.path}')"><span>📝 Sửa nhanh</span></div>`;
                    html += `<div class="fm-ctx-item" onclick="FileManager.openInEditor('${firstItem.path}')"><span>⚡ Mở Antigravity IDE</span></div>`;
                }
            }
            html += `<div class="fm-ctx-item fm-ctx-danger" onclick="FileManager.deleteSelectedItems()"><span>🗑️ Xóa</span><span class="fm-ctx-key">Del</span></div>`;
            html += `<div class="fm-ctx-divider"></div>`;
        } else if (count > 1) {
            html += `<div class="fm-ctx-item fm-ctx-danger" onclick="FileManager.deleteSelectedItems()"><span>🗑️ Xóa ${count} mục đã chọn</span><span class="fm-ctx-key">Del</span></div>`;
            html += `<div class="fm-ctx-divider"></div>`;
        }

        html += `
            <div class="fm-ctx-item" onclick="FileManager.showCreateDirModal()"><span>📁 Tạo thư mục mới</span></div>
            <div class="fm-ctx-item" onclick="FileManager.triggerUploadFiles()"><span>☁️ Tải lên tệp tin</span></div>
            <div class="fm-ctx-item" onclick="FileManager.triggerUploadFolder()"><span>📁 Tải lên cả thư mục</span></div>
            <div class="fm-ctx-divider"></div>
            <div class="fm-ctx-item" onclick="FileManager.loadCurrentPath(); FileManager.loadTree(true);"><span>🔄 Làm mới</span><span class="fm-ctx-key">F5</span></div>
        `;

        menu.innerHTML = html;
        menu.style.display = 'block';

        // Position with bounds check
        const menuWidth = 230;
        const menuHeight = menu.offsetHeight || 220;
        const posX = (x + menuWidth > window.innerWidth) ? (window.innerWidth - menuWidth - 10) : x;
        const posY = (y + menuHeight > window.innerHeight) ? (window.innerHeight - menuHeight - 10) : y;

        menu.style.left = `${posX}px`;
        menu.style.top = `${posY}px`;
    },

    hideContextMenu() {
        const menu = document.getElementById('fm-context-menu');
        if (menu) menu.style.display = 'none';
    },

    initMarqueeSelection() {
        const container = document.querySelector('.fm-list-container');
        if (!container || container.dataset.marqueeInit === 'true') return;
        container.dataset.marqueeInit = 'true';

        let marqueeBox = document.getElementById('fm-marquee-box');
        if (!marqueeBox) {
            marqueeBox = document.createElement('div');
            marqueeBox.id = 'fm-marquee-box';
            container.appendChild(marqueeBox);
        }

        let isDragging = false;
        let startX = 0, startY = 0;

        container.addEventListener('mousedown', e => {
            // Only left click on empty background
            if (e.button !== 0) return;
            const tag = e.target.tagName.toLowerCase();
            if (['input', 'button', 'a', 'img'].includes(tag) || e.target.closest('button') || e.target.closest('a')) {
                return;
            }

            const rect = container.getBoundingClientRect();
            startX = e.clientX - rect.left + container.scrollLeft;
            startY = e.clientY - rect.top + container.scrollTop;

            isDragging = true;
            marqueeBox.style.left = `${startX}px`;
            marqueeBox.style.top = `${startY}px`;
            marqueeBox.style.width = '0px';
            marqueeBox.style.height = '0px';
            marqueeBox.style.display = 'block';

            if (!e.ctrlKey && !e.metaKey && !e.target.closest('tr.fm-row-item')) {
                this.clearSelection();
            }
        });

        window.addEventListener('mousemove', e => {
            if (!isDragging) return;
            const rect = container.getBoundingClientRect();
            const currentX = e.clientX - rect.left + container.scrollLeft;
            const currentY = e.clientY - rect.top + container.scrollTop;

            const x = Math.min(startX, currentX);
            const y = Math.min(startY, currentY);
            const w = Math.abs(currentX - startX);
            const h = Math.abs(currentY - startY);

            marqueeBox.style.left = `${x}px`;
            marqueeBox.style.top = `${y}px`;
            marqueeBox.style.width = `${w}px`;
            marqueeBox.style.height = `${h}px`;

            // Hit test rows
            const marqueeRect = marqueeBox.getBoundingClientRect();
            document.querySelectorAll('#fm-file-list tr.fm-row-item').forEach(tr => {
                const trRect = tr.getBoundingClientRect();
                const intersect = !(trRect.right < marqueeRect.left || 
                                    trRect.left > marqueeRect.right || 
                                    trRect.bottom < marqueeRect.top || 
                                    trRect.top > marqueeRect.bottom);
                const path = tr.dataset.fmPath;
                const isDir = tr.dataset.fmIsDir === '1';
                const name = tr.dataset.fmName;

                if (intersect) {
                    this.selectedItems.set(path, { path, isDir, name });
                }
            });

            this.updateSelectionUI();
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                marqueeBox.style.display = 'none';
            }
        });

        // Context menu on empty area
        container.addEventListener('contextmenu', e => {
            if (!e.target.closest('tr.fm-row-item')) {
                e.preventDefault();
                this.showContextMenu(e.clientX, e.clientY);
            }
        });
    },

    initKeyBindings() {
        if (window.fmKeysBound) return;
        window.fmKeysBound = true;

        window.addEventListener('keydown', e => {
            const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            if (['input', 'textarea'].includes(activeTag)) return;

            if (e.key === 'Delete' || e.key === 'Del') {
                if (this.selectedItems.size > 0) {
                    e.preventDefault();
                    this.deleteSelectedItems();
                }
            } else if (e.key === 'Escape') {
                this.hideContextMenu();
                this.clearSelection();
            }
        });
    },

    showCreateDirModal() {
        const name = prompt('Nhập tên thư mục mới:');
        if (!name) return;
        
        const path = (this.currentPath === '/' ? '' : this.currentPath) + '/' + name;
        UI.showLoading(`Đang tạo thư mục "${name}"...`);
        
        fetch('api.php?action=fmCreateDir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('detail-project-name')?.innerText,
                category: App.currentCategory,
                path: path,
                env: this.currentEnv
            })
        }).then(res => res.json()).then(res => {
            if (res.status === 'success') {
                UI.showToast('Tạo thư mục thành công', 'success');
                this.loadCurrentPath();
            } else {
                UI.showToast('Lỗi: ' + (res.message || 'Không thể tạo thư mục'), 'error');
            }
        }).catch(err => {
            UI.showToast('Lỗi kết nối: ' + err.message, 'error');
        }).finally(() => {
            UI.hideLoading();
        });
    },

    showUploadModal() {
        let existing = document.getElementById('fm-upload-dialog-modal');
        if (existing) existing.remove();

        const currentPathDisplay = this.currentPath === '/' ? '/' : this.currentPath;
        const envLabel = this.currentEnv === 'prod' ? 'Production Server' : 'Demo Server';

        const modalHtml = `
            <div class="modal-overlay" id="fm-upload-dialog-modal" style="display:flex; z-index:9999; background:rgba(6,9,15,0.78); backdrop-filter:blur(8px); animation:modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);" onclick="if(event.target===this) this.remove()">
                <div class="modal-content" style="max-width: 540px; width: 92%; background: #131822; border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; box-shadow: 0 24px 60px rgba(0,0,0,0.75); overflow: hidden; display: flex; flex-direction: column;">
                    
                    <!-- Header -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 22px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.08);">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(0,210,211,0.12); display: flex; align-items: center; justify-content: center; font-size: 16px;">☁️</div>
                            <div>
                                <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #f8fafc;">Tải lên Máy chủ</h3>
                                <span style="font-size: 11.5px; color: #94a3b8;">Đích: <code style="color:var(--primary, #00d2d3); background:rgba(0,210,211,0.08); padding:1px 6px; border-radius:4px;">${this.escapeHtml(currentPathDisplay)}</code> (${envLabel})</span>
                            </div>
                        </div>
                        <button type="button" onclick="document.getElementById('fm-upload-dialog-modal').remove()" style="background:none; border:none; color:#71717a; font-size:22px; cursor:pointer; padding:2px 8px; border-radius:6px; transition:all 0.15s;" onmouseover="this.style.color='#fff'; this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.color='#71717a'; this.style.background='none'">×</button>
                    </div>

                    <!-- Body -->
                    <div style="padding: 22px; display: flex; flex-direction: column; gap: 14px;">
                        <p style="margin: 0; font-size: 12.5px; color: #94a3b8;">Vui lòng chọn hình thức bạn muốn tải lên:</p>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                            <!-- Card 1: Upload Files -->
                            <div onclick="FileManager.triggerUploadFiles()" style="cursor: pointer; padding: 20px 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; text-align: center; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; align-items: center; gap: 10px;" onmouseover="this.style.borderColor='var(--primary, #00d2d3)'; this.style.background='rgba(0,210,211,0.06)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.background='rgba(255,255,255,0.03)'; this.style.transform='none'">
                                <div style="width: 46px; height: 46px; border-radius: 12px; background: rgba(0,210,211,0.12); display: flex; align-items: center; justify-content: center; font-size: 24px; color: #00d2d3;">📄</div>
                                <div>
                                    <div style="font-size: 14px; font-weight: 700; color: #f1f5f9; margin-bottom: 4px;">Tải lên Tệp tin</div>
                                    <div style="font-size: 11.5px; color: #94a3b8; line-height: 1.4;">Chọn 1 hoặc nhiều file từ máy tính</div>
                                </div>
                                <span style="font-size: 11px; padding: 4px 10px; border-radius: 6px; background: rgba(0,210,211,0.15); color: #00d2d3; font-weight: 600;">Chọn Files ▾</span>
                            </div>

                            <!-- Card 2: Upload Folder -->
                            <div onclick="FileManager.triggerUploadFolder()" style="cursor: pointer; padding: 20px 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; text-align: center; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; align-items: center; gap: 10px;" onmouseover="this.style.borderColor='#a29bfe'; this.style.background='rgba(162,155,254,0.08)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.background='rgba(255,255,255,0.03)'; this.style.transform='none'">
                                <div style="width: 46px; height: 46px; border-radius: 12px; background: rgba(162,155,254,0.15); display: flex; align-items: center; justify-content: center; font-size: 24px; color: #a29bfe;">📁</div>
                                <div>
                                    <div style="font-size: 14px; font-weight: 700; color: #f1f5f9; margin-bottom: 4px;">Tải lên Cả Thư mục</div>
                                    <div style="font-size: 11.5px; color: #94a3b8; line-height: 1.4;">Tải toàn bộ folder & cây thư mục con</div>
                                </div>
                                <span style="font-size: 11px; padding: 4px 10px; border-radius: 6px; background: rgba(162,155,254,0.2); color: #c7d2fe; font-weight: 600;">Chọn Thư mục ▾</span>
                            </div>
                        </div>

                        <!-- Drag and drop zone -->
                        <div id="fm-modal-dropzone" style="border: 2px dashed rgba(255,255,255,0.15); border-radius: 12px; padding: 18px 14px; text-align: center; color: #94a3b8; font-size: 12px; transition: all 0.2s ease; background: rgba(0,0,0,0.15);">
                            💡 Hoặc kéo & thả file / thư mục vào đây để bắt đầu tải lên ngay
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Bind drag & drop in modal
        const dropzone = document.getElementById('fm-modal-dropzone');
        if (dropzone) {
            dropzone.ondragover = e => { e.preventDefault(); dropzone.style.borderColor = 'var(--primary, #00d2d3)'; dropzone.style.background = 'rgba(0,210,211,0.08)'; };
            dropzone.ondragleave = () => { dropzone.style.borderColor = 'rgba(255,255,255,0.15)'; dropzone.style.background = 'rgba(0,0,0,0.15)'; };
            dropzone.ondrop = async e => {
                e.preventDefault();
                dropzone.style.borderColor = 'rgba(255,255,255,0.15)';
                dropzone.style.background = 'rgba(0,0,0,0.15)';
                const modal = document.getElementById('fm-upload-dialog-modal');
                if (modal) modal.remove();

                const files = await FileManager.extractFilesFromDataTransfer(e.dataTransfer);
                if (files && files.length > 0) {
                    FileManager.uploadFilesQueue(files, true);
                }
            };
        }
    },

    triggerUploadFiles() {
        const modal = document.getElementById('fm-upload-dialog-modal');
        if (modal) modal.remove();

        let input = document.getElementById('fm-hidden-input-files');
        if (!input) {
            input = document.createElement('input');
            input.id = 'fm-hidden-input-files';
            input.type = 'file';
            input.multiple = true;
            input.style.display = 'none';
            document.body.appendChild(input);
        }
        input.value = '';
        input.onchange = e => {
            if (e.target.files && e.target.files.length > 0) {
                this.uploadFilesQueue(e.target.files, false);
            }
        };
        input.click();
    },

    triggerUploadFolder() {
        const modal = document.getElementById('fm-upload-dialog-modal');
        if (modal) modal.remove();

        let input = document.getElementById('fm-hidden-input-folder');
        if (!input) {
            input = document.createElement('input');
            input.id = 'fm-hidden-input-folder';
            input.type = 'file';
            input.webkitdirectory = true;
            input.directory = true;
            input.multiple = true;
            input.style.display = 'none';
            document.body.appendChild(input);
        }
        input.value = '';
        input.onchange = e => {
            if (e.target.files && e.target.files.length > 0) {
                this.uploadFilesQueue(e.target.files, true);
            }
        };
        input.click();
    },

    async extractFilesFromDataTransfer(dataTransfer) {
        const fileList = [];
        if (!dataTransfer || !dataTransfer.items) return fileList;

        const items = dataTransfer.items;
        const queue = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                if (entry) {
                    queue.push(entry);
                } else {
                    const f = item.getAsFile();
                    if (f) fileList.push(f);
                }
            }
        }

        const readEntry = (entry, path = '') => {
            return new Promise((resolve) => {
                if (entry.isFile) {
                    entry.file(f => {
                        try {
                            Object.defineProperty(f, 'webkitRelativePath', {
                                value: (path ? path + '/' : '') + f.name,
                                writable: true
                            });
                        } catch (err) {}
                        fileList.push(f);
                        resolve();
                    }, () => resolve());
                } else if (entry.isDirectory) {
                    const dirReader = entry.createReader();
                    const readAll = () => {
                        dirReader.readEntries(async entries => {
                            if (entries.length === 0) {
                                resolve();
                            } else {
                                for (const child of entries) {
                                    await readEntry(child, (path ? path + '/' : '') + entry.name);
                                }
                                readAll();
                            }
                        }, () => resolve());
                    };
                    readAll();
                } else {
                    resolve();
                }
            });
        };

        while (queue.length > 0) {
            const entry = queue.shift();
            await readEntry(entry);
        }

        return fileList;
    },

    async uploadFilesQueue(filesList, isFolder = false) {
        if (!filesList || filesList.length === 0) return;

        const files = Array.from(filesList);
        const totalCount = files.length;
        let successCount = 0;
        let failCount = 0;

        const rootTarget = this.currentPath === '/' ? '' : this.currentPath;
        const uploadTitle = isFolder ? 'Đang tải lên Thư mục' : 'Đang tải lên Tệp tin';

        this.showUploadProgressModal(uploadTitle, totalCount);

        for (let i = 0; i < totalCount; i++) {
            const file = files[i];
            const relPath = file.webkitRelativePath ? file.webkitRelativePath : file.name;
            const targetFilePath = rootTarget + '/' + relPath;

            const percent = Math.round((i / totalCount) * 100);
            this.updateUploadProgressModal(i + 1, totalCount, relPath, percent);

            const formData = new FormData();
            formData.append('name', document.getElementById('detail-project-name')?.innerText);
            formData.append('category', App.currentCategory);
            formData.append('path', targetFilePath);
            formData.append('file', file);
            formData.append('env', this.currentEnv);

            try {
                const res = await fetch('api.php?action=fmUpload', {
                    method: 'POST',
                    body: formData
                }).then(r => r.json());

                if (res.status === 'success') {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                failCount++;
            }
        }

        this.hideUploadProgressModal();

        if (failCount === 0) {
            UI.showToast(`✅ Đã tải lên thành công toàn bộ ${successCount} tệp tin!`, 'success');
        } else {
            UI.showToast(`Đã tải lên ${successCount}/${totalCount} tệp (${failCount} tệp lỗi)`, 'warning');
        }

        this.loadCurrentPath();
        this.loadTree(true);
    },

    showUploadProgressModal(title, total) {
        let existing = document.getElementById('fm-upload-progress-modal');
        if (existing) existing.remove();

        const html = `
            <div class="modal-overlay" id="fm-upload-progress-modal" style="display:flex; z-index:1000002; background:rgba(6,9,15,0.85); backdrop-filter:blur(10px);">
                <div style="background:linear-gradient(145deg, #151b26, #0d1118); border:1px solid rgba(0,210,211,0.25); padding:26px 32px; border-radius:18px; box-shadow:0 24px 60px rgba(0,0,0,0.8), 0 0 35px rgba(0,210,211,0.12); width:440px; max-width:92%; display:flex; flex-direction:column; gap:16px;">
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:34px; height:34px; border-radius:8px; background:rgba(0,210,211,0.15); display:flex; align-items:center; justify-content:center; color:#00d2d3; font-size:16px;">☁️</div>
                            <div>
                                <div style="font-size:14px; font-weight:700; color:#f8fafc;" id="fm-prog-title">${this.escapeHtml(title)}</div>
                                <div style="font-size:11.5px; color:#94a3b8;" id="fm-prog-counter">Chuẩn bị tải lên ${total} tệp...</div>
                            </div>
                        </div>
                        <span id="fm-prog-percent" style="font-size:16px; font-weight:800; color:var(--primary, #00d2d3); font-family:var(--mono, monospace);">0%</span>
                    </div>

                    <!-- Progress Bar Track -->
                    <div style="width:100%; height:8px; background:rgba(255,255,255,0.08); border-radius:6px; overflow:hidden; position:relative;">
                        <div id="fm-prog-bar" style="height:100%; width:0%; background:linear-gradient(90deg, #00d2d3, #0984e3); border-radius:6px; transition:width 0.15s ease;"></div>
                    </div>

                    <!-- Current file label -->
                    <div id="fm-prog-file" style="font-size:11.5px; color:#cbd5e1; font-family:var(--mono, monospace); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; background:rgba(255,255,255,0.03); padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.06);">
                        Đang khởi động...
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    updateUploadProgressModal(current, total, fileName, percent) {
        const counter = document.getElementById('fm-prog-counter');
        const percentEl = document.getElementById('fm-prog-percent');
        const bar = document.getElementById('fm-prog-bar');
        const fileEl = document.getElementById('fm-prog-file');

        if (counter) counter.innerText = `Đang tải: ${current} / ${total} tệp`;
        if (percentEl) percentEl.innerText = `${percent}%`;
        if (bar) bar.style.width = `${percent}%`;
        if (fileEl) fileEl.innerText = `📄 ${fileName}`;
    },

    hideUploadProgressModal() {
        const modal = document.getElementById('fm-upload-progress-modal');
        if (modal) modal.remove();
    },

    editFile(path) {
        const fileName = path.split('/').pop();
        UI.showLoading(`Đang tải nội dung file "${fileName}"...`);
        fetch('api.php?action=fmGet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('detail-project-name')?.innerText,
                category: App.currentCategory,
                path: path,
                env: this.currentEnv
            })
        }).then(res => res.json()).then(res => {
            if (res.status === 'success') {
                this.showEditorModal(path, res.content);
            } else {
                UI.showToast('Lỗi: ' + res.message, 'error');
            }
        }).catch(err => {
            UI.showToast('Lỗi kết nối: ' + err.message, 'error');
        }).finally(() => {
            UI.hideLoading();
        });
    },

    showEditorModal(path, content) {
        // Remove existing if any
        let existing = document.getElementById('fm-editor-modal');
        if (existing) existing.remove();
        this.lastFindIndex = -1;
        
        const modalHtml = `
            <div class="modal-overlay" id="fm-editor-modal" style="display:flex; z-index:9999;" onclick="if(event.target===this) this.remove()">
                <div class="modal-content" style="max-width: 980px; width: 95%; height: 88vh; display: flex; flex-direction: column; background: #18181c; border-radius: 14px; overflow: hidden; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 16px 60px rgba(0,0,0,0.9);">
                    
                    <!-- Header -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: #1f1f26; border-bottom: 1px solid rgba(255,255,255,0.08);">
                        <div style="display:flex; align-items:center; gap:10px; overflow:hidden;">
                            <div style="width:28px; height:28px; border-radius:6px; background:rgba(0,210,211,0.12); display:flex; align-items:center; justify-content:center; color:#00d2d3; font-size:14px;">📝</div>
                            <span style="font-size:13px; font-weight:600; color:#aaa;">Sửa file:</span>
                            <span style="color:#00d2d3; font-family:monospace; font-size:13px; background:rgba(0,210,211,0.08); padding:3px 10px; border-radius:6px; border:1px solid rgba(0,210,211,0.2); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${this.escapeHtml(path)}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <button type="button" class="btn btn-ghost btn-sm" onclick="FileManager.openInEditor('${this.escapeHtml(path)}')" title="Mở file này bằng Antigravity IDE" style="padding:4px 10px; font-size:12px; border:1px solid rgba(162,155,254,0.3); border-radius:6px; color:#a29bfe; background:rgba(162,155,254,0.08);">
                                ⚡ Mở Antigravity
                            </button>
                            <button type="button" class="btn btn-ghost btn-sm" onclick="FileManager.toggleFindWidget()" title="Tìm kiếm (Ctrl + F)" style="padding:4px 10px; font-size:12px; border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#ccc;">
                                🔍 Tìm kiếm
                            </button>
                            <button type="button" onclick="document.getElementById('fm-editor-modal').remove()" style="background:none; border:none; color:#71717a; font-size:22px; cursor:pointer; line-height:1; padding:2px 8px; border-radius:6px; transition:all 0.15s;" onmouseover="this.style.color='#fff'; this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.color='#71717a'; this.style.background='none'">×</button>
                        </div>
                    </div>

                    <!-- Body / Textarea with Floating VSCode-style Find Widget -->
                    <div class="modal-body" style="flex:1; display:flex; flex-direction:column; padding: 0; position:relative; overflow:hidden; background:#121215;">
                        
                        <!-- Floating Find Widget -->
                        <div id="fm-editor-find-widget" style="position: absolute; top: 12px; right: 24px; z-index: 100; background: rgba(24, 24, 30, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 8px; box-shadow: 0 8px 30px rgba(0,0,0,0.65); padding: 5px 8px; display: flex; align-items: center; gap: 6px; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
                            <div style="position:relative; display:flex; align-items:center;">
                                <input type="text" id="fm-editor-find-input" placeholder="Tìm kiếm..." style="width: 210px; padding: 5px 46px 5px 10px; font-size: 12.5px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.15); background: #121216; color: #fff; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#00d2d3'" onblur="this.style.borderColor='rgba(255,255,255,0.15)'" oninput="FileManager.findInEditor('input')">
                                <span id="fm-editor-find-status" style="position:absolute; right:8px; font-size:11px; color:#71717a; pointer-events:none; white-space:nowrap;"></span>
                            </div>
                            <button type="button" class="btn btn-ghost btn-sm" onmousedown="event.preventDefault()" onclick="FileManager.findInEditor('prev')" title="Trước đó (Shift + Enter)" style="padding: 4px 7px; font-size: 12px; border-radius: 4px; line-height: 1; border: 1px solid rgba(255,255,255,0.1); color:#ccc;">↑</button>
                            <button type="button" class="btn btn-ghost btn-sm" onmousedown="event.preventDefault()" onclick="FileManager.findInEditor('next')" title="Tiếp theo (Enter)" style="padding: 4px 7px; font-size: 12px; border-radius: 4px; line-height: 1; border: 1px solid rgba(255,255,255,0.1); color:#ccc;">↓</button>
                            <button type="button" onclick="FileManager.toggleFindWidget(false)" title="Đóng tìm kiếm (Escape)" style="background:none; border:none; color:#71717a; font-size:16px; cursor:pointer; line-height:1; padding:2px 5px; margin-left:2px; border-radius:4px;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#71717a'">×</button>
                        </div>

                        <!-- Highlight Backdrop + Editor Textarea -->
                        <div style="flex:1; position:relative; overflow:hidden; width:100%; height:100%;">
                            <pre id="fm-editor-backdrop" aria-hidden="true" style="position:absolute; inset:0; margin:0; padding:18px 24px; font-family:'Fira Code', Consolas, Menlo, Monaco, monospace; font-size:13.5px; line-height:1.65; white-space:pre; overflow:hidden; tab-size:4; color:transparent; pointer-events:none; z-index:1; box-sizing:border-box; border:none;"></pre>
                            <textarea id="fm-editor-textarea" spellcheck="false" style="position:relative; z-index:2; width:100%; height:100%; resize:none; padding:18px 24px; font-family:'Fira Code', Consolas, Menlo, Monaco, monospace; background:transparent; color:#f4f4f5; caret-color:#00d2d3; border:none; outline:none; font-size:13.5px; line-height:1.65; white-space:pre; overflow:auto; tab-size:4; box-sizing:border-box;">${this.escapeHtml(content)}</textarea>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="modal-footer" style="padding: 12px 20px; border-top: 1px solid rgba(255,255,255,0.08); background: #1f1f26; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:16px; font-size: 12px; color: #71717a;">
                            <span>⌨️ <kbd style="background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; font-family:monospace; color:#ccc;">Ctrl + S</kbd> Lưu nhanh</span>
                            <span>🔍 <kbd style="background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; font-family:monospace; color:#ccc;">Ctrl + F</kbd> Tìm kiếm</span>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button type="button" class="btn btn-ghost" onclick="document.getElementById('fm-editor-modal').remove()" style="border: 1px solid rgba(255,255,255,0.1); border-radius:6px; font-size:13px; padding:6px 16px;">Hủy</button>
                            <button type="button" class="btn btn-primary" onclick="FileManager.saveFile('${this.escapeHtml(path)}')" style="border-radius:6px; font-size:13px; font-weight:600; padding:6px 18px;">💾 Lưu Thay Đổi</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Bind hotkeys Ctrl+S, Ctrl+F, Escape in textarea & findInput
        const textarea = document.getElementById('fm-editor-textarea');
        const backdrop = document.getElementById('fm-editor-backdrop');
        const findInput = document.getElementById('fm-editor-find-input');
        this.findAnchorPos = 0;

        if (textarea && backdrop) {
            textarea.addEventListener('scroll', () => {
                backdrop.scrollTop = textarea.scrollTop;
                backdrop.scrollLeft = textarea.scrollLeft;
            });
            textarea.addEventListener('input', () => {
                if (findInput && findInput.value) {
                    FileManager.renderFindBackdrop(textarea.value, findInput.value, FileManager.lastFindIndex);
                } else {
                    backdrop.innerHTML = '';
                }
            });
            textarea.addEventListener('click', () => {
                FileManager.findAnchorPos = textarea.selectionStart || 0;
            });
        }

        if (findInput) {
            findInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    FileManager.findInEditor(e.shiftKey ? 'prev' : 'next');
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    FileManager.toggleFindWidget(false);
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    FileManager.saveFile(path);
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                    e.preventDefault();
                    findInput.select();
                }
            });
        }
        
        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                FileManager.saveFile(path);
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                FileManager.findAnchorPos = textarea.selectionStart || 0;
                FileManager.toggleFindWidget(true);
            }
            if (e.key === 'Escape') {
                FileManager.toggleFindWidget(false);
            }
        });
    },

    toggleFindWidget(show) {
        const widget = document.getElementById('fm-editor-find-widget');
        const backdrop = document.getElementById('fm-editor-backdrop');
        const textarea = document.getElementById('fm-editor-textarea');
        if (!widget) return;
        if (show === undefined) {
            widget.style.display = widget.style.display === 'none' ? 'flex' : 'none';
        } else {
            widget.style.display = show ? 'flex' : 'none';
        }
        if (widget.style.display !== 'none') {
            const input = document.getElementById('fm-editor-find-input');
            if (input) {
                input.focus();
                input.select();
                if (input.value) {
                    this.findInEditor('input');
                }
            }
        } else {
            if (backdrop) backdrop.innerHTML = '';
            if (textarea) textarea.focus();
        }
    },

    renderFindBackdrop(text, term, activePos) {
        const backdrop = document.getElementById('fm-editor-backdrop');
        const textarea = document.getElementById('fm-editor-textarea');
        if (!backdrop || !textarea || !term) {
            if (backdrop) backdrop.innerHTML = '';
            return null;
        }
        const lowerText = text.toLowerCase();
        const lowerTerm = term.toLowerCase();
        const termLen = term.length;
        let html = '';
        let lastIdx = 0;
        let pos = lowerText.indexOf(lowerTerm);
        while (pos !== -1) {
            if (pos > lastIdx) {
                html += this.escapeHtml(text.substring(lastIdx, pos));
            }
            const matchedStr = this.escapeHtml(text.substring(pos, pos + termLen));
            if (pos === activePos) {
                html += `<mark id="fm-find-active-mark" style="background:rgba(0, 210, 211, 0.42); color:transparent; outline:1.5px solid #00d2d3; border-radius:3px;">${matchedStr}</mark>`;
            } else {
                html += `<mark style="background:rgba(250, 204, 21, 0.22); color:transparent; border-radius:2px;">${matchedStr}</mark>`;
            }
            lastIdx = pos + termLen;
            pos = lowerText.indexOf(lowerTerm, lastIdx);
        }
        if (lastIdx < text.length) {
            html += this.escapeHtml(text.substring(lastIdx));
        }
        // Extra newline to preserve trailing line height
        html += '\n';
        backdrop.innerHTML = html;
        backdrop.scrollTop = textarea.scrollTop;
        backdrop.scrollLeft = textarea.scrollLeft;
        return document.getElementById('fm-find-active-mark');
    },

    findInEditor(direction = 'next') {
        const input = document.getElementById('fm-editor-find-input');
        const textarea = document.getElementById('fm-editor-textarea');
        const backdrop = document.getElementById('fm-editor-backdrop');
        const status = document.getElementById('fm-editor-find-status');
        if (!input || !textarea) return;
        
        const term = input.value;
        if (!term) {
            if (status) status.innerText = '';
            if (backdrop) backdrop.innerHTML = '';
            this.lastFindIndex = -1;
            return;
        }
        
        const text = textarea.value;
        const lowerText = text.toLowerCase();
        const lowerTerm = term.toLowerCase();
        
        // Collect all match positions
        let pos = lowerText.indexOf(lowerTerm);
        const matches = [];
        while (pos !== -1) {
            matches.push(pos);
            pos = lowerText.indexOf(lowerTerm, pos + 1);
        }
        
        const count = matches.length;
        if (count === 0) {
            if (status) {
                status.innerText = '0/0';
                status.style.color = '#f87171';
            }
            if (backdrop) backdrop.innerHTML = '';
            this.lastFindIndex = -1;
            return;
        }
        if (status) status.style.color = '#71717a';
        
        let targetPos = matches[0];
        const currentPos = (typeof this.lastFindIndex === 'number' && this.lastFindIndex >= 0)
            ? this.lastFindIndex
            : (this.findAnchorPos || textarea.selectionStart || 0);
        
        if (direction === 'prev') {
            const prevMatches = matches.filter(p => p < currentPos);
            targetPos = prevMatches.length > 0 ? prevMatches[prevMatches.length - 1] : matches[matches.length - 1];
            this.findAnchorPos = targetPos;
        } else if (direction === 'next') {
            const nextMatches = matches.filter(p => p > currentPos);
            targetPos = nextMatches.length > 0 ? nextMatches[0] : matches[0];
            this.findAnchorPos = targetPos;
        } else {
            // Live typing in search box: keep anchor at current match if possible, without stealing focus!
            const anchor = this.findAnchorPos ?? 0;
            targetPos = matches.find(p => p >= anchor) ?? matches[0];
        }
        
        this.lastFindIndex = targetPos;
        textarea.setSelectionRange(targetPos, targetPos + term.length);
        
        // Render visual highlight in backdrop & scroll both vertically and horizontally
        const activeMark = this.renderFindBackdrop(text, term, targetPos);
        if (activeMark) {
            const topTarget = activeMark.offsetTop - Math.max(60, Math.floor(textarea.clientHeight * 0.3));
            const leftTarget = activeMark.offsetLeft - Math.max(40, Math.floor(textarea.clientWidth * 0.25));
            textarea.scrollTop = Math.max(0, topTarget);
            textarea.scrollLeft = Math.max(0, leftTarget);
            if (backdrop) {
                backdrop.scrollTop = textarea.scrollTop;
                backdrop.scrollLeft = textarea.scrollLeft;
            }
        } else {
            const linesBefore = text.substring(0, targetPos).split('\n').length;
            const lineHeight = 22.2;
            textarea.scrollTop = Math.max(0, (linesBefore - 5) * lineHeight);
        }
        
        const matchIdx = matches.indexOf(targetPos) + 1;
        if (status) status.innerText = `${matchIdx}/${count}`;
    },
    
    saveFile(path) {
        const fileName = path.split('/').pop();
        const content = document.getElementById('fm-editor-textarea').value;
        const btn = document.querySelector('#fm-editor-modal .btn-primary');
        const oldText = btn ? btn.innerText : 'Lưu';
        if (btn) {
            btn.innerText = 'Đang lưu...';
            btn.disabled = true;
        }
        
        UI.showLoading(`Đang lưu file "${fileName}" lên máy chủ...`);
        
        fetch('api.php?action=fmSave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('detail-project-name')?.innerText,
                category: App.currentCategory,
                path: path,
                content: content,
                env: this.currentEnv
            })
        }).then(res => res.json()).then(res => {
            if (btn) {
                btn.innerText = oldText;
                btn.disabled = false;
            }
            if (res.status === 'success') {
                UI.showToast('Lưu file thành công!', 'success');
                const modal = document.getElementById('fm-editor-modal');
                if (modal) modal.remove();
                this.loadCurrentPath();
            } else {
                UI.showToast('Lỗi: ' + res.message, 'error');
            }
        }).catch(err => {
            if (btn) {
                btn.innerText = oldText;
                btn.disabled = false;
            }
            UI.showToast('Lỗi kết nối: ' + err.message, 'error');
        }).finally(() => {
            UI.hideLoading();
        });
    },

    openInEditor(path) {
        const fileName = path.split('/').pop();
        UI.showLoading(`Đang chuẩn bị file "${fileName}" & mở Antigravity IDE...`);
        
        fetch('api.php?action=fmOpenInEditor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('detail-project-name')?.innerText,
                category: App.currentCategory,
                path: path
            })
        }).then(res => res.json()).then(res => {
            if (res.status === 'success') {
                UI.showToast('🚀 Đang mở file trong Antigravity IDE!', 'success');
                if (res.ideUrl) {
                    window.location.href = res.ideUrl;
                    
                    // Start checking for background syncs
                    window.fmSyncIntervals = window.fmSyncIntervals || {};
                    if (window.fmSyncIntervals[path]) clearInterval(window.fmSyncIntervals[path]);
                    
                    let lastSyncTime = 0;
                    let isFirstCheck = true;
                    let lastToastTime = 0;
                    
                    const checkSync = () => {
                        fetch('api.php?action=fmCheckSyncStatus', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                name: document.getElementById('detail-project-name')?.innerText,
                                category: App.currentCategory,
                                path: path
                            })
                        }).then(r => r.json()).then(syncRes => {
                            if (syncRes.status === 'success') {
                                const newTime = parseFloat(syncRes.time);
                                if (isFirstCheck) {
                                    lastSyncTime = newTime;
                                    isFirstCheck = false;
                                } else if (newTime > lastSyncTime) {
                                    lastSyncTime = newTime;
                                    const now = Date.now();
                                    if (now - lastToastTime > 3000) {
                                        lastToastTime = now;
                                        const fileName = path.split('/').pop();
                                        UI.showToast(`✅ IDE: Đã lưu tự động ${fileName} lên Server!`, 'success');
                                    }
                                }
                            }
                        }).catch(() => {});
                    };
                    
                    checkSync(); // Initial check immediately
                    window.fmSyncIntervals[path] = setInterval(checkSync, 2000);
                }
            } else {
                UI.showToast('Lỗi mở IDE: ' + res.message, 'error');
            }
        }).catch(err => {
            UI.showToast('Lỗi kết nối khi mở IDE', 'error');
        }).finally(() => {
            UI.hideLoading();
        });
    },

    syncLocalFile(path) {
        const fileName = path.split('/').pop();
        UI.showLoading(`Đang đồng bộ file "${fileName}" lên Demo Host...`);
        fetch('api.php?action=fmSyncLocalFile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('detail-project-name')?.innerText,
                category: App.currentCategory,
                path: path
            })
        }).then(res => res.json()).then(res => {
            if (res.status === 'success') {
                UI.showToast('✅ Đã đồng bộ file lên Demo Host!', 'success');
                this.loadCurrentPath();
            } else {
                UI.showToast('Lỗi đồng bộ: ' + res.message, 'error');
            }
        }).catch(err => {
            UI.showToast('Lỗi kết nối khi đồng bộ: ' + err.message, 'error');
        }).finally(() => {
            UI.hideLoading();
        });
    },

    previewImage(url, title) {
        let existing = document.getElementById('fm-image-modal');
        if (existing) existing.remove();
        
        const modalHtml = `
            <div class="modal-overlay" id="fm-image-modal" style="display:flex; z-index:9999;" onclick="if(event.target===this) this.remove()">
                <div class="modal-content" style="max-width: 800px; width: 90%; max-height: 90vh; display: flex; flex-direction: column; background: #1e1e24; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
                    <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; padding: 12px 18px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <h4 style="margin:0; font-size:14px; color:#fff; word-break:break-all;">🖼️ ${this.escapeHtml(title)}</h4>
                        <button class="modal-close" onclick="document.getElementById('fm-image-modal').remove()" style="background:none; border:none; color:#aaa; font-size:22px; cursor:pointer; line-height:1;">×</button>
                    </div>
                    <div class="modal-body" style="padding: 20px; display:flex; justify-content:center; align-items:center; background: repeating-conic-gradient(#18181b 0% 25%, #27272a 0% 50%) 50% / 20px 20px; min-height: 250px; overflow:auto;">
                        <img src="${url}" alt="${this.escapeHtml(title)}" style="max-width: 100%; max-height: 60vh; object-fit: contain; box-shadow: 0 4px 20px rgba(0,0,0,0.6); border-radius:4px;">
                    </div>
                    <div class="modal-footer" style="padding: 10px 18px; border-top: 1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center; background: #18181b;">
                        <span style="font-size:11px; color:#888; word-break:break-all; max-width:60%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${url}</span>
                        <div style="display:flex; gap:8px;">
                            <a href="${url}" target="_blank" class="btn btn-ghost btn-sm" style="text-decoration:none; padding:4px 10px; font-size:12px;">🔗 Mở tab mới</a>
                            <button class="btn btn-primary btn-sm" onclick="document.getElementById('fm-image-modal').remove()" style="padding:4px 12px; font-size:12px;">Đóng</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    escapeHtml(unsafe) {
        return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
};

const SyncCenter = {
    lastData: null,
    lastProject: null,
    currentEnv: 'demo',
    currentFilter: 'all',
    currentScope: 'all',
    searchQuery: '',
    includeClearData: false,
    selectedPaths: new Set(),
    customActions: new Map(),

    getDefaultEnv() {
        const config = (typeof App !== 'undefined' && App.currentProjectConfig) ? App.currentProjectConfig : {};
        const prod = config.prod || {};
        const deployedProd = config.deployed?.production || {};
        if (prod.ftp_host || prod.web_domain || prod.ftp_user || prod.da_user || deployedProd.ftp_host || deployedProd.url) {
            return 'prod';
        }
        const ftpHost = document.getElementById('d_ftp_host')?.value?.trim();
        const webDomain = document.getElementById('d_web_domain')?.value?.trim();
        const ftpUser = document.getElementById('d_ftp_user')?.value?.trim();
        if (ftpHost || webDomain || ftpUser) {
            return 'prod';
        }
        return 'demo';
    },

    updateEnvUI(env) {
        document.querySelectorAll('.sc-env-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.background = 'transparent';
            btn.style.color = '#94a3b8';
        });
        const activeBtn = document.getElementById(`sc-env-btn-${env}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.background = (env === 'prod') ? '#f59e0b' : 'var(--primary, #00d2d3)';
            activeBtn.style.color = '#000';
        }
        const desc = document.getElementById('sc-header-desc');
        if (desc) {
            desc.innerHTML = (env === 'prod')
                ? '<b style="color:#f59e0b;">🚀 CHẾ ĐỘ PRODUCTION</b> - Đối soát và đồng bộ trực tiếp với Hosting thật của khách hàng'
                : 'Tự động đối soát và đồng bộ mã nguồn giữa Local Workspace và Demo Hosting';
        }
    },

    resetToDefaultEnv() {
        const defEnv = this.getDefaultEnv();
        this.currentEnv = defEnv;
        this.lastData = null;
        this.selectedPaths = new Set();
        this.customActions = new Map();
        this.updateEnvUI(defEnv);

        // Reset view to standby prompt if not yet scanned
        const container = document.getElementById('sync-center-content');
        if (container) {
            container.innerHTML = `
                <div style="padding: 60px 20px; text-align: center; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.12); border-radius: 16px;">
                    <div style="font-size: 32px; margin-bottom: 12px;">🔄</div>
                    <h3 style="color: #fff; font-size: 16px; font-weight: 700; margin-bottom: 6px;">Sẵn sàng đối soát [${defEnv === 'prod' ? 'Production Server' : 'Demo Server'}]</h3>
                    <p style="color: var(--text-muted, #94a3b8); font-size: 13px; max-width: 460px; margin: 0 auto 20px;">
                        Nhấn nút <b>"Quét & So Sánh"</b> để kiểm tra sự khác biệt giữa máy Local và ${defEnv === 'prod' ? 'Production Server' : 'Demo Server'}.
                    </p>
                    <button class="btn btn-primary" onclick="SyncCenter.scan()" style="padding: 10px 24px; font-weight: 700; border-radius: 8px;">
                        🔍 Bắt đầu Quét & So sánh
                    </button>
                </div>
            `;
        }
    },
    
    init() {
        this.includeClearData = false;
        try { localStorage.removeItem('sc_include_cleardata'); } catch(e) {}
        const cb = document.getElementById('sc-check-cleardata');
        if (cb) cb.checked = false;
        const cbToolbar = document.getElementById('sc-check-cleardata-toolbar');
        if (cbToolbar) cbToolbar.checked = false;

        const currentProject = document.getElementById('detail-project-name')?.innerText;
        if (this.lastProject !== currentProject) {
            this.lastProject = currentProject;
            this.resetToDefaultEnv();
        } else if (!this.currentEnv) {
            this.resetToDefaultEnv();
        }
    },

    setEnv(env) {
        if (this.currentEnv === env) return;
        this.currentEnv = env;
        this.updateEnvUI(env);
        this.scan();
    },
    
    toggleClearData(checked) {
        this.includeClearData = !!checked;
        
        const cbHeader = document.getElementById('sc-check-cleardata');
        if (cbHeader) cbHeader.checked = this.includeClearData;
        const cbToolbar = document.getElementById('sc-check-cleardata-toolbar');
        if (cbToolbar) cbToolbar.checked = this.includeClearData;
        
        if (this.includeClearData) {
            UI.showToast('⚠️ Đã bật hiển thị file ClearData (Xoá dữ liệu Demo)', 'warning');
        } else {
            UI.showToast('🛡️ Đã ẩn & loại trừ file ClearData', 'info');
        }
        
        this.scan();
    },

    async clearCompiledCache() {
        const projectName = document.getElementById('detail-project-name')?.innerText;
        if (!projectName) {
            UI.showToast('Vui lòng chọn dự án trước', 'warning');
            return;
        }
        UI.showLoading('Đang xoá sạch cache compiled (Local & Remote)...');
        try {
            const res = await fetch('api.php?action=fmClearCompiledCache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: projectName,
                    category: App.currentCategory,
                    env: this.currentEnv
                })
            }).then(r => r.json());
            UI.hideLoading();
            if (res.status === 'success') {
                const info = res.info || {};
                UI.showToast(`✅ Đã xoá sạch cache compiled! (Local: ${info.deleted_local || 0}, Remote: ${info.deleted_remote || 0})`, 'success');
            } else {
                UI.showToast('Lỗi xoá cache: ' + (res.message || 'Thất bại'), 'error');
            }
        } catch (e) {
            UI.hideLoading();
            UI.showToast('Lỗi kết nối khi xoá cache: ' + e.message, 'error');
        }
    },
    
    scan(allowUploadBridge = false) {
        const projectName = document.getElementById('detail-project-name')?.innerText;
        if (!projectName) return;
        
        const cbHeader = document.getElementById('sc-check-cleardata');
        if (cbHeader) this.includeClearData = cbHeader.checked;
        
        const envLabel = (this.currentEnv === 'prod') ? 'Production Hosting' : 'Demo Hosting';
        const loadingTitle = allowUploadBridge
            ? `Đang tải bridge.php & quét toàn bộ cây thư mục (${envLabel})`
            : `Đang quét & đối soát toàn bộ cây thư mục (${envLabel})`;

        document.getElementById('sync-center-content').innerHTML = `
            <div style="padding: 60px 20px; text-align: center; background: rgba(255,255,255,0.015); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px;">
                <div class="loader" style="margin: 0 auto 18px; border: 3px solid rgba(0, 210, 211, 0.15); border-top-color: ${this.currentEnv === 'prod' ? '#f59e0b' : 'var(--primary, #00d2d3)'}; border-radius: 50%; width: 36px; height: 36px; animation: sc-spin 0.8s linear infinite;"></div>
                <h4 style="color: #fff; font-size: 15px; margin-bottom: 6px; font-weight: 600;">${loadingTitle}</h4>
                <p style="color: var(--text-muted, #94a3b8); font-size: 13px;">Hệ thống đang so sánh thời gian & dung lượng giữa Local và ${envLabel}...</p>
            </div>
            <style>@keyframes sc-spin { 100% { transform:rotate(360deg); } }</style>
        `;
        
        fetch('api.php?action=fmSyncCenterCompare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: projectName,
                category: App.currentCategory,
                include_cleardata: this.includeClearData,
                env: this.currentEnv,
                allow_upload_bridge: !!allowUploadBridge
            })
        }).then(r => r.json()).then(res => {
            if (res.status === 'success') {
                this.lastData = res.comparison;
                this.currentFilter = 'all';
                this.currentScope = 'all';
                this.searchQuery = '';
                const all = this.getAllItems();
                this.selectedPaths = new Set(all.map(i => i.path));
                this.customActions = new Map();
                this.render();
            } else if (res.status === 'bridge_missing' || res.code === 'BRIDGE_MISSING') {
                this.showBridgeUploadModal(res.env_label || envLabel);
            } else {
                document.getElementById('sync-center-content').innerHTML = `
                    <div style="padding: 24px; border-radius: 12px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); color: #fca5a5; display: flex; align-items: center; gap: 12px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <div>
                            <div style="font-weight:600; font-size:14px; margin-bottom:2px;">Quét thất bại (${envLabel})</div>
                            <div style="font-size:13px; opacity:0.9;">${this.escapeHtml(res.message)}</div>
                        </div>
                    </div>
                `;
            }
        }).catch(err => {
            document.getElementById('sync-center-content').innerHTML = `
                <div style="padding: 24px; border-radius: 12px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); color: #fca5a5;">
                    Lỗi kết nối khi quét ${envLabel}. Vui lòng kiểm tra lại mạng hoặc cấu hình máy chủ.
                </div>
            `;
        });
    },

    showBridgeUploadModal(envLabel) {
        let existing = document.getElementById('sc-bridge-confirm-modal');
        if (existing) existing.remove();

        const envColor = (this.currentEnv === 'prod') ? '#f59e0b' : '#00d2d3';

        const modalHtml = `
            <div class="modal-overlay" id="sc-bridge-confirm-modal" style="display:flex; z-index:10000; align-items:center; justify-content:center; position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(8px);">
                <div class="modal-content" style="max-width:520px; width:92%; background:#18181c; border-radius:14px; overflow:hidden; border:1px solid rgba(255,255,255,0.12); box-shadow:0 20px 60px rgba(0,0,0,0.85);">
                    <div style="display:flex; align-items:center; gap:12px; padding:16px 20px; background:#1f1f26; border-bottom:1px solid rgba(255,255,255,0.08);">
                        <div style="width:36px; height:36px; border-radius:10px; background:rgba(239,68,68,0.15); display:flex; align-items:center; justify-content:center; color:#f87171; font-size:18px;">🛡️</div>
                        <div>
                            <h3 style="margin:0; font-size:15px; font-weight:700; color:#fff;">Xác nhận tải tệp kết nối Bridge</h3>
                            <span style="font-size:12px; color:var(--text-muted, #94a3b8);">Môi trường: <b style="color:${envColor};">${this.escapeHtml(envLabel)}</b></span>
                        </div>
                        <button type="button" onclick="SyncCenter.cancelBridgeUpload('${this.escapeHtml(envLabel)}')" style="margin-left:auto; background:none; border:none; color:#71717a; font-size:22px; cursor:pointer; line-height:1; padding:4px 8px; border-radius:6px;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#71717a'">×</button>
                    </div>
                    <div style="padding:20px; color:#e2e8f0; font-size:13.5px; line-height:1.6;">
                        <p style="margin:0 0 12px;">
                            Trên máy chủ <b>${this.escapeHtml(envLabel)}</b> chưa có tệp kết nối <code>bridge.php</code>.
                        </p>
                        <div style="background:rgba(255,183,77,0.08); border-left:3px solid #ffb74d; border-radius:4px; padding:10px 14px; margin-bottom:14px; font-size:12.5px; color:#fcd34d;">
                            <b>Lưu ý bảo mật:</b> Để tránh tự ý đẩy file lên hosting gây rủi ro an toàn, hệ thống chỉ tải <code>bridge.php</code> khi bạn cho phép. Tệp này hỗ trợ so sánh đối soát file và có thể dọn dẹp sau khi hoàn tất.
                        </div>
                        <p style="margin:0; font-size:13px; color:#94a3b8;">
                            Bạn có đồng ý cho phép tải tệp <code>bridge.php</code> lên máy chủ để tiến hành Quét & So sánh không?
                        </p>
                    </div>
                    <div style="padding:14px 20px; background:#141418; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:flex-end; gap:10px;">
                        <button type="button" class="btn btn-ghost" onclick="SyncCenter.cancelBridgeUpload('${this.escapeHtml(envLabel)}')" style="padding:8px 16px; font-size:13px; border:1px solid rgba(255,255,255,0.12); border-radius:8px; color:#cbd5e1;">
                            Hủy bỏ
                        </button>
                        <button type="button" class="btn btn-primary" onclick="SyncCenter.confirmBridgeUpload()" style="padding:8px 18px; font-size:13px; font-weight:600; border-radius:8px; background:linear-gradient(135deg, #00d2d3, #0984e3); border:none; color:#fff; display:flex; align-items:center; gap:6px;">
                            <span>✓ Đồng ý tải lên & Quét</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('sync-center-content').innerHTML = `
            <div style="padding: 50px 20px; text-align: center; background: rgba(255,255,255,0.015); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px;">
                <div style="font-size: 32px; margin-bottom: 12px;">🛡️</div>
                <h4 style="color: #fff; font-size: 15px; margin-bottom: 6px; font-weight: 600;">Đang chờ xác nhận bảo mật</h4>
                <p style="color: var(--text-muted, #94a3b8); font-size: 13px; max-width: 480px; margin: 0 auto 16px;">
                    Vui lòng xác nhận trên hộp thoại để cho phép tải tệp kết nối <code>bridge.php</code> lên máy chủ ${this.escapeHtml(envLabel)}.
                </p>
                <button class="btn btn-primary" onclick="SyncCenter.showBridgeUploadModal('${this.escapeHtml(envLabel)}')" style="padding: 8px 20px; font-weight: 600; border-radius: 8px;">
                    Mở lại hộp thoại xác nhận
                </button>
            </div>
        `;
    },

    confirmBridgeUpload() {
        const modal = document.getElementById('sc-bridge-confirm-modal');
        if (modal) modal.remove();
        this.scan(true);
    },

    cancelBridgeUpload(envLabel) {
        const modal = document.getElementById('sc-bridge-confirm-modal');
        if (modal) modal.remove();

        document.getElementById('sync-center-content').innerHTML = `
            <div style="padding: 50px 20px; text-align: center; background: rgba(255,255,255,0.015); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px;">
                <div style="font-size: 32px; margin-bottom: 12px;">🛡️</div>
                <h4 style="color: #fff; font-size: 15px; margin-bottom: 6px; font-weight: 600;">Đã hủy tải tệp Bridge</h4>
                <p style="color: var(--text-muted, #94a3b8); font-size: 13px; max-width: 480px; margin: 0 auto 16px;">
                    Tệp <code>bridge.php</code> chưa được tải lên máy chủ ${this.escapeHtml(envLabel || '')}. Thao tác so sánh tạm dừng để bảo vệ an toàn hệ thống.
                </p>
                <button class="btn btn-primary" onclick="SyncCenter.scan()" style="padding: 8px 20px; font-weight: 600; border-radius: 8px;">
                    🔄 Quét lại
                </button>
            </div>
        `;
    },

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update active class on filter buttons
        document.querySelectorAll('.sc-pill-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        if (filter === 'all') {
            document.querySelector('.sc-pill-btn.pill-all')?.classList.add('active');
        } else if (filter === 'upload') {
            document.querySelector('.sc-pill-btn.pill-up')?.classList.add('active');
        } else if (filter === 'download') {
            document.querySelector('.sc-pill-btn.pill-down')?.classList.add('active');
        } else if (filter === 'conflict') {
            document.querySelector('.sc-pill-btn.pill-conflict')?.classList.add('active');
        }

        // Tự động chọn lại danh sách file theo tab hướng hiện tại (bỏ chọn các file ngoài tab)
        const visibleItems = this.getFilteredItems();
        this.selectedPaths = new Set(visibleItems.map(i => i.path));
        
        this.renderTableOnly();
    },

    setScope(scope) {
        this.currentScope = scope;
        document.querySelectorAll('.sc-scope-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.getElementById(`sc-scope-btn-${scope}`);
        if (activeBtn) activeBtn.classList.add('active');

        // Tự động chọn lại danh sách file theo tab phân vùng hiện tại
        const visibleItems = this.getFilteredItems();
        this.selectedPaths = new Set(visibleItems.map(i => i.path));

        this.renderTableOnly();
    },

    setSearch(query) {
        this.searchQuery = (query || '').toLowerCase().trim();
        this.renderTableOnly();
    },

    getScopeMeta(path) {
        const p = (path || '').toLowerCase().replace(/\\/g, '/');
        if (p.includes('/admin/') || p.startsWith('admin/') || p.includes('controllers/admin') || p.includes('views/admin')) {
            return {
                key: 'admin',
                label: 'ADMIN',
                icon: '🛡️',
                bg: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: 'rgba(239, 68, 68, 0.4)'
            };
        }
        if (p.includes('/web/') || p.startsWith('web/') || p.includes('controllers/web') || p.includes('views/web') || p.includes('views/templates') || p.includes('views/layout')) {
            return {
                key: 'web',
                label: 'WEB / CLIENT',
                icon: '🌐',
                bg: 'rgba(14, 165, 233, 0.15)',
                color: '#38bdf8',
                border: 'rgba(14, 165, 233, 0.4)'
            };
        }
        if (p.includes('/models/') || p.includes('/model/') || p.startsWith('models/') || p.startsWith('model/')) {
            return {
                key: 'model_other',
                label: 'MODEL',
                icon: '📦',
                bg: 'rgba(168, 85, 247, 0.15)',
                color: '#c084fc',
                border: 'rgba(168, 85, 247, 0.4)'
            };
        }
        if (p.includes('routes/') || p.includes('config/') || p.includes('.env')) {
            return {
                key: 'model_other',
                label: 'ROUTER/CFG',
                icon: '⚙️',
                bg: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: 'rgba(16, 185, 129, 0.4)'
            };
        }
        return {
            key: 'model_other',
            label: 'HỆ THỐNG',
            icon: '📁',
            bg: 'rgba(148, 163, 184, 0.15)',
            color: '#94a3b8',
            border: 'rgba(148, 163, 184, 0.25)'
        };
    },

    getDuplicateStats(items) {
        const map = new Map();
        items.forEach(item => {
            const fileName = item.path.split('/').pop().toLowerCase();
            if (!map.has(fileName)) {
                map.set(fileName, []);
            }
            map.get(fileName).push(item);
        });

        const duplicatesMap = new Map();
        let duplicateItemCount = 0;
        map.forEach((list, fileName) => {
            if (list.length > 1) {
                duplicatesMap.set(fileName, list);
                duplicateItemCount += list.length;
            }
        });

        return {
            duplicatesMap,
            duplicateItemCount
        };
    },

    selectScopeOnly(scopeKey) {
        const visibleItems = this.getFilteredItems();
        this.selectedPaths.clear();
        let count = 0;
        const { duplicatesMap } = this.getDuplicateStats(this.getAllItems());
        visibleItems.forEach(item => {
            const meta = this.getScopeMeta(item.path);
            if (scopeKey === 'all') {
                this.selectedPaths.add(item.path);
                count++;
            } else if (scopeKey === 'duplicates') {
                const fn = item.path.split('/').pop().toLowerCase();
                if (duplicatesMap.has(fn)) {
                    this.selectedPaths.add(item.path);
                    count++;
                }
            } else if (meta.key === scopeKey) {
                this.selectedPaths.add(item.path);
                count++;
            }
        });
        this.renderTableOnly();
        const label = scopeKey === 'admin' ? '🛡️ ADMIN' : (scopeKey === 'web' ? '🌐 WEB / CLIENT' : (scopeKey === 'duplicates' ? '⚠️ FILE TRÙNG TÊN' : 'TẤT CẢ'));
        UI.showToast(`Đã chọn ${count} file [${label}] trong tab hiện tại!`, 'info');
    },

    deselectAll() {
        this.selectedPaths.clear();
        this.renderTableOnly();
        UI.showToast('Đã bỏ chọn toàn bộ file trong tab hiện tại', 'info');
    },

    togglePathSelect(path, checked) {
        if (checked) {
            this.selectedPaths.add(path);
        } else {
            this.selectedPaths.delete(path);
        }

        // Cập nhật lại trạng thái checkbox header
        const items = this.getFilteredItems();
        const allFilteredChecked = items.length > 0 && items.every(i => this.selectedPaths.has(i.path));
        const checkAllEl = document.getElementById('sync-check-all');
        if (checkAllEl) checkAllEl.checked = allFilteredChecked;

        this.updateExecuteBtnCount();
    },

    toggleSelectAllFiltered(checked) {
        const visibleItems = this.getFilteredItems();
        visibleItems.forEach(item => {
            if (checked) {
                this.selectedPaths.add(item.path);
            } else {
                this.selectedPaths.delete(item.path);
            }
        });
        document.querySelectorAll('.sync-cb').forEach(cb => {
            cb.checked = checked;
        });
        this.updateExecuteBtnCount();
    },

    changeAction(path, action) {
        this.customActions.set(path, action);
    },

    getFilteredItems() {
        let items = this.getAllItems();
        const { duplicatesMap } = this.getDuplicateStats(items);

        // Filter by Direction
        if (this.currentFilter === 'upload') {
            items = items.filter(i => i.type === 'local_newer' || i.type === 'local_only');
        } else if (this.currentFilter === 'download') {
            items = items.filter(i => i.type === 'remote_newer' || i.type === 'remote_only');
        } else if (this.currentFilter === 'conflict') {
            items = items.filter(i => i.type === 'conflict');
        }

        // Filter by Scope
        if (this.currentScope === 'admin') {
            items = items.filter(i => this.getScopeMeta(i.path).key === 'admin');
        } else if (this.currentScope === 'web') {
            items = items.filter(i => this.getScopeMeta(i.path).key === 'web');
        } else if (this.currentScope === 'model_other') {
            items = items.filter(i => this.getScopeMeta(i.path).key === 'model_other');
        } else if (this.currentScope === 'duplicates') {
            items = items.filter(i => {
                const fn = i.path.split('/').pop().toLowerCase();
                return duplicatesMap.has(fn);
            });
        }

        // Filter by Search Query
        if (this.searchQuery) {
            items = items.filter(i => i.path.toLowerCase().includes(this.searchQuery));
        }

        return items;
    },

    getAllItems() {
        if (!this.lastData) return [];
        const envName = (this.currentEnv === 'prod') ? 'Production' : 'Demo';
        const items = [];
        this.lastData.local_newer.forEach(f => items.push({ path: f.path, type: 'local_newer', reason: 'Local mới hơn', color: 'emerald', defaultAction: 'upload', local_mtime: f.local_mtime, remote_mtime: f.remote_mtime }));
        this.lastData.local_only.forEach(f => items.push({ path: f.path, type: 'local_only', reason: 'Chưa có trên ' + envName, color: 'cyan', defaultAction: 'upload', local_mtime: f.local_mtime, remote_mtime: f.remote_mtime }));
        this.lastData.remote_newer.forEach(f => items.push({ path: f.path, type: 'remote_newer', reason: envName + ' mới hơn', color: 'purple', defaultAction: 'download', local_mtime: f.local_mtime, remote_mtime: f.remote_mtime }));
        this.lastData.remote_only.forEach(f => items.push({ path: f.path, type: 'remote_only', reason: 'Chỉ có trên ' + envName, color: 'indigo', defaultAction: 'download', local_mtime: f.local_mtime, remote_mtime: f.remote_mtime }));
        this.lastData.conflict.forEach(f => items.push({ path: f.path, type: 'conflict', reason: 'Lệch dung lượng (Conflict)', color: 'rose', defaultAction: 'upload', local_mtime: f.local_mtime, remote_mtime: f.remote_mtime }));
        return items;
    },

    formatTime(ts) {
        if (!ts) return '<span style="color:#64748b; font-size:11.5px; font-style:italic;">Chưa có</span>';
        const d = new Date(ts * 1000);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return `${day}/${month}/${year} <span style="color:#94a3b8; font-size:11px;">${hours}:${minutes}:${seconds}</span>`;
    },

    getFileIcon(path) {
        const ext = path.split('.').pop().toLowerCase();
        if (['php', 'blade.php'].includes(ext) || path.endsWith('.blade.php')) {
            return `<span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:5px; background:rgba(99,102,241,0.15); color:#818cf8; font-size:10px; font-weight:700; font-family:monospace;">PHP</span>`;
        }
        if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) {
            return `<span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:5px; background:rgba(245,158,11,0.15); color:#fbbf24; font-size:10px; font-weight:700; font-family:monospace;">JS</span>`;
        }
        if (['css', 'scss', 'sass', 'less'].includes(ext)) {
            return `<span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:5px; background:rgba(14,165,233,0.15); color:#38bdf8; font-size:10px; font-weight:700; font-family:monospace;">CSS</span>`;
        }
        if (['json', 'lock', 'env', 'config'].includes(ext) || path.includes('.env')) {
            return `<span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:5px; background:rgba(16,185,129,0.15); color:#34d399; font-size:10px; font-weight:700; font-family:monospace;">CFG</span>`;
        }
        if (['md', 'txt', 'sql'].includes(ext)) {
            return `<span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:5px; background:rgba(168,85,247,0.15); color:#c084fc; font-size:10px; font-weight:700; font-family:monospace;">DOC</span>`;
        }
        return `<span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:5px; background:rgba(255,255,255,0.08); color:#94a3b8; font-size:10px; font-weight:700;">FILE</span>`;
    },

    renderDbSyncCard(dbDiff) {
        const envLabel = this.currentEnv === 'prod' ? 'Production' : 'Demo';
        if (!dbDiff) return '';

        if (!dbDiff.available) {
            return `
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 20px;">🗄️</span>
                        <div>
                            <div style="font-weight: 600; font-size: 13.5px; color: #cbd5e1;">Cơ sở dữ liệu (SQL Schema)</div>
                            <div style="font-size: 12px; color: #94a3b8;">${this.escapeHtml(dbDiff.error || 'Không phát hiện cấu hình Database hợp lệ để đối soát.')}</div>
                        </div>
                    </div>
                    <span class="sc-tag" style="background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1);">Chưa kết nối DB</span>
                </div>
            `;
        }

        const uploadStmts = dbDiff.upload_statements || [];
        const downloadStmts = dbDiff.download_statements || [];
        const uploadSummary = dbDiff.upload_summary || { new_tables: [], new_columns: [] };
        const downloadSummary = dbDiff.download_summary || { new_tables: [], new_columns: [] };
        const hasDiff = uploadStmts.length > 0 || downloadStmts.length > 0;

        if (!hasDiff) {
            return `
                <div style="background: rgba(16,185,129,0.04); border: 1px solid rgba(16,185,129,0.2); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 34px; height: 34px; border-radius: 8px; background: rgba(16,185,129,0.12); color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 18px;">✓</div>
                        <div>
                            <div style="font-weight: 700; font-size: 13.5px; color: #34d399; display: flex; align-items: center; gap: 8px;">
                                <span>Cấu trúc Database (SQL Schema) đã đồng bộ 100%</span>
                                <span style="font-size: 11px; font-weight: 500; color: #94a3b8;">(Local ⟷ ${envLabel})</span>
                            </div>
                            <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
                                Tất cả bảng và cột dữ liệu đều khớp hoàn hảo. Không có câu lệnh DDL nào cần áp dụng.
                            </div>
                        </div>
                    </div>
                    <span class="sc-tag sc-tag-emerald" style="padding: 4px 10px; font-size: 11.5px;">✓ Khớp cấu trúc</span>
                </div>
            `;
        }

        let html = `
            <div style="background: linear-gradient(180deg, rgba(20, 26, 38, 0.95), rgba(13, 17, 26, 0.95)); border: 1px solid rgba(0, 210, 211, 0.25); border-radius: 14px; padding: 16px 20px; box-shadow: 0 8px 30px rgba(0,0,0,0.35);">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 36px; height: 36px; border-radius: 9px; background: rgba(0,210,211,0.15); color: #00d2d3; display: flex; align-items: center; justify-content: center; font-size: 18px;">🗄️</div>
                        <div>
                            <div style="font-weight: 700; font-size: 14.5px; color: #fff; display: flex; align-items: center; gap: 8px;">
                                <span>Đồng bộ Cấu trúc Database (SQL Schema Diff)</span>
                                <span class="sc-tag sc-tag-cyan" style="font-size: 11px;">Chỉ cấu trúc • Tuyệt đối không đè dữ liệu</span>
                            </div>
                            <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
                                Phát hiện khác biệt cấu trúc giữa Local và ${envLabel}. Hệ thống sẽ <b style="color: #38bdf8;">tự động backup .sql</b> trước khi áp dụng câu lệnh.
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11.5px; color: #a1a1aa; background: rgba(255,255,255,0.04); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
                            🛡️ Auto-Backup: <b style="color: #34d399;">BẬT</b>
                        </span>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px;">
        `;

        // Chiều 1: Upload (Local -> Hosting)
        html += `
            <div style="background: rgba(16, 185, 129, 0.04); border: 1px solid ${uploadStmts.length > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.06)'}; border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-weight: 700; font-size: 13px; color: #34d399; display: flex; align-items: center; gap: 6px;">
                            <span>↑ Local ➔ ${envLabel}</span>
                        </span>
                        <span class="sc-badge-count" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">${uploadStmts.length} câu lệnh DDL</span>
                    </div>
                    <div style="font-size: 12px; color: #cbd5e1; line-height: 1.5; margin-bottom: 12px;">
                        ${uploadStmts.length > 0 ? `
                            Hosting khác biệt so với Local:<br>
                            ${uploadSummary.new_tables && uploadSummary.new_tables.length > 0 ? `• <b style="color:#fff;">${uploadSummary.new_tables.length}</b> bảng mới: <code>${this.escapeHtml(uploadSummary.new_tables.join(', '))}</code><br>` : ''}
                            ${uploadSummary.new_columns && uploadSummary.new_columns.length > 0 ? `• <b style="color:#fff;">${uploadSummary.new_columns.length}</b> cột mới: <code>${this.escapeHtml(uploadSummary.new_columns.slice(0, 4).join(', '))}${uploadSummary.new_columns.length > 4 ? ' ...' : ''}</code><br>` : ''}
                            ${uploadSummary.modify_columns && uploadSummary.modify_columns.length > 0 ? `• <b style="color:#fbbf24;">${uploadSummary.modify_columns.length}</b> cột đổi kiểu/chiều dài: <code>${this.escapeHtml(uploadSummary.modify_columns.slice(0, 4).join(', '))}${uploadSummary.modify_columns.length > 4 ? ' ...' : ''}</code>` : ''}
                        ` : '<span style="color:#94a3b8;">Hosting đã có đầy đủ toàn bộ bảng & cột của Local.</span>'}
                    </div>
                </div>
                ${uploadStmts.length > 0 ? `
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                        <button type="button" class="btn btn-primary" onclick="SyncCenter.executeDbSync('upload')" style="flex: 1; height: 34px; font-size: 12.5px; font-weight: 600; border-radius: 7px; background: linear-gradient(135deg, #10b981, #059669); border: none; box-shadow: 0 4px 12px rgba(16,185,129,0.3); display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                            <span>↑ Đồng bộ lên ${envLabel} (Tự động Backup)</span>
                        </button>
                        <button type="button" class="btn btn-ghost" onclick="SyncCenter.previewDbSql('upload')" title="Xem trước câu lệnh SQL DDL" style="height: 34px; padding: 0 12px; font-size: 12px; border-radius: 7px; border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1;">
                            Xem SQL
                        </button>
                    </div>
                ` : ''}
            </div>
        `;

        // Chiều 2: Download (Hosting -> Local)
        html += `
            <div style="background: rgba(168, 85, 247, 0.04); border: 1px solid ${downloadStmts.length > 0 ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255,255,255,0.06)'}; border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-weight: 700; font-size: 13px; color: #c084fc; display: flex; align-items: center; gap: 6px;">
                            <span>↓ ${envLabel} ➔ Local</span>
                        </span>
                        <span class="sc-badge-count" style="background: rgba(168, 85, 247, 0.15); color: #c084fc;">${downloadStmts.length} câu lệnh DDL</span>
                    </div>
                    <div style="font-size: 12px; color: #cbd5e1; line-height: 1.5; margin-bottom: 12px;">
                        ${downloadStmts.length > 0 ? `
                            Local khác biệt so với Hosting:<br>
                            ${downloadSummary.new_tables && downloadSummary.new_tables.length > 0 ? `• <b style="color:#fff;">${downloadSummary.new_tables.length}</b> bảng mới: <code>${this.escapeHtml(downloadSummary.new_tables.join(', '))}</code><br>` : ''}
                            ${downloadSummary.new_columns && downloadSummary.new_columns.length > 0 ? `• <b style="color:#fff;">${downloadSummary.new_columns.length}</b> cột mới: <code>${this.escapeHtml(downloadSummary.new_columns.slice(0, 4).join(', '))}${downloadSummary.new_columns.length > 4 ? ' ...' : ''}</code><br>` : ''}
                            ${downloadSummary.modify_columns && downloadSummary.modify_columns.length > 0 ? `• <b style="color:#fbbf24;">${downloadSummary.modify_columns.length}</b> cột đổi kiểu/chiều dài: <code>${this.escapeHtml(downloadSummary.modify_columns.slice(0, 4).join(', '))}${downloadSummary.modify_columns.length > 4 ? ' ...' : ''}</code>` : ''}
                        ` : '<span style="color:#94a3b8;">Local đã có đầy đủ toàn bộ bảng & cột của Hosting.</span>'}
                    </div>
                </div>
                ${downloadStmts.length > 0 ? `
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                        <button type="button" class="btn btn-primary" onclick="SyncCenter.executeDbSync('download')" style="flex: 1; height: 34px; font-size: 12.5px; font-weight: 600; border-radius: 7px; background: linear-gradient(135deg, #a855f7, #7c3aed); border: none; box-shadow: 0 4px 12px rgba(168,85,247,0.3); display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                            <span>↓ Đồng bộ về Local (Tự động Backup)</span>
                        </button>
                        <button type="button" class="btn btn-ghost" onclick="SyncCenter.previewDbSql('download')" title="Xem trước câu lệnh SQL DDL" style="height: 34px; padding: 0 12px; font-size: 12px; border-radius: 7px; border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1;">
                            Xem SQL
                        </button>
                    </div>
                ` : ''}
            </div>
        `;

        html += `
                </div>
            </div>
        `;

        return html;
    },

    render() {
        if (!this.lastData) return;
        const allItems = this.getAllItems();
        
        const countUpload = this.lastData.local_newer.length + this.lastData.local_only.length;
        const countDownload = this.lastData.remote_newer.length + this.lastData.remote_only.length;
        const countConflict = this.lastData.conflict.length;
        const total = allItems.length;

        // Scope Counts
        let adminCount = 0;
        let webCount = 0;
        let modelOtherCount = 0;
        allItems.forEach(i => {
            const scopeKey = this.getScopeMeta(i.path).key;
            if (scopeKey === 'admin') adminCount++;
            else if (scopeKey === 'web') webCount++;
            else modelOtherCount++;
        });

        const duplicateStats = this.getDuplicateStats(allItems);

        const dbDiff = this.lastData.db_diff || null;
        const uploadDbCount = dbDiff && dbDiff.upload_statements ? dbDiff.upload_statements.length : 0;
        const downloadDbCount = dbDiff && dbDiff.download_statements ? dbDiff.download_statements.length : 0;
        const hasDbChanges = uploadDbCount > 0 || downloadDbCount > 0;

        if (total === 0 && !hasDbChanges) {
            document.getElementById('sync-center-content').innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    ${this.renderDbSyncCard(dbDiff)}
                    <div style="padding: 50px 20px; text-align: center; background: rgba(16,185,129,0.03); border: 1px solid rgba(16,185,129,0.15); border-radius: 16px;">
                        <div style="display:inline-flex; width:60px; height:60px; border-radius:50%; background:rgba(16,185,129,0.1); color:#10b981; align-items:center; justify-content:center; margin-bottom:14px;">
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        </div>
                        <h3 style="color:#fff; font-size:17px; font-weight:700; margin-bottom:6px;">Tuyệt vời! Mọi thứ đã đồng bộ 100%</h3>
                        <p style="color:var(--text-muted, #94a3b8); font-size:13px; max-width:420px; margin:0 auto;">Cả mã nguồn file và cấu trúc Database đều hoàn toàn đồng nhất giữa Local và Hosting.</p>
                    </div>
                </div>
            `;
            return;
        }

        let html = `
            <style>
                .sc-pill-btn {
                    height: 36px; padding: 0 14px; box-sizing: border-box; border-radius: 8px; font-size: 12.5px; font-weight: 700;
                    cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); display: inline-flex; align-items: center; gap: 7px;
                    border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: #94a3b8;
                }
                .sc-pill-btn:hover { background: rgba(255,255,255,0.08); color: #fff; transform: translateY(-1px); }
                
                .sc-pill-btn.active {
                    background: #00d2d3 !important; color: #0f172a !important; font-weight: 700 !important;
                    border-color: #00f2fe !important; box-shadow: 0 4px 18px rgba(0, 210, 211, 0.45) !important;
                    transform: translateY(-1px);
                }
                .sc-pill-btn.active .sc-badge-count { background: rgba(0, 0, 0, 0.3) !important; color: #fff !important; }
                
                .sc-pill-btn.pill-all { border-color: rgba(0, 210, 211, 0.25); background: rgba(0, 210, 211, 0.05); color: #cbd5e1; }
                .sc-pill-btn.pill-all .sc-badge-count { background: rgba(0, 210, 211, 0.2); color: #00d2d3; }
                .sc-pill-btn.pill-all.active {
                    background: linear-gradient(135deg, #00d2d3, #0097e6) !important;
                    color: #04141e !important; border-color: #00f2fe !important;
                    box-shadow: 0 4px 18px rgba(0, 210, 211, 0.45) !important; font-weight: 700 !important;
                }
                .sc-pill-btn.pill-all.active .sc-badge-count { background: rgba(0, 0, 0, 0.35) !important; color: #ffffff !important; }
                
                .sc-pill-btn.pill-up { border-color: rgba(16, 185, 129, 0.25); background: rgba(16, 185, 129, 0.05); color: #cbd5e1; }
                .sc-pill-btn.pill-up svg { color: #34d399; }
                .sc-pill-btn.pill-up .sc-badge-count { background: rgba(16, 185, 129, 0.2); color: #34d399; }
                .sc-pill-btn.pill-up.active {
                    background: linear-gradient(135deg, #10b981, #059669) !important;
                    color: #ffffff !important; border-color: #34d399 !important;
                    box-shadow: 0 4px 18px rgba(16, 185, 129, 0.45) !important; font-weight: 700 !important;
                }
                .sc-pill-btn.pill-up.active svg { color: #ffffff !important; }
                .sc-pill-btn.pill-up.active .sc-badge-count { background: rgba(0, 0, 0, 0.35) !important; color: #ffffff !important; }
                
                .sc-pill-btn.pill-down { border-color: rgba(168, 85, 247, 0.25); background: rgba(168, 85, 247, 0.05); color: #cbd5e1; }
                .sc-pill-btn.pill-down svg { color: #c084fc; }
                .sc-pill-btn.pill-down .sc-badge-count { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
                .sc-pill-btn.pill-down.active {
                    background: linear-gradient(135deg, #a855f7, #7c3aed) !important;
                    color: #ffffff !important; border-color: #c084fc !important;
                    box-shadow: 0 4px 18px rgba(168, 85, 247, 0.45) !important; font-weight: 700 !important;
                }
                .sc-pill-btn.pill-down.active svg { color: #ffffff !important; }
                .sc-pill-btn.pill-down.active .sc-badge-count { background: rgba(0, 0, 0, 0.35) !important; color: #ffffff !important; }
                
                .sc-pill-btn.pill-conflict { border-color: rgba(244, 63, 94, 0.25); background: rgba(244, 63, 94, 0.05); color: #cbd5e1; }
                .sc-pill-btn.pill-conflict svg { color: #fb7185; }
                .sc-pill-btn.pill-conflict .sc-badge-count { background: rgba(244, 63, 94, 0.2); color: #fb7185; }
                .sc-pill-btn.pill-conflict.active {
                    background: linear-gradient(135deg, #f43f5e, #e11d48) !important;
                    color: #ffffff !important; border-color: #fb7185 !important;
                    box-shadow: 0 4px 18px rgba(244, 63, 94, 0.45) !important; font-weight: 700 !important;
                }
                .sc-pill-btn.pill-conflict.active svg { color: #ffffff !important; }
                .sc-pill-btn.pill-conflict.active .sc-badge-count { background: rgba(0, 0, 0, 0.35) !important; color: #ffffff !important; }
                
                .sc-badge-count {
                    padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: 700;
                    transition: all 0.2s ease;
                }

                /* Scope Buttons */
                .sc-scope-btn {
                    height: 32px; padding: 0 12px; box-sizing: border-box; border-radius: 7px; font-size: 12px; font-weight: 600;
                    cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 6px;
                    border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: #94a3b8;
                }
                .sc-scope-btn:hover { background: rgba(255,255,255,0.08); color: #fff; transform: translateY(-1px); }
                .sc-scope-btn.active {
                    background: rgba(255,255,255,0.15) !important; color: #fff !important; font-weight: 700 !important;
                    border-color: rgba(255,255,255,0.35) !important;
                }
                .sc-scope-btn.sc-scope-admin.active {
                    background: linear-gradient(135deg, rgba(239,68,68,0.85), rgba(185,28,28,0.9)) !important;
                    color: #fff !important; border-color: #f87171 !important; box-shadow: 0 4px 14px rgba(239,68,68,0.35);
                }
                .sc-scope-btn.sc-scope-web.active {
                    background: linear-gradient(135deg, rgba(14,165,233,0.85), rgba(2,132,199,0.9)) !important;
                    color: #fff !important; border-color: #38bdf8 !important; box-shadow: 0 4px 14px rgba(14,165,233,0.35);
                }
                .sc-scope-btn.sc-scope-model.active {
                    background: linear-gradient(135deg, rgba(168,85,247,0.85), rgba(126,34,206,0.9)) !important;
                    color: #fff !important; border-color: #c084fc !important; box-shadow: 0 4px 14px rgba(168,85,247,0.35);
                }
                .sc-scope-btn.sc-scope-dup.active {
                    background: linear-gradient(135deg, rgba(245,158,11,0.85), rgba(217,119,6,0.9)) !important;
                    color: #fff !important; border-color: #fbbf24 !important; box-shadow: 0 4px 14px rgba(245,158,11,0.35);
                }

                .sc-quick-sel-btn {
                    height: 28px; padding: 0 10px; border-radius: 6px; font-size: 11.5px; font-weight: 600;
                    cursor: pointer; transition: all 0.15s ease; border: 1px solid rgba(255,255,255,0.12);
                    background: rgba(255,255,255,0.04); color: #cbd5e1; display: inline-flex; align-items: center; gap: 4px;
                }
                .sc-quick-sel-btn:hover { background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.25); }
                .sc-quick-sel-clear { color: #f87171 !important; border-color: rgba(239,68,68,0.25) !important; }
                .sc-quick-sel-clear:hover { background: rgba(239,68,68,0.15) !important; border-color: rgba(239,68,68,0.4) !important; }
                
                .sc-table { width: 100%; border-collapse: separate; border-spacing: 0 4px; }
                .sc-table thead th {
                    padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.05em; color: #64748b; border: none; text-align: left !important;
                }
                .sc-table tbody tr {
                    background: rgba(18, 24, 34, 0.6); backdrop-filter: blur(8px);
                    transition: all 0.15s ease; border-radius: 8px;
                }
                .sc-table tbody tr:hover {
                    background: rgba(26, 34, 48, 0.85); transform: translateY(-1px);
                    box-shadow: 0 4px 14px rgba(0,0,0,0.15);
                }
                .sc-table tbody td {
                    padding: 10px 14px; vertical-align: middle; border: none; text-align: left;
                }
                .sc-table tbody tr td:first-child { border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
                .sc-table tbody tr td:last-child { border-top-right-radius: 8px; border-bottom-right-radius: 8px; }
                
                .sc-select-action {
                    appearance: none; -webkit-appearance: none;
                    background: rgba(13, 18, 28, 0.9) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 10px center;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 7px; color: #f1f5f9; padding: 6px 28px 6px 10px;
                    font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all 0.2s ease;
                }
                .sc-select-action:focus, .sc-select-action:hover {
                    border-color: rgba(255,255,255,0.3); background-color: rgba(20, 28, 42, 0.95);
                }
                
                .sc-btn-sync-single {
                    width: 30px; height: 30px; border-radius: 7px; display: inline-flex;
                    align-items: center; justify-content: center; background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08); color: #94a3b8; cursor: pointer;
                    transition: all 0.2s ease;
                }
                .sc-btn-sync-single:hover {
                    background: var(--primary, #00d2d3); color: #000; border-color: transparent;
                    transform: scale(1.08); box-shadow: 0 0 12px var(--primary-glow, rgba(0,210,211,0.4));
                }
                
                .sc-btn-diff {
                    height: 30px; padding: 0 10px; border-radius: 7px; display: inline-flex;
                    align-items: center; gap: 5px; background: rgba(0, 210, 211, 0.08);
                    border: 1px solid rgba(0, 210, 211, 0.2); color: var(--primary, #00d2d3);
                    font-size: 11.5px; font-weight: 700; cursor: pointer; transition: all 0.2s ease;
                }
                .sc-btn-diff:hover {
                    background: rgba(0, 210, 211, 0.22); color: #00f2fe; border-color: rgba(0, 210, 211, 0.5);
                    transform: translateY(-1px); box-shadow: 0 0 12px rgba(0, 210, 211, 0.3);
                }
                
                .sc-search-box {
                    height: 36px; padding: 0 14px; box-sizing: border-box;
                    background: rgba(13, 17, 24, 0.7); border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px; color: #fff; font-size: 13px; width: 230px;
                    outline: none; transition: border-color 0.2s;
                }
                .sc-search-box:focus { border-color: var(--primary, #00d2d3); box-shadow: 0 0 0 2px var(--primary-glow, rgba(0,210,211,0.15)); }

                .sc-custom-cb {
                    width: 16px; height: 16px; accent-color: var(--primary, #00d2d3); cursor: pointer;
                }
                
                .sc-tag {
                    display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px;
                    border-radius: 6px; font-size: 11.5px; font-weight: 600;
                }
                .sc-tag-emerald { background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.2); }
                .sc-tag-cyan { background: rgba(6, 182, 212, 0.12); color: #22d3ee; border: 1px solid rgba(34, 211, 238, 0.2); }
                .sc-tag-purple { background: rgba(168, 85, 247, 0.12); color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.2); }
                .sc-tag-indigo { background: rgba(99, 102, 241, 0.12); color: #818cf8; border: 1px solid rgba(129, 140, 248, 0.2); }
                .sc-tag-rose { background: rgba(244, 63, 94, 0.12); color: #fb7185; border: 1px solid rgba(251, 113, 133, 0.2); }

                /* Diff Modal Styles */
                .sc-diff-overlay {
                    position: fixed; inset: 0; z-index: 10050;
                    background: rgba(6, 9, 15, 0.88); backdrop-filter: blur(12px);
                    display: flex; align-items: center; justify-content: center;
                    padding: 24px; animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .sc-diff-dialog {
                    width: 95vw; max-width: 1400px; height: 90vh; max-height: 900px;
                    background: #0b0f17; border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 16px; display: flex; flex-direction: column;
                    overflow: hidden; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7);
                }
                .sc-diff-header {
                    padding: 14px 20px; background: rgba(255, 255, 255, 0.03);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
                }
                .sc-diff-body {
                    flex: 1; overflow: auto; background: #070a10; font-family: var(--mono, monospace);
                    font-size: 12px; line-height: 1.5; color: #cbd5e1;
                }
                .sc-diff-footer {
                    padding: 12px 20px; background: rgba(255, 255, 255, 0.03);
                    border-top: 1px solid rgba(255, 255, 255, 0.08);
                    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
                }
                .diff-line {
                    display: flex; width: 100%; border-bottom: 1px solid rgba(255, 255, 255, 0.02); box-sizing: border-box;
                }
                .diff-line:hover { background: rgba(255, 255, 255, 0.04); }
                .diff-cell-inner {
                    display: flex; width: 100%; min-height: 22px; box-sizing: border-box; align-items: stretch;
                }
                .diff-cell-inner:hover { background: rgba(255, 255, 255, 0.04); }
                .diff-num {
                    width: 44px; text-align: right; padding: 2px 8px; color: #475569;
                    user-select: none; border-right: 1px solid rgba(255, 255, 255, 0.06); flex-shrink: 0; box-sizing: border-box;
                }
                .diff-text {
                    padding: 2px 10px; white-space: pre; flex: 1; min-width: 0; overflow-x: auto;
                }
                .diff-add { background: rgba(16, 185, 129, 0.16) !important; color: #34d399 !important; }
                .diff-add .diff-num { color: #10b981; background: rgba(16, 185, 129, 0.08); }
                .diff-del { background: rgba(244, 63, 94, 0.16) !important; color: #fb7185 !important; }
                .diff-del .diff-num { color: #f43f5e; background: rgba(244, 63, 94, 0.08); }
                .diff-gutter-sym { width: 20px; text-align: center; font-weight: 700; user-select: none; flex-shrink: 0; padding-top: 2px; }
                .diff-split-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                .diff-split-table tr { border-bottom: 1px solid rgba(255, 255, 255, 0.02); }
                .diff-split-table td { padding: 0; vertical-align: top; width: 50%; border-right: 1px solid rgba(255,255,255,0.08); }
                .diff-split-table td:last-child { border-right: none; }
            </style>

            <div style="display: flex; flex-direction: column; gap: 14px;">
                <!-- SQL Schema Diff Card -->
                ${this.renderDbSyncCard(dbDiff)}

                <!-- Header Toolbar: Direction Filters & Search -->
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: rgba(255,255,255,0.02); padding: 10px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <button class="sc-pill-btn pill-all ${this.currentFilter === 'all' ? 'active' : ''}" onclick="SyncCenter.setFilter('all')">
                            Tất cả hướng <span class="sc-badge-count">${total}</span>
                        </button>
                        <button class="sc-pill-btn pill-up ${this.currentFilter === 'upload' ? 'active' : ''}" onclick="SyncCenter.setFilter('upload')">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                            Đẩy lên ${this.currentEnv === 'prod' ? 'Production' : 'Demo'} <span class="sc-badge-count">${countUpload}</span>
                        </button>
                        <button class="sc-pill-btn pill-down ${this.currentFilter === 'download' ? 'active' : ''}" onclick="SyncCenter.setFilter('download')">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                            Kéo về Local <span class="sc-badge-count">${countDownload}</span>
                        </button>
                        ${countConflict > 0 ? `
                            <button class="sc-pill-btn pill-conflict ${this.currentFilter === 'conflict' ? 'active' : ''}" onclick="SyncCenter.setFilter('conflict')">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                Xung đột <span class="sc-badge-count">${countConflict}</span>
                            </button>
                        ` : ''}
                    </div>

                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <label class="sc-cleardata-toggle" style="display: inline-flex; align-items: center; gap: 7px; cursor: pointer; height: 36px; box-sizing: border-box; padding: 0 12px; border-radius: 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.15); font-size: 12px; font-weight: 600; color: #cbd5e1; user-select: none; transition: all 0.2s; white-space: nowrap; text-transform: none; margin: 0;" title="Bật nếu muốn quét và đồng bộ các file tính năng xoá dữ liệu Demo (ClearDataController...)">
                            <input type="checkbox" id="sc-check-cleardata-toolbar" ${this.includeClearData ? 'checked' : ''} onchange="SyncCenter.toggleClearData(this.checked)" style="accent-color: var(--primary, #00d2d3); width: 14px; height: 14px; cursor: pointer; margin: 0;">
                            <span>Đồng bộ ClearData</span>
                        </label>
                        <input type="text" class="sc-search-box" placeholder="🔍 Lọc file theo tên..." oninput="SyncCenter.setSearch(this.value)" value="${this.escapeHtml(this.searchQuery)}">
                        <button class="btn btn-primary" onclick="SyncCenter.executeAll()" style="height: 36px; box-sizing: border-box; display: flex; align-items: center; gap: 8px; font-weight: 700; padding: 0 16px; border-radius: 8px; box-shadow: 0 4px 14px var(--primary-glow, rgba(0,210,211,0.25)); font-size: 13px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            <span id="sc-btn-execute-text">THỰC THI (${this.selectedPaths.size} FILE)</span>
                        </button>
                    </div>
                </div>

                <!-- Scope & Security Toolbar (Row 2): Segregation between Admin, Web, and Duplicates -->
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: rgba(13, 17, 24, 0.85); padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.07);">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-right: 4px; display: inline-flex; align-items: center; gap: 4px;">
                            <span>🛡️ PHÂN VÙNG:</span>
                        </span>
                        <button class="sc-scope-btn ${this.currentScope === 'all' ? 'active' : ''}" id="sc-scope-btn-all" onclick="SyncCenter.setScope('all')">
                            Toàn bộ <span class="sc-badge-count">${total}</span>
                        </button>
                        <button class="sc-scope-btn sc-scope-admin ${this.currentScope === 'admin' ? 'active' : ''}" id="sc-scope-btn-admin" onclick="SyncCenter.setScope('admin')" title="Chỉ hiển thị các file thuộc khu vực Quản trị Admin">
                            🛡️ Chỉ Admin <span class="sc-badge-count">${adminCount}</span>
                        </button>
                        <button class="sc-scope-btn sc-scope-web ${this.currentScope === 'web' ? 'active' : ''}" id="sc-scope-btn-web" onclick="SyncCenter.setScope('web')" title="Chỉ hiển thị các file thuộc giao diện Khách Web / Client">
                            🌐 Chỉ Web/Client <span class="sc-badge-count">${webCount}</span>
                        </button>
                        <button class="sc-scope-btn sc-scope-model ${this.currentScope === 'model_other' ? 'active' : ''}" id="sc-scope-btn-model_other" onclick="SyncCenter.setScope('model_other')">
                            📦 Model / Khác <span class="sc-badge-count">${modelOtherCount}</span>
                        </button>
                        ${duplicateStats.duplicateItemCount > 0 ? `
                            <button class="sc-scope-btn sc-scope-dup ${this.currentScope === 'duplicates' ? 'active' : ''}" id="sc-scope-btn-duplicates" onclick="SyncCenter.setScope('duplicates')" title="Cảnh báo: Có ${duplicateStats.duplicateItemCount} file trùng tên nhau ở các thư mục khác nhau! Hãy kiểm tra để tránh sync nhầm.">
                                ⚠️ File trùng tên <span class="sc-badge-count" style="background:rgba(245,158,11,0.25); color:#fbbf24;">${duplicateStats.duplicateItemCount}</span>
                            </button>
                        ` : ''}
                    </div>

                    <!-- Quick Selection Helpers -->
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span style="font-size: 11.5px; color: #64748b; margin-right: 2px;">Chọn nhanh:</span>
                        <button type="button" class="sc-quick-sel-btn" onclick="SyncCenter.selectScopeOnly('admin')" title="Chỉ tích chọn file Admin, tự động bỏ chọn file Web và các mục khác để an toàn">
                            🛡️ Chỉ chọn Admin
                        </button>
                        <button type="button" class="sc-quick-sel-btn" onclick="SyncCenter.selectScopeOnly('web')" title="Chỉ tích chọn file Web, tự động bỏ chọn file Admin và các mục khác">
                            🌐 Chỉ chọn Web
                        </button>
                        <button type="button" class="sc-quick-sel-btn" onclick="SyncCenter.selectScopeOnly('all')" title="Tích chọn toàn bộ các file">
                            ✓ Tất cả
                        </button>
                        <button type="button" class="sc-quick-sel-btn sc-quick-sel-clear" onclick="SyncCenter.deselectAll()" title="Bỏ tích chọn toàn bộ để chọn lại thủ công">
                            ✕ Bỏ chọn
                        </button>
                    </div>
                </div>

                <!-- Table Content Container -->
                <div id="sc-table-container"></div>
            </div>
        `;

        document.getElementById('sync-center-content').innerHTML = html;
        this.renderTableOnly();
    },

    renderTableOnly() {
        const container = document.getElementById('sc-table-container');
        if (!container) return;

        const allItems = this.getAllItems();
        const { duplicatesMap } = this.getDuplicateStats(allItems);
        let items = this.getFilteredItems();

        if (items.length === 0) {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--text-muted, #94a3b8); font-size: 13px; background: rgba(255,255,255,0.015); border: 1px dashed rgba(255,255,255,0.08); border-radius: 12px;">
                    Không tìm thấy file nào khớp với bộ lọc hiện tại.
                </div>
            `;
            this.updateExecuteBtnCount();
            return;
        }

        const envLabel = this.currentEnv === 'prod' ? 'Production' : 'Demo';
        const allFilteredChecked = items.length > 0 && items.every(i => this.selectedPaths.has(i.path));

        let tableHtml = `
            <table class="sc-table">
                <thead>
                    <tr>
                        <th style="width: 44px; text-align: center;">
                            <input type="checkbox" class="sc-custom-cb" id="sync-check-all" ${allFilteredChecked ? 'checked' : ''} onchange="SyncCenter.toggleSelectAllFiltered(this.checked)">
                        </th>
                        <th style="width: 135px; white-space: nowrap;">Phân vùng</th>
                        <th>Đường dẫn File</th>
                        <th style="width: 160px; white-space: nowrap;">Trạng thái / Lý do</th>
                        <th style="width: 155px; white-space: nowrap;">Ngày Local</th>
                        <th style="width: 155px; white-space: nowrap;">Ngày ${envLabel}</th>
                        <th style="width: 170px; white-space: nowrap;">Hành động</th>
                        <th style="width: 110px; text-align: left; white-space: nowrap;">Xử lý</th>
                    </tr>
                </thead>
                <tbody>
        `;

        items.forEach(item => {
            const path = this.escapeHtml(item.path);
            const currentAction = this.customActions.get(item.path) || item.defaultAction;
            const isUpload = currentAction === 'upload';
            const icon = this.getFileIcon(item.path);
            const scope = this.getScopeMeta(item.path);
            
            // Format path: split dir & filename
            const parts = item.path.split('/');
            const fileName = parts.pop();
            const dirName = parts.length > 0 ? parts.join('/') + '/' : '';
            const isClearData = item.path.toLowerCase().includes('cleardata') || item.path.toLowerCase() === 'src/routes/web.php';

            const dupList = duplicatesMap.get(fileName.toLowerCase());
            const isDuplicate = dupList && dupList.length > 1;
            const isChecked = this.selectedPaths.has(item.path);

            tableHtml += `
                <tr style="${isDuplicate ? 'border-left: 3px solid #f59e0b;' : ''}">
                    <td style="text-align: center;">
                        <input type="checkbox" class="sc-custom-cb sync-cb" value="${path}" ${isChecked ? 'checked' : ''} onchange="SyncCenter.togglePathSelect('${path}', this.checked)">
                    </td>
                    <td style="white-space: nowrap;">
                        <span class="sc-tag" style="background: ${scope.bg}; color: ${scope.color}; border: 1px solid ${scope.border}; font-weight: 700; font-size: 11px;">
                            ${scope.icon} ${scope.label}
                        </span>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" onclick="SyncCenter.openDiff('${path}')" title="Nhấn để xem Diff so sánh nội dung">
                            ${icon}
                            <div style="font-family: var(--mono, monospace); font-size: 12.5px; line-height: 1.4; word-break: break-all;">
                                <span style="color: #94a3b8; font-size: 12px; font-weight: 500;">${this.escapeHtml(dirName)}</span><span style="color: #ffffff; font-weight: 700; font-size: 13px; text-decoration: underline; text-decoration-color: rgba(255,255,255,0.3);">${this.escapeHtml(fileName)}</span>
                                ${isDuplicate ? `<span class="sc-tag" style="background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.4); font-weight: 700; font-size: 10.5px; margin-left: 6px;" title="Cảnh báo: Tên file '${this.escapeHtml(fileName)}' xuất hiện ở ${dupList.length} thư mục khác nhau! Hãy chú ý Scope Admin vs Web.">⚠️ Trùng tên (${dupList.length} vị trí)</span>` : ''}
                                ${isClearData ? '<span class="sc-tag" style="background: rgba(239,68,68,0.18); color: #f87171; border: 1px solid rgba(239,68,68,0.35); font-weight: 700; font-size: 10.5px; margin-left: 6px; padding: 1px 6px;">⚠️ ClearData (' + (item.path.toLowerCase().includes('routes') ? 'Router' : 'Controller') + ')</span>' : ''}
                            </div>
                        </div>
                    </td>
                    <td style="white-space: nowrap;">
                        <span class="sc-tag sc-tag-${item.color}">
                            ${item.type === 'local_newer' || item.type === 'local_only' ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>' : ''}
                            ${item.type === 'remote_newer' || item.type === 'remote_only' ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>' : ''}
                            ${item.type === 'conflict' ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>' : ''}
                            ${item.reason}
                        </span>
                    </td>
                    <td style="white-space: nowrap; font-family: var(--mono, monospace); font-size: 12px; color: ${item.local_mtime ? '#34d399' : '#64748b'};">
                        ${this.formatTime(item.local_mtime)}
                    </td>
                    <td style="white-space: nowrap; font-family: var(--mono, monospace); font-size: 12px; color: ${item.remote_mtime ? '#c084fc' : '#64748b'};">
                        ${this.formatTime(item.remote_mtime)}
                    </td>
                    <td style="white-space: nowrap;">
                        <select class="sc-select-action sync-action" data-path="${path}" onchange="SyncCenter.changeAction('${path}', this.value)">
                            <option value="upload" ${isUpload ? 'selected' : ''}>↑ Đẩy lên ${envLabel}</option>
                            <option value="download" ${!isUpload ? 'selected' : ''}>↓ Kéo về Local</option>
                        </select>
                    </td>
                    <td style="text-align: left; white-space: nowrap;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <button class="sc-btn-diff" onclick="SyncCenter.openDiff('${path}')" title="So sánh sự thay đổi code (Diff)">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                <span>Diff</span>
                            </button>
                            <button class="sc-btn-sync-single" onclick="SyncCenter.executeSingle(this, '${path}')" title="Đồng bộ ngay file này (Tự động Backup)">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tableHtml += `</tbody></table>`;
        container.innerHTML = tableHtml;
        this.updateExecuteBtnCount();
    },

    updateExecuteBtnCount() {
        const visibleItems = this.getFilteredItems();
        const visibleSet = new Set(visibleItems.map(i => i.path));
        let checkedCount = 0;
        this.selectedPaths.forEach(p => {
            if (visibleSet.has(p)) checkedCount++;
        });

        const btnText = document.getElementById('sc-btn-execute-text');
        if (btnText) {
            let actionLabel = `THỰC THI (${checkedCount} FILE)`;
            if (this.currentFilter === 'upload') {
                actionLabel = `ĐẨY LÊN (${checkedCount} FILE)`;
            } else if (this.currentFilter === 'download') {
                actionLabel = `KÉO VỀ (${checkedCount} FILE)`;
            }
            btnText.innerText = actionLabel;
        }

        const btnExecute = btnText?.closest('button');
        if (btnExecute) {
            if (checkedCount === 0) {
                btnExecute.style.opacity = '0.55';
            } else {
                btnExecute.style.opacity = '1';
            }
        }
    },

    executeSingle(btn, path) {
        const currentAction = this.customActions.get(path) || (btn.closest('tr')?.querySelector('.sync-action')?.value) || 'upload';
        const actions = { upload: [], download: [] };
        actions[currentAction].push(path);
        const scope = this.getScopeMeta(path);
        
        btn.innerHTML = '<span class="loader" style="width:12px; height:12px; border-width:2px; display:inline-block;"></span>';
        btn.disabled = true;

        this.runExecuteApi(actions).then(res => {
            if (res.status === 'success') {
                UI.showToast(`Đã ${currentAction === 'upload' ? 'đẩy' : 'kéo'} [${scope.label}] ${path} thành công (Đã tự động backup)!`, 'success');
                const row = btn.closest('tr');
                if (row) row.style.opacity = '0.35';
                this.selectedPaths.delete(path);
                const cb = row?.querySelector('.sync-cb');
                if (cb) cb.checked = false;
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
                btn.style.borderColor = 'rgba(16,185,129,0.4)';
                this.updateExecuteBtnCount();
            } else {
                UI.showToast('Lỗi: ' + res.message, 'error');
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
                btn.disabled = false;
            }
        }).catch(() => {
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
            btn.disabled = false;
        });
    },

    showExecutionConfirmationModal({ envLabel, uploadCount, downloadCount, adminSelected, webSelected, otherSelected }) {
        return new Promise(resolve => {
            let existing = document.getElementById('sc-exec-confirm-modal');
            if (existing) existing.remove();

            const total = uploadCount + downloadCount;

            const modalHtml = `
                <div class="modal-overlay" id="sc-exec-confirm-modal" style="display:flex; z-index:10050; align-items:center; justify-content:center; position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px);">
                    <div class="modal-content" style="max-width:680px; width:94%; max-height:85vh; background:#0e131d; border-radius:14px; overflow:hidden; border:1px solid rgba(0,210,211,0.3); box-shadow:0 24px 70px rgba(0,0,0,0.9); display:flex; flex-direction:column;">
                        <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; background:#141b29; border-bottom:1px solid rgba(255,255,255,0.08);">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <span style="font-size:20px;">🛡️</span>
                                <div>
                                    <h3 style="margin:0; font-size:15px; font-weight:700; color:#fff;">Xác nhận danh sách tệp đồng bộ [${this.escapeHtml(envLabel)}]</h3>
                                    <span style="font-size:12px; color:var(--text-muted, #94a3b8);">Tổng số: <b style="color:#00d2d3;">${total} file</b> (Đẩy: ${uploadCount} • Kéo: ${downloadCount})</span>
                                </div>
                            </div>
                            <button type="button" id="sc-exec-modal-close" style="background:none; border:none; color:#71717a; font-size:22px; cursor:pointer; line-height:1; padding:4px 8px; border-radius:6px;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#71717a'">×</button>
                        </div>
                        <div style="padding:16px 20px; overflow-y:auto; flex:1; background:#080c14;">
                            <div style="background:rgba(16,185,129,0.08); border-left:3px solid #10b981; border-radius:4px; padding:10px 14px; margin-bottom:14px; font-size:12.5px; color:#6ee7b7;">
                                🛡️ <b>Cơ chế An toàn:</b> Hệ thống sẽ <b>tự động sao lưu (Backup snapshot)</b> các tệp đích trước khi tiến hành ghi đè. Bạn có thể khôi phục lại bất kỳ lúc nào tại tab Lịch sử Backup.
                            </div>

                            ${adminSelected.length > 0 ? `
                                <div style="margin-bottom:12px;">
                                    <div style="font-weight:700; font-size:12.5px; color:#f87171; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                                        <span>🛡️ Tệp thuộc Admin (${adminSelected.length}):</span>
                                    </div>
                                    <div style="background:#05070a; border:1px solid rgba(255,255,255,0.06); border-radius:6px; padding:8px 12px; font-family:var(--mono, monospace); font-size:11.5px; color:#cbd5e1; max-height:110px; overflow-y:auto; line-height:1.6;">
                                        ${adminSelected.map(p => `<div>• ${this.escapeHtml(p)}</div>`).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            ${webSelected.length > 0 ? `
                                <div style="margin-bottom:12px;">
                                    <div style="font-weight:700; font-size:12.5px; color:#38bdf8; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                                        <span>🌐 Tệp thuộc Web / Client (${webSelected.length}):</span>
                                    </div>
                                    <div style="background:#05070a; border:1px solid rgba(255,255,255,0.06); border-radius:6px; padding:8px 12px; font-family:var(--mono, monospace); font-size:11.5px; color:#cbd5e1; max-height:110px; overflow-y:auto; line-height:1.6;">
                                        ${webSelected.map(p => `<div>• ${this.escapeHtml(p)}</div>`).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            ${otherSelected.length > 0 ? `
                                <div style="margin-bottom:12px;">
                                    <div style="font-weight:700; font-size:12.5px; color:#c084fc; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                                        <span>📦 Tệp Model & Khác (${otherSelected.length}):</span>
                                    </div>
                                    <div style="background:#05070a; border:1px solid rgba(255,255,255,0.06); border-radius:6px; padding:8px 12px; font-family:var(--mono, monospace); font-size:11.5px; color:#cbd5e1; max-height:90px; overflow-y:auto; line-height:1.6;">
                                        ${otherSelected.map(p => `<div>• ${this.escapeHtml(p)}</div>`).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <div style="padding:14px 20px; background:#121722; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:flex-end; gap:10px;">
                            <button type="button" class="btn btn-ghost" id="sc-exec-modal-cancel" style="padding:8px 16px; font-size:13px; border:1px solid rgba(255,255,255,0.12); border-radius:8px; color:#cbd5e1;">
                                Hủy bỏ
                            </button>
                            <button type="button" class="btn btn-primary" id="sc-exec-modal-confirm" style="padding:8px 20px; font-size:13px; font-weight:700; border-radius:8px; background:linear-gradient(135deg, #00d2d3, #0984e3); border:none; color:#fff; display:flex; align-items:center; gap:6px; box-shadow:0 4px 14px rgba(0,210,211,0.35);">
                                <span>✓ Đồng ý Đồng Bộ</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            const cleanup = (confirmed) => {
                const el = document.getElementById('sc-exec-confirm-modal');
                if (el) el.remove();
                resolve(confirmed);
            };

            document.getElementById('sc-exec-modal-close')?.addEventListener('click', () => cleanup(false));
            document.getElementById('sc-exec-modal-cancel')?.addEventListener('click', () => cleanup(false));
            document.getElementById('sc-exec-modal-confirm')?.addEventListener('click', () => cleanup(true));
        });
    },

    async executeAll() {
        const envLabel = this.currentEnv === 'prod' ? 'Production' : 'Demo';
        const visibleItems = this.getFilteredItems();
        const visibleMap = new Map();
        visibleItems.forEach(i => visibleMap.set(i.path, i));

        // CHỈ thực thi các file vừa nằm trong tab hiện tại VỪA được tích chọn
        const selectedItems = [];
        this.selectedPaths.forEach(p => {
            if (visibleMap.has(p)) {
                selectedItems.push(visibleMap.get(p));
            }
        });

        if (selectedItems.length === 0) {
            UI.showToast('Chưa chọn file nào để đồng bộ trong tab hiện tại. Vui lòng tích chọn ít nhất 1 file!', 'warning');
            return;
        }

        // Rebuild actions chỉ cho các file selectedItems hợp lệ trong tab
        let actions = { upload: [], download: [] };
        const adminSelected = [];
        const webSelected = [];
        const otherSelected = [];

        selectedItems.forEach(it => {
            const p = it.path;
            const act = this.customActions.get(p) || it.defaultAction;
            if (actions[act]) actions[act].push(p);

            const scopeKey = this.getScopeMeta(p).key;
            if (scopeKey === 'admin') adminSelected.push(p);
            else if (scopeKey === 'web') webSelected.push(p);
            else otherSelected.push(p);
        });

        const totalSelected = actions.upload.length + actions.download.length;
        if (totalSelected === 0) {
            UI.showToast('Chưa chọn file nào để đồng bộ', 'warning');
            return;
        }

        // 2. High-clarity Confirmation Modal
        const confirmed = await this.showExecutionConfirmationModal({
            envLabel,
            uploadCount: actions.upload.length,
            downloadCount: actions.download.length,
            adminSelected,
            webSelected,
            otherSelected
        });
        if (!confirmed) return;

        UI.showLoading('Đang đồng bộ các file & tạo bản sao lưu an toàn...');

        const btnText = document.getElementById('sc-btn-execute-text');
        const oldText = btnText ? btnText.innerText : 'THỰC THI';
        if (btnText) btnText.innerHTML = '<span class="loader" style="width:12px; height:12px; border-width:2px; display:inline-block; margin-right:6px;"></span> ĐANG ĐỒNG BỘ...';

        this.runExecuteApi(actions).then(res => {
            UI.hideLoading();
            if (res.status === 'success') {
                const results = res.results || [];
                const errors = results.filter(r => r.status === 'error');
                if (errors.length > 0) {
                    UI.showToast(`Đã đồng bộ ${results.length - errors.length}/${results.length} files (Đã xoá sạch cache compiled). Có ${errors.length} file bị lỗi!`, 'warning');
                } else {
                    UI.showToast(`Đồng bộ thành công ${results.length} files & đã xoá sạch cache compiled!`, 'success');
                }
                this.scan(); // Rescan to refresh differences
            } else {
                UI.showToast('Lỗi đồng bộ: ' + res.message, 'error');
                if (btnText) btnText.innerText = oldText;
            }
        }).catch(err => {
            UI.hideLoading();
            UI.showToast('Lỗi kết nối khi đồng bộ', 'error');
            if (btnText) btnText.innerText = oldText;
        });
    },

    runExecuteApi(actions) {
        const projectName = document.getElementById('detail-project-name')?.innerText;
        return fetch('api.php?action=fmSyncCenterExecute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: projectName,
                category: App.currentCategory,
                env: this.currentEnv,
                include_cleardata: this.includeClearData,
                actions: actions
            })
        }).then(r => r.json());
    },

    previewDbSql(direction) {
        if (!this.lastData || !this.lastData.db_diff) return;
        const dbDiff = this.lastData.db_diff;
        const stmts = direction === 'upload' ? (dbDiff.upload_statements || []) : (dbDiff.download_statements || []);
        const envLabel = this.currentEnv === 'prod' ? 'Production' : 'Demo';
        const title = direction === 'upload' ? `Xem trước SQL DDL (Local ➔ ${envLabel})` : `Xem trước SQL DDL (${envLabel} ➔ Local)`;
        const targetLabel = direction === 'upload' ? (this.currentEnv === 'prod' ? 'Production Hosting' : 'Demo Hosting') : 'Local Workspace';

        let existing = document.getElementById('sc-db-preview-modal');
        if (existing) existing.remove();

        const sqlText = stmts.join('\n\n');

        const modalHtml = `
            <div class="modal-overlay" id="sc-db-preview-modal" style="display:flex; z-index:10050; align-items:center; justify-content:center; position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(8px);">
                <div class="modal-content" style="max-width:760px; width:92%; max-height:85vh; background:#0f141c; border-radius:14px; overflow:hidden; border:1px solid rgba(255,255,255,0.14); box-shadow:0 24px 70px rgba(0,0,0,0.9); display:flex; flex-direction:column;">
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; background:#161c28; border-bottom:1px solid rgba(255,255,255,0.08);">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:20px;">🗄️</span>
                            <div>
                                <h3 style="margin:0; font-size:15px; font-weight:700; color:#fff;">${this.escapeHtml(title)}</h3>
                                <span style="font-size:12px; color:var(--text-muted, #94a3b8);">Áp dụng lên: <b style="color:#38bdf8;">${this.escapeHtml(targetLabel)}</b> (${stmts.length} câu lệnh)</span>
                            </div>
                        </div>
                        <button type="button" onclick="document.getElementById('sc-db-preview-modal').remove()" style="background:none; border:none; color:#71717a; font-size:22px; cursor:pointer; line-height:1; padding:4px 8px; border-radius:6px;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#71717a'">×</button>
                    </div>
                    <div style="padding:16px 20px; overflow-y:auto; flex:1; background:#090d14;">
                        <div style="background:rgba(16,185,129,0.08); border-left:3px solid #10b981; border-radius:4px; padding:10px 14px; margin-bottom:14px; font-size:12.5px; color:#6ee7b7;">
                            🛡️ <b>Cơ chế An toàn:</b> Hệ thống sẽ <b>tự động sao lưu toàn bộ Database ${this.escapeHtml(targetLabel)}</b> thành tệp <code>.sql</code> trước khi chạy các câu lệnh bên dưới. Nếu sao lưu thất bại, hệ thống sẽ dừng ngay lập tức để bảo vệ dữ liệu.
                        </div>
                        <pre style="margin:0; padding:14px; background:#05070a; border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:#e2e8f0; font-family:var(--mono, monospace); font-size:12.5px; line-height:1.6; white-space:pre-wrap; word-break:break-all; max-height:400px; overflow-y:auto;">${this.escapeHtml(sqlText || '-- Không có câu lệnh nào')}</pre>
                    </div>
                    <div style="padding:14px 20px; background:#141923; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center; gap:10px;">
                        <span style="font-size:12px; color:#94a3b8;">Chỉ đồng bộ DDL (CREATE TABLE / ALTER TABLE) • Không đè Data</span>
                        <div style="display:flex; gap:10px;">
                            <button type="button" class="btn btn-ghost" onclick="document.getElementById('sc-db-preview-modal').remove()" style="padding:8px 16px; font-size:13px; border:1px solid rgba(255,255,255,0.12); border-radius:8px; color:#cbd5e1;">
                                Đóng
                            </button>
                            <button type="button" class="btn btn-primary" onclick="document.getElementById('sc-db-preview-modal').remove(); SyncCenter.executeDbSync('${direction}');" style="padding:8px 18px; font-size:13px; font-weight:600; border-radius:8px; background:linear-gradient(135deg, #00d2d3, #0984e3); border:none; color:#fff; display:flex; align-items:center; gap:6px;">
                                <span>Tiến hành Đồng bộ (Có Backup)</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    async executeDbSync(direction) {
        if (!this.lastData || !this.lastData.db_diff) return;
        const dbDiff = this.lastData.db_diff;
        const stmts = direction === 'upload' ? (dbDiff.upload_statements || []) : (dbDiff.download_statements || []);
        if (stmts.length === 0) {
            UI.showToast('Không có thay đổi cấu trúc nào cần đồng bộ.', 'info');
            return;
        }

        const envLabel = this.currentEnv === 'prod' ? 'Production' : 'Demo';
        const targetLabel = direction === 'upload' ? (this.currentEnv === 'prod' ? 'Production Hosting' : 'Demo Hosting') : 'Local Workspace';
        const projectName = document.getElementById('detail-project-name')?.innerText;
        if (!projectName) return;

        const confirmed = await UI.confirm(
            `Xác nhận đồng bộ cấu trúc SQL (${stmts.length} câu lệnh DDL) sang ${targetLabel}?`
        );
        if (!confirmed) return;

        UI.showLoading(`Đang sao lưu Database & đồng bộ cấu trúc SQL sang ${targetLabel}...`);

        fetch('api.php?action=fmSyncCenterExecuteDb', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: projectName,
                category: App.currentCategory,
                env: this.currentEnv,
                direction: direction,
                queries: stmts
            })
        })
        .then(r => r.json())
        .then(res => {
            UI.hideLoading();
            if (res.status === 'success') {
                const backupInfo = res.backup_file ? `\n(Đã tạo bản backup: ${res.backup_file})` : '';
                UI.showToast(`Đồng bộ cấu trúc SQL thành công! ${backupInfo}`, 'success');
                this.scan(); // Quét lại để cập nhật trạng thái schema
            } else {
                UI.showToast('Lỗi đồng bộ cấu trúc: ' + (res.message || 'Thao tác bị hủy bỏ để bảo vệ an toàn dữ liệu'), 'error');
            }
        })
        .catch(err => {
            UI.hideLoading();
            UI.showToast('Lỗi kết nối khi đồng bộ cấu trúc Database', 'error');
        });
    },

    // ==========================================
    // DIFF VIEWER & COMPARISON ENGINE
    // ==========================================
    diffMode: 'sideBySide', // 'sideBySide' or 'unified'
    currentDiffData: null,

    openDiff(path) {
        const projectName = document.getElementById('detail-project-name')?.innerText;
        if (!projectName) return;

        UI.showLoading('Đang phân tích & so sánh nội dung file...');

        fetch(`api.php?action=fmGetDiff&name=${encodeURIComponent(projectName)}&category=${encodeURIComponent(App.currentCategory)}&path=${encodeURIComponent(path)}&env=${encodeURIComponent(this.currentEnv)}`)
            .then(r => r.json())
            .then(res => {
                UI.hideLoading();
                if (res.status !== 'success') {
                    UI.showToast('Không thể đọc file để so sánh: ' + (res.message || 'Lỗi server'), 'error');
                    return;
                }
                this.currentDiffData = res;
                this.renderDiffModal(res);
            })
            .catch(err => {
                UI.hideLoading();
                UI.showToast('Lỗi kết nối khi tải diff', 'error');
            });
    },

    closeDiffModal() {
        const modal = document.getElementById('sc-diff-modal-container');
        if (modal) modal.remove();
        this.currentDiffData = null;
    },

    setDiffViewMode(mode) {
        this.diffMode = mode;
        if (this.currentDiffData) {
            this.renderDiffModal(this.currentDiffData);
        }
    },

    computeLineDiff(oldStr, newStr) {
        const oldLines = (oldStr || '').split('\n');
        const newLines = (newStr || '').split('\n');

        // Simple LCS Diff Algorithm
        const n = oldLines.length;
        const m = newLines.length;
        
        // Matrix for LCS length
        const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < m; j++) {
                if (oldLines[i] === newLines[j]) {
                    dp[i + 1][j + 1] = dp[i][j] + 1;
                } else {
                    dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
                }
            }
        }

        // Backtrack to get diff operations
        let i = n, j = m;
        const diff = [];
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
                diff.push({ type: 'equal', oldLine: oldLines[i - 1], newLine: newLines[j - 1], oldNum: i, newNum: j });
                i--; j--;
            } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                diff.push({ type: 'insert', oldLine: '', newLine: newLines[j - 1], oldNum: null, newNum: j });
                j--;
            } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
                diff.push({ type: 'delete', oldLine: oldLines[i - 1], newLine: '', oldNum: i, newNum: null });
                i--;
            }
        }

        return diff.reverse();
    },

    renderDiffModal(data) {
        let existing = document.getElementById('sc-diff-modal-container');
        if (existing) existing.remove();

        const path = data.path;
        const local = data.local;
        const remote = data.remote;
        const envLabel = this.currentEnv === 'prod' ? 'Production' : 'Demo';
        const remoteColor = this.currentEnv === 'prod' ? '#fbbf24' : '#c084fc';
        const remoteIcon = this.currentEnv === 'prod' ? '🚀' : '☁️';

        const isLocalExists = local && local.exists;
        const isRemoteExists = remote && remote.exists;

        const localContent = isLocalExists ? local.content : '';
        const remoteContent = isRemoteExists ? remote.content : '';

        // Calculate diff: Local as old (left), Remote as new (right)
        const diffLines = this.computeLineDiff(localContent, remoteContent);
        const countAdded = diffLines.filter(l => l.type === 'insert').length;
        const countDeleted = diffLines.filter(l => l.type === 'delete').length;

        const modal = document.createElement('div');
        modal.id = 'sc-diff-modal-container';
        modal.className = 'sc-diff-overlay';
        modal.onclick = (e) => {
            if (e.target === modal) SyncCenter.closeDiffModal();
        };

        let diffBodyHtml = '';

        if (!isLocalExists && !isRemoteExists) {
            diffBodyHtml = '<div style="padding:40px; text-align:center; color:#f87171;">File không tồn tại ở cả 2 môi trường.</div>';
        } else if (this.diffMode === 'sideBySide') {
            // Side by side rendering
            let rowsHtml = '';
            diffLines.forEach(item => {
                if (item.type === 'equal') {
                    rowsHtml += `
                        <tr>
                            <td>
                                <div class="diff-cell-inner">
                                    <span class="diff-num">${item.oldNum}</span>
                                    <span class="diff-gutter-sym" style="color:#475569;"> </span>
                                    <span class="diff-text">${this.escapeHtml(item.oldLine)}</span>
                                </div>
                            </td>
                            <td>
                                <div class="diff-cell-inner">
                                    <span class="diff-num">${item.newNum}</span>
                                    <span class="diff-gutter-sym" style="color:#475569;"> </span>
                                    <span class="diff-text">${this.escapeHtml(item.newLine)}</span>
                                </div>
                            </td>
                        </tr>
                    `;
                } else if (item.type === 'delete') {
                    rowsHtml += `
                        <tr>
                            <td>
                                <div class="diff-cell-inner diff-del">
                                    <span class="diff-num">${item.oldNum}</span>
                                    <span class="diff-gutter-sym">-</span>
                                    <span class="diff-text">${this.escapeHtml(item.oldLine)}</span>
                                </div>
                            </td>
                            <td style="background:rgba(255,255,255,0.01);">
                                <div class="diff-cell-inner">
                                    <span class="diff-num" style="opacity:0.3;"></span>
                                    <span class="diff-gutter-sym"> </span>
                                    <span class="diff-text"></span>
                                </div>
                            </td>
                        </tr>
                    `;
                } else if (item.type === 'insert') {
                    rowsHtml += `
                        <tr>
                            <td style="background:rgba(255,255,255,0.01);">
                                <div class="diff-cell-inner">
                                    <span class="diff-num" style="opacity:0.3;"></span>
                                    <span class="diff-gutter-sym"> </span>
                                    <span class="diff-text"></span>
                                </div>
                            </td>
                            <td>
                                <div class="diff-cell-inner diff-add">
                                    <span class="diff-num">${item.newNum}</span>
                                    <span class="diff-gutter-sym">+</span>
                                    <span class="diff-text">${this.escapeHtml(item.newLine)}</span>
                                </div>
                            </td>
                        </tr>
                    `;
                }
            });

            diffBodyHtml = `
                <table class="diff-split-table">
                    <thead style="background:#0d121d; position:sticky; top:0; z-index:10; border-bottom:1px solid rgba(255,255,255,0.08);">
                        <tr>
                            <th style="padding:8px 14px; text-align:left; color:#34d399; font-size:12px; font-weight:700; width:50%; border-right:1px solid rgba(255,255,255,0.08);">
                                💻 BẢN LOCAL (DEV) ${isLocalExists ? `(${this.formatBytes(local.size)})` : '<span style="color:#f87171;">(Chưa có)</span>'}
                            </th>
                            <th style="padding:8px 14px; text-align:left; color:${remoteColor}; font-size:12px; font-weight:700; width:50%;">
                                ${remoteIcon} BẢN ${envLabel.toUpperCase()} (HOSTING) ${isRemoteExists ? `(${this.formatBytes(remote.size)})` : '<span style="color:#f87171;">(Chưa có)</span>'}
                            </th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            `;
        } else {
            // Unified rendering
            let linesHtml = '';
            diffLines.forEach(item => {
                if (item.type === 'equal') {
                    linesHtml += `
                        <div class="diff-line">
                            <span class="diff-num">${item.oldNum || ''}</span>
                            <span class="diff-num">${item.newNum || ''}</span>
                            <span class="diff-gutter-sym" style="color:#475569;"> </span>
                            <span class="diff-text">${this.escapeHtml(item.oldLine || item.newLine)}</span>
                        </div>
                    `;
                } else if (item.type === 'delete') {
                    linesHtml += `
                        <div class="diff-line diff-del">
                            <span class="diff-num">${item.oldNum}</span>
                            <span class="diff-num" style="opacity:0.3;"> </span>
                            <span class="diff-gutter-sym">-</span>
                            <span class="diff-text">${this.escapeHtml(item.oldLine)}</span>
                        </div>
                    `;
                } else if (item.type === 'insert') {
                    linesHtml += `
                        <div class="diff-line diff-add">
                            <span class="diff-num" style="opacity:0.3;"> </span>
                            <span class="diff-num">${item.newNum}</span>
                            <span class="diff-gutter-sym">+</span>
                            <span class="diff-text">${this.escapeHtml(item.newLine)}</span>
                        </div>
                    `;
                }
            });

            diffBodyHtml = `
                <div style="background:#0d121d; position:sticky; top:0; z-index:10; border-bottom:1px solid rgba(255,255,255,0.08); padding:8px 14px; font-size:12px; font-weight:700; display:flex; gap:20px;">
                    <span style="color:#34d399;">💻 Local: ${isLocalExists ? this.formatBytes(local.size) : 'Chưa có'}</span>
                    <span style="color:${remoteColor};">${remoteIcon} ${envLabel}: ${isRemoteExists ? this.formatBytes(remote.size) : 'Chưa có'}</span>
                </div>
                <div>${linesHtml}</div>
            `;
        }

        modal.innerHTML = `
            <div class="sc-diff-dialog">
                <!-- Header -->
                <div class="sc-diff-header">
                    <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                        <span style="font-size:18px;">🔍</span>
                        <div>
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:3px; flex-wrap:wrap;">
                                <span class="sc-tag" style="background:${this.getScopeMeta(path).bg}; color:${this.getScopeMeta(path).color}; border:1px solid ${this.getScopeMeta(path).border}; font-weight:700; font-size:11px;">
                                    ${this.getScopeMeta(path).icon} ${this.getScopeMeta(path).label}
                                </span>
                                <span style="font-size:14px; font-weight:700; color:#fff; font-family:var(--mono, monospace); word-break:break-all;">
                                    ${this.escapeHtml(path)}
                                </span>
                            </div>
                            <div style="font-size:11.5px; color:#94a3b8; display:flex; align-items:center; gap:12px; margin-top:2px;">
                                <span><b style="color:#34d399;">+${countAdded}</b> thêm mới</span>
                                <span><b style="color:#fb7185;">-${countDeleted}</b> xóa/sửa</span>
                                <span style="display:inline-flex; align-items:center; gap:4px; color:#38bdf8;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Tự động Backup trước khi đè [${envLabel}]</span>
                            </div>
                        </div>
                    </div>

                    <div style="display:flex; align-items:center; gap:8px;">
                        <!-- Mode Toggle -->
                        <div style="display:flex; background:rgba(255,255,255,0.06); padding:3px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
                            <button style="padding:4px 10px; border-radius:6px; font-size:11.5px; font-weight:700; border:none; cursor:pointer; background:${this.diffMode === 'sideBySide' ? 'var(--primary, #00d2d3)' : 'transparent'}; color:${this.diffMode === 'sideBySide' ? '#000' : '#94a3b8'}; transition:all 0.15s;" onclick="SyncCenter.setDiffViewMode('sideBySide')">
                                Song song (Split)
                            </button>
                            <button style="padding:4px 10px; border-radius:6px; font-size:11.5px; font-weight:700; border:none; cursor:pointer; background:${this.diffMode === 'unified' ? 'var(--primary, #00d2d3)' : 'transparent'}; color:${this.diffMode === 'unified' ? '#000' : '#94a3b8'}; transition:all 0.15s;" onclick="SyncCenter.setDiffViewMode('unified')">
                                Gộp dòng (Unified)
                            </button>
                        </div>
                        <button class="btn btn-ghost" onclick="SyncCenter.closeDiffModal()" style="height:32px; width:32px; padding:0; border-radius:8px; font-size:16px;">✕</button>
                    </div>
                </div>

                <!-- Body (Diff Container) -->
                <div class="sc-diff-body">
                    ${diffBodyHtml}
                </div>

                <!-- Footer Actions -->
                <div class="sc-diff-footer">
                    <div style="font-size:12px; color:#94a3b8; display:flex; align-items:center; gap:8px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span>Bản gốc trước khi ghi đè sẽ được tự động lưu trữ trong thư mục <code>backups/sync_snapshots/.../${this.currentEnv}/</code></span>
                    </div>

                    <div style="display:flex; align-items:center; gap:10px;">
                        <button class="btn btn-ghost" onclick="SyncCenter.closeDiffModal()" style="height:36px; padding:0 14px;">Đóng</button>
                        <button class="btn" style="height:36px; padding:0 16px; font-weight:700; background:linear-gradient(135deg, #a855f7, #7c3aed); color:#fff; border:none;" onclick="SyncCenter.executeSingleDiff('${this.escapeHtml(path)}', 'download')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                            Kéo ${envLabel} về Local (Backup Local)
                        </button>
                        <button class="btn btn-primary" style="height:36px; padding:0 16px; font-weight:700;" onclick="SyncCenter.executeSingleDiff('${this.escapeHtml(path)}', 'upload')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                            Đẩy Local lên ${envLabel} (Backup ${envLabel})
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    async executeSingleDiff(path, action) {
        const envLabel = this.currentEnv === 'prod' ? 'Production' : 'Demo';
        if (!await UI.confirm(`Xác nhận ${action === 'upload' ? `đẩy bản Local lên ghi đè ${envLabel}` : `kéo bản ${envLabel} về ghi đè Local`}?\n\n🛡️ Bản cũ sẽ được tự động backup an toàn.`)) return;

        const actions = { upload: [], download: [] };
        actions[action].push(path);

        UI.showLoading(`Đang ${action === 'upload' ? 'đẩy' : 'kéo'} file & tạo bản sao lưu...`);

        this.runExecuteApi(actions).then(res => {
            UI.hideLoading();
            if (res.status === 'success') {
                UI.showToast(`Đã ${action === 'upload' ? 'đẩy' : 'kéo'} file thành công & đã xoá sạch cache compiled!`, 'success');
                this.closeDiffModal();
                this.scan(); // Refresh differences
            } else {
                UI.showToast('Lỗi đồng bộ: ' + res.message, 'error');
            }
        }).catch(err => {
            UI.hideLoading();
            UI.showToast('Lỗi kết nối khi đồng bộ', 'error');
        });
    },

    // ==========================================
    // BACKUP & RESTORE HISTORY MANAGEMENT
    // ==========================================
    cachedBackups: [],
    backupFilter: 'all',
    backupEnvFilter: 'all',
    backupSearch: '',

    openBackupHistory() {
        const sideTab = document.getElementById('side-tab-backups');
        if (sideTab) {
            UI.switchProjectTab(sideTab, 'd_tab-backups');
        } else {
            this.openBackupHistoryTab();
        }
    },

    openBackupHistoryTab() {
        const projectName = document.getElementById('detail-project-name')?.innerText?.trim() || (App.currentProject ? App.currentProject.name : '');
        if (!projectName) {
            UI.showToast('Vui lòng chọn dự án trước khi xem lịch sử backup!', 'warning');
            return;
        }

        UI.showLoading('Đang tải danh sách bản sao lưu...');

        const envParam = this.backupEnvFilter || 'all';
        fetch(`api.php?action=fmListBackups&name=${encodeURIComponent(projectName)}&category=${encodeURIComponent(App.currentCategory || 'projects')}&env=${encodeURIComponent(envParam)}`)
            .then(r => r.json())
            .then(res => {
                UI.hideLoading();
                if (res.status !== 'success') {
                    UI.showToast('Không thể tải lịch sử backup: ' + (res.message || 'Lỗi server'), 'error');
                    return;
                }
                this.cachedBackups = res.backups || [];
                this.renderBackupHistoryTab();
            })
            .catch(() => {
                UI.hideLoading();
                UI.showToast('Lỗi kết nối khi lấy lịch sử backup', 'error');
            });
    },

    setBackupFilter(type) {
        this.backupFilter = type;
        document.querySelectorAll('#d_tab-backups .sc-pill-type, #sc-backup-tab-main .sc-pill-type').forEach(btn => btn.classList.remove('active'));
        const targetBtn = document.getElementById(`sc-bk-pill-${type}`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
        this.renderBackupList();
    },

    setBackupEnvFilter(env) {
        this.backupEnvFilter = env;
        this.openBackupHistoryTab();
    },

    setBackupSearch(query) {
        this.backupSearch = (query || '').toLowerCase().trim();
        this.renderBackupList();
    },

    getFilteredBackups() {
        let list = this.cachedBackups;
        if (this.backupEnvFilter && this.backupEnvFilter !== 'all') {
            list = list.filter(b => (b.env || 'demo') === this.backupEnvFilter);
        }
        if (this.backupFilter !== 'all') {
            list = list.filter(b => b.type === this.backupFilter);
        }
        if (this.backupSearch) {
            list = list.filter(b => (b.original_rel_path || '').toLowerCase().includes(this.backupSearch) || (b.date || '').includes(this.backupSearch));
        }
        return list;
    },

    renderBackupHistoryTab() {
        const container = document.getElementById('sc-backup-tab-main');
        if (!container) return;

        const total = this.cachedBackups.length;
        const countDemo = this.cachedBackups.filter(b => (b.env || 'demo') === 'demo').length;
        const countProd = this.cachedBackups.filter(b => b.env === 'prod').length;

        const countUpload = this.cachedBackups.filter(b => b.type === 'remote_before_upload').length;
        const countDownload = this.cachedBackups.filter(b => b.type === 'local_before_download').length;
        const countEdit = this.cachedBackups.filter(b => b.type === 'remote_before_edit').length;

        container.innerHTML = `
            <!-- Toolbar & Filter -->
            <div style="padding: 4px 0 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 18px;">
                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                    <!-- Environment Filter Pills -->
                    <div style="display: inline-flex; background: rgba(255,255,255,0.04); padding: 3px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.08); gap: 2px;">
                        <button class="sc-pill-btn ${this.backupEnvFilter === 'all' ? 'active' : ''}" style="height:28px; padding:0 10px; font-size:11.5px; border-radius:6px;" onclick="SyncCenter.setBackupEnvFilter('all')">
                            Tất cả MT <span class="sc-badge-count">${total}</span>
                        </button>
                        <button class="sc-pill-btn ${this.backupEnvFilter === 'demo' ? 'active' : ''}" style="height:28px; padding:0 10px; font-size:11.5px; border-radius:6px; color:#38bdf8;" onclick="SyncCenter.setBackupEnvFilter('demo')">
                            🌐 Demo <span class="sc-badge-count">${countDemo}</span>
                        </button>
                        <button class="sc-pill-btn ${this.backupEnvFilter === 'prod' ? 'active' : ''}" style="height:28px; padding:0 10px; font-size:11.5px; border-radius:6px; color:#fbbf24;" onclick="SyncCenter.setBackupEnvFilter('prod')">
                            🚀 Production <span class="sc-badge-count">${countProd}</span>
                        </button>
                    </div>

                    <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>

                    <!-- Type Filter Pills -->
                    <div style="display: inline-flex; gap: 6px; flex-wrap: wrap;">
                        <button class="sc-pill-btn sc-pill-type pill-all ${this.backupFilter === 'all' ? 'active' : ''}" id="sc-bk-pill-all" style="height:32px; padding:0 10px; font-size:11.5px;" onclick="SyncCenter.setBackupFilter('all')">
                            Tất cả loại
                        </button>
                        <button class="sc-pill-btn sc-pill-type pill-up ${this.backupFilter === 'remote_before_upload' ? 'active' : ''}" id="sc-bk-pill-remote_before_upload" style="height:32px; padding:0 10px; font-size:11.5px;" onclick="SyncCenter.setBackupFilter('remote_before_upload')">
                            🛡️ Trước khi Upload <span class="sc-badge-count">${countUpload}</span>
                        </button>
                        <button class="sc-pill-btn sc-pill-type pill-down ${this.backupFilter === 'local_before_download' ? 'active' : ''}" id="sc-bk-pill-local_before_download" style="height:32px; padding:0 10px; font-size:11.5px;" onclick="SyncCenter.setBackupFilter('local_before_download')">
                            💻 Trước khi Download <span class="sc-badge-count">${countDownload}</span>
                        </button>
                        <button class="sc-pill-btn sc-pill-type pill-conflict ${this.backupFilter === 'remote_before_edit' ? 'active' : ''}" id="sc-bk-pill-remote_before_edit" style="height:32px; padding:0 10px; font-size:11.5px;" onclick="SyncCenter.setBackupFilter('remote_before_edit')">
                            ✎ Trước Sửa Web <span class="sc-badge-count">${countEdit}</span>
                        </button>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <button class="btn btn-danger btn-sm" id="sc-btn-delete-backups" onclick="SyncCenter.deleteSelectedBackups()" style="display:none; height:34px; padding:0 12px; font-weight:700; background:#ef4444; color:#fff; border:none; border-radius:8px;">
                        🗑️ Xóa đã chọn (<span id="sc-bk-selected-count">0</span>)
                    </button>
                    <div style="min-width: 240px;">
                        <input type="text" placeholder="🔍 Tìm theo đường dẫn file hoặc ngày..." style="width:100%; height:34px; padding:0 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.25); color:#fff; font-size:12.5px; outline:none; box-sizing:border-box;" oninput="SyncCenter.setBackupSearch(this.value)">
                    </div>
                </div>
            </div>

            <!-- Table Container -->
            <div id="sc-backup-list-body"></div>
        `;

        this.renderBackupList();
    },

    renderBackupList() {
        const container = document.getElementById('sc-backup-list-body');
        if (!container) return;

        const list = this.getFilteredBackups();

        if (list.length === 0) {
            container.innerHTML = `
                <div style="padding: 60px 20px; text-align: center; color: #64748b;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:10px; opacity:0.5;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
                    <div style="font-size: 14px; font-weight: 600; color: #cbd5e1;">Chưa có bản sao lưu nào khớp</div>
                    <p style="font-size: 12px; margin: 4px 0 0;">Bản sao lưu sẽ tự động được tạo mỗi khi bạn thực hiện Đồng bộ (Sync) hoặc Sửa file.</p>
                </div>
            `;
            this.updateBackupSelectedCount();
            return;
        }

        let html = `
            <table class="sc-table">
                <thead>
                    <tr>
                        <th style="width: 44px; text-align: center;">
                            <input type="checkbox" class="sc-custom-cb" id="sc-bk-check-all" onchange="SyncCenter.toggleSelectAllBackups(this.checked)">
                        </th>
                        <th style="width: 155px; white-space: nowrap;">Thời gian</th>
                        <th style="width: 110px; white-space: nowrap;">Môi trường</th>
                        <th>Đường dẫn File gốc</th>
                        <th style="width: 190px; white-space: nowrap;">Loại Snapshot</th>
                        <th style="width: 85px; white-space: nowrap;">Dung lượng</th>
                        <th style="width: 280px; text-align: right; white-space: nowrap;">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
        `;

        list.forEach(item => {
            const path = item.original_rel_path || '';
            const icon = this.getFileIcon(path);
            const backupFile = item.backup_file || '';
            const env = item.env === 'prod' ? 'prod' : 'demo';
            
            let envBadge = '';
            if (env === 'prod') {
                envBadge = `<span class="sc-tag" style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.35); font-weight:700;">🚀 Prod</span>`;
            } else {
                envBadge = `<span class="sc-tag sc-tag-cyan" style="font-weight:700;">🌐 Demo</span>`;
            }

            let typeLabel = '';
            let typeTagClass = '';
            if (item.type === 'remote_before_upload') {
                typeLabel = `${env === 'prod' ? '🚀 Prod' : '🛡️ Demo'} (Trước Upload)`;
                typeTagClass = 'sc-tag-emerald';
            } else if (item.type === 'local_before_download') {
                typeLabel = '💻 Local (Trước Download)';
                typeTagClass = 'sc-tag-purple';
            } else if (item.type === 'remote_before_edit') {
                typeLabel = `${env === 'prod' ? '🚀 Prod' : '✎ Demo'} (Trước Sửa Web)`;
                typeTagClass = 'sc-tag-cyan';
            } else {
                typeLabel = '⏪ Bản lưu trước Restore';
                typeTagClass = 'sc-tag-indigo';
            }

            const restoreRemoteBtn = env === 'prod' ? `
                <button class="btn btn-ghost btn-sm" style="height:30px; padding:0 10px; font-size:11.5px; font-weight:700; color:#fbbf24; border-color:rgba(245,158,11,0.35);" onclick="SyncCenter.restoreBackup('${this.escapeHtml(backupFile)}', '${this.escapeHtml(path)}', 'remote', 'prod')" title="Khôi phục ghi đè lại lên Production Hosting">
                    🚀 Lên Prod
                </button>
            ` : `
                <button class="btn btn-ghost btn-sm" style="height:30px; padding:0 10px; font-size:11.5px; font-weight:700; color:#34d399; border-color:rgba(16,185,129,0.3);" onclick="SyncCenter.restoreBackup('${this.escapeHtml(backupFile)}', '${this.escapeHtml(path)}', 'remote', 'demo')" title="Khôi phục ghi đè lại lên Demo Hosting">
                    ⏫ Lên Demo
                </button>
            `;

            html += `
                <tr>
                    <td style="text-align: center;">
                        <input type="checkbox" class="sc-custom-cb sc-bk-cb" value="${this.escapeHtml(backupFile)}" onchange="SyncCenter.updateBackupSelectedCount()">
                    </td>
                    <td style="white-space: nowrap; font-family: var(--mono, monospace); font-size: 12px; color: #94a3b8;">
                        <span style="color: #f8fafc; font-weight: 600;">${this.escapeHtml(item.time || '')}</span> 
                        <span style="color: #64748b; font-size: 11px;">${this.escapeHtml(item.date || '')}</span>
                    </td>
                    <td style="white-space: nowrap;">
                        ${envBadge}
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${icon}
                            <span style="font-family: var(--mono, monospace); font-size: 12.5px; color: #f8fafc; font-weight: 600; word-break: break-all;">
                                ${this.escapeHtml(path)}
                            </span>
                        </div>
                    </td>
                    <td style="white-space: nowrap;">
                        <span class="sc-tag ${typeTagClass}">${typeLabel}</span>
                    </td>
                    <td style="white-space: nowrap; font-family: var(--mono, monospace); font-size: 12px; color: #94a3b8;">
                        ${this.formatBytes(item.size)}
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <div style="display: inline-flex; align-items: center; gap: 6px;">
                            <button class="sc-btn-diff" onclick="SyncCenter.previewBackup('${this.escapeHtml(backupFile)}', '${this.escapeHtml(path)}', '${env}')" title="Xem nội dung code bản snapshot này">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                <span>Xem</span>
                            </button>
                            <button class="btn btn-ghost btn-sm" style="height:30px; padding:0 10px; font-size:11.5px; font-weight:700; color:#c084fc; border-color:rgba(168,85,247,0.3);" onclick="SyncCenter.restoreBackup('${this.escapeHtml(backupFile)}', '${this.escapeHtml(path)}', 'local', '${env}')" title="Khôi phục ghi đè lại file Local">
                                ⏪ Về Local
                            </button>
                            ${restoreRemoteBtn}
                            <button class="btn btn-ghost btn-sm" style="height:30px; width:30px; padding:0; color:#f87171; border-color:rgba(248,113,113,0.25);" onclick="SyncCenter.deleteSingleBackup('${this.escapeHtml(backupFile)}', '${this.escapeHtml(path)}')" title="Xóa bản sao lưu này">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
        this.updateBackupSelectedCount();
    },

    updateBackupSelectedCount() {
        const checked = document.querySelectorAll('.sc-bk-cb:checked');
        const count = checked.length;
        const btn = document.getElementById('sc-btn-delete-backups');
        const counter = document.getElementById('sc-bk-selected-count');
        if (btn) {
            btn.style.display = count > 0 ? 'inline-flex' : 'none';
        }
        if (counter) {
            counter.innerText = count;
        }
        const checkAll = document.getElementById('sc-bk-check-all');
        const allCbs = document.querySelectorAll('.sc-bk-cb');
        if (checkAll && allCbs.length > 0) {
            checkAll.checked = count === allCbs.length;
        }
    },

    toggleSelectAllBackups(checked) {
        document.querySelectorAll('.sc-bk-cb').forEach(cb => cb.checked = checked);
        this.updateBackupSelectedCount();
    },

    async deleteSingleBackup(backupFile, path) {
        if (!await UI.confirm(`Xác nhận xóa vĩnh viễn bản sao lưu của file:\n${path}?`)) {
            return;
        }
        this.runDeleteBackupsApi({ backup_files: [backupFile] });
    },

    async deleteSelectedBackups() {
        const checked = Array.from(document.querySelectorAll('.sc-bk-cb:checked')).map(cb => cb.value);
        if (checked.length === 0) return;
        if (!await UI.confirm(`Xác nhận xóa vĩnh viễn ${checked.length} bản sao lưu đã chọn?`)) {
            return;
        }
        this.runDeleteBackupsApi({ backup_files: checked });
    },

    async clearAllBackups() {
        if (this.cachedBackups.length === 0) {
            UI.showToast('Không có bản sao lưu nào để dọn dẹp', 'warning');
            return;
        }
        if (!await UI.confirm(`CẢNH BÁO: Xác nhận DỌN SẠCH TOÀN BỘ ${this.cachedBackups.length} bản sao lưu của dự án này?\n\nHành động này không thể hoàn tác!`)) {
            return;
        }
        this.runDeleteBackupsApi({ all: true });
    },

    runDeleteBackupsApi(payload) {
        const projectName = document.getElementById('detail-project-name')?.innerText?.trim() || (App.currentProject ? App.currentProject.name : '');
        UI.showLoading('Đang xóa bản sao lưu...');

        fetch('api.php?action=fmDeleteBackups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: projectName,
                category: App.currentCategory || 'projects',
                ...payload
            })
        })
        .then(r => r.json())
        .then(res => {
            UI.hideLoading();
            if (res.status === 'success') {
                UI.showToast(res.message || 'Đã xóa bản sao lưu thành công!', 'success');
                this.openBackupHistoryTab(); // Reload backup list in tab
            } else {
                UI.showToast('Lỗi khi xóa: ' + res.message, 'error');
            }
        })
        .catch(() => {
            UI.hideLoading();
            UI.showToast('Lỗi kết nối khi xóa bản sao lưu', 'error');
        });
    },

    async restoreBackup(backupFile, path, target, env = 'demo') {
        const isRemote = target === 'remote';
        const targetName = isRemote ? (env === 'prod' ? 'Production Hosting' : 'Demo Hosting') : 'Local Workspace';
        const actionVerb = isRemote ? 'LÊN' : 'VỀ';
        const actionVerbLower = isRemote ? 'lên' : 'về';
        
        if (!await UI.confirm(`Xác nhận KHÔI PHỤC ${actionVerb} ${targetName} cho file:\n${path}\n\n🛡️ Bản file hiện tại sẽ được tự động sao lưu an toàn trước khi khôi phục.`)) {
            return;
        }

        const projectName = document.getElementById('detail-project-name')?.innerText;
        UI.showLoading(`Đang khôi phục file ${actionVerbLower} ${targetName}...`);

        fetch('api.php?action=fmRestoreBackup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: projectName,
                category: App.currentCategory,
                backup_file: backupFile,
                path: path,
                target: target,
                env: env
            })
        })
        .then(r => r.json())
        .then(res => {
            UI.hideLoading();
            if (res.status === 'success') {
                UI.showToast(res.message || `Đã khôi phục thành công ${actionVerbLower} ${targetName}!`, 'success');
                this.openBackupHistoryTab(); // Reload list in tab
                this.scan(); // Rescan Sync Center
            } else {
                UI.showToast('Lỗi khôi phục: ' + res.message, 'error');
            }
        })
        .catch(() => {
            UI.hideLoading();
            UI.showToast('Lỗi kết nối khi khôi phục', 'error');
        });
    },

    previewBackup(backupFile, path, env = 'demo') {
        const projectName = document.getElementById('detail-project-name')?.innerText;
        UI.showLoading('Đang tải nội dung bản sao lưu...');

        fetch(`api.php?action=fmGetBackupContent&name=${encodeURIComponent(projectName)}&category=${encodeURIComponent(App.currentCategory)}&backup_file=${encodeURIComponent(backupFile)}`)
            .then(r => r.json())
            .then(res => {
                UI.hideLoading();
                if (res.status !== 'success') {
                    UI.showToast('Không thể đọc file: ' + res.message, 'error');
                    return;
                }

                let previewModal = document.getElementById('sc-backup-preview-modal');
                if (previewModal) previewModal.remove();

                previewModal = document.createElement('div');
                previewModal.id = 'sc-backup-preview-modal';
                previewModal.className = 'sc-diff-overlay';
                previewModal.style.zIndex = '10060';
                previewModal.onclick = (e) => {
                    if (e.target === previewModal) previewModal.remove();
                };

                const lines = (res.content || '').split('\n');
                let codeHtml = '';
                lines.forEach((line, idx) => {
                    codeHtml += `
                        <div class="diff-line">
                            <span class="diff-num">${idx + 1}</span>
                            <span class="diff-text">${this.escapeHtml(line)}</span>
                        </div>
                    `;
                });

                const envLabel = env === 'prod' ? 'Production' : 'Demo';
                const remoteBtnBg = env === 'prod' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #10b981, #059669)';

                previewModal.innerHTML = `
                    <div class="sc-diff-dialog" style="max-width: 1100px; height: 80vh;">
                        <div class="sc-diff-header">
                            <div style="font-size: 14px; font-weight: 700; color: #fff; font-family: var(--mono, monospace);">
                                📄 Xem Snapshot [${envLabel}]: ${this.escapeHtml(path)}
                            </div>
                            <button class="btn btn-ghost" onclick="document.getElementById('sc-backup-preview-modal').remove()" style="height:30px; width:30px; padding:0; border-radius:8px;">✕</button>
                        </div>
                        <div class="sc-diff-body" style="padding: 10px 0;">
                            ${codeHtml}
                        </div>
                        <div class="sc-diff-footer">
                            <span style="font-size: 12px; color: #94a3b8;">${lines.length} dòng | ${this.formatBytes(res.content.length)}</span>
                            <div style="display:flex; gap:10px;">
                                <button class="btn btn-ghost" onclick="document.getElementById('sc-backup-preview-modal').remove()">Đóng</button>
                                <button class="btn btn-primary" onclick="SyncCenter.restoreBackup('${this.escapeHtml(backupFile)}', '${this.escapeHtml(path)}', 'local', '${env}'); document.getElementById('sc-backup-preview-modal').remove();">
                                    ⏪ Khôi phục về Local
                                </button>
                                <button class="btn" style="background:${remoteBtnBg}; color:#fff; font-weight:700;" onclick="SyncCenter.restoreBackup('${this.escapeHtml(backupFile)}', '${this.escapeHtml(path)}', 'remote', '${env}'); document.getElementById('sc-backup-preview-modal').remove();">
                                    ⏫ Khôi phục lên ${envLabel}
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                document.body.appendChild(previewModal);
            })
            .catch(() => {
                UI.hideLoading();
                UI.showToast('Lỗi kết nối khi tải nội dung snapshot', 'error');
            });
    },

    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    escapeHtml(unsafe) {
        return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
};
