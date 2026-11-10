console.log('ImageTrimManager loaded');

const ImageTrimManager = {
	images: [],
	selected: new Set(),
	bound: false,

	init() {
		this.bindEvents();
		this.loadImages();
	},

	bindEvents() {
		if (this.bound) return;
		this.bound = true;

		const toggleBtn = document.getElementById('btn-trim-toggle-all');
		if (toggleBtn) {
			toggleBtn.addEventListener('click', () => {
				const selecting = toggleBtn.dataset.mode !== 'deselect';
				this.images.forEach((img) => {
					if (selecting) this.selected.add(img.name);
					else this.selected.delete(img.name);
				});
				this.render();
			});
		}

		const tolerance = document.getElementById('trim-tolerance');
		const toleranceNumber = document.getElementById('trim-tolerance-number');
		if (tolerance && toleranceNumber) {
			tolerance.addEventListener('input', () => {
				toleranceNumber.value = tolerance.value;
			});
			toleranceNumber.addEventListener('input', () => {
				const value = Math.max(0, Math.min(80, parseInt(toleranceNumber.value, 10) || 0));
				toleranceNumber.value = value;
				tolerance.value = value;
			});
		}
	},

	async loadImages() {
		const projectName = document.getElementById('d_current-project')?.value || '';
		const category = App.currentCategory || '';
		const grid = document.getElementById('project-trim-images-grid');
		if (!grid) return;

		this.selected.clear();
		this.setStatus('');
		this.updateCounts();
		grid.innerHTML = '<div class="trim-empty">Đang quét thư mục hình ảnh...</div>';

		if (!projectName) {
			grid.innerHTML = '<div class="trim-empty error">Vui lòng chọn một dự án trước.</div>';
			return;
		}

		try {
			const res = await fetch(`api.php?action=listProjectTrimImages&name=${encodeURIComponent(projectName)}&category=${encodeURIComponent(category)}`);
			const result = await res.json();
			if (result.status !== 'success') {
				grid.innerHTML = `<div class="trim-empty error">${this.escapeHtml(result.message || 'Lỗi khi quét ảnh')}</div>`;
				return;
			}

			this.images = result.data || [];
			this.render();
		} catch (e) {
			console.error(e);
			grid.innerHTML = '<div class="trim-empty error">Không thể kết nối tới máy chủ.</div>';
		}
	},

	render() {
		const grid = document.getElementById('project-trim-images-grid');
		if (!grid) return;

		if (!this.images.length) {
			grid.innerHTML = '<div class="trim-empty">Không tìm thấy hình ảnh nào trong assets/images/images.</div>';
			this.updateCounts();
			return;
		}

		let hasBackup = false;
		grid.innerHTML = this.images.map((img) => {
			const checked = this.selected.has(img.name);
			if (img.hasTrimBackup) hasBackup = true;
			const dim = img.width && img.height ? `${img.width}x${img.height}px` : '--';
			const backup = img.hasTrimBackup
				? `<button type="button" class="trim-card-action" data-action="undo" data-file="${this.escapeAttr(img.name)}">Hoàn tác</button>`
				: '';
			const backupBadge = img.hasTrimBackup
				? `<span class="trim-backup-badge">${this.formatTimeLeft(img.trimTimeLeft)}</span>`
				: '';

			return `
				<label class="trim-card ${checked ? 'checked' : ''}">
					<input type="checkbox" class="trim-check" data-file="${this.escapeAttr(img.name)}" ${checked ? 'checked' : ''}>
					<div class="trim-thumb">
						<img src="${this.escapeAttr(img.previewUrl || '')}" alt="${this.escapeAttr(img.name)}" loading="lazy">
					</div>
					<div class="trim-meta">
						<div class="trim-name" title="${this.escapeAttr(img.name)}">${this.escapeHtml(img.name)}</div>
						<div class="trim-info">${dim} - ${this.formatSize(img.size || 0)} - ${this.escapeHtml((img.ext || '').toUpperCase())}</div>
						<div class="trim-card-footer">
							${backupBadge}
							${backup}
						</div>
					</div>
				</label>`;
		}).join('');

		grid.querySelectorAll('.trim-check').forEach((checkbox) => {
			checkbox.addEventListener('change', () => {
				const file = checkbox.dataset.file;
				if (checkbox.checked) this.selected.add(file);
				else this.selected.delete(file);
				checkbox.closest('.trim-card')?.classList.toggle('checked', checkbox.checked);
				this.updateCounts();
			});
		});

		grid.querySelectorAll('[data-action="undo"]').forEach((button) => {
			button.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.undoSingle(button.dataset.file, button);
			});
		});

		const undoAllBtn = document.getElementById('btn-project-trim-undo-all');
		if (undoAllBtn) undoAllBtn.style.display = hasBackup ? 'inline-flex' : 'none';

		this.updateCounts();
	},

	updateCounts() {
		const totalEl = document.getElementById('trim-total-count');
		const selectedEl = document.getElementById('trim-selected-count');
		if (totalEl) totalEl.textContent = this.images.length;
		if (selectedEl) selectedEl.textContent = this.selected.size;

		const toggleBtn = document.getElementById('btn-trim-toggle-all');
		if (toggleBtn) {
			const allSelected = this.images.length > 0 && this.selected.size === this.images.length;
			toggleBtn.dataset.mode = allSelected ? 'deselect' : 'select';
			const span = toggleBtn.querySelector('span');
			if (span) span.textContent = allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả';
		}
	},

	async trimSelected() {
		const projectName = document.getElementById('d_current-project')?.value || '';
		const category = App.currentCategory || '';
		const files = Array.from(this.selected);
		if (!projectName) {
			UI.notify('Vui lòng chọn một dự án trước.', 'error');
			return;
		}
		if (!files.length) {
			UI.notify('Vui lòng chọn ít nhất 1 ảnh để trim.', 'error');
			return;
		}

		const btn = document.getElementById('btn-project-trim-run');
		const originalHtml = btn ? btn.innerHTML : '';
		if (btn) {
			btn.disabled = true;
			btn.innerHTML = 'Đang trim...';
		}
		this.setStatus('Đang trim ảnh đã chọn. Vui lòng không tắt trình duyệt.', 'info');

		try {
			const formData = new FormData();
			formData.append('name', projectName);
			formData.append('category', category);
			formData.append('tolerance', document.getElementById('trim-tolerance-number')?.value || 12);
			formData.append('files', JSON.stringify(files));

			const res = await fetch('api.php?action=trimProjectImages', {
				method: 'POST',
				body: formData,
			});
			const result = await res.json();

			if (result.status === 'success') {
				UI.notify(result.message, 'success');
				const detailText = (result.details || []).slice(0, 8).map((item) =>
					`${this.escapeHtml(item.file)}: ${item.oldWidth}x${item.oldHeight} -> ${item.newWidth}x${item.newHeight}`
				).join('<br>');
				const errors = result.errors && result.errors.length
					? `<div class="trim-status-errors">${result.errors.map((msg) => this.escapeHtml(msg)).join('<br>')}</div>`
					: '';
				await this.loadImages();
				this.setStatus(`<strong>Hoàn tất.</strong><br>${detailText || this.escapeHtml(result.message)}${errors}`, 'success');
			} else {
				UI.notify(result.message || 'Lỗi khi trim ảnh', 'error');
				this.setStatus(result.message || 'Lỗi khi trim ảnh', 'error');
			}
		} catch (e) {
			console.error(e);
			UI.notify('Không thể kết nối tới máy chủ.', 'error');
			this.setStatus('Không thể kết nối tới máy chủ.', 'error');
		} finally {
			if (btn) {
				btn.disabled = false;
				btn.innerHTML = originalHtml;
			}
		}
	},

	async undoSingle(fileName, btn) {
		if (!await UI.confirm(`Hoàn tác trim ảnh ${fileName}?`)) return;
		const projectName = document.getElementById('d_current-project')?.value || '';
		const category = App.currentCategory || '';
		const originalHtml = btn ? btn.innerHTML : '';
		if (btn) {
			btn.disabled = true;
			btn.innerHTML = '...';
		}

		try {
			const formData = new FormData();
			formData.append('name', projectName);
			formData.append('category', category);
			formData.append('file', fileName);

			const res = await fetch('api.php?action=undoTrimImage', {
				method: 'POST',
				body: formData,
			});
			const result = await res.json();
			if (result.status === 'success') {
				UI.notify(result.message, 'success');
				await this.loadImages();
			} else {
				UI.notify(result.message || 'Lỗi khi hoàn tác trim', 'error');
			}
		} catch (e) {
			console.error(e);
			UI.notify('Không thể kết nối tới máy chủ.', 'error');
		} finally {
			if (btn) {
				btn.disabled = false;
				btn.innerHTML = originalHtml;
			}
		}
	},

	async undoAll() {
		if (!await UI.confirm('Hoàn tác tất cả ảnh đã trim về bản sao lưu mới nhất?')) return;
		const projectName = document.getElementById('d_current-project')?.value || '';
		const category = App.currentCategory || '';
		const btn = document.getElementById('btn-project-trim-undo-all');
		const originalHtml = btn ? btn.innerHTML : '';
		if (btn) {
			btn.disabled = true;
			btn.innerHTML = 'Đang hoàn tác...';
		}

		try {
			const formData = new FormData();
			formData.append('name', projectName);
			formData.append('category', category);
			const res = await fetch('api.php?action=undoAllTrimImages', {
				method: 'POST',
				body: formData,
			});
			const result = await res.json();
			if (result.status === 'success') {
				UI.notify(result.message, 'success');
				await this.loadImages();
			} else {
				UI.notify(result.message || 'Lỗi khi hoàn tác trim', 'error');
			}
		} catch (e) {
			console.error(e);
			UI.notify('Không thể kết nối tới máy chủ.', 'error');
		} finally {
			if (btn) {
				btn.disabled = false;
				btn.innerHTML = originalHtml;
			}
		}
	},

	setStatus(message, type = 'info') {
		const box = document.getElementById('project-trim-status');
		if (!box) return;
		if (!message) {
			box.style.display = 'none';
			box.innerHTML = '';
			box.className = 'trim-status';
			return;
		}
		box.style.display = 'block';
		box.className = `trim-status ${type}`;
		box.innerHTML = message;
	},

	formatSize(bytes) {
		const n = Number(bytes) || 0;
		if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
		return `${(n / 1024).toFixed(1)} KB`;
	},

	formatTimeLeft(seconds) {
		const n = Number(seconds) || 0;
		if (n <= 0) return 'sao lưu';
		const hours = Math.floor(n / 3600);
		const mins = Math.floor((n % 3600) / 60);
		return hours > 0 ? `sao lưu ${hours}g ${mins}ph` : `sao lưu ${mins}ph`;
	},

	escapeHtml(value) {
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	},

	escapeAttr(value) {
		return this.escapeHtml(value);
	},
};
