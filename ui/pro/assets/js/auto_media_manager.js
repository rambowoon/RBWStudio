const AutoMediaManager = {
	currentProject: '',
	currentMainKey: 'type-photo',
	mainKeys: ['type-photo', 'type-static', 'type-news', 'type-products'],

	async init(projectName) {
		if (!projectName) return;
		this.currentProject = projectName;
		this.bindEvents();
		await this.loadImages(this.currentMainKey);
	},

	bindEvents() {
		// Tab switching
		const wrap = document.getElementById('auto-media-main-tabs');
		if (!wrap || wrap.dataset.bound === '1') return;
		wrap.dataset.bound = '1';

		wrap.addEventListener('click', async (e) => {
			const btn = e.target.closest('[data-main-key]');
			if (!btn) return;
			await this.loadImages(btn.dataset.mainKey);
		});

		// Run button
		const runBtn = document.getElementById('btn-auto-media-run');
		if (runBtn) runBtn.addEventListener('click', () => this.runUpdate());

		// Rescan button
		const rescanBtn = document.getElementById('btn-am-rescan');
		if (rescanBtn) {
			rescanBtn.addEventListener('click', () => this.loadImages(this.currentMainKey));
		}

		// Toggle select/deselect all
		const toggleBtn = document.getElementById('btn-am-toggle-all');
		if (toggleBtn) {
			toggleBtn.addEventListener('click', () => {
				const mode = toggleBtn.dataset.mode;
				const isSelecting = mode === 'select';
				document.querySelectorAll('.am-image-check').forEach((c) => (c.checked = isSelecting));
				this._setToggleMode(toggleBtn, !isSelecting ? 'select' : 'deselect');
				this.updateSelectedCount();
			});
		}
	},

	updateSelectedCount() {
		const count = document.querySelectorAll('.am-image-check:checked').length;
		const el = document.getElementById('auto-media-selected-count');
		if (el) el.textContent = count;

		// Auto reset toggle button nếu count = 0
		const toggleBtn = document.getElementById('btn-am-toggle-all');
		if (toggleBtn && count === 0) this._setToggleMode(toggleBtn, 'select');
	},

	_setToggleMode(btn, mode) {
		btn.dataset.mode = mode;
		const span = btn.querySelector('span');
		const svg = btn.querySelector('svg');
		if (mode === 'select') {
			if (span) span.textContent = 'Chọn tất cả';
			if (svg) svg.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
			btn.style.color = '';
		} else {
			if (span) span.textContent = 'Bỏ chọn tất cả';
			if (svg) svg.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
			btn.style.color = '#f87171';
		}
	},

	renderState(type, message) {
		const listBox = document.getElementById('auto-media-groups');
		if (!listBox) return;

		if (type === 'loading') {
			listBox.innerHTML = `
				<div class="am-loading-pulse">
					<div class="am-skeleton-row"></div>
					<div class="am-skeleton-row" style="opacity:0.7"></div>
					<div class="am-skeleton-row" style="opacity:0.4"></div>
				</div>`;
		} else if (type === 'error') {
			listBox.innerHTML = `
				<div class="am-state error">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom:8px;opacity:0.7"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
					<div>${message}</div>
				</div>`;
		} else {
			listBox.innerHTML = `<div class="am-state">${message}</div>`;
		}
	},

	async loadImages(mainKey) {
		if (!this.mainKeys.includes(mainKey)) return;
		this.currentMainKey = mainKey;

		// Update tab active state
		const tabBtns = document.querySelectorAll('#auto-media-main-tabs [data-main-key]');
		tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.mainKey === mainKey));

		// Reset counters & toggle btn
		const totalEl = document.getElementById('auto-media-total');
		const selectedEl = document.getElementById('auto-media-selected-count');
		const toggleBtn = document.getElementById('btn-am-toggle-all');
		if (totalEl) totalEl.textContent = '0';
		if (selectedEl) selectedEl.textContent = '0';
		if (toggleBtn) this._setToggleMode(toggleBtn, 'select');

		this.renderState('loading', '');

		try {
			const cat = (typeof App !== 'undefined' && App.currentCategory) ? App.currentCategory : '';
			const url = `scan_images.php?main_key=${encodeURIComponent(mainKey)}&project_name=${encodeURIComponent(this.currentProject)}&category=${encodeURIComponent(cat)}`;
			const res = await (await fetch(url)).json();
			if (res.status !== 'success') {
				this.renderState('error', res.message || 'Lỗi quét ảnh');
				return;
			}
			this.renderGroups(res.groups || {});
		} catch (e) {
			this.renderState('error', 'Không thể kết nối scan_images.php');
		}
	},

	renderGroups(groups) {
		const listBox = document.getElementById('auto-media-groups');
		const totalEl = document.getElementById('auto-media-total');
		if (!listBox || !totalEl) return;

		const keys = Object.keys(groups || {});
		if (keys.length === 0) {
			listBox.innerHTML = `
				<div class="am-empty">
					<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
					<p>Không có cấu hình sub-type nào</p>
				</div>`;
			totalEl.textContent = '0';
			return;
		}

		let html = '';
		let total = 0;

		keys.forEach((subKey) => {
			const arr = groups[subKey] || [];
			total += arr.length;

			const items = arr.length
				? arr.map((img) => {
					const dim = img.width && img.height ? `${img.width}×${img.height}` : '—';
					const preview = img.preview_url || '';
					const byRatio = img.match_source === 'ratio';
					const thumbContent = preview
						? `<img src="${preview}" alt="${img.file}" loading="lazy">`
						: `<div class="am-thumb-placeholder"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;
					return `
						<label class="am-item">
							<input type="checkbox" class="am-image-check" data-sub-type="${subKey}" data-file="${img.file}">
							<div class="am-thumb">${thumbContent}</div>
							<div class="am-meta">
								<div class="am-file">
									<span class="am-file-name" title="${img.file}">${img.file}</span>
									${byRatio ? '<span class="am-badge ratio">ratio</span>' : ''}
								</div>
								<span class="am-sub">${dim} · ${this.formatSize(img.size || 0)}</span>
							</div>
						</label>`;
				}).join('')
				: `<div class="am-empty" style="padding:20px; border-style:dashed;">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
					<p>Không có ảnh khớp sub-type này</p>
				</div>`;

			html += `
				<section class="am-group">
					<div class="am-group-head">
						<div class="am-group-title-wrap">
							<div class="am-group-dot"></div>
							<div class="am-group-title">${subKey}</div>
							<span class="am-group-count">${arr.length} ảnh</span>
						</div>
						<div class="am-actions">
							<button type="button" class="am-select-btn am-toggle-sub" data-sub-type="${subKey}" data-mode="all">Chọn tất cả</button>
						</div>
					</div>
					<div class="am-grid">${items}</div>
				</section>`;
		});

		listBox.innerHTML = html || `<div class="am-empty"><p>Không có ảnh phù hợp</p></div>`;
		totalEl.textContent = total;

		// Bind sub-toggle buttons
		listBox.querySelectorAll('.am-toggle-sub').forEach((btn) => {
			btn.onclick = () => {
				const subType = btn.dataset.subType;
				const isSelecting = btn.dataset.mode === 'all';
				listBox.querySelectorAll(`.am-image-check[data-sub-type="${subType}"]`).forEach((chk) => {
					chk.checked = isSelecting;
				});
				// Toggle mode & text
				if (isSelecting) {
					btn.dataset.mode = 'none';
					btn.textContent = 'Bỏ chọn';
					btn.style.color = '#f87171';
					btn.style.borderColor = 'rgba(248,113,113,0.3)';
				} else {
					btn.dataset.mode = 'all';
					btn.textContent = 'Chọn tất cả';
					btn.style.color = '';
					btn.style.borderColor = '';
				}
				this.updateSelectedCount();
			};
		});

		// Bind checkbox change → update counter
		listBox.querySelectorAll('.am-image-check').forEach((chk) => {
			chk.addEventListener('change', () => this.updateSelectedCount());
		});
	},

	async runUpdate() {
		if (!this.currentProject) {
			UI.notify('Chưa xác định được project.', 'error');
			return;
		}

		const checks = Array.from(document.querySelectorAll('.am-image-check:checked'));
		if (checks.length === 0) {
			UI.notify('Vui lòng chọn ít nhất 1 ảnh.', 'error');
			return;
		}

		const cat = (typeof App !== 'undefined' && App.currentCategory) ? App.currentCategory : '';
		const payload = {
			project_name: this.currentProject,
			project: this.currentProject,
			category: cat,
			main_key: this.currentMainKey,
			images: checks.map((c) => ({
				file: c.dataset.file,
				sub_type: c.dataset.subType,
			})),
		};

		const runBtn = document.getElementById('btn-auto-media-run');
		const originalHTML = runBtn.innerHTML;
		runBtn.disabled = true;
		runBtn.innerHTML = `
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
			Đang xử lý...`;

		// Add spin keyframe if not exists
		if (!document.getElementById('am-spin-style')) {
			const s = document.createElement('style');
			s.id = 'am-spin-style';
			s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
			document.head.appendChild(s);
		}

		try {
			const res = await (
				await fetch('auto_update.php', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				})
			).json();

			if (res.status !== 'success') {
				UI.notify(`Lỗi: ${res.message || 'Không xác định'}`, 'error');
				return;
			}

			// Show success summary
			let updated = 0, deleted = 0, copied = 0;
			Object.keys(res.details || {}).forEach((k) => {
				const d = res.details[k];
				updated += d.updated_rows || 0;
				deleted += d.deleted_old_files || 0;
				copied += d.copied_new_files || 0;
			});

			const summaryEl = document.getElementById('am-run-summary');
			const summaryText = document.getElementById('am-run-summary-text');
			if (summaryEl && summaryText) {
				summaryText.textContent = `Cập nhật ${updated} bản ghi · Xóa ${deleted} file · Sao chép ${copied} file mới`;
				summaryEl.style.display = 'flex';
			}

			UI.notify(`✅ Hoàn tất! Cập nhật ${updated} bản ghi, xóa ${deleted} file cũ.`, 'success');
			await this.loadImages(this.currentMainKey);
		} catch (e) {
			UI.notify('Không thể gọi auto_update.php', 'error');
		} finally {
			runBtn.disabled = false;
			runBtn.innerHTML = originalHTML;
		}
	},

	formatSize(bytes) {
		const n = Number(bytes) || 0;
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / (1024 * 1024)).toFixed(2)} MB`;
	},
};
