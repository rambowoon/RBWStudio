const AIChecker = {
	currentTab: 'gemini',
	data: { gemini: [], claude: [] },
	overrides: JSON.parse(localStorage.getItem('ai_usage_overrides') || '{}'),

	pricing: {
		'gemini-1.5-pro': { input: 3.5, output: 10.5 },
		'gemini-1.5-flash': { input: 0.075, output: 0.3 },
		'gemini-1.0-pro': { input: 0.5, output: 1.5 },
		'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
		'claude-3-opus': { input: 15.0, output: 75.0 },
		'claude-3-haiku': { input: 0.25, output: 1.25 }
	},

	async switchTab(provider) {
		this.currentTab = provider;
		document.querySelectorAll('.btn-ghost').forEach(b => b.classList.remove('active'));
		const tabBtn = document.getElementById('tab-btn-' + provider);
		if (tabBtn) tabBtn.classList.add('active');

		if (this.data[provider].length === 0) {
			await this.checkModels(provider);
		} else {
			this.renderTable(provider, this.data[provider]);
		}
	},

	async checkModels(provider) {
		const apiKeyInput = document.getElementById(provider + '-api-key');
		const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
		if (!apiKey) {
			document.getElementById('ai-results-table-container').innerHTML = `<div style="text-align:center; padding:40px; color:var(--muted);">Chưa có API Key cho ${provider.toUpperCase()}. Vui lòng cấu hình trong phần Cấu hình Demo.</div>`;
			return;
		}
		const loading = document.getElementById('ai-loading');
		const container = document.getElementById('ai-results-table-container');
		if (loading) loading.style.display = 'block';
		if (container) container.style.display = 'none';

		try {
			const res = await fetch(`ai_checker.php?action=check_${provider}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ api_key: apiKey }),
			});
			const data = await res.json();
			if (data.status === 'success') {
				this.data[provider] = data.data.sort((a, b) => (b.id || b.name).localeCompare(a.id || a.name));
				this.renderTable(provider, this.data[provider]);
			} else {
				if (container) { container.innerHTML = `<div style="color:var(--danger); padding:20px; text-align:center;">Lỗi: ${data.message}</div>`; container.style.display = 'block'; }
			}
		} catch (err) { UI.notify('Không thể kết nối đến server.', 'error'); } finally { if (loading) loading.style.display = 'none'; }
	},

	async testLive(provider, modelId) {
		const apiKey = document.getElementById(provider + '-api-key').value.trim();
		const btn = document.getElementById(`btn-test-${modelId}`);
		const statusCell = document.getElementById(`status-${modelId}`);
		
		btn.disabled = true;
		statusCell.innerHTML = '<span style="color:var(--muted);">Đang test...</span>';

		try {
			const res = await fetch(`ai_checker.php?action=test_model_${provider}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ api_key: apiKey, model: modelId }),
			});
			const data = await res.json();
			if (data.status === 'success') {
				const q = data.quota;
				statusCell.innerHTML = `
					<div style="font-size:0.7rem; color:var(--success); font-weight:600;">Live: Active</div>
					<div style="font-size:0.65rem; color:var(--muted); line-height:1.2;">
						Req: ${q.remaining_requests}/${q.limit_requests}<br>
						Tok: ${q.remaining_tokens}/${q.limit_tokens}
					</div>
				`;
				UI.notify(`Đã lấy được thông tin quota thực tế cho ${modelId}!`, 'success');
			} else {
				let msg = data.message;
				if (msg.includes('retry in')) {
					const seconds = msg.match(/retry in ([\d.]+)s/);
					msg = seconds ? `Hết lượt (Thử lại sau ${Math.round(seconds[1])}s)` : 'Hết hạn mức';
				} else if (msg.includes('Quota exceeded')) {
					msg = 'Hết hạn mức (Quota Exceeded)';
				}
				statusCell.innerHTML = `<span style="color:var(--danger); font-size:0.65rem; font-weight:600;">${msg}</span>`;
				UI.notify(msg, 'error');
			}
		} catch (e) { statusCell.innerHTML = '<span style="color:var(--danger);">Lỗi kết nối</span>'; } finally { btn.disabled = false; }
	},

	editUsage(id) {
		const current = this.overrides[id] || 100;
		const val = prompt(`Nhập % khả dụng còn lại cho model ${id}:`, current);
		if (val !== null) {
			const percent = parseFloat(val);
			if (!isNaN(percent) && percent >= 0 && percent <= 100) {
				this.overrides[id] = percent;
				localStorage.setItem('ai_usage_overrides', JSON.stringify(this.overrides));
				this.renderTable(this.currentTab, this.data[this.currentTab]);
			}
		}
	},

	renderTable(provider, models) {
		const container = document.getElementById('ai-results-table-container');
		if (!container) return;
		container.style.display = 'block';

		const now = new Date();
		const midnight = new Date(now);
		midnight.setHours(24, 0, 0, 0);
		const diffMs = midnight - now;
		const hours = Math.floor(diffMs / 3600000);
		const minutes = Math.floor((diffMs % 3600000) / 60000);
		const resetStr = `${hours}h ${minutes}m`;

		let html = `
			<table class="config-table" style="width:100%; border-collapse:collapse; font-size:0.8rem;">
				<thead>
					<tr style="text-align:left; border-bottom:1px solid var(--border); background:rgba(255,255,255,0.02);">
						<th style="padding:15px;">Model Name</th>
						<th style="padding:15px;">Hạn mức</th>
						<th style="padding:15px; width:180px;">% Khả dụng</th>
						<th style="padding:15px; width:150px;">Chi phí (1M)</th>
						<th style="padding:15px;">Live Quota (Real-time)</th>
						<th style="padding:15px; text-align:right;">Thao tác</th>
					</tr>
				</thead>
				<tbody>
		`;

		models.forEach(model => {
			let id = model.id || model.name;
			if (id.startsWith('models/')) id = id.replace('models/', '');
			const name = model.displayName || model.display_name || id;
			
			let priceStr = 'In: — / Out: —';
			const priceKey = Object.keys(this.pricing).find(k => id.toLowerCase().includes(k));
			if (priceKey) { priceStr = `<span style="color:var(--success)">$${this.pricing[priceKey].input}</span>/<span style="color:#d97757">$${this.pricing[priceKey].output}</span>`; }

			let limit = (provider === 'gemini') ? (model.inputTokenLimit || 0) : 200000;
			const limitStr = limit > 0 ? `${(limit/1000).toFixed(0)}k` : 'N/A';
			const percentage = this.overrides[id] !== undefined ? this.overrides[id] : 100;
			const barColor = percentage < 30 ? 'var(--danger)' : (percentage < 60 ? '#fbbf24' : 'var(--success)');

			html += `
				<tr style="border-bottom:1px solid var(--border); transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
					<td style="padding:15px;"><div style="font-weight:700; color:#fff;">${name}</div><div style="font-size:0.65rem; color:var(--muted);">${id}</div></td>
					<td style="padding:15px; font-weight:600; color:var(--primary);">${limitStr}</td>
					<td style="padding:15px;">
						<div style="display:flex; align-items:center; gap:8px;">
							<div style="flex:1; height:6px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden;"><div style="width:${percentage}%; height:100%; background:${barColor};"></div></div>
							<span style="font-weight:700; color:${barColor}; font-size:0.75rem;">${percentage}%</span>
							<button onclick="AIChecker.editUsage('${id}')" style="background:none; border:none; color:var(--muted); cursor:pointer;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
						</div>
					</td>
					<td style="padding:15px; font-size:0.7rem;">${priceStr}</td>
					<td id="status-${id}" style="padding:15px;"><span style="color:var(--muted); font-size:0.7rem;">Chưa kiểm tra</span></td>
					<td style="padding:15px; text-align:right;">
						<button id="btn-test-${id}" class="btn btn-ghost" onclick="AIChecker.testLive('${provider}', '${id}')" style="font-size:0.7rem; padding:6px 12px; border:1px solid var(--border);">Test Live</button>
					</td>
				</tr>
			`;
		});

		html += `
				</tbody>
			</table>
			<div style="margin-top:20px; padding:15px; background:rgba(99,102,241,0.05); border-radius:12px; border:1px solid rgba(99,102,241,0.1); font-size:0.75rem; color:var(--muted);">
				<strong>⚡ GIẢI PHÁP KIỂM TRA THỰC TẾ:</strong> 
				- Nhấn <strong>"Test Live"</strong>: Hệ thống sẽ gửi một yêu cầu thực tế đến Google/Anthropic để trích xuất <strong>Rate Limit Headers</strong>. 
				- Bạn sẽ thấy chính xác số <strong>Requests</strong> và <strong>Tokens</strong> còn lại trong phút hiện tại mà API cho phép. Đây là thông số "sống" duy nhất mà API cung cấp.
			</div>
		`;
		container.innerHTML = html;
	}
};
