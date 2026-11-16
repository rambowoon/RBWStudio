// Background Service Worker for Nasani Projects Sync
const CLEAN_NASANI_LIST_URL = "https://projects.nasani.vn/ky-thuat/program/list/";
const interceptedReportTabs = new Set();

function dispatchAutoReportToTab(targetTab, reportPayload) {
    if (!targetTab || !targetTab.id) return;
    if (targetTab.windowId) {
        chrome.windows.update(targetTab.windowId, { focused: true });
    }
    chrome.tabs.update(targetTab.id, { active: true }, () => {
        const currentUrl = targetTab.url || '';
        if (currentUrl.includes('/program/list')) {
            chrome.tabs.sendMessage(targetTab.id, {
                action: 'TRIGGER_AUTO_REPORT',
                ...reportPayload
            }, (resp) => {
                if (!chrome.runtime.lastError && resp && resp.status === 'started') {
                    chrome.storage.local.remove(['pending_auto_report']);
                } else {
                    chrome.tabs.update(targetTab.id, { url: CLEAN_NASANI_LIST_URL });
                }
            });
        } else {
            chrome.tabs.update(targetTab.id, { url: CLEAN_NASANI_LIST_URL });
        }
    });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const targetUrl = changeInfo.url || (changeInfo.status === 'loading' ? tab?.url : '');
    if (!targetUrl || !targetUrl.includes('projects.nasani.vn') || !targetUrl.includes('auto_report_code=')) {
        return;
    }
    if (interceptedReportTabs.has(tabId)) return;
    interceptedReportTabs.add(tabId);
    setTimeout(() => interceptedReportTabs.delete(tabId), 5000);

    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (e) {
        return;
    }
    const autoCode = parsedUrl.searchParams.get('auto_report_code') || '';
    if (!autoCode) return;

    const reportPayload = {
        reportCode: autoCode,
        adminUrl: parsedUrl.searchParams.get('auto_admin_url') || '',
        adminUser: parsedUrl.searchParams.get('auto_admin_user') || 'admin',
        adminPass: parsedUrl.searchParams.get('auto_admin_pass') || '',
        createdAt: Date.now()
    };

    chrome.tabs.query({ url: "*://projects.nasani.vn/*" }, (tabs) => {
        const otherTab = (tabs || []).find((t) => t.id !== tabId);
        if (!otherTab) {
            return;
        }
        chrome.tabs.remove(tabId, () => {
            void chrome.runtime.lastError;
        });
        chrome.storage.local.set({ pending_auto_report: reportPayload }, () => {
            dispatchAutoReportToTab(otherTab, reportPayload);
        });
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'OPEN_OR_FOCUS_NASANI') {
        const reportPayload = {
            reportCode: request.reportCode,
            adminUrl: request.adminUrl,
            adminUser: request.adminUser,
            adminPass: request.adminPass,
            createdAt: Date.now()
        };

        // Lưu vào chrome.storage.local để truyền dữ liệu nội bộ qua Extension mà KHÔNG đưa lên URL
        chrome.storage.local.set({ pending_auto_report: reportPayload }, () => {
            chrome.tabs.query({ url: "*://projects.nasani.vn/*" }, (tabs) => {
                if (tabs && tabs.length > 0) {
                    const existingTab = tabs[0];
                    dispatchAutoReportToTab(existingTab, reportPayload);
                    sendResponse({ status: 'focused', tabId: existingTab.id });
                } else {
                    chrome.tabs.create({ url: CLEAN_NASANI_LIST_URL, active: true }, (newTab) => {
                        if (newTab.windowId) {
                            chrome.windows.update(newTab.windowId, { focused: true });
                        }
                        sendResponse({ status: 'created', tabId: newTab.id });
                    });
                }
            });
        });
        return true; // Giữ kênh kết nối async
    }

    if (request.action === 'OPEN_OR_FOCUS_RBW_DEPLOY') {
        const projectName = request.projectName || '';
        const deployUrl = `http://localhost/RBWManager/?auto_deploy=${encodeURIComponent(projectName)}`;

        // Đẩy vào hàng đợi để ứng dụng desktop RBWStudio tự bật lên và mở modal Triển khai dự án
        fetch(`http://localhost/RBWManager/api.php?action=queueStudioDeploy&projectName=${encodeURIComponent(projectName)}`)
            .catch(() => {});

        chrome.tabs.query({ url: ["http://localhost/*", "http://127.0.0.1/*"] }, (tabs) => {
            let rbwTab = null;
            if (tabs && tabs.length > 0) {
                rbwTab = tabs.find(t => t.url && t.url.toLowerCase().includes('rbwmanager'));
                if (!rbwTab) rbwTab = tabs[0];
            }

            if (rbwTab) {
                if (rbwTab.windowId) {
                    chrome.windows.update(rbwTab.windowId, { focused: true });
                }
                chrome.tabs.update(rbwTab.id, { active: true }, () => {
                    chrome.tabs.sendMessage(rbwTab.id, {
                        action: 'TRIGGER_DEPLOY_MODAL',
                        projectName: projectName
                    }, (resp) => {
                        if (chrome.runtime.lastError || !resp) {
                            // Nếu tab chưa load content script hoặc phản hồi, điều hướng kèm param auto_deploy
                            chrome.tabs.update(rbwTab.id, { url: deployUrl });
                        }
                    });
                });
                sendResponse({ status: 'focused', tabId: rbwTab.id });
            } else {
                chrome.tabs.create({ url: deployUrl, active: true }, (newTab) => {
                    if (newTab.windowId) {
                        chrome.windows.update(newTab.windowId, { focused: true });
                    }
                    sendResponse({ status: 'created', tabId: newTab.id });
                });
            }
        });
        return true;
    }

    if (request.action === 'GET_EXISTING_RBW_PROJECTS') {
        const apiUrl = 'http://localhost/RBWManager/api.php?action=getExistingProjectsList';
        fetch(apiUrl)
            .then(res => res.json())
            .then(data => {
                if (data && data.status === 'success' && data.data) {
                    sendResponse({ status: 'success', data: data.data });
                } else {
                    sendResponse({ status: 'error', data: { names: [], codes: [] } });
                }
            })
            .catch(err => {
                fetch('http://localhost/RBWManager/api.php?action=listProjects')
                    .then(r => r.json())
                    .then(d => {
                        const names = [];
                        const codes = [];
                        (d.data || []).forEach(p => {
                            const n = (p.name || '').toLowerCase();
                            if (n) {
                                names.push(n);
                                const m = n.match(/_(\d+)w?$/i) || n.match(/(\d{5,})/i);
                                if (m) codes.push(m[1]);
                            }
                        });
                        sendResponse({ status: 'success', data: { names, codes } });
                    })
                    .catch(() => {
                        sendResponse({ status: 'error', data: { names: [], codes: [] } });
                    });
            });
        return true; // Giữ kết nối async
    }
});
