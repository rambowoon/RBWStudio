/**
 * Nasani Projects Sync Content Script
 * Tự động đọc dữ liệu bảng và gửi về RBWManager
 */

(function () {
    const DEFAULT_API = 'http://localhost/RBWManager/api.php';

    function getApiUrl() {
        return new Promise(resolve => {
            if (chrome && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['rbw_api_url'], res => {
                    resolve(res.rbw_api_url || DEFAULT_API);
                });
            } else {
                resolve(DEFAULT_API);
            }
        });
    }

    function extractTableProjects() {
        const rows = document.querySelectorAll('table tbody tr[role="row"], table tbody tr');
        const projects = [];

        rows.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length < 10) return; // Bỏ qua hàng tiêu đề hoặc hàng rỗng

            // 1. Checkbox ID & STT
            const chk = tr.querySelector('input[type="checkbox"][data-id], input[name*="checkAction"]');
            const id = chk ? (chk.getAttribute('data-id') || chk.value) : '';

            // 2. Tên Khách Hàng / Hợp Đồng (td[1])
            let contractName = '';
            const tdName = tds[1];
            if (tdName) {
                const clone = tdName.cloneNode(true);
                clone.querySelectorAll('.text-sm, .tooltip, div, small').forEach(el => el.remove());
                contractName = clone.textContent.trim().replace(/\s+/g, ' ');
                if (!contractName) {
                    contractName = tdName.textContent.split('(')[0].trim();
                }
            }

            // 3. Mã Hợp Đồng & Link Design (td[2])
            let contractCode = '';
            let designUrl = '';
            let designFolder = '';
            const tdCode = tds[2];
            if (tdCode) {
                const aLink = tdCode.querySelector('a');
                if (aLink) {
                    contractCode = aLink.textContent.trim();
                    designUrl = aLink.href || '';
                } else {
                    contractCode = tdCode.textContent.trim();
                }
                if (designUrl) {
                    try {
                        const parsed = new URL(designUrl);
                        const parts = parsed.pathname.replace(/^\/|\/$/g, '').split('/');
                        designFolder = parts[0] || '';
                    } catch (e) {
                        const m = designUrl.match(/https?:\/\/[^\/]+\/([^\/\?#]+)/);
                        if (m) designFolder = m[1];
                    }
                }
            }

            // 4. Các thông tin quản lý
            const nvkd = tds[3] ? tds[3].textContent.trim().replace(/\s+/g, ' ') : '';
            const manager = tds[4] ? tds[4].textContent.trim().replace(/\s+/g, ' ') : '';
            const area = tds[5] ? tds[5].textContent.trim().replace(/\s+/g, ' ') : '';
            const receiveDate = tds[6] ? tds[6].innerText.trim().replace(/\s+/g, ' ') : '';
            const devName = tds[8] ? tds[8].textContent.trim().replace(/\s+/g, ' ') : '';
            const sentKtDate = tds[9] ? tds[9].innerText.trim().replace(/\s+/g, ' ') : '';

            // 5. Ngày giờ LT & Giờ làm (td[10])
            let ltHours = '';
            const tdLt = tds[10];
            if (tdLt) {
                const badge = tdLt.querySelector('.badge');
                ltHours = badge ? badge.textContent.trim() : '';
            }

            // 6. Tình trạng chung & Nhãn trạng thái
            const statusText = [];
            tr.querySelectorAll('.badge, .btn').forEach(b => {
                const t = b.textContent.trim();
                if (t && !t.includes('TB trưởng nhóm') && !t.includes('giờ')) {
                    statusText.push(t);
                }
            });
            const statusJoined = statusText.join(' | ').toLowerCase();
            const trTextLower = tr.innerText.toLowerCase();

            // Nhận diện dự án đã hoàn thành dựa vào nút trạng thái: "Link hoàn thành", "Web đã BG", "Đã Up Source", "Đã hoàn thành"
            const isDoneByStatus = statusJoined.includes('link hoàn thành') ||
                                   statusJoined.includes('web đã bg') ||
                                   statusJoined.includes('đã up source') ||
                                   statusJoined.includes('đã hoàn thành') ||
                                   trTextLower.includes('link hoàn thành');

            // 7. Phân định: Chỉ dự án có "Dự kiến hoàn thành" (hoặc "Dự kiến") VÀ KHÔNG có nhãn hoàn thành mới là ĐANG LÀM.
            // Còn lại tất cả đều là ĐÃ HOÀN THÀNH.
            let deadline = '';
            let isCompleted = true;
            let isActive = false;
            let completedAt = '';
            let hasEstimatedDeadline = false;

            const tdHt = tds[11];
            if (tdHt) {
                const fullText = tdHt.innerText.trim();
                const fullTextLower = fullText.toLowerCase();

                // BẮT BUỘC có từ khóa "dự kiến" (Tuyệt đối không lấy theo style .text-danger vì ngày quá hạn thực tế cũng màu đỏ)
                const hasDkKeyword = fullTextLower.includes('dự kiến hoàn thành') || fullTextLower.includes('dự kiến');
                
                // Trích xuất chuỗi thời gian: YYYY-MM-DD HH:MM:SS hoặc YYYY-MM-DD
                const match = fullText.match(/\d{4}-\d{2}-\d{2}[\s\n\r]*\d{2}:\d{2}(:\d{2})?/);
                const dtStr = match ? match[0].replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim() : '';

                if (hasDkKeyword && !isDoneByStatus) {
                    // Dự án ĐANG LÀM
                    isCompleted = false;
                    isActive = true;
                    hasEstimatedDeadline = true;
                    deadline = dtStr;
                } else {
                    // Dự án ĐÃ HOÀN THÀNH
                    isCompleted = true;
                    isActive = false;
                    hasEstimatedDeadline = false;
                    completedAt = dtStr;
                    deadline = '';
                }
            }

            // 8. Thông báo trưởng nhóm / Ngày DK dự phòng (td[13])
            let leaderDeadline = '';
            const tdNotice = tds[13];
            if (tdNotice) {
                const mDk = tdNotice.innerText.match(/Ngày\s*DK:\s*(\d{4}-\d{2}-\d{2}[\s\n\r]*\d{2}:\d{2}(:\d{2})?)/i);
                if (mDk) {
                    leaderDeadline = mDk[1].replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
                    // Nếu td[11] có Dự kiến hoàn thành mà chưa lấy được giờ thì lấy từ đây
                    if (hasEstimatedDeadline && !deadline) {
                        deadline = leaderDeadline;
                    }
                }
            }

            if (contractCode || contractName) {
                projects.push({
                    id,
                    contract_code: contractCode,
                    contract_name: contractName,
                    design_url: designUrl,
                    design_folder: designFolder,
                    nvkd,
                    manager,
                    area,
                    receive_date: receiveDate,
                    dev_name: devName,
                    sent_kt_date: sentKtDate,
                    lt_hours: ltHours,
                    deadline,
                    leader_deadline: leaderDeadline,
                    is_completed: isCompleted,
                    is_active: isActive,
                    has_estimated_deadline: hasEstimatedDeadline,
                    completed_at: completedAt,
                    status_text: statusText.slice(0, 5).join(' | '),
                    updated_at: new Date().toISOString()
                });
            }
        });

        return projects;
    }

    async function sendDataToRbwManager(showToast = true) {
        const btn = document.getElementById('rbw-sync-btn');
        const originalText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = `
                <svg class="rbw-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10"/>
                </svg>
                <span>Đang đồng bộ...</span>
            `;
            btn.style.opacity = '0.85';
            btn.disabled = true;
        }

        try {
            const projects = extractTableProjects();
            if (projects.length === 0) {
                showToastMessage('Không tìm thấy dòng dự án nào trên bảng để đồng bộ!', 'warning');
                return;
            }

            const apiUrl = await getApiUrl();
            const targetUrl = apiUrl.includes('?') 
                ? `${apiUrl}&action=syncNasaniData` 
                : `${apiUrl}?action=syncNasaniData`;

            const resp = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: 'chrome_extension',
                    projects: projects,
                    synced_at: Math.floor(Date.now() / 1000)
                })
            });

            const res = await resp.json();
            if (res.status === 'success') {
                if (chrome && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.set({
                        last_sync_time: Date.now(),
                        last_sync_count: projects.length
                    });
                }
                showToastMessage(`✓ Đã đồng bộ thành công ${projects.length} dự án sang RBWManager!`, 'success');
            } else {
                showToastMessage('Lỗi từ RBWManager: ' + (res.message || 'Không xác định'), 'error');
            }
        } catch (err) {
            console.error('[NasaniSync]', err);
            showToastMessage('Không thể kết nối tới RBWManager tại localhost! Vui lòng kiểm tra web server local.', 'error');
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.style.opacity = '1';
                btn.disabled = false;
            }
        }
    }

    function showToastMessage(msg, type = 'info') {
        let toast = document.getElementById('rbw-sync-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'rbw-sync-toast';
            document.body.appendChild(toast);
        }

        toast.className = `rbw-toast rbw-toast-${type} rbw-toast-show`;
        const icon = type === 'success' ? '✓' : (type === 'warning' ? '⚠️' : (type === 'error' ? '✕' : 'ℹ️'));
        toast.innerHTML = `<strong>${icon}</strong> <span>${msg}</span>`;

        setTimeout(() => {
            toast.classList.remove('rbw-toast-show');
        }, 4500);
    }

    function injectFloatingButton() {
        if (document.getElementById('rbw-sync-floating-container')) return;

        const container = document.createElement('div');
        container.id = 'rbw-sync-floating-container';
        container.innerHTML = `
            <button id="rbw-sync-btn" type="button" title="Đồng bộ danh sách hạn hoàn thành & mã hợp đồng sang RBWManager">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
                </svg>
                <span>Đồng bộ ➔ RBWManager</span>
            </button>
        `;
        document.body.appendChild(container);

        document.getElementById('rbw-sync-btn')?.addEventListener('click', () => {
            sendDataToRbwManager(true);
        });
    }

    // ==========================================
    // NÚT TRIỂN KHAI DỰ ÁN SANG RBWMANAGER
    // ==========================================
    window._existingRbwProjects = window._existingRbwProjects || { names: new Set(), codes: new Set(), loaded: false };

    function fetchExistingRbwProjects(callback) {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
            if (callback) callback();
            return;
        }

        try {
            chrome.runtime.sendMessage({ action: 'GET_EXISTING_RBW_PROJECTS' }, (response) => {
                if (!chrome.runtime.lastError && response && response.data) {
                    const names = new Set((response.data.names || []).map(n => String(n).toLowerCase()));
                    const codes = new Set((response.data.codes || []).map(c => String(c).trim()));
                    window._existingRbwProjects = { names, codes, loaded: true };
                }
                if (callback) callback();
            });
        } catch (e) {
            if (callback) callback();
        }
    }

    function isRowInDeployableStatus(tr) {
        const trText = (tr.innerText || '');
        const trTextLower = trText.toLowerCase();

        // 1. Bắt buộc có nút/text "TB trưởng nhóm" hoặc "trưởng nhóm"
        const hasTbTruongNhom = trTextLower.includes('tb trưởng nhóm') || trTextLower.includes('trưởng nhóm');
        if (!hasTbTruongNhom) return false;

        // 2. Không được có các trạng thái đã hoàn thành / up host / link hoàn thành
        const forbiddenKeywords = [
            'link hoàn thành',
            'tb up host',
            'upload source',
            'đã up source',
            'web đã bg',
            'web chưa bg',
            'còn thiếu chức năng',
            'đã hoàn thành'
        ];

        for (const kw of forbiddenKeywords) {
            if (trTextLower.includes(kw)) {
                return false;
            }
        }

        return true;
    }

    function isProjectAlreadyInTool(contractName, contractCode) {
        const data = window._existingRbwProjects;
        if (!data || !data.loaded) return false;

        const formattedName = formatDeployProjectName(contractName, contractCode).toLowerCase();
        const cleanCode = (contractCode || '').replace(/[^0-9]/g, '');

        // 1. Kiểm tra mã hợp đồng
        if (cleanCode && data.codes && data.codes.has(cleanCode)) {
            return true;
        }

        // 2. Kiểm tra tên folder dự án chính xác
        if (formattedName && data.names && data.names.has(formattedName)) {
            return true;
        }

        // 3. Kiểm tra xem có thư mục nào trong tool chứa mã hợp đồng này không (ví dụ: *_1843826w)
        if (cleanCode && cleanCode.length >= 5 && data.names) {
            for (const name of data.names) {
                if (name.includes(cleanCode)) {
                    return true;
                }
            }
        }

        return false;
    }

    function formatDeployProjectName(contractName, contractCode) {
        if (!contractName && !contractCode) return '';

        // Tách phần trước dấu ngoặc nếu có (ví dụ: PHẠM THỊ PHÚC LINH (Cọc 50%) -> PHẠM THỊ PHÚC LINH)
        let rawName = (contractName || '').split('(')[0].trim();

        // Chuyển tiếng Việt thành không dấu
        let cleanName = rawName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[đĐ]/g, 'd')
            .toLowerCase();

        // Chỉ giữ chữ cái latin và số, xóa khoảng trắng và ký tự đặc biệt
        cleanName = cleanName.replace(/[^a-z0-9]/g, '');

        // Mã hợp đồng: chỉ lấy số
        let cleanCode = (contractCode || '').replace(/[^0-9]/g, '');

        if (cleanName && cleanCode) {
            return `${cleanName}_${cleanCode}w`;
        } else if (cleanName) {
            return `${cleanName}_w`;
        } else if (cleanCode) {
            return `project_${cleanCode}w`;
        }
        return '';
    }

    function triggerDeployToRbw(contractName, contractCode) {
        const formattedName = formatDeployProjectName(contractName, contractCode);
        if (!formattedName) {
            showToastMessage('Không tìm thấy tên hoặc mã hợp đồng để triển khai!', 'warning');
            return;
        }

        showToastMessage(`🚀 Đang chuyển sang RBWManager để triển khai: ${formattedName}...`, 'info');

        try {
            chrome.runtime.sendMessage({
                action: 'OPEN_OR_FOCUS_RBW_DEPLOY',
                projectName: formattedName,
                contractName: contractName,
                contractCode: contractCode
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('[NasaniSync] Message error:', chrome.runtime.lastError);
                }
            });
        } catch (e) {
            console.error('[NasaniSync] Error sending deploy message:', e);
        }
    }

    function injectDeployButtons() {
        const rows = document.querySelectorAll('table tbody tr[role="row"], table tbody tr');
        rows.forEach(tr => {
            const btnWrap = tr.querySelector('.rbw-deploy-wrap');

            // 1. Chỉ dòng có tình trạng "TB trưởng nhóm" (và không có nhãn hoàn thành) mới có nút
            if (!isRowInDeployableStatus(tr)) {
                if (btnWrap) btnWrap.remove();
                return;
            }

            const tds = tr.querySelectorAll('td');
            if (tds.length < 10) return;

            // 2. Tên Khách Hàng / Hợp Đồng (td[1])
            let contractName = '';
            const tdName = tds[1];
            if (tdName) {
                const clone = tdName.cloneNode(true);
                clone.querySelectorAll('.text-sm, .tooltip, div, small').forEach(el => el.remove());
                contractName = clone.textContent.trim().replace(/\s+/g, ' ');
                if (!contractName) {
                    contractName = tdName.textContent.split('(')[0].trim();
                }
            }

            // 3. Mã Hợp Đồng (td[2])
            let contractCode = '';
            const tdCode = tds[2];
            if (tdCode) {
                const aLink = tdCode.querySelector('a');
                const rawText = (aLink ? aLink.textContent : tdCode.textContent) || '';
                const mCode = rawText.match(/\d{5,9}/);
                contractCode = mCode ? mCode[0] : rawText.trim();
            }

            if (!contractCode) {
                const mTr = (tr.innerText || '').match(/\d{5,9}/);
                if (mTr) contractCode = mTr[0];
            }

            if (!contractCode && !contractName) return;

            // 4. Nếu dự án đã có trong tool rồi thì không còn nút đó nữa
            if (isProjectAlreadyInTool(contractName, contractCode)) {
                if (btnWrap) btnWrap.remove();
                return;
            }

            // Đã gắn nút hợp lệ thì giữ nguyên
            if (tr.querySelector('.rbw-btn-deploy-row')) return;

            // Tạo nút Triển khai gắn ngay dưới Mã HĐ trong td[2]
            const newBtnWrap = document.createElement('div');
            newBtnWrap.className = 'rbw-deploy-wrap';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rbw-btn-deploy-row';
            btn.innerHTML = `
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <span>Triển khai</span>
            `;
            btn.title = `Triển khai dự án ${contractName} (#${contractCode}) sang RBWManager`;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerDeployToRbw(contractName, contractCode);
            });

            newBtnWrap.appendChild(btn);
            tdCode.appendChild(newBtnWrap);
        });
    }

    function setupDeployButtonsObserver() {
        // Lấy danh sách dự án hiện có trong tool ngay khi mở
        fetchExistingRbwProjects(() => {
            injectDeployButtons();
        });

        // Khi người dùng quay lại tab Nasani (sau khi đã sang tool triển khai xong), tự động cập nhật lại danh sách và ẩn nút
        window.addEventListener('focus', () => {
            fetchExistingRbwProjects(() => {
                injectDeployButtons();
            });
        });

        // Lắng nghe thay đổi của bảng (phân trang, tìm kiếm, lọc)
        const table = document.querySelector('table');
        if (table) {
            const observer = new MutationObserver(() => {
                injectDeployButtons();
            });
            observer.observe(table, { childList: true, subtree: true });
        } else {
            const bodyObserver = new MutationObserver(() => {
                const tbl = document.querySelector('table');
                if (tbl) {
                    injectDeployButtons();
                }
            });
            bodyObserver.observe(document.body, { childList: true, subtree: true });
        }

        // Định kỳ cập nhật lại danh sách dự án từ tool và làm mới nút
        setInterval(() => {
            fetchExistingRbwProjects(() => {
                injectDeployButtons();
            });
        }, 4000);
    }

    // ==========================================
    // TỰ ĐỘNG BÁO CÁO HOÀN THÀNH CHO TRƯỞNG NHÓM
    // ==========================================
    function generateRandomPassword() {
        const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const lower = 'abcdefghijkmnpqrstuvwxyz';
        const digits = '23456789';
        const all = upper + lower + digits;
        const len = Math.floor(Math.random() * 3) + 8; // 8 - 10 ký tự

        let pwd = [
            upper[Math.floor(Math.random() * upper.length)],
            lower[Math.floor(Math.random() * lower.length)],
            digits[Math.floor(Math.random() * digits.length)]
        ];

        while (pwd.length < len) {
            pwd.push(all[Math.floor(Math.random() * all.length)]);
        }

        for (let i = pwd.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
        }

        return pwd.join('');
    }

    const showToast = showToastMessage;

    function setNativeValue(element, value) {
        if (!element) return;
        try { element.focus(); } catch (e) {}
        element.value = value;
        const event = new Event('input', { bubbles: true });
        const tracker = element._valueTracker;
        if (tracker) {
            tracker.setValue(value);
        }
        element.dispatchEvent(event);
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        if (window.$ && typeof window.$(element).val === 'function') {
            try {
                window.$(element).val(value).trigger('input').trigger('change');
            } catch (e) {}
        }
    }

    function triggerButtonClick(btn) {
        if (!btn) return false;
        try { btn.focus(); } catch (e) {}

        // 1. Dispatch chuỗi sự kiện chuột hoàn chỉnh
        ['mousedown', 'mouseup', 'click'].forEach(type => {
            try {
                const ev = new MouseEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    view: window
                });
                btn.dispatchEvent(ev);
            } catch (e) {}
        });

        // 2. Gọi native click
        if (typeof btn.click === 'function') {
            try { btn.click(); } catch (e) {}
        }

        // 3. Nếu nút có phần tử con (icon, span), click vào phần tử con luôn
        if (btn.firstElementChild) {
            try {
                btn.firstElementChild.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: window }));
            } catch (e) {}
        }

        // 4. Nếu có onclick inline dạng code JS (ví dụ onclick="thong_bao(...)"), thực thi trực tiếp trên trang web
        const onclickAttr = btn.getAttribute('onclick') || (btn.parentElement ? btn.parentElement.getAttribute('onclick') : null);
        if (onclickAttr && typeof onclickAttr === 'string' && onclickAttr.trim()) {
            try {
                const s = document.createElement('script');
                s.textContent = `(function() { try { ${onclickAttr} } catch(e) { console.warn('[NasaniSync] Inline onclick call:', e); } })();`;
                (document.head || document.documentElement).appendChild(s);
                s.remove();
            } catch (e) {}
        }

        // 5. Nếu nút chứa data-target / data-bs-target modal Bootstrap
        const modalTarget = btn.getAttribute('data-target') || btn.getAttribute('data-bs-target') || (btn.getAttribute('href') && btn.getAttribute('href').startsWith('#') ? btn.getAttribute('href') : null);
        if (modalTarget && modalTarget.startsWith('#')) {
            try {
                const s = document.createElement('script');
                s.textContent = `if (window.$ && typeof window.$.fn.modal === 'function') { $('${modalTarget}').modal('show'); }`;
                (document.head || document.documentElement).appendChild(s);
                s.remove();
            } catch (e) {}
        }

        return true;
    }

    function findTbButton(tr) {
        if (!tr) return null;

        // 1. Tìm trong các thẻ tương tác có chữ 'trưởng nhóm'
        const clickables = Array.from(tr.querySelectorAll('button, a, .btn, [role="button"], [onclick], [data-toggle], [data-target]'));
        for (const el of clickables) {
            const txt = (el.innerText || el.textContent || '').toLowerCase();
            if (txt.includes('trưởng nhóm')) {
                return el;
            }
        }

        // 2. Tìm bất kỳ thẻ nào trong dòng có text 'trưởng nhóm' và lấy phần tử tương tác gần nhất
        const allElements = Array.from(tr.querySelectorAll('*'));
        for (const el of allElements) {
            const txt = (el.innerText || el.textContent || '').toLowerCase();
            if (txt.includes('trưởng nhóm')) {
                const parentBtn = el.closest('button, a, .btn, [role="button"], [onclick], [data-toggle], [data-target]');
                if (parentBtn) return parentBtn;
                return el;
            }
        }

        // 3. Fallback theo cột Tình trạng
        const tds = tr.querySelectorAll('td');
        for (const td of tds) {
            const tdTxt = (td.innerText || td.textContent || '').toLowerCase();
            if (tdTxt.includes('trưởng nhóm') || (tdTxt.includes('tb') && tdTxt.includes('ngày dk'))) {
                const btnInTd = td.querySelector('button, a, .btn, [onclick], [data-toggle], [role="button"]');
                if (btnInTd) return btnInTd;
                return td;
            }
        }

        return null;
    }

    function fillReportModal(adminUrl, adminUser, adminPass, autoCode, btnTb) {
        let attempts = 0;
        const maxAttempts = 40; // 20s
        const timer = setInterval(() => {
            attempts++;

            // Tìm modal thông báo hoàn thành trong DOM
            const allModals = Array.from(document.querySelectorAll('.modal, [role="dialog"], div[id*="modal"], div[id*="Modal"]'));
            
            // Ưu tiên modal đang hiển thị
            let activeModal = allModals.find(m => {
                const style = window.getComputedStyle(m);
                const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && m.offsetHeight > 0;
                const text = (m.innerText || '').toLowerCase();
                return isVisible && (text.includes('trưởng nhóm') || text.includes('link quản trị') || text.includes('quản trị'));
            });

            // Nếu sau 3 lần thử (1.5s) chưa thấy modal mở, thử click lại nút lần nữa
            if (!activeModal && (attempts === 3 || attempts === 6) && btnTb) {
                triggerButtonClick(btnTb);
            }

            // Nếu chưa tìm thấy modal đang hiển thị, tìm modal có tiêu đề chứa text
            if (!activeModal) {
                activeModal = allModals.find(m => {
                    const text = (m.innerText || '').toLowerCase();
                    return text.includes('thông báo hoàn thành cho trưởng nhóm') || text.includes('link quản trị');
                });
                // Nếu tìm thấy modal trong DOM nhưng chưa show, kích hoạt hiển thị
                if (activeModal && attempts >= 4 && activeModal.id) {
                    try {
                        const s = document.createElement('script');
                        s.textContent = `if (window.$ && typeof window.$.fn.modal === 'function') { $('#${activeModal.id}').modal('show'); }`;
                        (document.head || document.documentElement).appendChild(s);
                        s.remove();
                    } catch (e) {}
                }
            }

            if (activeModal) {
                // 1. Link quản trị
                let inputLink = activeModal.querySelector('input[placeholder*="Link quản trị"], input[placeholder*="quản trị"], input[name*="link"]');
                // 2. Tên đăng nhập
                let inputUser = activeModal.querySelector('input[placeholder*="Tên đăng nhập"], input[placeholder*="đăng nhập"], input[name*="user"], input[name*="ten_dang_nhap"]');
                // 3. Mật khẩu
                let inputPass = activeModal.querySelector('input[placeholder*="Mật khẩu"], input[placeholder*="mật khẩu"], input[name*="pass"], input[name*="mat_khau"]');

                // Fallback theo thứ tự input text trong form modal
                if (!inputLink || !inputUser || !inputPass) {
                    const textInputs = Array.from(activeModal.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="submit"]):not([type="button"])'));
                    if (textInputs.length >= 3) {
                        if (!inputLink) inputLink = textInputs[0];
                        if (!inputUser) inputUser = textInputs[1];
                        if (!inputPass) inputPass = textInputs[2];
                    }
                }

                if (inputLink && inputUser && inputPass) {
                    clearInterval(timer);

                    setNativeValue(inputLink, adminUrl);
                    setNativeValue(inputUser, adminUser || 'admin');
                    setNativeValue(inputPass, adminPass);

                    showModalAutoFillSuccess(activeModal, autoCode, adminUrl, adminUser, adminPass);
                    showToastMessage(`✅ Đã tự động điền form báo cáo cho HĐ #${autoCode}!`, 'success');
                }
            }

            if (attempts >= maxAttempts) {
                clearInterval(timer);
                showToastMessage(`⚠️ Không tìm thấy ô nhập liệu trong form báo cáo.`, 'warning');
            }
        }, 500);
    }

    function showModalAutoFillSuccess(modal, autoCode, adminUrl, adminUser, adminPass) {
        if (modal.querySelector('.rbw-modal-autofill-banner')) return;

        const banner = document.createElement('div');
        banner.className = 'rbw-modal-autofill-banner';
        banner.style.cssText = 'background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.1)); border: 1.5px solid #10b981; border-radius: 8px; padding: 10px 14px; margin: 10px 15px 15px 15px; font-size: 13px; color: #065f46; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);';
        banner.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span style="font-weight: 700; color: #047857; display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 16px;">⚡</span> RBWManager: Đã tự động điền thông tin báo cáo
                </span>
                <button type="button" id="rbw-btn-copy-pass" style="background: #10b981; color: #fff; border: none; border-radius: 6px; padding: 4px 10px; font-size: 11.5px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                    📋 Copy Pass (${adminPass})
                </button>
            </div>
            <div style="font-size: 12px; color: #065f46; line-height: 1.4; font-family: monospace;">
                Link: <b style="color: #0284c7;">${adminUrl}</b><br>
                User: <b style="color: #059669;">${adminUser || 'admin'}</b> | Pass: <b style="color: #b45309; background: #fef3c7; padding: 1px 4px; border-radius: 3px;">${adminPass}</b>
            </div>
        `;

        const modalBody = modal.querySelector('.modal-body') || modal;
        modalBody.insertBefore(banner, modalBody.firstChild);

        document.getElementById('rbw-btn-copy-pass')?.addEventListener('click', (e) => {
            e.preventDefault();
            navigator.clipboard.writeText(adminPass).then(() => {
                const btn = document.getElementById('rbw-btn-copy-pass');
                if (btn) {
                    btn.textContent = '✓ Đã copy!';
                    btn.style.background = '#059669';
                    setTimeout(() => {
                        btn.textContent = `📋 Copy Pass (${adminPass})`;
                        btn.style.background = '#10b981';
                    }, 2000);
                }
            });
        });
    }

    window._rbwLastReportTrigger = window._rbwLastReportTrigger || {};

    function executeFindAndReport(autoCode, adminUrl, adminUser, adminPass) {
        if (!autoCode) return;
        const cleanAutoCode = String(autoCode || '').trim().replace(/[^0-9]/g, '');
        const lockKey = cleanAutoCode || String(autoCode);

        // Debounce chống click đúp trong 2.5 giây (thay vì khóa vĩnh viễn)
        const now = Date.now();
        const lastTime = window._rbwLastReportTrigger[lockKey] || 0;
        if (now - lastTime < 2500) {
            console.log(`[NasaniSync] Báo cáo #${lockKey} đang được xử lý, bỏ qua trigger lặp.`);
            return;
        }
        window._rbwLastReportTrigger[lockKey] = now;

        showToastMessage(`⚡ Nhận lệnh từ RBWManager: Đang tìm dự án #${lockKey}...`, 'info');

        let attempts = 0;
        const maxAttempts = 35; // ~17s
        const timer = setInterval(() => {
            attempts++;
            const rows = document.querySelectorAll('table tbody tr');
            let targetTr = null;

            for (const tr of rows) {
                const text = tr.innerText || '';
                if ((cleanAutoCode && text.includes(cleanAutoCode)) || text.includes(autoCode)) {
                    targetTr = tr;
                    break;
                }
            }

            // Nếu sau 3 lần thử (1.5s) chưa thấy dòng và có ô tìm kiếm DataTables, tự động điền tìm kiếm
            if (!targetTr && attempts === 3 && cleanAutoCode) {
                const searchInput = document.querySelector('input[type="search"], #table_filter input, .dataTables_filter input');
                if (searchInput && searchInput.value !== cleanAutoCode) {
                    setNativeValue(searchInput, cleanAutoCode);
                }
            }

            if (targetTr) {
                clearInterval(timer);
                targetTr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetTr.style.outline = '3px solid #10b981';
                targetTr.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.4)';

                const btnTb = findTbButton(targetTr);

                if (btnTb) {
                    showToastMessage(`⚡ Đang tự động mở form báo cáo cho #${lockKey}...`, 'info');
                    triggerButtonClick(btnTb);
                    fillReportModal(adminUrl, adminUser, adminPass, lockKey, btnTb);
                } else {
                    showToastMessage(`⚠️ Không tìm thấy nút "TB trưởng nhóm" ở dòng #${lockKey}.`, 'warning');
                }
            } else if (attempts >= maxAttempts) {
                clearInterval(timer);
                showToastMessage(`❌ Không tìm thấy mã hợp đồng #${lockKey} trên danh sách trang hiện tại.`, 'error');
            }
        }, 500);
    }

    function checkPendingAutoReport() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['pending_auto_report'], res => {
                if (res && res.pending_auto_report) {
                    const data = res.pending_auto_report;
                    // Xóa ngay lập tức khỏi storage để không bao giờ bị lặp lại khi F5 / báo cáo xong
                    chrome.storage.local.remove(['pending_auto_report']);
                    if (Date.now() - (data.createdAt || 0) < 60000) {
                        executeFindAndReport(
                            data.reportCode,
                            data.adminUrl,
                            data.adminUser || 'admin',
                            data.adminPass || generateRandomPassword()
                        );
                    }
                }
            });
        }
    }

    function handleAutoReportParam() {
        const urlParams = new URLSearchParams(window.location.search);
        const autoCode = urlParams.get('auto_report_code') || urlParams.get('report_code');
        if (!autoCode) return;

        const adminUrl = urlParams.get('auto_admin_url') || '';
        const adminUser = urlParams.get('auto_admin_user') || 'admin';
        const adminPass = urlParams.get('auto_admin_pass') || generateRandomPassword();

        // XÓA NGAY LẬP TỨC CÁC QUERY PARAMS TRÊN URL KHỎI THANH ĐỊA CHỈ TRÌNH DUYỆT!
        // Giúp khi bấm Xác nhận / Báo cáo hoặc reload F5 sẽ KHÔNG BỊ MỞ LẠI POPUP NỮA!
        try {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        } catch (e) {}

        executeFindAndReport(autoCode, adminUrl, adminUser, adminPass);
    }

    // Khởi chạy khi DOM sẵn sàng
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectFloatingButton();
            setupDeployButtonsObserver();
            checkPendingAutoReport();
            handleAutoReportParam();
        });
    } else {
        injectFloatingButton();
        setupDeployButtonsObserver();
        checkPendingAutoReport();
        handleAutoReportParam();
    }

    // Lắng nghe lệnh từ Extension Popup hoặc Background Worker
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'TRIGGER_SYNC') {
                sendDataToRbwManager(true);
                sendResponse({ status: 'started' });
                return true;
            }
            if (request.action === 'TRIGGER_AUTO_REPORT') {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.remove(['pending_auto_report']);
                }
                executeFindAndReport(
                    request.reportCode,
                    request.adminUrl,
                    request.adminUser || 'admin',
                    request.adminPass || generateRandomPassword()
                );
                sendResponse({ status: 'started' });
                return true;
            }
        });
    }

    // Lắng nghe thay đổi popstate / URL trong SPA
    window.addEventListener('popstate', () => {
        handleAutoReportParam();
    });

    // Tự động kiểm tra nếu người dùng bật chế độ Auto Sync
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['auto_sync_enabled'], res => {
            if (res.auto_sync_enabled) {
                setTimeout(() => {
                    sendDataToRbwManager(false);
                }, 1500);
            }
        });
    }
})();
