const CacheClearer = {
	async run() {
		const urlInput = document.getElementById('cache-clear-url');
		const statusDiv = document.getElementById('cache-clear-status');
		
		const url = urlInput.value.trim();
		if (!url) {
			await UI.alert('Vui lòng nhập đường dẫn URL!');
			return;
		}

		statusDiv.style.display = 'block';
		statusDiv.style.background = 'rgba(255, 193, 7, 0.1)';
		statusDiv.style.border = '1px solid #ffc107';
		statusDiv.style.color = '#ffc107';
		statusDiv.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px">${fi("loader", 14)} Đang gửi yêu cầu tải lại từ mạng (Bypass Cache) cho đường link:</span><br><strong style="color:#fff;">${url}</strong>...`;

		try {
			let httpUrl = url;
			let httpsUrl = url;
			
			try {
				const parsed = new URL(url);
				const domainAndPort = parsed.host;
				const path = parsed.pathname + parsed.search;
				
				httpUrl = `http://${domainAndPort}${path}`;
				httpsUrl = `https://${domainAndPort}${path}`;
			} catch (e) {
				httpUrl = url.replace(/^https:/i, 'http:');
				httpsUrl = url.replace(/^http:/i, 'https:');
			}

			const fetchOptions = {
				method: 'GET',
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					'Pragma': 'no-cache',
					'Expires': '0'
				},
				cache: 'reload',
				mode: 'no-cors',
				credentials: 'omit'
			};

			statusDiv.innerHTML += `<br><span style="display:inline-flex;align-items:center;gap:5px">${fi("link", 12)} Đang gửi request Bypass Cache tới HTTP...</span>`;
			const p1 = fetch(httpUrl, fetchOptions).catch(() => null);

			statusDiv.innerHTML += `<br><span style="display:inline-flex;align-items:center;gap:5px">${fi("link", 12)} Đang gửi request Bypass Cache tới HTTPS...</span>`;
			const p2 = fetch(httpsUrl, fetchOptions).catch(() => null);

			// Gửi thêm POST request để phá vỡ redirect cache 301 triệt để hơn
			const p3 = fetch(httpUrl, {
				method: 'POST',
				cache: 'reload',
				mode: 'no-cors',
				credentials: 'omit'
			}).catch(() => null);

			await Promise.all([p1, p2, p3]);

			statusDiv.style.background = 'rgba(40, 167, 69, 0.1)';
			statusDiv.style.border = '1px solid #28a745';
			statusDiv.style.color = '#28a745';
			statusDiv.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px">${fi("checkCircle", 14)} Đã gửi yêu cầu xóa cache cho đường link thành công!</span><br>
				<ul style="margin: 10px 0 0 20px; padding: 0;">
					<li>Đã gửi request ép tải lại từ mạng (<code>cache: 'reload'</code>) tới các link:</li>
					<li style="list-style-type:none; font-family:monospace; margin-top:5px; color:#fff;">- ${httpUrl}</li>
					<li style="list-style-type:none; font-family:monospace; color:#fff;">- ${httpsUrl}</li>
					<li>Cache của các đường dẫn và dự án khác trên localhost hoàn toàn KHÔNG bị ảnh hưởng.</li>
				</ul>
				<p style="margin-top: 10px; font-weight: bold; color: #fff; display:flex; align-items:center; gap:6px;">${fi("lightbulb", 14)} Hãy mở lại hoặc tải lại trang đó bằng tổ hợp phím (Ctrl + F5) để kiểm tra.</p>`;

		} catch (error) {
			statusDiv.style.background = 'rgba(220, 53, 69, 0.1)';
			statusDiv.style.border = '1px solid #dc3545';
			statusDiv.style.color = '#dc3545';
			statusDiv.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px">${fi("xCircle", 14)} Lỗi hệ thống: ${error.message}</span>`;
		}
	}
};
