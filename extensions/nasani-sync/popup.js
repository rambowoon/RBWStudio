document.addEventListener('DOMContentLoaded', () => {
    const inputUrl = document.getElementById('api-url');
    const chkAuto = document.getElementById('auto-sync');
    const btnSync = document.getElementById('btn-manual-sync');
    const lastSyncEl = document.getElementById('last-sync-time');

    // 1. Load saved settings
    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['rbw_api_url', 'auto_sync_enabled', 'last_sync_time', 'last_sync_count'], res => {
            if (res.rbw_api_url) inputUrl.value = res.rbw_api_url;
            if (res.auto_sync_enabled !== undefined) chkAuto.checked = !!res.auto_sync_enabled;
            if (res.last_sync_time) {
                const d = new Date(res.last_sync_time);
                const timeStr = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')} - ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                lastSyncEl.innerHTML = `Lần cuối: <b>${timeStr}</b> (${res.last_sync_count || 0} dự án)`;
            }
        });
    }

    // 2. Save settings on change
    inputUrl.addEventListener('change', () => {
        let val = inputUrl.value.trim();
        if (val && !val.includes('api.php')) {
            val = val.replace(/\/+$/, '') + '/api.php';
            inputUrl.value = val;
        }
        chrome.storage.local.set({ rbw_api_url: val });
    });

    chkAuto.addEventListener('change', () => {
        chrome.storage.local.set({ auto_sync_enabled: chkAuto.checked });
    });

    // 3. Manual sync button: send message to active tab
    btnSync.addEventListener('click', async () => {
        btnSync.disabled = true;
        btnSync.innerText = 'Đang đồng bộ...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.id) {
                alert('Vui lòng mở trang projects.nasani.vn để bấm đồng bộ!');
                return;
            }

            if (!tab.url || !tab.url.includes('projects.nasani.vn')) {
                alert('Tab hiện tại không phải là projects.nasani.vn!\nVui lòng chuyển sang tab danh sách kỹ thuật của Nasani.');
                return;
            }

            // 1. Thử gửi message trực tiếp tới content script
            chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_SYNC' }, (response) => {
                const err = chrome.runtime.lastError;
                if (!err && response) {
                    setTimeout(() => window.close(), 600);
                    return;
                }

                // 2. Nếu content script chưa nạp (do mở tab trước khi load extension)
                if (chrome.scripting && chrome.scripting.executeScript) {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => {
                            const btn = document.getElementById('rbw-sync-btn');
                            if (btn) {
                                btn.click();
                            } else {
                                alert('Vui lòng nhấn F5 lại trang projects.nasani.vn để tiện ích kích hoạt nút đồng bộ!');
                            }
                        }
                    }).then(() => {
                        setTimeout(() => window.close(), 600);
                    }).catch(e => {
                        alert('Không thể thực thi lệnh trên tab: ' + e.message);
                    });
                } else {
                    alert('Vui lòng tải lại (F5) trang projects.nasani.vn rồi bấm nút "⚡ Đồng bộ ➔ RBWManager" ở góc phải dưới!');
                }
            });
        } catch (e) {
            console.error(e);
            alert('Lỗi: ' + e.message);
        } finally {
            setTimeout(() => {
                btnSync.disabled = false;
                btnSync.innerText = '⚡ Đồng bộ ngay bây giờ';
            }, 800);
        }
    });
});
