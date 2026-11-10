/**
 * Image Converter Frontend Logic
 */
const ConverterUI = {
    selectedFiles: [],
    serverLimits: { max_file_uploads: 20 },

    async show() {
        await this.fetchLimits();
        // Chuyển view
        document.getElementById('view-dashboard').style.display = 'none';
        document.getElementById('view-project-detail').style.display = 'none';
        if(document.getElementById('view-ai-checker')) document.getElementById('view-ai-checker').style.display = 'none';
        if(document.getElementById('view-cache-clearer')) document.getElementById('view-cache-clearer').style.display = 'none';
        document.getElementById('view-converter').style.display = 'block';
        
        // Cập nhật menu active
        this.setActiveNav(2); // Mục thứ 3 (index 2) trong Sidebar
        this.initDropZone();
    },

    async fetchLimits() {
        try {
            const res = await (await fetch('converter.php?action=info')).json();
            this.serverLimits = res;
        } catch (e) {}
    },

    setActiveNav(index) {
        const items = document.querySelectorAll('.sidebar-nav .nav-item');
        items.forEach((item, i) => {
            if (i === index) item.classList.add('active');
            else item.classList.remove('active');
        });
    },

    initDropZone() {
        const zone = document.getElementById('drop-zone');
        const input = document.getElementById('file-input');

        zone.ondragover = (e) => { e.preventDefault(); zone.style.borderColor = 'var(--primary)'; };
        zone.ondragleave = () => { zone.style.borderColor = 'var(--border-hover)'; };
        zone.ondrop = (e) => {
            e.preventDefault();
            zone.style.borderColor = 'var(--border-hover)';
            this.handleFiles(e.dataTransfer.files);
        };

        input.onchange = (e) => this.handleFiles(e.target.files);
    },

    async handleFiles(files) {
        this.selectedFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        
        const limit = parseInt(this.serverLimits.max_file_uploads) || 20;
        if (this.selectedFiles.length > limit) {
            await UI.alert(`Cảnh báo: Server của bạn chỉ cho phép upload tối đa ${limit} file một lần. Các file dư thừa sẽ bị loại bỏ.`);
            this.selectedFiles = this.selectedFiles.slice(0, limit);
        }

        if (this.selectedFiles.length > 0) {
            document.getElementById('converter-controls').style.display = 'block';
            document.getElementById('selected-count').innerText = `Đã chọn: ${this.selectedFiles.length} ảnh`;
            document.getElementById('converter-results').style.display = 'none';
        }
    },

    async process() {
        const btn = document.getElementById('start-convert-btn');
        const originalText = btn.innerText;
        btn.innerText = '⏳ Đang xử lý...';
        btn.disabled = true;

        const deep = document.getElementById('conv-deep')?.checked ? 1 : 0;

        const formData = new FormData();
        this.selectedFiles.forEach(file => formData.append('images[]', file));
        formData.append('format', document.getElementById('conv-format').value);
        formData.append('quality', document.getElementById('conv-quality').value);
        formData.append('deep', deep);

        try {
            const response = await fetch('converter.php?action=convert', {
                method: 'POST',
                body: formData
            });
            const res = await response.json();

            if (res.status === 'success') {
                const resultsArea = document.getElementById('converter-results');
                const downloadLink = document.getElementById('zip-download-link');
                
                resultsArea.style.display = 'block';
                downloadLink.href = res.download_url;
                
                // Tự động tải về
                downloadLink.click();
                
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            } else {
                await UI.alert('Lỗi: ' + res.message);
            }
        } catch (err) {
            await UI.alert('Lỗi kết nối máy chủ');
            console.error(err);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    },

    reset() {
        this.selectedFiles = [];
        document.getElementById('file-input').value = '';
        document.getElementById('converter-controls').style.display = 'none';
        document.getElementById('converter-results').style.display = 'none';
    }
};
