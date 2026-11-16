// Content Script injected into localhost / RBWManager
document.documentElement.setAttribute('data-rbw-nasani-ext', '1');
window._rbwNasaniExtLoaded = true;

window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'RBW_OPEN_OR_FOCUS_NASANI') {
        try {
            chrome.runtime.sendMessage({
                action: 'OPEN_OR_FOCUS_NASANI',
                url: event.data.url,
                reportCode: event.data.reportCode,
                adminUrl: event.data.adminUrl,
                adminUser: event.data.adminUser,
                adminPass: event.data.adminPass
            }, (res) => {
                // Background đã xử lý
            });
        } catch (e) {
            console.warn('[NasaniSync Bridge] Background message error:', e);
        }
    }
});

// Lắng nghe lệnh từ background worker chuyển tới web RBWManager
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'TRIGGER_DEPLOY_MODAL') {
            window.postMessage({
                type: 'RBW_TRIGGER_DEPLOY_MODAL',
                projectName: request.projectName
            }, '*');
            sendResponse({ status: 'dispatched' });
            return true;
        }
    });
}

