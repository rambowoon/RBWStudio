console.log('WebpManager loaded');

const WebpManager = {
	images: [],

	async loadImages() {
		const projectName = document.getElementById('d_current-project').value;
		const category = App.currentCategory || '';
		
		const listContainer = document.getElementById('project-webp-images-list');
		if (!listContainer) return;

		listContainer.innerHTML = `
			<tr>
				<td colspan="6" style="text-align:center; padding:30px; color:var(--muted);">
					<span style="display:inline-block; animation: spin 1s linear infinite; margin-right: 8px;">⏳</span> Đang quét thư mục hình ảnh...
				</td>
			</tr>
		`;

		const statusBox = document.getElementById('project-webp-status');
		if (statusBox) statusBox.style.display = 'none';

		// Hide undo all button by default
		const undoAllBtn = document.getElementById('btn-project-webp-undo-all');
		if (undoAllBtn) undoAllBtn.style.display = 'none';

		if (!projectName) {
			listContainer.innerHTML = `
				<tr>
					<td colspan="6" style="text-align:center; padding:20px; color:var(--danger);">Vui lòng chọn một dự án trước.</td>
				</tr>
			`;
			return;
		}

		try {
			const res = await fetch(`api.php?action=listProjectImages&name=${encodeURIComponent(projectName)}&category=${encodeURIComponent(category)}`);
			const result = await res.json();

			if (result.status === 'success') {
				this.images = result.data || [];
				this.render();
			} else {
				listContainer.innerHTML = `
					<tr>
						<td colspan="6" style="text-align:center; padding:20px; color:var(--danger);">${result.message || 'Lỗi khi quét hình ảnh'}</td>
					</tr>
				`;
			}
		} catch (e) {
			console.error(e);
			listContainer.innerHTML = `
				<tr>
					<td colspan="6" style="text-align:center; padding:20px; color:var(--danger);">Không thể kết nối tới server.</td>
				</tr>
			`;
		}
	},

	formatTimeLeft(seconds) {
		if (seconds <= 0) return 'Đã hết hạn';
		const hours = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		if (hours > 0) {
			return `còn ${hours}h ${mins}ph`;
		}
		return `còn ${mins}ph`;
	},

	render() {
		const listContainer = document.getElementById('project-webp-images-list');
		if (!listContainer) return;

		if (this.images.length === 0) {
			listContainer.innerHTML = `
				<tr>
					<td colspan="6" style="text-align:center; padding:30px; color:var(--muted);">
						Không tìm thấy hình ảnh nào trong thư mục <code>assets/images/images</code>.
					</td>
				</tr>
			`;
			return;
		}

		listContainer.innerHTML = '';
		let anyBackup = false;

		this.images.forEach((img, idx) => {
			const row = document.createElement('tr');
			row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
			row.style.transition = 'background 0.2s';
			row.onmouseover = () => row.style.background = 'rgba(255,255,255,0.02)';
			row.onmouseout = () => row.style.background = 'transparent';

			const nameOnly = (img.name.split('.').slice(0, -1).join('.') || img.name).toLowerCase();
			const isExactLogo = (nameOnly === 'logo');
			const isFavicon = (nameOnly === 'favicon' || img.name.toLowerCase().includes('favicon'));
			const isLogoOrFavicon = (isExactLogo || isFavicon);
			const isWebp = img.ext === 'webp';

			let statusHtml = '';
			if (isWebp) {
				if (img.hasBackup) {
					anyBackup = true;
					statusHtml = `<span style="color: var(--success); background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">✓ Sẵn sàng (WebP)</span> <span style="color: #fbbf24; font-size: 0.75rem; margin-left: 5px;">(${this.formatTimeLeft(img.timeLeft)})</span>`;
				} else {
					statusHtml = `<span style="color: var(--success); background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">✓ Sẵn sàng (WebP)</span>`;
				}
			} else if (isLogoOrFavicon) {
				statusHtml = `<span style="color: var(--warning); background: rgba(245, 158, 11, 0.1); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">🛡️ Giữ lại bản gốc</span>`;
			} else {
				statusHtml = `<span style="color: var(--muted); background: rgba(255, 255, 255, 0.05); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">⏳ Đợi convert</span>`;
			}

			const sizeFormatted = (img.size / 1024).toFixed(1) + ' KB';
			const dimensionsFormatted = img.width && img.height ? `${img.width}x${img.height} px` : '—';

			// Generate action buttons
			let actionsHtml = '';
			const safeName = img.name.replace(/'/g, "\\'");
			if (isWebp) {
				if (img.hasBackup) {
					actionsHtml = `
						<div style="display:flex; justify-content:center;">
							<button class="btn btn-sm" onclick="WebpManager.undoSingle('${safeName}', this)" style="padding: 4px 10px; font-size: 0.7rem; color: #f59e0b; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 4px;">↩️ Hoàn tác</button>
						</div>
					`;
				} else {
					actionsHtml = `
						<div style="display:flex; justify-content:center; color: var(--muted); font-size: 0.7rem; font-style: italic;">
							Hết hạn hoàn tác
						</div>
					`;
				}
			} else {
				if (img.name.toLowerCase().includes('favicon')) {
					actionsHtml = `
						<div style="display:flex; justify-content:center; color: var(--muted); font-size: 0.7rem; font-style: italic;">
							Giữ nguyên favicon
						</div>
					`;
				} else {
					actionsHtml = `
						<div style="display:flex; justify-content:center;">
							<button class="btn btn-sm btn-primary" onclick="WebpManager.convertSingle('${safeName}', this)" style="padding: 4px 10px; font-size: 0.7rem; border-radius: 4px;">🖼️ Sang WebP</button>
						</div>
					`;
				}
			}

			row.innerHTML = `
				<td style="padding:12px 10px; font-weight: 500; color: #fff;">${img.name}</td>
				<td style="padding:12px 10px; text-transform: uppercase; color: var(--muted);">${img.ext}</td>
				<td style="padding:12px 10px; color: var(--muted);">${sizeFormatted}</td>
				<td style="padding:12px 10px; color: var(--muted);">${dimensionsFormatted}</td>
				<td style="padding:12px 10px;">${statusHtml}</td>
				<td style="padding:12px 10px; text-align: center;">${actionsHtml}</td>
			`;
			listContainer.appendChild(row);
		});

		// Show/hide undo all button based on backups presence
		const undoAllBtn = document.getElementById('btn-project-webp-undo-all');
		if (undoAllBtn) {
			undoAllBtn.style.display = anyBackup ? 'inline-block' : 'none';
		}
	},

	async convertSingle(fileName, btnElement) {
		const projectName = document.getElementById('d_current-project').value;
		const category = App.currentCategory || '';
		const quality = document.getElementById('project-webp-quality').value || 100;
		const deep = document.getElementById('project-webp-deep')?.checked ? 1 : 0;

		if (!projectName) {
			UI.notify('Vui lòng chọn một dự án trước.', 'error');
			return;
		}

		let originalBtnHtml = '';
		if (btnElement) {
			originalBtnHtml = btnElement.innerHTML;
			btnElement.disabled = true;
			btnElement.innerHTML = `⏳`;
		}

		try {
			const formData = new FormData();
			formData.append('name', projectName);
			formData.append('category', category);
			formData.append('file', fileName);
			formData.append('quality', quality);
			formData.append('deep', deep);

			const res = await fetch('api.php?action=convertSingleImage', {
				method: 'POST',
				body: formData
			});
			const result = await res.json();

			if (result.status === 'success') {
				UI.notify(result.message, 'success');
				this.loadImages();
			} else {
				UI.notify(result.message || 'Lỗi khi chuyển đổi hình ảnh', 'error');
				if (btnElement) {
					btnElement.disabled = false;
					btnElement.innerHTML = originalBtnHtml;
				}
			}
		} catch (e) {
			console.error(e);
			UI.notify('Không thể kết nối tới server.', 'error');
			if (btnElement) {
				btnElement.disabled = false;
				btnElement.innerHTML = originalBtnHtml;
			}
		}
	},

	async undoSingle(fileName, btnElement) {
		const projectName = document.getElementById('d_current-project').value;
		const category = App.currentCategory || '';

		if (!projectName) {
			UI.notify('Vui lòng chọn một dự án trước.', 'error');
			return;
		}

		let originalBtnHtml = '';
		if (btnElement) {
			originalBtnHtml = btnElement.innerHTML;
			btnElement.disabled = true;
			btnElement.innerHTML = `⏳`;
		}

		try {
			const formData = new FormData();
			formData.append('name', projectName);
			formData.append('category', category);
			formData.append('file', fileName);

			const res = await fetch('api.php?action=undoSingleImage', {
				method: 'POST',
				body: formData
			});
			const result = await res.json();

			if (result.status === 'success') {
				UI.notify(result.message, 'success');
				this.loadImages();
			} else {
				UI.notify(result.message || 'Lỗi khi hoàn tác hình ảnh', 'error');
				if (btnElement) {
					btnElement.disabled = false;
					btnElement.innerHTML = originalBtnHtml;
				}
			}
		} catch (e) {
			console.error(e);
			UI.notify('Không thể kết nối tới server.', 'error');
			if (btnElement) {
				btnElement.disabled = false;
				btnElement.innerHTML = originalBtnHtml;
			}
		}
	},

	async undoAll() {
		const projectName = document.getElementById('d_current-project').value;
		const category = App.currentCategory || '';

		if (!projectName) {
			UI.notify('Vui lòng chọn một dự án trước.', 'error');
			return;
		}

		if (!await UI.confirm('Bạn có chắc chắn muốn hoàn tác tất cả các hình ảnh đã convert về định dạng gốc?')) {
			return;
		}

		const btn = document.getElementById('btn-project-webp-undo-all');
		let originalBtnHtml = '';
		if (btn) {
			originalBtnHtml = btn.innerHTML;
			btn.disabled = true;
			btn.innerHTML = `⏳ Đang hoàn tác...`;
		}

		try {
			const formData = new FormData();
			formData.append('name', projectName);
			formData.append('category', category);

			const res = await fetch('api.php?action=undoAllImages', {
				method: 'POST',
				body: formData
			});
			const result = await res.json();

			if (result.status === 'success') {
				UI.notify(result.message, 'success');
			} else {
				UI.notify(result.message || 'Lỗi khi hoàn tác hình ảnh', 'error');
			}
		} catch (e) {
			console.error(e);
			UI.notify('Không thể kết nối tới server.', 'error');
		} finally {
			if (btn) {
				btn.disabled = false;
				btn.innerHTML = originalBtnHtml;
			}
			this.loadImages();
		}
	},

	async convertAll() {
		const projectName = document.getElementById('d_current-project').value;
		const category = App.currentCategory || '';
		const quality = document.getElementById('project-webp-quality').value || 100;
		const deep = document.getElementById('project-webp-deep')?.checked ? 1 : 0;

		if (!projectName) {
			UI.notify('Vui lòng chọn một dự án trước.', 'error');
			return;
		}

		const btn = document.getElementById('btn-project-webp-convert');
		if (btn) {
			btn.disabled = true;
			btn.innerHTML = `<span style="display:inline-block; animation: spin 1s linear infinite; margin-right: 8px;">⏳</span> Đang convert...`;
		}

		const statusBox = document.getElementById('project-webp-status');
		if (statusBox) {
			statusBox.style.display = 'block';
			statusBox.style.background = 'rgba(59, 130, 246, 0.1)';
			statusBox.style.border = '1px solid rgba(59, 130, 246, 0.2)';
			statusBox.style.color = '#93c5fd';
			statusBox.innerHTML = 'Đang tiến hành chuyển đổi và sao lưu thư mục ảnh... Vui lòng không tắt trình duyệt.';
		}

		try {
			const formData = new FormData();
			formData.append('name', projectName);
			formData.append('category', category);
			formData.append('quality', quality);
			formData.append('deep', deep);

			const res = await fetch('api.php?action=convertProjectImages', {
				method: 'POST',
				body: formData
			});
			const result = await res.json();

			if (result.status === 'success') {
				UI.notify(result.message, 'success');
				
				if (statusBox) {
					statusBox.style.background = 'rgba(16, 185, 129, 0.1)';
					statusBox.style.border = '1px solid rgba(16, 185, 129, 0.2)';
					statusBox.style.color = '#a7f3d0';
					statusBox.innerHTML = `<strong>Thành công!</strong> ${result.message}`;
				}

				if (result.errors && result.errors.length > 0) {
					statusBox.innerHTML += `<div style="margin-top: 10px; color: #fca5a5;">Cảnh báo:<br>${result.errors.join('<br>')}</div>`;
				}
			} else {
				UI.notify(result.message || 'Lỗi khi chuyển đổi hình ảnh', 'error');
				if (statusBox) {
					statusBox.style.background = 'rgba(239, 68, 68, 0.1)';
					statusBox.style.border = '1px solid rgba(239, 68, 68, 0.2)';
					statusBox.style.color = '#fca5a5';
					statusBox.innerHTML = `<strong>Lỗi:</strong> ${result.message}`;
				}
			}
		} catch (e) {
			console.error(e);
			UI.notify('Không thể kết nối tới server.', 'error');
			if (statusBox) {
				statusBox.style.background = 'rgba(239, 68, 68, 0.1)';
				statusBox.style.border = '1px solid rgba(239, 68, 68, 0.2)';
				statusBox.style.color = '#fca5a5';
				statusBox.innerHTML = '<strong>Lỗi:</strong> Không thể kết nối tới server.';
			}
		} finally {
			if (btn) {
				btn.disabled = false;
				btn.innerHTML = `🚀 Bắt đầu Convert`;
			}
			this.loadImages();
		}
	}
};

