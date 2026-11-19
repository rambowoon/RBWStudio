const FontManager = {
    async reindex() {
        UI.notify('Đang quét và đồng bộ lại chỉ mục tree.md...', 'info');
        try {
            const res = await (await fetch('api.php?action=reindexFonts')).json();
            if (res.status === 'success') {
                UI.notify(res.message, 'success');
                this.search(true);
            } else {
                UI.notify('Lỗi đồng bộ: ' + (res.message || 'Thao tác thất bại'), 'error');
            }
        } catch (err) {
            UI.notify('Lỗi kết nối API đồng bộ', 'error');
        }
    },

    async search(isProjectView = false) {
        const inputId = isProjectView ? 'project-font-search-input' : 'font-search-input';
        const resultsId = isProjectView ? 'project-font-results' : 'font-results';
        
        const query = document.getElementById(inputId).value.trim();
        // Allow empty query to show all
        
        const resultsContainer = document.getElementById(resultsId);
        resultsContainer.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px;"><div class="spinner" style="margin:0 auto 10px;"></div>Đang tìm kiếm...</div>';

        try {
            const res = await (await fetch(`api.php?action=searchFonts&query=${encodeURIComponent(query)}`)).json();
            if (res.status === 'success') {
                this.renderResults(res.data, resultsId);
                
                if (query !== '' && !res.google_search) {
                    UI.notify('Không thể kết nối với Google Fonts. Chỉ hiển thị kết quả từ Local Library.', 'info');
                }
            } else {
                UI.notify('Lỗi tìm kiếm: ' + res.message, 'error');
            }
        } catch (err) {
            UI.notify('Lỗi kết nối API', 'error');
        }
    },

    renderResults(fonts, resultsId) {
        const container = document.getElementById(resultsId);
        container.innerHTML = '';

        if (fonts.length === 0) {
            container.innerHTML = '<p style="color:var(--muted); text-align:center; padding:40px; grid-column: 1/-1;">Không tìm thấy font nào phù hợp.</p>';
            return;
        }

        const woffFonts = [];
        const convertFonts = [];

        fonts.forEach(font => {
            if (font.source === 'google' || (font.variants && font.variants.length > 0)) {
                woffFonts.push(font);
            }
            if (font.source === 'local' && font.convert_variants && font.convert_variants.length > 0) {
                convertFonts.push(font);
            }
        });

        // 1. Render WOFF Fonts
        if (woffFonts.length > 0) {
            const header = document.createElement('div');
            header.style.gridColumn = '1/-1';
            header.style.margin = '20px 0 10px 0';
            header.innerHTML = `
                <h4 style="margin:0; color:var(--primary); font-size:0.95rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:8px;">
                    <span style="display:inline-block; width:6px; height:14px; background:var(--primary); border-radius:2px;"></span>
                    Font WOFF / WOFF2 (Khuyên Dùng - Tương Thích Web Tốt Nhất)
                </h4>
            `;
            container.appendChild(header);

            woffFonts.forEach(font => {
                const card = document.createElement('div');
                const isGoogle = font.source === 'google';
                card.className = isGoogle ? 'font-card-premium google' : 'font-card-premium';
                
                const displayFamily = isGoogle ? font.family : font.family.split(' > ').pop();

                card.innerHTML = `
                    <div class="font-card-header">
                        <div class="font-card-header-left">
                            <div class="font-family-title" style="font-family: '${displayFamily}', sans-serif; color: #0F172A !important; font-weight: 800; font-size: 1.25rem;">${displayFamily}</div>
                            <div class="font-path-badge" style="display:inline-flex;align-items:center;gap:5px;">${isGoogle ? `${fi("cloud", 12)} Google Web Fonts` : `${fi("folder", 12)} ${font.family}`}</div>
                        </div>
                        <div class="font-source-tag ${isGoogle ? 'google' : 'local'}" style="display:inline-flex;align-items:center;gap:4px;">
                            ${isGoogle ? `${fi("cloud", 12)} Google` : `${fi("zap", 12)} Local WOFF`}
                        </div>
                    </div>
                    
                    ${!isGoogle ? `
                    <div class="font-variants-wrap">
                        <div class="font-variants-header">
                            <span class="font-variants-title">BIẾN THỂ WEIGHT & STYLE (${(font.variants || []).length})</span>
                            <button class="btn btn-ghost" style="font-size:0.68rem; padding:3px 10px; height:auto; color:#4f46e5; background:#eef2ff; border:1px solid #c7d2fe; border-radius:6px; font-weight:600; cursor:pointer;" onclick="FontManager.toggleAll('${font.id}')">Chọn tất cả</button>
                        </div>
                        <div class="font-variants-box" id="vars-${font.id.replace(/[^a-z0-9]/gi, '')}" style="background:#F8FAFC !important; border:1px solid #E2E8F0 !important;">
                            ${(font.variants || []).map(v => `
                                <label class="font-variant-chip" style="background:#FFFFFF !important; color:#1E293B !important; border:1px solid #CBD5E1 !important;">
                                    <input type="checkbox" class="font-variant-checkbox" data-font="${font.id}" data-variant="${v}">
                                    <span>${String(v).replace(/italic/gi, 'I').replace(/i$/i, 'I').replace(/\s+/g, '')}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    ` : `
                    <div class="font-variants-wrap">
                        <div class="font-variants-header">
                            <span class="font-variants-title">CHỌN BIẾN THỂ CẦN DÙNG (${(font.variants || []).length})</span>
                            <button class="btn btn-ghost" style="font-size:0.68rem; padding:3px 10px; height:auto; color:#4f46e5; background:#eef2ff; border:1px solid #c7d2fe; border-radius:6px; font-weight:600; cursor:pointer;" onclick="FontManager.toggleAllGoogle('${font.family}')">Chọn tất cả</button>
                        </div>
                        <div class="font-variants-box" id="gvars-${font.family.replace(/[^a-z0-9]/gi, '')}" style="background:#F8FAFC !important; border:1px solid #E2E8F0 !important;">
                            ${(font.variants || []).map(v => {
                                const vStr = String(v);
                                const isDefault = ['400', '700', 'regular'].includes(vStr.toLowerCase());
                                const label = vStr.toLowerCase() === 'regular' ? '400' : (vStr.toLowerCase() === 'italic' ? '400I' : vStr.replace(/italic/gi, 'I').replace(/i$/i, 'I').replace(/\s+/g, ''));
                                return `
                                <label class="font-variant-chip" style="background:#FFFFFF !important; color:#1E293B !important; border:1px solid #CBD5E1 !important;">
                                    <input type="checkbox" class="font-google-variant-checkbox" data-family="${font.family}" data-variant="${vStr}" ${isDefault ? 'checked' : ''}>
                                    <span>${label}</span>
                                </label>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    `}

                    <div>
                        ${isGoogle ? 
                            `<div style="display:flex; flex-direction:column; gap:8px;">
                                <button class="font-action-btn-local" style="width:100%; background:linear-gradient(135deg, #10b981, #059669); box-shadow: 0 4px 12px rgba(16,185,129,0.25); display:inline-flex; align-items:center; justify-content:center; gap:6px;" onclick="FontManager.downloadGoogle('${font.family}')" title="Tải các biến thể font đã chọn về lưu trữ trực tiếp trong assets/fonts/ và tạo @font-face local">${fi("download", 14)} Tải font về Website</button>
                                <button class="font-action-btn-google" style="width:100%; background:linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 4px 12px rgba(99,102,241,0.25); border:none; display:inline-flex; align-items:center; justify-content:center; gap:6px;" onclick="FontManager.quickAddGoogle('${font.family}')" title="Chèn dòng @import Google Fonts online vào fonts.css">${fi("zap", 14)} Nhúng @import Online</button>
                            </div>` :
                            `<button class="font-action-btn-local" style="display:inline-flex; align-items:center; justify-content:center; gap:6px;" onclick="FontManager.install('${font.id}', '${font.family}')">${fi("save", 14)} Install Local Font</button>`
                        }
                    </div>
                `;
                
                if (isGoogle) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = `https://fonts.googleapis.com/css2?family=${displayFamily.replace(/ /g, '+')}&display=swap`;
                    document.head.appendChild(link);
                }
                
                container.appendChild(card);
            });
        }

        // 2. Render OTF/TTF Fonts
        if (convertFonts.length > 0) {
            const header = document.createElement('div');
            header.style.gridColumn = '1/-1';
            header.style.margin = '40px 0 10px 0';
            header.innerHTML = `
                <h4 style="margin:0; color:var(--warning); font-size:0.95rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:8px;">
                    <span style="display:inline-block; width:6px; height:14px; background:var(--warning); border-radius:2px;"></span>
                    Font Gốc OTF / TTF (Cần Convert Sang WOFF)
                </h4>
            `;
            container.appendChild(header);

            convertFonts.forEach(font => {
                const card = document.createElement('div');
                card.className = 'font-card-premium convertible';
                const displayFamily = font.family.split(' > ').pop();

                card.innerHTML = `
                    <div class="font-card-header">
                        <div class="font-card-header-left">
                            <div class="font-family-title" style="font-family: '${displayFamily}', sans-serif; color: #0F172A !important; font-weight: 800; font-size: 1.25rem;">${displayFamily}</div>
                            <div class="font-path-badge" style="display:inline-flex;align-items:center;gap:5px;">${fi("folder", 12)} ${font.family}</div>
                        </div>
                        <div class="font-source-tag convertible" style="display:inline-flex;align-items:center;gap:4px;">
                            ${fi("settings", 12)} Convertible
                        </div>
                    </div>
                    
                    <div class="font-variants-wrap">
                        <div class="font-variants-header">
                            <span class="font-variants-title">BIẾN THỂ CẦN CONVERT (${(font.convert_variants || []).length})</span>
                            <button class="btn btn-ghost" style="font-size:0.68rem; padding:3px 10px; height:auto; color:#b45309; background:#fef3c7; border:1px solid #fde68a; border-radius:6px; font-weight:600; cursor:pointer;" onclick="FontManager.toggleAllConvert('${font.id}')">Chọn tất cả</button>
                        </div>
                        <div class="font-variants-box" id="conv-vars-${font.id.replace(/[^a-z0-9]/gi, '')}" style="background:#F8FAFC !important; border:1px solid #E2E8F0 !important;">
                            ${(font.convert_variants || []).map(cv => `
                                <label class="font-variant-chip" style="background:#FFFFFF !important; color:#1E293B !important; border:1px solid #CBD5E1 !important;">
                                    <input type="checkbox" class="font-convert-checkbox" data-font="${font.id}" data-variant="${cv.variant}" data-ext="${cv.ext}" data-filename="${cv.filename}">
                                    <span>${String(cv.variant).replace(/italic/gi, 'I').replace(/i$/i, 'I').replace(/\s+/g, '')} (${cv.ext.toUpperCase()})</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <div>
                        <button class="font-action-btn-convert" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;" onclick="FontManager.convertAndInstall('${font.id}', '${font.family}')">${fi("zap", 14)} Convert & Install Font</button>
                    </div>
                `;
                
                container.appendChild(card);
            });
        }
    },

    toggleAllGoogle(family) {
        const checkboxes = document.querySelectorAll(`.font-google-variant-checkbox[data-family="${family}"]`);
        if (checkboxes.length === 0) return;
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => cb.checked = !allChecked);
    },

    _normalizeVariantToken(v) {
        const s = String(v).trim().toLowerCase();
        if (s === 'regular' || s === 'normal') return '400';
        if (s === 'italic') return '400i';
        const w = s.replace(/[^0-9]/g, '') || '400';
        const isItalic = s.endsWith('i') || s.includes('italic');
        return isItalic ? `${w}i` : w;
    },

    _sortVariantTokens(tokens) {
        return [...new Set(tokens)].sort((a, b) => {
            const wa = parseInt(a, 10) || 400;
            const wb = parseInt(b, 10) || 400;
            if (wa !== wb) return wa - wb;
            return a.endsWith('i') === b.endsWith('i') ? 0 : (a.endsWith('i') ? 1 : -1);
        });
    },

    _buildGoogleCssV1Url(family, variants) {
        const famPlus = family.trim().replace(/\s+/g, '+');
        if (!variants || variants.length === 0) {
            return `https://fonts.googleapis.com/css?family=${famPlus}&display=swap`;
        }
        const tokens = this._sortVariantTokens(variants.map(v => this._normalizeVariantToken(v)));
        return `https://fonts.googleapis.com/css?family=${famPlus}:${tokens.join(',')}&display=swap`;
    },

    _normalizeGoogleImportInput(rawInput, fallbackFamily) {
        const urlMatch = rawInput.match(/https?:\/\/fonts\.googleapis\.com\/css2\?[^\s'"\);<>]+/i);
        if (!urlMatch) return rawInput;
        try {
            const u = new URL(urlMatch[0]);
            const famSpecs = u.searchParams.getAll('family');
            if (famSpecs.length !== 1) return rawInput;
            const [famRaw, axisPart] = famSpecs[0].split(':');
            const famName = decodeURIComponent((famRaw || fallbackFamily || '').replace(/\+/g, ' ')).trim();
            if (!famName) return rawInput;
            if (!axisPart || !axisPart.includes('@')) {
                return `@import url('${this._buildGoogleCssV1Url(famName, [])}');`;
            }
            const [axesStr, valsStr] = axisPart.split('@');
            const axes = axesStr.split(',');
            const tokens = [];
            valsStr.split(';').forEach(entry => {
                const parts = entry.split(',');
                if (axes.includes('ital') && axes.includes('wght') && parts.length >= 2) {
                    const isItal = parts[axes.indexOf('ital')] === '1';
                    const w = parts[axes.indexOf('wght')] || '400';
                    tokens.push(isItal ? `${w}i` : w);
                } else if (axes.includes('wght')) {
                    const w = parts[axes.indexOf('wght')] || '400';
                    tokens.push(w);
                }
            });
            if (tokens.length === 0) return rawInput;
            return `@import url('${this._buildGoogleCssV1Url(famName, tokens)}');`;
        } catch (_) {
            return rawInput;
        }
    },

    _arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        const chunk = 0x8000;
        let binary = '';
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
    },

    async _fetchGoogleFontVariantFiles(family, tokens) {
        const slug = family.trim().toLowerCase().replace(/\s+/g, '-');
        const slugBase = `${slug.replace(/[^a-z0-9-]/g, '')}`;
        const grouped = new Map(); // key `${weight}|${style}` -> [{ fileName, data, weight, style, ext }]

        // 1. Ưu tiên Google Webfonts Helper (trả về file woff2 đầy đủ subsets)
        try {
            const metaResp = await fetch(`https://gwfh.mranftl.com/api/fonts/${encodeURIComponent(slug)}?subsets=latin,vietnamese`);
            if (metaResp.ok) {
                const meta = await metaResp.json();
                const variants = Array.isArray(meta.variants) ? meta.variants : [];
                for (const tok of tokens) {
                    const isItalic = tok.endsWith('i');
                    const weight = tok.replace('i', '') || '400';
                    const style = isItalic ? 'italic' : 'normal';
                    const matchVar = variants.find(v => {
                        const vId = String(v.id || '').toLowerCase();
                        const vWeight = String(v.fontWeight || '');
                        const vStyle = String(v.fontStyle || 'normal').toLowerCase();
                        if (vWeight === weight && vStyle === style) return true;
                        if (tok === '400' && vId === 'regular') return true;
                        if (tok === '400i' && vId === 'italic') return true;
                        return vId === tok;
                    });
                    if (matchVar && matchVar.woff2) {
                        const fResp = await fetch(matchVar.woff2);
                        if (fResp.ok) {
                            const buf = await fResp.arrayBuffer();
                            const suffix = isItalic ? `${weight}italic` : weight;
                            const key = `${weight}|${style}`;
                            grouped.set(key, [{
                                fileName: `${slugBase}-${suffix}.woff2`,
                                data: this._arrayBufferToBase64(buf),
                                weight,
                                style,
                                ext: 'woff2'
                            }]);
                        }
                    }
                }
            }
        } catch (_) {
            // Fallback sang Google Fonts CSS bên dưới
        }

        // 2. Fallback: tải qua CSS2 của Google Fonts cho các biến thể còn thiếu
        const missing = tokens.filter(tok => {
            const weight = tok.replace('i', '') || '400';
            const style = tok.endsWith('i') ? 'italic' : 'normal';
            return !grouped.has(`${weight}|${style}`);
        });

        if (missing.length > 0) {
            const normals = missing.filter(t => !t.endsWith('i')).map(t => t);
            const italics = missing.filter(t => t.endsWith('i')).map(t => t.replace('i', ''));
            const famPlus = family.trim().replace(/\s+/g, '+');
            let cssUrl;
            if (italics.length > 0) {
                const pairs = [];
                normals.forEach(w => pairs.push(`0,${w}`));
                italics.forEach(w => pairs.push(`1,${w}`));
                cssUrl = `https://fonts.googleapis.com/css2?family=${famPlus}:ital,wght@${pairs.join(';')}&display=swap`;
            } else {
                cssUrl = `https://fonts.googleapis.com/css2?family=${famPlus}:wght@${normals.join(';')}&display=swap`;
            }

            const cssResp = await fetch(cssUrl);
            if (cssResp.ok) {
                const cssText = await cssResp.text();
                const blocks = cssText.match(/(\/\*[\s\S]*?\*\/\s*)?@font-face\s*\{[\s\S]*?\}/g) || [];
                let idx = 0;
                for (const blk of blocks) {
                    const styleMatch = blk.match(/font-style\s*:\s*([^;}\s]+)/i);
                    const weightMatch = blk.match(/font-weight\s*:\s*([^;}\s]+)/i);
                    const urlMatch = blk.match(/url\((['"]?)(https?:\/\/[^'")\s]+)\1\)/i);
                    if (!urlMatch) continue;
                    const style = (styleMatch ? styleMatch[1] : 'normal').toLowerCase();
                    const weight = (weightMatch ? weightMatch[1] : '400').toLowerCase();
                    const key = `${weight}|${style}`;
                    const fileResp = await fetch(urlMatch[2]);
                    if (!fileResp.ok) continue;
                    const buf = await fileResp.arrayBuffer();
                    const subsetTagMatch = blk.match(/\/\*\s*([^*]+?)\s*\*\//);
                    const subsetTag = subsetTagMatch ? subsetTagMatch[1].trim().replace(/[^a-z0-9_-]/gi, '') : `s${idx++}`;
                    const suffix = style === 'italic' ? `${weight}italic` : weight;
                    const list = grouped.get(key) || [];
                    list.push({
                        fileName: `${slugBase}-${suffix}-${subsetTag}.woff2`,
                        data: this._arrayBufferToBase64(buf),
                        weight,
                        style,
                        ext: 'woff2'
                    });
                    grouped.set(key, list);
                }
            }
        }

        return grouped;
    },

    async downloadGoogle(family) {
        const projectName = document.getElementById('d_current-project')?.value || document.getElementById('current-project')?.value;
        if (!projectName) return UI.notify('Vui lòng mở một dự án trước khi tải font!', 'error');

        // Lấy danh sách biến thể đã chọn qua checkbox
        const checkedBoxes = document.querySelectorAll(`.font-google-variant-checkbox[data-family="${family}"]:checked`);
        if (checkedBoxes.length === 0) {
            return UI.notify(`Vui lòng chọn ít nhất một biến thể cho font "${family}" để tải về!`, 'warning');
        }

        const selectedTokens = this._sortVariantTokens(
            Array.from(checkedBoxes).map(cb => this._normalizeVariantToken(cb.dataset.variant))
        );

        if (!await UI.confirm(`Bạn có chắc muốn tải ${selectedTokens.length} biến thể của Google Font "${family}" về lưu trữ trực tiếp trên website (Local self-hosted) của dự án "${projectName}" không?\n\n(Hệ thống sẽ tải tệp woff2 về assets/fonts/ và tạo @font-face tối ưu trong fonts.css)`)) {
            return;
        }

        UI.showModal('deploy-modal');
        UI.updateDeployStatus('Đang tải...', 15, `Đang tải ${selectedTokens.length} biến thể woff2 cho "${family}" từ Google Fonts...`);

        try {
            const grouped = await this._fetchGoogleFontVariantFiles(family, selectedTokens);
            if (grouped.size === 0) {
                UI.updateDeployStatus('Lỗi!', 50, `<span style="color:var(--danger)">Không tải được file woff2 nào cho font "${family}"!</span>`);
                UI.notify(`Không thể tải font ${family} từ Google Fonts!`, 'error');
                const deployFooter = document.getElementById('deploy-footer');
                if (deployFooter) deployFooter.style.display = 'flex';
                return;
            }

            let doneCount = 0;
            const totalGroups = grouped.size;
            for (const [key, files] of grouped.entries()) {
                const [weight, style] = key.split('|');
                const pct = Math.min(95, Math.round(35 + (doneCount / totalGroups) * 60));
                UI.updateDeployStatus('Đang cài đặt...', pct, `Đang lưu biến thể ${weight} (${style}) của "${family}"...`);
                const res = await (await fetch(`api.php?action=installConvertedFonts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: projectName,
                        category: App.currentCategory,
                        fontFamily: family,
                        fontWeight: weight,
                        fontStyle: style,
                        files
                    })
                })).json();
                if (res.status !== 'success') {
                    throw new Error(res.message || `Không thể cài biến thể ${weight} ${style}`);
                }
                doneCount++;
            }

            const msg = `Đã tải và cài đặt ${doneCount} biến thể font '${family}' về assets/fonts/ thành công!`;
            UI.updateDeployStatus('Hoàn tất!', 100, msg);
            UI.notify(msg, 'success');
            if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            this.loadCssPreview();
            const deployFooter = document.getElementById('deploy-footer');
            if (deployFooter) deployFooter.style.display = 'flex';
        } catch (err) {
            UI.updateDeployStatus('Lỗi!', 0, `<span style="color:var(--danger)">${err.message || 'Không thể tải hoặc cài đặt font.'}</span>`);
            UI.notify(err.message || 'Không thể tải font về website!', 'error');
            const deployFooter = document.getElementById('deploy-footer');
            if (deployFooter) deployFooter.style.display = 'flex';
        }
    },

    async quickAddGoogle(family, variants = []) {
        // Ưu tiên đọc biến thể được check trong UI, nếu không có mới dùng mảng variants truyền vào
        let selected = [];
        const checkedBoxes = document.querySelectorAll(`.font-google-variant-checkbox[data-family="${family}"]:checked`);
        if (checkedBoxes.length > 0) {
            selected = Array.from(checkedBoxes).map(cb => cb.dataset.variant);
        } else if (Array.isArray(variants) && variants.length > 0) {
            selected = variants;
        }

        const countText = selected.length > 0 ? `${selected.length} biến thể` : 'tất cả biến thể';
        if (!await UI.confirm(`Bạn có chắc chắn muốn thêm Google Font "${family}" (${countText}) qua @import vào dự án không?`)) return;

        // Dùng cú pháp Google Fonts CSS không chứa dấu ';' để tránh bị cắt cụt URL ở backend cũ
        const cleanUrl = this._buildGoogleCssV1Url(family, selected);
        const importUrl = `@import url('${cleanUrl}');`;
        this.executeAddGoogle(family, importUrl);
    },

    async _removeExactFontFromProject(projectName, category, fontName) {
        const cleanName = String(fontName || '').trim();
        if (!cleanName) {
            return { status: 'error', message: 'Thiếu tên font cần gỡ' };
        }
        const famPlus = cleanName.replace(/\s+/g, '+');
        // Dùng delimiter để bản backend đang chạy khớp chính xác tên font, không xóa nhầm font có cùng tiền tố (vd Roboto vs Roboto Flex)
        const exactTokens = [
            `'${cleanName}'`,
            `"${cleanName}"`,
            `family=${famPlus}:`,
            `family=${famPlus}&`,
            `family=${famPlus}'`,
            `family=${famPlus}"`,
            `family=${famPlus})`
        ];
        let lastRes = { status: 'success' };
        for (const token of exactTokens) {
            lastRes = await (await fetch(`api.php?action=removeFont`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: projectName, category, fontName: token })
            })).json();
            if (lastRes.status !== 'success') {
                return lastRes;
            }
        }
        return lastRes;
    },

    async executeAddGoogle(family, importUrl) {
        const projectName = document.getElementById('d_current-project')?.value || document.getElementById('current-project')?.value;
        if (!projectName) return UI.notify('Vui lòng mở một dự án trước!', 'error');

        const normalizedImportUrl = this._normalizeGoogleImportInput(importUrl, family);

        try {
            // Nếu đang tồn tại @import cũ của font này trong fonts.css (vd bản bị cắt cụt ?family=...:ital,wght@0,100), gỡ trước để thay thế
            const previewEl = document.getElementById('fonts-css-preview');
            const currentCss = previewEl ? previewEl.innerText : '';
            const famPlusEscaped = family.trim().replace(/\s+/g, '\\+').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const famEscaped = family.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const hasExistingImport = family && family !== 'Custom Font' && new RegExp(`@import[^;]*family=${famPlusEscaped}(?:[:&'")\\s]|$)`, 'i').test(currentCss);
            const hasExistingLocal = family && family !== 'Custom Font' && new RegExp(`@font-face[^}]*font-family\\s*:\\s*(['"])${famEscaped}\\1`, 'i').test(currentCss);

            if (hasExistingImport && !hasExistingLocal) {
                await this._removeExactFontFromProject(projectName, App.currentCategory, family);
            }

            const res = await (await fetch(`api.php?action=addGoogleFont`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: projectName, category: App.currentCategory, family, importUrl: normalizedImportUrl })
            })).json();

            if (res.status === 'success') {
                UI.notify(`Đã thêm Google Font ${family} vào fonts.css!`, 'success');
                this.loadCssPreview();
            } else {
                UI.notify(res.message, 'error');
            }
        } catch (err) {
            UI.notify('Lỗi kết nối API', 'error');
        }
    },

    async install(fontId, fontFamily) {
        const projectName = document.getElementById('d_current-project')?.value || document.getElementById('current-project')?.value;
        if (!projectName) return UI.notify('Vui lòng mở một dự án trước khi cài đặt font!', 'error');

        // Get selected variants
        const checkedBoxes = document.querySelectorAll(`.font-variant-checkbox[data-font="${fontId}"]:checked`);
        if (checkedBoxes.length === 0) return UI.notify('Vui lòng chọn ít nhất một biến thể font!', 'error');
        
        const selectedVariants = Array.from(checkedBoxes).map(cb => cb.dataset.variant);

        if (!await UI.confirm(`Bạn có chắc muốn cài đặt ${selectedVariants.length} biến thể của font "${fontFamily}" vào dự án "${projectName}"?`)) return;

        UI.showModal('deploy-modal');
        UI.updateDeployStatus('Đang chuẩn bị...', 10, `Bắt đầu copy font ${fontFamily}...`);

        try {
            const res = await (await fetch(`api.php?action=installFont`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: projectName, category: App.currentCategory, fontId, fontFamily, variants: selectedVariants })
            })).json();

            if (res.status === 'success') {
                UI.updateDeployStatus('Thành công!', 100, `Đã cài đặt font ${fontFamily} vào thư mục assets/fonts/ của dự án.`);
                UI.notify('Cài đặt font thành công!', 'success');
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                this.loadCssPreview();
            } else {
                UI.updateDeployStatus('Lỗi!', 50, `<span style="color:var(--danger)">${res.message}</span>`);
            }
            document.getElementById('deploy-footer').style.display = 'flex';
        } catch (err) {
            UI.updateDeployStatus('Lỗi kết nối!', 0, 'Không thể kết nối API.');
            document.getElementById('deploy-footer').style.display = 'flex';
        }
    },

    toggleAll(fontId, status) {
        const checkboxes = document.querySelectorAll(`.font-variant-checkbox[data-font="${fontId}"]`);
        const btn = event.target;
        
        // If status is specifically provided (true/false), use it. 
        // Otherwise, determine based on current state (toggle).
        let targetState = status;
        if (targetState === undefined) {
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            targetState = !allChecked;
        }

        checkboxes.forEach(cb => cb.checked = targetState);
        
        // Update button text
        if (btn && btn.tagName === 'BUTTON') {
            btn.innerText = targetState ? 'Bỏ chọn' : 'Chọn hết';
        }
    },

    async addGoogleFont() {
        // Redirection to unify logic
        const importUrl = document.getElementById('google-font-url')?.value.trim();
        if (!importUrl) return UI.notify('Vui lòng nhập link @import!', 'error');
        this.executeAddGoogle('Custom Font', importUrl);
    },

    async loadCssPreview() {
        const projectName = document.getElementById('d_current-project')?.value;
        if (!projectName) return;

        const previewContainer = document.getElementById('fonts-css-preview');
        if (!previewContainer) return;

        try {
            const res = await (await fetch(`api.php?action=getFontsCss&name=${encodeURIComponent(projectName)}&category=${encodeURIComponent(App.currentCategory || '')}`)).json();
            if (res.status === 'success') {
                let content = '';
                if (res.data) {
                    if (typeof res.data === 'string') {
                        content = res.data;
                    } else if (typeof res.data.css === 'string') {
                        content = res.data.css;
                    } else if (res.data.css) {
                        content = JSON.stringify(res.data.css, null, 2);
                    } else {
                        content = typeof res.data === 'object' ? JSON.stringify(res.data, null, 2) : String(res.data);
                    }
                }
                if (typeof content !== 'string' || !content.trim()) {
                    content = '/* Chưa có font nào được thêm */';
                }
                previewContainer.innerText = content;
                this.renderInstalledFonts(content);
            }
        } catch (err) {
            previewContainer.innerText = '/* Lỗi tải file fonts.css */';
        }
    },

    renderInstalledFonts(cssContent) {
        const listContainer = document.getElementById('installed-fonts-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        // Extract font names from @font-face or @import
        const fonts = [];
        
        // Match @font-face font-family
        const fontFaceRegex = /font-family:\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = fontFaceRegex.exec(cssContent)) !== null) {
            if (!fonts.includes(match[1])) fonts.push(match[1]);
        }

        // Match @import Google Fonts
        const importRegex = /family=([^&:'");\s]+)/g;
        while ((match = importRegex.exec(cssContent)) !== null) {
            const family = decodeURIComponent(match[1]).replace(/\+/g, ' ');
            if (!fonts.includes(family)) fonts.push(family);
        }

        if (fonts.length === 0) {
            listContainer.innerHTML = '<p style="font-size:0.8rem; color:var(--muted);">Chưa có font nào được cài đặt.</p>';
            return;
        }

        fonts.forEach(font => {
            const item = document.createElement('div');
            item.className = 'badge badge-ok';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.padding = '8px 12px';
            item.style.background = 'rgba(255,255,255,0.05)';
            item.style.border = '1px solid var(--border)';
            item.style.textTransform = 'none';
            item.innerHTML = `
                <span style="color:#fff; font-weight:600; margin-right:10px;">${font}</span>
                <span style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:0.6rem; color:var(--muted);">Installed</span>
                    <button class="btn btn-ghost" style="padding:2px; height:auto; color:var(--danger); font-size:0.75rem; border:none; background:none; cursor:pointer; display:inline-flex; align-items:center;" onclick="FontManager.remove('${font.replace(/'/g, "\\'")}')" title="Gỡ bỏ font">${fi("x", 13)}</button>
                </span>
            `;
            listContainer.appendChild(item);

            // Dynamically load font for preview in the list if it's a google font
            if (cssContent.includes('fonts.googleapis.com')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}&display=swap`;
                document.head.appendChild(link);
            }
        });
    },

    async remove(fontName) {
        const projectName = document.getElementById('d_current-project')?.value || document.getElementById('current-project')?.value;
        if (!projectName) return UI.notify('Vui lòng mở một dự án trước!', 'error');

        if (!await UI.confirm(`Bạn có chắc chắn muốn gỡ bỏ font "${fontName}" ra khỏi dự án "${projectName}" không?`)) return;

        try {
            const res = await this._removeExactFontFromProject(projectName, App.currentCategory, fontName);

            if (res.status === 'success') {
                UI.notify(`Đã gỡ bỏ font ${fontName} thành công!`, 'success');
                this.loadCssPreview();
            } else {
                UI.notify(res.message, 'error');
            }
        } catch (err) {
            UI.notify('Lỗi kết nối API', 'error');
        }
    },

    toggleAllConvert(fontId, status) {
        const checkboxes = document.querySelectorAll(`.font-convert-checkbox[data-font="${fontId}"]`);
        const btn = event.target;
        
        let targetState = status;
        if (targetState === undefined) {
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            targetState = !allChecked;
        }

        checkboxes.forEach(cb => cb.checked = targetState);
        
        if (btn && btn.tagName === 'BUTTON') {
            btn.innerText = targetState ? 'Bỏ chọn' : 'Chọn hết';
        }
    },

    async convertAndInstall(fontId, fontFamily) {
        const projectName = document.getElementById('d_current-project')?.value || document.getElementById('current-project')?.value;
        if (!projectName) return UI.notify('Vui lòng mở một dự án trước khi cài đặt font!', 'error');

        const checkedBoxes = document.querySelectorAll(`.font-convert-checkbox[data-font="${fontId}"]:checked`);
        if (checkedBoxes.length === 0) return UI.notify('Vui lòng chọn ít nhất một biến thể font để convert!', 'error');
        
        if (!await UI.confirm(`Bạn có chắc muốn convert và cài đặt ${checkedBoxes.length} biến thể của font "${fontFamily}" vào dự án "${projectName}"?`)) return;

        UI.showModal('deploy-modal');
        UI.updateDeployStatus('Đang chuẩn bị...', 10, `Bắt đầu tải các tệp tin font từ thư viện local...`);

        try {
            const filesToUpload = [];

            for (let i = 0; i < checkedBoxes.length; i++) {
                const cb = checkedBoxes[i];
                const variant = cb.dataset.variant;
                const ext = cb.dataset.ext;
                const filename = cb.dataset.filename;
                
                UI.updateDeployStatus('Đang tải...', Math.round(10 + (i / checkedBoxes.length) * 40), `Đang tải biến thể ${variant} (${ext.toUpperCase()})...`);
                
                const fileUrl = `api.php?action=getFontFile&fontId=${encodeURIComponent(fontId)}&variant=${variant}&ext=${ext}`;
                const resp = await fetch(fileUrl);
                if (!resp.ok) throw new Error(`Không thể tải biến thể ${variant} từ server.`);
                
                const arrayBuffer = await resp.arrayBuffer();

                UI.updateDeployStatus('Đang convert...', Math.round(50 + (i / checkedBoxes.length) * 30), `Đang convert biến thể ${variant} sang WOFF & WOFF2...`);
                
                const Font = window.fonteditor.Font;
                const fontObj = Font.create(arrayBuffer, {
                    type: ext.toLowerCase(),
                    hinting: true
                });

                // Write WOFF2
                const woff2Buffer = fontObj.write({
                    type: 'woff2',
                    hinting: true
                });
                let binaryWoff2 = '';
                const bytesWoff2 = new Uint8Array(woff2Buffer);
                const lenWoff2 = bytesWoff2.byteLength;
                for (let j = 0; j < lenWoff2; j++) {
                    binaryWoff2 += String.fromCharCode(bytesWoff2[j]);
                }
                const base64Woff2 = btoa(binaryWoff2);

                // Write WOFF
                const woffBuffer = fontObj.write({
                    type: 'woff',
                    hinting: true
                });
                let binaryWoff = '';
                const bytesWoff = new Uint8Array(woffBuffer);
                const lenWoff = bytesWoff.byteLength;
                for (let j = 0; j < lenWoff; j++) {
                    binaryWoff += String.fromCharCode(bytesWoff[j]);
                }
                const base64Woff = btoa(binaryWoff);

                const weight = (variant.replace(/i$/i, '') || '400');
                const style = variant.toLowerCase().endsWith('i') ? 'italic' : 'normal';

                filesToUpload.push({
                    weight,
                    style,
                    files: [
                        {
                            fileName: `${filename}.woff2`,
                            data: base64Woff2,
                            weight: weight,
                            style: style,
                            ext: 'woff2'
                        },
                        {
                            fileName: `${filename}.woff`,
                            data: base64Woff,
                            weight: weight,
                            style: style,
                            ext: 'woff'
                        }
                    ]
                });
            }

            UI.updateDeployStatus('Đang cài đặt...', 90, `Đang gửi các tệp tin đã convert lên server...`);

            let lastRes = { status: 'error', message: 'Không có biến thể nào được chọn' };
            for (const item of filesToUpload) {
                lastRes = await (await fetch(`api.php?action=installConvertedFonts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: projectName,
                        category: App.currentCategory,
                        fontFamily,
                        fontWeight: item.weight,
                        fontStyle: item.style,
                        files: item.files
                    })
                })).json();
                if (lastRes.status !== 'success') break;
            }
            const res = lastRes;

            if (res.status === 'success') {
                UI.updateDeployStatus('Thành công!', 100, `Đã convert và cài đặt font ${fontFamily} vào thư mục assets/fonts/ của dự án.`);
                UI.notify('Convert và cài đặt font thành công!', 'success');
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                this.loadCssPreview();
            } else {
                UI.updateDeployStatus('Lỗi!', 50, `<span style="color:var(--danger)">${res.message}</span>`);
            }
            document.getElementById('deploy-footer').style.display = 'flex';
        } catch (err) {
            UI.updateDeployStatus('Lỗi xử lý!', 0, `<span style="color:var(--danger)">Lỗi: ${err.message}</span>`);
            document.getElementById('deploy-footer').style.display = 'flex';
        }
    }
};
