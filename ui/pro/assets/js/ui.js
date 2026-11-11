console.log("UI.js loaded v1.1");
const UI = {
	async confirm(message) {
		return new Promise((resolve) => {
			const overlay = document.createElement("div");
			overlay.className = "modal-overlay";
			overlay.style.zIndex = "999999";
			overlay.style.display = "flex";
			overlay.innerHTML = `
				<div class="modal" style="max-width: 450px; padding: 30px 25px; text-align: center; border-radius: 16px; background: #1a1e29; box-shadow: 0 20px 40px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05);">
                    <div style="margin-bottom: 25px;">
					    <div style="width: 64px; height: 64px; background: rgba(79, 157, 255, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
					    <div style="font-size: 1.15rem; color: #e2e8f0; line-height: 1.6; word-break: break-word;">${message.replace(/\n/g, "<br>")}</div>
                    </div>
					<div style="display: flex; gap: 12px; justify-content: center;">
						<button class="btn btn-ghost" id="ui-confirm-cancel" style="min-width: 110px; font-weight: 500;">Hủy</button>
						<button class="btn btn-primary" id="ui-confirm-ok" style="min-width: 110px; font-weight: 500;">Đồng ý</button>
					</div>
				</div>
			`;
			document.body.appendChild(overlay);
			overlay.querySelector("#ui-confirm-ok").onclick = () => {
				overlay.remove();
				resolve(true);
			};
			overlay.querySelector("#ui-confirm-cancel").onclick = () => {
				overlay.remove();
				resolve(false);
			};
		});
	},

	async alert(message) {
		return new Promise((resolve) => {
			const overlay = document.createElement("div");
			overlay.className = "modal-overlay";
			overlay.style.zIndex = "999999";
			overlay.style.display = "flex";
			overlay.innerHTML = `
				<div class="modal" style="max-width: 450px; padding: 30px 25px; text-align: center; border-radius: 16px; background: #1a1e29; box-shadow: 0 20px 40px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05);">
                    <div style="margin-bottom: 25px;">
                        <div style="width: 64px; height: 64px; background: rgba(79, 157, 255, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>
					    <div style="font-size: 1.15rem; color: #e2e8f0; line-height: 1.6; word-break: break-word;">${message.replace(/\n/g, "<br>")}</div>
                    </div>
					<div style="display: flex; justify-content: center;">
						<button class="btn btn-primary" id="ui-alert-ok" style="min-width: 130px; font-weight: 500;">OK</button>
					</div>
				</div>
			`;
			document.body.appendChild(overlay);
			overlay.querySelector("#ui-alert-ok").onclick = () => {
				overlay.remove();
				resolve();
			};
		});
	},

	showLoading(
		message = "Đang xử lý...",
		subText = "Vui lòng chờ trong giây lát...",
	) {
		if (!document.getElementById("ui-loading-styles")) {
			const style = document.createElement("style");
			style.id = "ui-loading-styles";
			style.textContent = `
				@keyframes ui-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
				@keyframes ui-pulse-glow { 0%, 100% { transform: scale(0.95); opacity: 0.7; } 50% { transform: scale(1.1); opacity: 1; } }
			`;
			document.head.appendChild(style);
		}

		let overlay = document.getElementById("ui-loading-overlay");
		if (!overlay) {
			overlay = document.createElement("div");
			overlay.id = "ui-loading-overlay";
			overlay.className = "modal-overlay";
			overlay.style.cssText =
				"position:fixed; inset:0; z-index:1000001; background:rgba(6,9,15,0.78); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center; animation:modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);";
			overlay.innerHTML = `
				<div style="background:linear-gradient(145deg, #151b26, #0d1118); border:1px solid rgba(0,210,211,0.22); padding:26px 36px; border-radius:18px; box-shadow:0 24px 60px rgba(0,0,0,0.75), 0 0 35px rgba(0,210,211,0.12); display:flex; flex-direction:column; align-items:center; gap:14px; min-width:260px; max-width:400px; text-align:center; position:relative; overflow:hidden;">
					<div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
						<div style="width:42px; height:42px; border:3px solid rgba(0,210,211,0.15); border-top-color:var(--primary, #00d2d3); border-right-color:rgba(0,210,211,0.6); border-radius:50%; animation:ui-spin 0.75s linear infinite;"></div>
						<div style="position:absolute; width:10px; height:10px; background:#00d2d3; border-radius:50%; box-shadow:0 0 12px #00d2d3; animation:ui-pulse-glow 1.5s ease-in-out infinite;"></div>
					</div>
					<div style="display:flex; flex-direction:column; gap:4px;">
						<div id="ui-loading-msg" style="color:#f8fafc; font-size:13.5px; font-weight:600; line-height:1.45; word-break:break-word;">${message}</div>
						<div id="ui-loading-sub" style="color:#94a3b8; font-size:11.5px; font-weight:400;">${subText}</div>
					</div>
				</div>
			`;
			document.body.appendChild(overlay);
		} else {
			const msgEl = overlay.querySelector("#ui-loading-msg");
			if (msgEl) msgEl.innerText = message;
			const subEl = overlay.querySelector("#ui-loading-sub");
			if (subEl) subEl.innerText = subText;
			overlay.style.display = "flex";
		}
	},

	hideLoading() {
		const overlay = document.getElementById("ui-loading-overlay");
		if (overlay) overlay.remove();
	},
	formatBytes(bytes, decimals = 1) {
		if (!bytes || bytes <= 0) return "0 B";
		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ["B", "KB", "MB", "GB", "TB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return (
			parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
		);
	},
	renderCategories(categories, stats = {}) {
		const sidebar = document.getElementById("category-sidebar");
		if (!sidebar) return;
		sidebar.innerHTML = "";

		if (categories.length === 0) {
			sidebar.innerHTML =
				'<div class="subtitle">Không có danh mục nào.</div>';
			return;
		}

		categories.forEach((cat) => {
			const item = document.createElement("div");
			item.className = "category-item";
			item.dataset.category = cat;
			if (App.currentCategory === cat) item.classList.add("active");

			item.onclick = () => {
				document
					.querySelectorAll(".category-item")
					.forEach((i) => i.classList.remove("active"));
				item.classList.add("active");
				App.showDashboard();
				App.loadProjects(cat);
			};

			const isStrict = /^\d{4}_\d{2}$/.test(cat);
			let displayTitle = "";
			let displaySubtitle = "";
			let displayIcon = "";

			if (isStrict) {
				const parts = cat.split("_");
				const year = parts[0];
				const month = parts[1];
				displayTitle = `Tháng ${month}`;
				displaySubtitle = year;
				displayIcon = month;
			} else {
				displayTitle = cat;
				displaySubtitle = "Thư mục";
				displayIcon = cat.substring(0, 2).toUpperCase();
			}

			const stat = stats && stats[cat] ? stats[cat] : null;
			const sizeStr =
				stat && stat.size_formatted ? stat.size_formatted : "";
			if (sizeStr) {
				displaySubtitle = `${displaySubtitle} • ${sizeStr}`;
			}

			item.innerHTML = `
                <div class="category-item-icon">${displayIcon}</div>
                <div class="flex-1-minw0">
                    <div class="category-item-title" title="${displayTitle}">${displayTitle}</div>
                    <div class="category-item-subtitle" title="${sizeStr ? `Tổng dung lượng: ${sizeStr}` : ""}">${displaySubtitle}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
            `;
			sidebar.appendChild(item);
		});
	},

	renderProjects(projects, category, categoryTotalSizeFormatted = null) {
		const list = document.getElementById("project-list");
		if (!list) return;
		list.innerHTML = "";

		const catText = category || "Toàn bộ";
		const currentCatEl = document.getElementById("current-category");
		if (currentCatEl) currentCatEl.innerText = catText;

		const titleEl = document.getElementById("content-title");
		if (titleEl) titleEl.innerText = `Dự án: ${catText}`;

		if (projects.length === 0) {
			list.innerHTML =
				'<div class="subtitle subtitle-padded">Không có dự án nào trong tháng này.</div>';
			return;
		}

		// Stats calculation
		let stats = { total: projects.length, configured: 0, demo: 0 };

		projects.forEach((p) => {
			const card = document.createElement("div");
			card.className = "item-card";

			const isConfigured =
				p.config &&
				(p.config.ftp_host ||
					(p.config.prod && p.config.prod.ftp_host));
			const isLockedDemo = !!(p.config && p.config.lock_demo);
			const isLockedProd = !!(p.config && p.config.lock_production);
			const hasDeployed = !!(p.config && p.config.deployed);

			card.dataset.lockDemo = isLockedDemo ? "1" : "0";
			card.dataset.lockProd = isLockedProd ? "1" : "0";
			card.dataset.configured = isConfigured ? "1" : "0";
			card.dataset.deployed = JSON.stringify(
				p.config && p.config.deployed ? p.config.deployed : {},
			);

			if (isConfigured) stats.configured++;
			if (isLockedDemo) stats.demo++;

			const safeName = p.name.replace(/'/g, "\\'").replace(/`/g, "\\`");
			const safeCat = category.replace(/'/g, "\\'").replace(/`/g, "\\`");

			const hasDemo = !!(
				p.config &&
				p.config.deployed &&
				p.config.deployed.demo &&
				p.config.deployed.demo.deploy_time
			);
			const hasProd = !!(
				p.config &&
				p.config.deployed &&
				p.config.deployed.production
			);

			let badgeClass = "badge-pending";
			let badgeText = "⏳ Local";
			let cardStatusClass = "card-status-pending";

			if (hasProd) {
				badgeClass = "badge-prod";
				badgeText = "🚀 Production";
				cardStatusClass = "card-status-prod";
			} else if (hasDemo) {
				badgeClass = "badge-ok";
				badgeText = "🌿 Demo";
				cardStatusClass = "card-status-demo";
			}

			card.dataset.project = safeName;
			card.dataset.category = safeCat;

			card.className = `item-card ${cardStatusClass}`;

			card.onclick = () => App.openConfig(p.name, category);
			card.oncontextmenu = (e) => {
				e.preventDefault();
				e.stopPropagation();
				UI.openMenu(e, safeName, safeCat);
			};

			const thumbHtml = p.screenshot
				? `<img src="${p.screenshot}" class="item-card-thumb-img" alt="${p.name}" loading="lazy" />`
				: `<div class="item-card-thumb-placeholder">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
						<span>Chưa có ảnh</span>
				   </div>`;

			const isCustomPhp = !!p.is_custom_php;
			const phpDisplay =
				p.php_display ||
				(p.php_version
					? p.php_version.replace(/^php-?/i, "PHP ")
					: "PHP");
			const phpTitle = isCustomPhp
				? `Phiên bản PHP riêng: ${p.php_version} (Cấu hình riêng trong sites.json)`
				: `Phiên bản PHP mặc định hệ thống: ${p.php_version || "Hệ thống"}`;

			// Phân loại màu theo phiên bản: >= 8.4 (php-v84), 8.3 (php-v83), 7.4 / < 8.0 (php-v74)
			const vNum = parseFloat(
				(p.php_version || "").replace(/[^0-9.]/g, ""),
			);
			let vClass = "php-v-default";
			if (!isNaN(vNum)) {
				if (vNum >= 8.4) vClass = "php-v84";
				else if (vNum >= 8.3 && vNum < 8.4) vClass = "php-v83";
				else if (vNum < 8.0) vClass = "php-v74";
				else vClass = "php-v8x";
			}

			const customClass = isCustomPhp ? "is-custom" : "";
			const phpBadge = `<span class="badge-php ${vClass} ${customClass}" title="${phpTitle}">${isCustomPhp ? '<span class="badge-php-dot"></span>' : ""}${phpDisplay}</span>`;

			// Badge Deadline & Design từ Nasani Project Management
			let deadlineRowHtml =
				'<div class="item-card-deadline-row is-empty"></div>';
			if (p.nasani_info) {
				const ni = p.nasani_info;
				let shortDate = "";
				if (ni.deadline) {
					const parts = ni.deadline.split(" ");
					const dParts = parts[0].split("-");
					if (dParts.length === 3) {
						shortDate = `${dParts[2]}/${dParts[1]}`;
					} else {
						shortDate = ni.deadline;
					}
				}

				const designLinkHtml = ni.design_url
					? `<a href="${ni.design_url}" target="_blank" onclick="event.stopPropagation();" class="card-dl-design-btn" title="Mở link Design (Figma / Nasani): ${ni.design_url}">
						<span>🎨</span>
					</a>`
					: "";

				let badgeHtml = "";
				if (ni.is_active && ni.deadline) {
					const rem = this.formatRemainingTime(
						ni.deadline,
						shortDate,
					);
					const demoUrl = this.getProjectDemoUrl(
						p,
						safeName,
						safeCat,
					);
					badgeHtml = `
						<div class="card-dl-badge ${rem.className}" data-deadline="${ni.deadline}" data-shortdate="${shortDate}" data-contract-code="${ni.contract_code || ""}" data-project-name="${safeName}" data-project-cat="${safeCat}" data-demo-url="${demoUrl}" title="⚡ ĐANG LÀM - Hạn chót: ${ni.deadline}\nKhách hàng: ${ni.contract_name || ""}\nMã HĐ: ${ni.contract_code || ""}\nLập trình: ${ni.dev_name || ""}">
							<span class="dl-icon">${rem.icon}</span>
							<span class="dl-text">${rem.text}</span>
						</div>
					`;
				} else {
					let cDate = "";
					if (ni.completed_at) {
						const parts = ni.completed_at.split(" ");
						const dParts = parts[0].split("-");
						if (dParts.length === 3) {
							cDate = `${dParts[2]}/${dParts[1]}`;
							if (parts[1])
								cDate += " " + parts[1].substring(0, 5);
						} else {
							cDate = ni.completed_at;
						}
					}
					badgeHtml = `
						<div class="card-dl-badge dl-done" title="✓ Dự án đã hoàn thành ${ni.completed_at ? "ngày " + ni.completed_at : ""}\nKhách hàng: ${ni.contract_name || ""}\nMã HĐ: ${ni.contract_code || ""}\nLập trình: ${ni.dev_name || ""}">
							<span class="dl-icon">✓</span>
							<span class="dl-text">${cDate || "Hoàn thành"}</span>
						</div>
					`;
				}

				deadlineRowHtml = `
					<div class="item-card-deadline-row">
						${badgeHtml}
						${designLinkHtml}
					</div>
				`;
			}

			card.innerHTML = `
                <div class="item-card-inner">
                    <div class="item-card-thumb-wrap" onclick="event.stopPropagation(); App.previewOrCapture('${safeName}', '${safeCat}', '${p.screenshot ? p.screenshot.replace(/'/g, "\\'") : ""}')" title="${p.screenshot ? "Nhấn để xem hoặc cập nhật ảnh website" : "Nhấn để chụp ảnh website"}">
                        ${thumbHtml}
                        <button class="btn-thumb-capture" title="Chụp ảnh website" onclick="event.stopPropagation(); App.captureScreenshot('${safeName}', '${safeCat}')">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </button>
                    </div>
                    <div class="item-card-header">
                        <div class="item-card-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                        </div>
                        <div class="item-card-main flex-1-minw0">
                            <div class="item-card-title">${p.name}</div>
                            <div class="item-card-size" ${p.size_formatted ? "" : 'style="display:none;"'} title="Dung lượng dự án: ${p.size_formatted || ""}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><span>${p.size_formatted || ""}</span></div>
                        </div>
                    </div>
                    ${deadlineRowHtml}
                    <div class="item-card-footer">
                        <div class="item-card-badges" style="display:flex; align-items:center; justify-content:space-between; gap:6px; width:100%; flex-wrap:nowrap; overflow:hidden;">
                            <span class="badge ${badgeClass}">${badgeText}</span>
                            ${phpBadge}
                        </div>
                    </div>
                </div>
            `;
			list.appendChild(card);
		});

		// Update stats in UI
		document.getElementById("stat-total-projects").innerText = stats.total;
		document.getElementById("stat-configured").innerText = stats.configured;
		document.getElementById("stat-demo").innerText = stats.demo;

		// Khởi động bộ đếm thời gian thực cho các dự án đang làm
		this.startDeadlineTicker();
	},

	deadlineTickerTimer: null,
	padZero(num) {
		return num < 10 ? "0" + num : "" + num;
	},

	parseDeadlineDate(dateStr) {
		if (!dateStr) return null;
		const parts = dateStr.trim().split(" ");
		const dParts = parts[0].split("-");
		if (dParts.length !== 3) return null;
		const year = parseInt(dParts[0], 10);
		const month = parseInt(dParts[1], 10) - 1;
		const day = parseInt(dParts[2], 10);
		let hour = 0,
			min = 0,
			sec = 0;
		if (parts[1]) {
			const tParts = parts[1].split(":");
			if (tParts.length >= 2) {
				hour = parseInt(tParts[0], 10) || 0;
				min = parseInt(tParts[1], 10) || 0;
				sec = parseInt(tParts[2], 10) || 0;
			}
		}
		return new Date(year, month, day, hour, min, sec);
	},

	formatRemainingTime(deadlineStr, shortDate) {
		const targetDate = this.parseDeadlineDate(deadlineStr);
		if (!targetDate)
			return {
				text: shortDate || "",
				className: "dl-normal",
				icon: "⚡",
				diffMs: 0,
			};
		const diffMs = targetDate.getTime() - Date.now();
		if (diffMs < 0) {
			const absMs = Math.abs(diffMs);
			const totalSec = Math.floor(absMs / 1000);
			const s = totalSec % 60;
			const totalMin = Math.floor(totalSec / 60);
			const m = totalMin % 60;
			const totalHour = Math.floor(totalMin / 60);
			const h = totalHour % 24;
			const d = Math.floor(totalHour / 24);

			let timeStr = "";
			if (d > 0) {
				timeStr = `${d}d ${this.padZero(h)}:${this.padZero(m)}:${this.padZero(s)}`;
			} else {
				timeStr = `${this.padZero(totalHour)}:${this.padZero(m)}:${this.padZero(s)}`;
			}
			return {
				text: `Trễ ${timeStr} (${shortDate})`,
				className: "dl-overdue",
				icon: "🚨",
				diffMs: diffMs,
			};
		}

		const totalSec = Math.floor(diffMs / 1000);
		const s = totalSec % 60;
		const totalMin = Math.floor(totalSec / 60);
		const m = totalMin % 60;
		const totalHour = Math.floor(totalMin / 60);
		const h = totalHour % 24;
		const d = Math.floor(totalHour / 24);

		// CẢNH BÁO KHẨN CẤP: Còn <= 10 phút (<= 600s) -> Chớp đỏ theo giây
		if (diffMs <= 10 * 60 * 1000) {
			const timeStr = `${this.padZero(m)}:${this.padZero(s)}`;
			return {
				text: `Còn ${timeStr}! (${shortDate})`,
				className: "dl-critical-10m",
				icon: "🔥",
				diffMs: diffMs,
			};
		}

		// Còn trong 24 giờ
		if (diffMs <= 24 * 3600 * 1000) {
			const timeStr = `${this.padZero(h)}:${this.padZero(m)}:${this.padZero(s)}`;
			return {
				text: `Còn ${timeStr} (${shortDate})`,
				className: "dl-urgent",
				icon: "⚠️",
				diffMs: diffMs,
			};
		}

		// Còn trên 1 ngày -> hiển thị ngày và giờ:phút:giây realtime
		const timeStr = `${d}d ${this.padZero(h)}:${this.padZero(m)}:${this.padZero(s)}`;
		return {
			text: `Còn ${timeStr} (${shortDate})`,
			className: "dl-normal",
			icon: "⚡",
			diffMs: diffMs,
		};
	},

	startDeadlineTicker() {
		if (this.deadlineTickerTimer) clearInterval(this.deadlineTickerTimer);
		const badges = document.querySelectorAll(
			".card-dl-badge[data-deadline]",
		);
		if (!badges.length) return;
		this.deadlineTickerTimer = setInterval(() => {
			document
				.querySelectorAll(".card-dl-badge[data-deadline]")
				.forEach((badge) => {
					const dl = badge.getAttribute("data-deadline");
					const sd = badge.getAttribute("data-shortdate");
					if (!dl) return;
					const res = this.formatRemainingTime(dl, sd);
					const expectedClass = `card-dl-badge ${res.className}`;
					if (badge.className !== expectedClass) {
						badge.className = expectedClass;
					}
					const iconEl = badge.querySelector(".dl-icon");
					const textEl = badge.querySelector(".dl-text");
					if (iconEl && iconEl.textContent !== res.icon)
						iconEl.textContent = res.icon;
					if (textEl && textEl.textContent !== res.text)
						textEl.textContent = res.text;

					// Tự động kích hoạt mở báo cáo khi còn <= 5 phút (<= 300s)
					if (
						res.diffMs !== undefined &&
						res.diffMs > 0 &&
						res.diffMs <= 5 * 60 * 1000
					) {
						const contractCode =
							badge.getAttribute("data-contract-code");
						const pName = badge.getAttribute("data-project-name");
						const pCat = badge.getAttribute("data-project-cat");
						const dUrl = badge.getAttribute("data-demo-url");
						if (contractCode) {
							this.checkAndTriggerAutoReport(
								contractCode,
								pName,
								pCat,
								dUrl,
							);
						}
					}
				});
		}, 1000);
	},

	getProjectDemoInfo(projectName, category) {
		let p = App.projects
			? App.projects.find((x) => x.name === projectName)
			: null;
		let config = {};
		if (
			App.currentProjectName === projectName &&
			App.currentProjectConfig
		) {
			config = App.currentProjectConfig;
		} else if (p && p.config) {
			config = p.config;
		}

		const deployed = config.deployed || (p && p.deployed) || {};
		const demoDeployed = deployed.demo || null;

		// Kiểm tra nếu dự án đã từng deploy demo
		const isDemoDeployed =
			!!(
				demoDeployed &&
				(demoDeployed.deploy_time ||
					demoDeployed.url ||
					demoDeployed.demo_server_id ||
					demoDeployed.server_id ||
					demoDeployed.matched_folder ||
					demoDeployed.custom_domain ||
					demoDeployed.db_name)
			) || !!(config.lock_demo || (p && p.lock_demo));

		let adminUrl = "";
		let isSsl = !!(config.demo && config.demo.ssl);

		if (isDemoDeployed && demoDeployed) {
			// 1. Nếu có URL trực tiếp đã lưu (do bridge hoặc user set)
			if (
				demoDeployed.url &&
				typeof demoDeployed.url === "string" &&
				demoDeployed.url.trim()
			) {
				adminUrl = demoDeployed.url.trim();
			}
			// 2. Nếu có custom domain riêng cho demo
			else if (
				demoDeployed.custom_domain &&
				typeof demoDeployed.custom_domain === "string" &&
				demoDeployed.custom_domain.trim()
			) {
				adminUrl = demoDeployed.custom_domain.trim();
			}
			// 3. Nếu có demo_url được cấu hình ở project
			else if (config.demo_url || (p && p.demo_url)) {
				adminUrl = (config.demo_url || p.demo_url).trim();
			}
			// 4. Nếu deploy lên demo server thông qua hệ thống
			else {
				let demoDomain = "demo92.nasanivietnam.net";
				const targetServerId =
					demoDeployed.demo_server_id ||
					demoDeployed.server_id ||
					(App.globalData && App.globalData.default_demo_id) ||
					"demo_1785834732693";
				if (App.globalData && App.globalData.demo_list) {
					const matchedServer = App.globalData.demo_list.find(
						(d) => d.id === targetServerId,
					);
					if (matchedServer) {
						if (matchedServer.web_domain) {
							demoDomain = matchedServer.web_domain
								.replace(/^https?:\/\//i, "")
								.replace(/\/+$/, "");
						}
						if (
							matchedServer.ssl !== undefined &&
							(!config.demo || config.demo.ssl === undefined)
						) {
							isSsl = !!matchedServer.ssl;
						}
					}
				}

				// Lấy đúng folder đã deploy trên demo server (matched_folder)
				let folder = "";
				if (
					demoDeployed.matched_folder &&
					typeof demoDeployed.matched_folder === "string" &&
					demoDeployed.matched_folder.trim()
				) {
					folder = demoDeployed.matched_folder.trim();
				} else if (p && p.relPath) {
					folder = p.relPath.replace(/\\/g, "/");
				} else {
					const cat = category || (p && p.category) || "";
					folder =
						cat && cat !== "uncategorized" && cat !== "default"
							? `${cat}/${projectName}`
							: projectName;
				}

				adminUrl = `${demoDomain}/${folder.replace(/^\/+|\/+$/g, "")}/`;
			}
		} else {
			// Dự án chưa deploy demo: fallback theo URL dự kiến
			if (config.demo_url || (p && p.demo_url)) {
				adminUrl = (config.demo_url || p.demo_url).trim();
			} else {
				let demoDomain = "demo92.nasanivietnam.net";
				const defaultDemoId =
					(App.globalData && App.globalData.default_demo_id) ||
					"demo_1785834732693";
				if (App.globalData && App.globalData.demo_list) {
					const matchedServer =
						App.globalData.demo_list.find(
							(d) => d.id === defaultDemoId,
						) ||
						App.globalData.demo_list.find(
							(d) =>
								d.web_domain &&
								d.web_domain.includes("nasanivietnam.net"),
						) ||
						App.globalData.demo_list[0];
					if (matchedServer && matchedServer.web_domain) {
						demoDomain = matchedServer.web_domain
							.replace(/^https?:\/\//i, "")
							.replace(/\/+$/, "");
					}
				} else if (App.globalData && App.globalData.web_domain) {
					demoDomain = App.globalData.web_domain
						.replace(/^https?:\/\//i, "")
						.replace(/\/+$/, "");
				}
				const cat = category || (p && p.category) || "";
				const rel =
					p && p.relPath
						? p.relPath.replace(/\\/g, "/")
						: cat && cat !== "uncategorized" && cat !== "default"
							? `${cat}/${projectName}`
							: projectName;
				adminUrl = `${demoDomain}/${rel.replace(/^\/+|\/+$/g, "")}/`;
			}
		}

		// Chuẩn hóa protocol http:// hoặc https://
		if (
			!adminUrl.startsWith("http://") &&
			!adminUrl.startsWith("https://")
		) {
			const proto = isSsl ? "https://" : "http://";
			adminUrl = proto + adminUrl;
		}

		// Chuẩn hóa đường dẫn admin
		adminUrl = adminUrl.replace(/\/+$/, "");
		if (!adminUrl.endsWith("/admin")) {
			adminUrl += "/admin";
		}

		return {
			isDeployed: isDemoDeployed,
			adminUrl: adminUrl,
			adminUser: "admin",
			deployedDemo: demoDeployed,
			config: config,
		};
	},

	getProjectDemoUrl(p, projectName, category) {
		const name = projectName || (p && p.name);
		const cat = category || (p && p.category);
		return this.getProjectDemoInfo(name, cat).adminUrl;
	},

	generateRandomPassword(len = 10) {
		const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
		const lowers = "abcdefghijkmnpqrstuvwxyz";
		const digits = "23456789";
		const all = uppers + lowers + digits;
		let pwd = [
			uppers[Math.floor(Math.random() * uppers.length)],
			lowers[Math.floor(Math.random() * lowers.length)],
			digits[Math.floor(Math.random() * digits.length)],
		];
		while (pwd.length < len) {
			pwd.push(all[Math.floor(Math.random() * all.length)]);
		}
		return pwd.sort(() => 0.5 - Math.random()).join("");
	},

	playAlertSound() {
		try {
			const AudioContext =
				window.AudioContext || window.webkitAudioContext;
			if (!AudioContext) return;
			const ctx = new AudioContext();
			const now = ctx.currentTime;

			const osc1 = ctx.createOscillator();
			const gain1 = ctx.createGain();
			osc1.connect(gain1);
			gain1.connect(ctx.destination);
			osc1.type = "sine";
			osc1.frequency.setValueAtTime(587.33, now);
			gain1.gain.setValueAtTime(0.25, now);
			gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
			osc1.start(now);
			osc1.stop(now + 0.2);

			const osc2 = ctx.createOscillator();
			const gain2 = ctx.createGain();
			osc2.connect(gain2);
			gain2.connect(ctx.destination);
			osc2.type = "sine";
			osc2.frequency.setValueAtTime(880, now + 0.18);
			gain2.gain.setValueAtTime(0.3, now + 0.18);
			gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
			osc2.start(now + 0.18);
			osc2.stop(now + 0.55);
		} catch (e) {}
	},

	checkAndTriggerAutoReport(contractCode, pName, pCat, dUrl) {
		if (!contractCode) return;
		window._rbwAutoReports = window._rbwAutoReports || {};
		const now = Date.now();
		const lastTrigger = window._rbwAutoReports[contractCode];
		// Kích hoạt 1 lần trong 15 phút tránh spam mở tab
		if (lastTrigger && now - lastTrigger < 15 * 60 * 1000) {
			return;
		}
		window._rbwAutoReports[contractCode] = now;

		this.executeAutoReport(contractCode, pName, pCat, dUrl, true);
	},

	async triggerAutoReport(projectName, category) {
		const project = App.projects
			? App.projects.find((p) => p.name === projectName)
			: null;

		let contractCode = project?.nasani_info?.contract_code || "";
		if (!contractCode && projectName) {
			const m =
				projectName.match(/_(\d+)w?$/i) ||
				projectName.match(/(\d{6,})/);
			if (m) contractCode = m[1];
		}

		if (!contractCode) {
			this.showToast(
				"Không tìm thấy mã hợp đồng của dự án này để báo cáo!",
				"warning",
			);
			return;
		}

		if (
			App.currentProjectName === projectName &&
			!App.currentProjectConfig
		) {
			try {
				const res = await Api.getProjectConfig(
					projectName,
					category || "",
				);
				if (res && res.data) {
					App.currentProjectConfig = res.data;
				}
			} catch (e) {}
		}
		const demoInfo = this.getProjectDemoInfo(projectName, category);
		this.executeAutoReport(
			contractCode,
			projectName,
			category,
			demoInfo.adminUrl,
			false,
		);
	},

	executeAutoReport(
		contractCode,
		pName,
		pCat,
		dUrl,
		isAutoTriggered = false,
	) {
		const demoInfo = this.getProjectDemoInfo(pName, pCat);
		const adminUrl = dUrl || demoInfo.adminUrl;
		const pass = this.generateRandomPassword(10);
		const cleanTargetUrl =
			"https://projects.nasani.vn/ky-thuat/program/list/";
		const fallbackUrlWithParams = `${cleanTargetUrl}?auto_report_code=${encodeURIComponent(contractCode)}&auto_admin_url=${encodeURIComponent(adminUrl)}&auto_admin_user=admin&auto_admin_pass=${encodeURIComponent(pass)}&rbw_t=${Date.now()}`;

		this.playAlertSound();

		// 1. Gửi lệnh cho Extension để xử lý thông minh qua Chrome Storage & Messaging:
		// KHÔNG cần đưa tham số lên URL, giúp URL sạch 100% và không bị lặp lại popup khi F5 / submit báo cáo
		window.postMessage(
			{
				type: "RBW_OPEN_OR_FOCUS_NASANI",
				url: cleanTargetUrl,
				reportCode: contractCode,
				adminUrl: adminUrl,
				adminUser: "admin",
				adminPass: pass,
			},
			"*",
		);

		// 2. Chỉ gọi window.open dự phòng nếu Extension chưa được cài đặt
		const isExtInstalled =
			document.documentElement.getAttribute("data-rbw-nasani-ext") ===
				"1" || window._rbwNasaniExtLoaded;
		let win = null;
		if (!isExtInstalled) {
			try {
				win = window.open(fallbackUrlWithParams, "rbw_nasani_tab");
			} catch (e) {
				win = null;
			}
		}

		this.showAutoReportModal({
			projectName: pName,
			contractCode: contractCode,
			adminUrl: adminUrl,
			adminUser: "admin",
			adminPass: pass,
			targetUrl: isExtInstalled ? cleanTargetUrl : fallbackUrlWithParams,
			autoOpened: true,
			isAutoTriggered: isAutoTriggered,
			isDeployed: demoInfo.isDeployed,
		});
	},

	onAutoReportModalOpenBtnClick(contractCode, adminUrl, pass) {
		const modal = document.getElementById("rbw-autoreport-modal");
		if (modal) modal.remove();
		const cleanTargetUrl =
			"https://projects.nasani.vn/ky-thuat/program/list/";
		const isExtInstalled =
			document.documentElement.getAttribute("data-rbw-nasani-ext") ===
				"1" || window._rbwNasaniExtLoaded;
		if (isExtInstalled) {
			window.postMessage(
				{
					type: "RBW_OPEN_OR_FOCUS_NASANI",
					url: cleanTargetUrl,
					reportCode: contractCode,
					adminUrl: adminUrl,
					adminUser: "admin",
					adminPass: pass,
				},
				"*",
			);
		} else {
			const fallbackUrl = `${cleanTargetUrl}?auto_report_code=${encodeURIComponent(contractCode)}&auto_admin_url=${encodeURIComponent(adminUrl)}&auto_admin_user=admin&auto_admin_pass=${encodeURIComponent(pass)}&rbw_t=${Date.now()}`;
			window.open(fallbackUrl, "rbw_nasani_tab");
		}
	},

	showAutoReportModal(info) {
		const existing = document.getElementById("rbw-autoreport-modal");
		if (existing) existing.remove();

		const modal = document.createElement("div");
		modal.id = "rbw-autoreport-modal";
		modal.style.cssText = `
			position: fixed; inset: 0; z-index: 9999999;
			background: rgba(10, 12, 18, 0.75); backdrop-filter: blur(8px);
			display: flex; align-items: center; justify-content: center;
			padding: 20px;
		`;

		modal.innerHTML = `
			<div style="background: #1e222d; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 16px; width: 100%; max-width: 520px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); overflow: hidden; font-family: inherit; color: #f1f5f9;">
				<div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 18px 24px; display: flex; align-items: center; justify-content: space-between;">
					<div style="display: flex; align-items: center; gap: 10px;">
						<span style="font-size: 24px;">⚡</span>
						<div>
							<div style="font-weight: 700; font-size: 16px; color: #ffffff;">${info.isAutoTriggered ? "Cảnh báo 5 Phút: Tự động Báo Cáo Dự Án" : "Báo Cáo Hoàn Thành Dự Án"}</div>
							<div style="font-size: 12px; color: rgba(255,255,255,0.85);">Hợp đồng: <b>${info.contractCode}</b> (${info.projectName})</div>
						</div>
					</div>
					<button onclick="document.getElementById('rbw-autoreport-modal').remove()" style="background: rgba(0,0,0,0.2); border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;">✕</button>
				</div>
				<div style="padding: 20px 24px;">
					<div style="margin-bottom: 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px;">
						<div style="margin-bottom: 10px;">
							<div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
								<span>Link quản trị (/admin)</span>
								<span style="font-size: 10px; padding: 1px 6px; border-radius: 4px; ${info.isDeployed ? "background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);" : "background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);"}">
									${info.isDeployed ? "✓ Đã lấy đúng link Demo đã deploy" : "⚡ Link Demo dự kiến"}
								</span>
							</div>
							<div style="font-size: 13px; font-weight: 600; color: #38bdf8; word-break: break-all;">${info.adminUrl}</div>
						</div>
						<div style="display: flex; gap: 20px;">
							<div style="flex: 1;">
								<div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600; margin-bottom: 4px;">Tên đăng nhập</div>
								<div style="font-size: 14px; font-weight: 700; color: #f8fafc;">${info.adminUser}</div>
							</div>
							<div style="flex: 1;">
								<div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600; margin-bottom: 4px;">Mật khẩu tạo ngẫu nhiên</div>
								<div style="display: flex; align-items: center; gap: 8px;">
									<span style="font-size: 15px; font-weight: 700; letter-spacing: 1px; color: #34d399; font-family: monospace;">${info.adminPass}</span>
									<button onclick="navigator.clipboard.writeText('${info.adminPass}'); UI.showToast('Đã sao chép mật khẩu!', 'success');" style="background: rgba(52, 211, 153, 0.15); border: 1px solid rgba(52, 211, 153, 0.3); color: #34d399; border-radius: 6px; padding: 3px 8px; font-size: 11px; cursor: pointer;">Copy</button>
								</div>
							</div>
						</div>
					</div>

					<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 18px; font-size: 13px; color: ${info.autoOpened ? "#34d399" : "#fbbf24"};">
						<span>${info.autoOpened ? "✓" : "⚠️"}</span>
						<span>${info.autoOpened ? "Đã gửi lệnh qua Extension và tự động điền form trên Nasani." : "Trình duyệt có thể đã chặn popup, vui lòng bấm nút bên dưới để mở ngay:"}</span>
					</div>

					<div style="display: flex; gap: 12px;">
						<button type="button" onclick="UI.onAutoReportModalOpenBtnClick('${info.contractCode}', '${info.adminUrl.replace(/'/g, "\\'")}', '${info.adminPass}')" style="flex: 1; text-align: center; background: #10b981; color: #ffffff; border: none; padding: 12px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35); display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;">
							<span>🚀</span> Mở Trang Báo Cáo Nasani
						</button>
						<button type="button" onclick="document.getElementById('rbw-autoreport-modal').remove()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #94a3b8; border-radius: 10px; padding: 12px 18px; font-size: 13px; font-weight: 600; cursor: pointer;">Đóng</button>
					</div>
				</div>
			</div>
		`;

		document.body.appendChild(modal);
	},

	// ===== PORTAL MENU (single element at body level) =====
	openMenu(event, projectName, category) {
		const trigger = event.currentTarget || event.target;
		const portal = document.getElementById("action-menu-portal");

		// Read state from parent attributes
		const card = (trigger && typeof trigger.closest === "function")
			? (trigger.closest(".item-card") || trigger)
			: document.querySelector(`.item-card[data-project="${projectName}"]`);
		const isLockedDemo = card ? card.dataset.lockDemo === "1" : false;
		const isLockedProd = card ? card.dataset.lockProd === "1" : false;
		const isConfigured = card ? card.dataset.configured === "1" : false;
		const deployedJson = card ? (card.dataset.deployed || "") : "";

		const safeName = projectName;
		const safeCat = category;
		const project = App.projects
			? App.projects.find((p) => p.name === projectName)
			: null;
		const isConfigPhp = !!(
			project &&
			(project.is_config_php || project.has_config_php)
		);

		// Build menu content
		portal.innerHTML = `
            <button class="action-menu-item portal-antigravity-btn" onclick="UI.closePortalMenu(); App.openAntigravity('${safeName}')">
                <span class="menu-icon mi-purple"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></span>
                <strong class="portal-antigravity-text">Mở bằng Antigravity</strong>
            </button>

            <div class="menu-divider"></div>
            <button class="action-menu-item" onclick="UI.closePortalMenu(); App.openConfig('${safeName}', '${safeCat}')">
                <span class="menu-icon mi-cyan"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-2.82-1.17l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
                Cấu hình
            </button>
            <button class="action-menu-item" onclick="UI.closePortalMenu(); App.captureScreenshot('${safeName}', '${safeCat}')">
                <span class="menu-icon mi-amber"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></span>
                Chụp ảnh Website
            </button>
            ${
				project &&
				project.nasani_info &&
				project.nasani_info.contract_code
					? `
            <button class="action-menu-item" style="color: #10b981; font-weight: 600;" onclick="UI.closePortalMenu(); UI.triggerAutoReport('${safeName}','${safeCat}')">
                <span class="menu-icon mi-green"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
                ⚡ Báo cáo hoàn thành (Nasani)
            </button>
            `
					: ""
			}
            ${
				deployedJson
					? `
            <button id="portal-detail-btn" class="action-menu-item">
                <span class="menu-icon mi-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>
                Xem Thông tin DB
            </button>`
					: ""
			}
            <div class="menu-divider"></div>
            <button class="action-menu-item" onclick="UI.closePortalMenu(); App.showSetDemoAccountModal('${safeName}','${safeCat}')">
                <span class="menu-icon mi-blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>
                Set tài khoản Demo
            </button>
            <button class="action-menu-item ${isLockedDemo ? "disabled" : ""}" onclick="UI.closePortalMenu(); App.deployDemo('${safeName}','${safeCat}')">
                <span class="menu-icon mi-green"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
                Deploy Demo ${isLockedDemo ? "🔒" : ""}
            </button>
            <button class="action-menu-item ${isLockedDemo ? "disabled" : ""}" onclick="UI.closePortalMenu(); App.deployDbDemo('${safeName}','${safeCat}')">
                <span class="menu-icon mi-green portal-db-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-2.239 10-5V7c0-2.761-4.477-5-10-5S2 4.239 2 7v10c0 2.761 4.477 5 10 5z"/><path d="M2 7c0 2.761 4.477 5 10 5s10-2.239 10-5"/><path d="M2 12c0 2.761 4.477 5 10 5s10-2.239 10-5"/></svg></span>
                Deploy DB Demo ${isLockedDemo ? "🔒" : ""}
            </button>
            <button class="action-menu-item" onclick="UI.closePortalMenu(); App.pushTools('${safeName}','${safeCat}')">
                <span class="menu-icon mi-cyan"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg></span>
                Sync Tools
            </button>
            <div class="menu-divider"></div>
            <button class="action-menu-item" onclick="UI.closePortalMenu(); App.installSSL('${safeName}')">
                <span class="menu-icon mi-purple"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
                Cài SSL
            </button>
            <button class="action-menu-item" onclick="UI.closePortalMenu(); App.showChangePhpVersionModal('${safeName}')">
                <span class="menu-icon mi-green"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></span>
                Đổi PHP Version
            </button>
            ${
				!isConfigPhp
					? `
            <button class="action-menu-item" onclick="UI.closePortalMenu(); App.downloadPackage('${safeName}','${safeCat}')">
                <span class="menu-icon mi-amber"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>
                Download Package
            </button>`
					: ""
			}
            <div class="menu-divider"></div>
            <button class="action-menu-item portal-danger-item" onclick="UI.closePortalMenu(); App.cleanupTools('${safeName}','${safeCat}', 'demo')">
                <span class="menu-icon mi-red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg></span>
                Dọn dẹp Demo
            </button>
            <button class="action-menu-item portal-danger-item" onclick="UI.closePortalMenu(); App.cleanupTools('${safeName}','${safeCat}', 'production')">
                <span class="menu-icon mi-red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg></span>
                Dọn dẹp Production
            </button>
            <div class="menu-divider"></div>
            <button class="action-menu-item ${isLockedDemo ? "portal-danger-item" : ""}" onclick="UI.closePortalMenu(); App.toggleActionLock('${safeName}','demo')">
                <span class="menu-icon ${isLockedDemo ? "mi-red" : ""}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="${isLockedDemo ? "M7 11V7a5 5 0 0 1 9.9-1" : "M7 11V7a5 5 0 0 1 10 0v4"}"/></svg></span>
                ${isLockedDemo ? "Mở khóa Demo" : "Khóa Demo"}
            </button>
            <button class="action-menu-item ${isLockedProd ? "portal-danger-item" : ""}" onclick="UI.closePortalMenu(); App.toggleActionLock('${safeName}','production')">
                <span class="menu-icon ${isLockedProd ? "mi-red" : ""}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="${isLockedProd ? "M7 11V7a5 5 0 0 1 9.9-1" : "M7 11V7a5 5 0 0 1 10 0v4"}"/></svg></span>
                ${isLockedProd ? "Mở khóa Production" : "Khóa Production"}
            </button>
        `;

		// Bind deployed detail button safely (avoids JSON-in-attribute issues)
		if (deployedJson) {
			const detailBtn = portal.querySelector("#portal-detail-btn");
			if (detailBtn) {
				const deployedObj = JSON.parse(deployedJson);
				detailBtn.addEventListener("click", () => {
					UI.closePortalMenu();
					UI.renderProjectDetail(safeName, deployedObj);
				});
			}
		}

		// Position: absolute relative to document body
		portal.style.visibility = "hidden";
		portal.style.display = "block";

		const menuW = 210;
		const menuH = portal.offsetHeight || 280;

		let top = 0;
		let left = 0;

		if (event.pageX !== undefined && event.pageY !== undefined) {
			// Click chuột phải (contextmenu) -> hiển thị chính xác tại con trỏ chuột
			top = event.pageY + 2;
			left = event.pageX + 2;

			// Nếu tràn cạnh dưới màn hình thì mở ngược lên trên
			if (event.clientY + menuH > window.innerHeight - 10) {
				top = event.pageY - menuH - 2;
			}
			// Nếu tràn cạnh phải màn hình thì lùi sang bên trái
			if (event.clientX + menuW > window.innerWidth - 10) {
				left = event.pageX - menuW - 2;
			}
		} else if (trigger && typeof trigger.getBoundingClientRect === "function") {
			const rect = trigger.getBoundingClientRect();
			top = rect.bottom + window.scrollY + 6;
			left = rect.right + window.scrollX - menuW;

			if (rect.bottom + menuH > window.innerHeight - 10) {
				top = rect.top + window.scrollY - menuH - 6;
			}
		}

		// Chống tràn mép trên (theo viewport)
		if (top < window.scrollY + 10) top = window.scrollY + 10;
		// Chống tràn mép phải/trái (theo viewport)
		if (left < window.scrollX + 10) left = window.scrollX + 10;
		if (left + menuW > window.scrollX + window.innerWidth - 10) {
			left = window.scrollX + window.innerWidth - menuW - 10;
		}

		portal.style.top = `${top}px`;
		portal.style.left = `${left}px`;
		portal.style.visibility = "visible";

		// Close on outside click (defer so this click doesn't immediately close it)
		setTimeout(() => {
			if (this._portalCloseHandler) {
				document.removeEventListener("click", this._portalCloseHandler);
				document.removeEventListener("contextmenu", this._portalCloseHandler);
			}
			this._portalCloseHandler = (e) => {
				if (!portal.contains(e.target)) {
					UI.closePortalMenu();
					document.removeEventListener("click", this._portalCloseHandler);
					document.removeEventListener("contextmenu", this._portalCloseHandler);
					this._portalCloseHandler = null;
				}
			};
			document.addEventListener("click", this._portalCloseHandler);
			document.addEventListener("contextmenu", this._portalCloseHandler);
		}, 10);
	},

	closePortalMenu() {
		const portal = document.getElementById("action-menu-portal");
		if (portal) portal.style.display = "none";
	},

	showChangeTypeModal(name, category) {
		document.getElementById("ct-project-name").value = name;
		document.getElementById("ct-project-category").value = category;
		document.getElementById("ct-old-type").value = "";
		document.getElementById("ct-new-type").value = "";
		this.showModal("change-type-modal");
	},

	notify(message, type = "info") {
		const container = document.getElementById("toast-container");
		if (!container) return;

		const toast = document.createElement("div");
		toast.className = `toast toast-${type}`;

		let icon = "ℹ️";
		if (type === "success") icon = "✔️";
		if (type === "error") icon = "❌";

		toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-msg">${message}</div>
        `;

		container.appendChild(toast);

		// Tự động xóa sau 3 giây
		setTimeout(() => {
			toast.classList.add("hide");
			setTimeout(() => toast.remove(), 300);
		}, 3000);

		// Cho phép nhấn để đóng ngay
		toast.onclick = () => {
			toast.classList.add("hide");
			setTimeout(() => toast.remove(), 300);
		};
	},

	// ===== MODAL =====
	showModal(id) {
		const modal = document.getElementById(id);
		if (modal) {
			modal.style.display = "flex";
			if (id === "deploy-modal") {
				if (!this._deployModalConfigured) {
					this.setupDeployModal({});
				}
				this._deployModalConfigured = false;
			}
		}
	},

	hideModal(id) {
		if (id === "deploy-modal") {
			this.stopDeployTimer();
			this._deployModalConfigured = false;
		}
		const el = document.getElementById(id);
		if (el) el.style.display = "none";
	},

	fillConfigForm(name, config) {
		document.getElementById("current-project").value = name;
		if (!config) config = {};
		const prod = config.prod || {};
		const deployed = config.deployed || {};

		Object.keys(prod).forEach((key) => {
			const el = document.getElementById(key);
			if (el && el.id !== "current-project") {
				if (el.type === "checkbox") el.checked = !!prod[key];
				else el.value = prod[key];
			}
		});

		// Render Master Actions & Info (Modal version)
		this.renderMasterActions(name, App.currentCategory, config, "");
		this.renderMasterDeployedInfo(deployed, "");
		this.renderMasterHistoryInfo(config.history, "");
	},

	_lastRenderedProject: null,

	resetProjectSubTabs(name) {
		if (this._lastRenderedProject === name) return;
		this._lastRenderedProject = name;

		if (typeof SchemaBuilder !== "undefined") {
			SchemaBuilder.currentProject = name;
			SchemaBuilder.currentFile = null;
			SchemaBuilder.currentData = null;
			const sbForm = document.getElementById("sb-form-container");
			if (sbForm) sbForm.innerHTML = "";
			const sbPrev = document.getElementById("sb-live-preview");
			if (sbPrev) sbPrev.textContent = "";
		}
		if (typeof FontManager !== "undefined") {
			const fPrev = document.getElementById("fonts-css-preview");
			if (fPrev) fPrev.innerText = "/* Đang tải... */";
			const fList = document.getElementById("installed-fonts-list");
			if (fList) fList.innerHTML = "";
		}
		if (typeof WebpManager !== "undefined") {
			const wList = document.getElementById("project-webp-images-list");
			if (wList) wList.innerHTML = "";
		}
		if (typeof ImageTrimManager !== "undefined") {
			ImageTrimManager.images = [];
			if (ImageTrimManager.selected) ImageTrimManager.selected.clear();
			const tGrid = document.getElementById("project-trim-images-grid");
			if (tGrid) tGrid.innerHTML = "";
		}
		if (typeof AutoMediaManager !== "undefined") {
			AutoMediaManager.currentProject = name;
			const amCont = document.getElementById("auto-media-groups-container");
			if (amCont) amCont.innerHTML = "";
		}
		if (typeof SeedManager !== "undefined") {
			SeedManager.currentProject = name;
			SeedManager.selectedImages = {};
			SeedManager.subTypes = {};
			SeedManager.allImages = [];
		}
		if (typeof FileManager !== "undefined") {
			FileManager.lastProject = null;
			FileManager.treeCache = {};
			FileManager.rawFiles = [];
		}
		if (typeof SyncCenter !== "undefined") {
			SyncCenter.lastProject = null;
			SyncCenter.lastData = null;
		}
	},

	fillProjectDetailForm(name, config, category) {
		document.getElementById("d_current-project").value = name;
		if (!config) config = {};
		const prod = config.prod || {};
		const deployed = config.deployed || {};

		// Map fields with d_ prefix
		const fields = [
			"ftp_host",
			"web_domain",
			"ftp_user",
			"da_user",
			"ftp_pass",
			"ftp_root",
		];
		fields.forEach((f) => {
			const el = document.getElementById("d_" + f);
			if (el) el.value = prod[f] || "";
		});

		// Render Master Actions & Info (Page version)
		this.renderNasaniInfoCard(config, "d_");
		this.renderMasterActions(name, category, config, "d_");
		this.renderMasterDeployedInfo(deployed, "d_");
		this.renderMasterHistoryInfo(config.history, "d_");

		// Show / Hide Hosting File Manager & Sync Center tabs if project is deployed to Demo OR has Production config
		const hasDemo = !!(
			deployed &&
			deployed.demo &&
			(deployed.demo.deploy_time ||
				deployed.demo.url ||
				deployed.demo.server_id ||
				deployed.demo.demo_server_id)
		);
		const hasProd =
			!!(deployed && deployed.production) ||
			!!(prod && (prod.ftp_host || prod.web_domain || prod.ftp_user));
		const canManageFiles = hasDemo || hasProd;

		const fmBtn = document.getElementById("tab-btn-filemanager");
		const syncBtn = document.getElementById("tab-btn-synccenter");
		if (fmBtn) fmBtn.style.display = canManageFiles ? "" : "none";
		if (syncBtn) syncBtn.style.display = canManageFiles ? "" : "none";

		const sideFmBtn = document.getElementById("side-tab-filemanager");
		const sideSyncBtn = document.getElementById("side-tab-synccenter");
		const sideBkBtn = document.getElementById("side-tab-backups");
		if (sideFmBtn)
			sideFmBtn.style.display = canManageFiles ? "flex" : "none";
		if (sideSyncBtn)
			sideSyncBtn.style.display = canManageFiles ? "flex" : "none";
		if (sideBkBtn)
			sideBkBtn.style.display = canManageFiles ? "flex" : "none";

		// Automatically prioritize environment for current project (Production if configured, otherwise Demo)
		if (
			typeof FileManager !== "undefined" &&
			FileManager.resetToDefaultEnv
		) {
			FileManager.resetToDefaultEnv();
		}
		if (typeof SyncCenter !== "undefined") {
			if (SyncCenter.resetToDefaultEnv) SyncCenter.resetToDefaultEnv();
			SyncCenter.init();
		}

		if (!canManageFiles) {
			const activeTab =
				document.querySelector(".project-side-tab.active") ||
				document.querySelector(".project-master-tabs .tab.active");
			if (
				activeTab &&
				(activeTab.dataset?.tab === "d_tab-filemanager" ||
					activeTab.dataset?.tab === "d_tab-synccenter" ||
					activeTab.dataset?.tab === "d_tab-backups" ||
					activeTab.id === "tab-btn-filemanager" ||
					activeTab.id === "tab-btn-synccenter")
			) {
				const firstTabBtn =
					document.querySelector(".project-side-tab") ||
					document.querySelector(".project-master-tabs .tab");
				if (firstTabBtn)
					this.switchProjectTab(firstTabBtn, "d_tab-config");
			}
		}
	},

	renderNasaniInfoCard(config, prefix = "d_") {
		const container = document.getElementById(prefix + "nasani-info-card");
		if (!container) return;

		const ni =
			(config && config.nasani_info) ||
			(typeof App !== "undefined" &&
				App.currentProjectConfig &&
				App.currentProjectConfig.nasani_info) ||
			null;

		const isDone = !!(ni && ni.is_completed);
		const statusColor = isDone
			? "#34d399"
			: ni && ni.status_type === "overdue"
				? "#f87171"
				: ni && ni.status_type === "urgent"
					? "#fbbf24"
					: "#00d2d3";

		if (ni) {
			container.innerHTML = `
				<div class="pd-top-card">
					<div class="pd-top-header">
						<h3 class="pd-top-title">QUẢN LÝ PROJECT NASANI</h3>
						<div class="pd-top-actions">
							${
								ni.contract_code
									? `
								<button type="button" class="pd-btn-report" onclick="UI.triggerAutoReport(App.currentProjectName, App.currentCategory)" title="Báo cáo hoàn thành sớm cho trưởng nhóm trên Nasani (Tự điền form)">
									<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
									<span>Báo cáo</span>
								</button>`
									: ""
							}
							${
								ni.design_url
									? `
								<a href="${ni.design_url}" target="_blank" class="pd-btn-design" title="Mở link Design (Figma / Nasani): ${ni.design_url}">
									<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
									<span>Link Design</span>
									<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
								</a>`
									: ""
							}
						</div>
					</div>
					<div class="pd-stats-grid">
						<div class="pd-stat-box">
							<span class="pd-stat-label">MÃ HĐ</span>
							<span class="pd-stat-value" style="font-family:var(--mono); color:#00d2d3; font-weight:800;">${ni.contract_code || "—"}</span>
						</div>
						<div class="pd-stat-box">
							<span class="pd-stat-label">Khách hàng</span>
							<span class="pd-stat-value" title="${ni.contract_name || ""}">${ni.contract_name || "—"}</span>
						</div>
						<div class="pd-stat-box">
							<span class="pd-stat-label">${isDone ? "Ngày xong" : "Dự kiến xong"}</span>
							<span class="pd-stat-value" style="color:${statusColor};">${ni.deadline || ni.completed_at || "—"}</span>
							${
								!isDone && ni.days_left !== null && ni.days_left !== undefined
									? `<span class="pd-stat-sub" style="color:${statusColor};">${ni.days_left >= 0 ? "Còn " + ni.days_left + " ngày" : "Quá " + Math.abs(ni.days_left) + " ngày"}</span>`
									: ""
							}
						</div>
						<div class="pd-stat-box">
							<span class="pd-stat-label">Lập trình</span>
							<span class="pd-stat-value">${ni.dev_name || "—"}</span>
						</div>
						<div class="pd-stat-box">
							<span class="pd-stat-label">Giờ làm</span>
							<span class="pd-stat-value">${ni.lt_hours || "—"}</span>
						</div>
					</div>
				</div>
			`;
		} else {
			const p =
				(typeof App !== "undefined" &&
					App.projects &&
					App.projects.find((item) => item.name === App.currentProjectName)) ||
				{};
			container.innerHTML = `
				<div class="pd-top-card">
					<div class="pd-top-header">
						<h3 class="pd-top-title">QUẢN LÝ DỰ ÁN NASANI</h3>
						<div class="pd-top-actions">
							<button type="button" class="pd-btn-report" onclick="UI.triggerAutoReport(App.currentProjectName, App.currentCategory)" title="Báo cáo hoàn thành cho trưởng nhóm">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
								<span>Báo cáo</span>
							</button>
						</div>
					</div>
					<div class="pd-stats-grid">
						<div class="pd-stat-box">
							<span class="pd-stat-label">Tên dự án</span>
							<span class="pd-stat-value" style="color:#00d2d3;">${App.currentProjectName || "—"}</span>
						</div>
						<div class="pd-stat-box">
							<span class="pd-stat-label">Thư mục</span>
							<span class="pd-stat-value">${App.currentCategory || "—"}</span>
						</div>
						<div class="pd-stat-box">
							<span class="pd-stat-label">Dung lượng</span>
							<span class="pd-stat-value">${(config && config.size_formatted) || p.size_formatted || "—"}</span>
						</div>
						<div class="pd-stat-box">
							<span class="pd-stat-label">PHP Version</span>
							<span class="pd-stat-value">${p.php_version || "8.3"}</span>
						</div>
						<div class="pd-stat-box">
							<span class="pd-stat-label">Trạng thái</span>
							<span class="pd-stat-value" style="color:#64748b;">Chưa gán HĐ Nasani</span>
						</div>
					</div>
				</div>
			`;
		}
	},

	renderMasterActions(name, category, config, prefix = "") {
		const container = document.getElementById(
			prefix + "master-action-buttons",
		);
		if (!container) return;
		container.innerHTML = "";

		const isLockedDemo = !!(config && config.lock_demo);
		const isLockedProd = !!(config && config.lock_production);
		const prod = config.prod || {};

		const project = App.projects.find((p) => p.name === name);
		const localUrl = project
			? `http://localhost/${project.relPath.replace(/\\/g, "/")}/`
			: "";

		const getUrl = (url, isSsl = false) => {
			if (!url) return "";
			if (url.startsWith("http")) return url;
			const protocol = isSsl ? "https" : "http";
			return `${protocol}://${url}`;
		};

		const hasProd = !!(config.deployed && config.deployed.production);
		const hasDemo = !!(
			config.deployed &&
			config.deployed.demo &&
			config.deployed.demo.deploy_time
		);

		let demoUrl =
			config.deployed && config.deployed.demo && config.deployed.demo.url
				? config.deployed.demo.url
				: config.demo_url || "";
		if (!demoUrl && hasDemo && project) {
			let demoDomain = "demo92.nasanivietnam.net";
			const defaultDemoId =
				(App.globalData && App.globalData.default_demo_id) ||
				"demo_1785834732693";
			const demoId =
				(config.deployed &&
					config.deployed.demo &&
					config.deployed.demo.demo_server_id) ||
				defaultDemoId;
			if (App.globalData && App.globalData.demo_list) {
				const demoServer =
					App.globalData.demo_list.find((d) => d.id === demoId) ||
					App.globalData.demo_list.find(
						(d) => d.id === defaultDemoId,
					) ||
					App.globalData.demo_list[0];
				if (demoServer && demoServer.web_domain)
					demoDomain = demoServer.web_domain
						.replace(/https?:\/\//i, "")
						.replace(/\/$/, "");
			}
			demoUrl = `${demoDomain}/${project.relPath.replace(/\\/g, "/")}/`;
		}

		const prodUrl = prod.web_domain || "";
		const isDemoSsl = !!(config.demo && config.demo.ssl);
		const isProdSsl = !!(config.prod && config.prod.ssl);

		const safeName = name.replace(/'/g, "\\'").replace(/`/g, "\\`");
		const safeCat = (category || "")
			.replace(/'/g, "\\'")
			.replace(/`/g, "\\`");

		const isConfiguredProd = !!(
			prod &&
			(prod.ftp_host || prod.web_domain || prod.da_user || prod.ftp_user)
		);
		const isConfiguredLocal = !!(config && config.configured_local);
		const isConfigPhp = !!(
			(config && (config.is_config_php || config.has_config_php)) ||
			(project && (project.is_config_php || project.has_config_php))
		);

		container.innerHTML = `
			<div class="pd-env-card">
				<div class="pd-env-header">
					<div class="pd-env-title-row">
						<span class="pd-env-title">MÔI TRƯỜNG LOCAL (DEV)</span>
						<span class="pd-badge pd-badge-local">✔ Sẵn sàng</span>
					</div>
				</div>

				<div class="pd-hero-btn pd-hero-local" onclick="${localUrl ? `window.open('${localUrl}', '_blank')` : ""}">
					<div class="pd-hero-icon">⌂</div>
					<div class="pd-hero-text">
						<div class="pd-hero-title">Mở Website (Local)</div>
					</div>
					<div class="pd-hero-arrow">→</div>
				</div>

				<div class="pd-actions-stack">
					<button type="button" class="pd-action-btn ${isConfiguredLocal ? "is-disabled" : ""}" onclick="${isConfiguredLocal ? "UI.notify('Dự án này đã được cấu hình Source Local!', 'info')" : `App.setupLocalSource('${safeName}', '${safeCat}')`}">
						<span class="pd-btn-icon">${isConfiguredLocal ? "✓" : "🔧"}</span>
						<span class="pd-btn-text">${isConfiguredLocal ? "Đã cấu hình Source" : "Cấu hình Source Local"}</span>
					</button>
					<button type="button" class="pd-action-btn" onclick="App.autoLoginAdmin('${safeName}', '${safeCat}', 'local')" title="Tự động đăng nhập thẳng vào trang quản trị Admin Local">
						<span class="pd-btn-icon">🔑</span>
						<span class="pd-btn-text">Đăng nhập Admin (Local)</span>
					</button>
					<button type="button" class="pd-action-btn" onclick="App.openAntigravity('${safeName}')">
						<span class="pd-btn-icon">▶</span>
						<span class="pd-btn-text">Mở bằng Antigravity</span>
					</button>
					${!isConfigPhp ? `
					<button type="button" class="pd-action-btn" onclick="UI.showChangeTypeModal('${safeName}', '${safeCat}')">
						<span class="pd-btn-icon">🔄</span>
						<span class="pd-btn-text">Đổi Type DB</span>
					</button>` : ""}
					${!isConfigPhp ? `
					<button type="button" class="pd-action-btn" onclick="App.integrateAMP('${safeName}','${safeCat}')">
						<span class="pd-btn-icon">⚡</span>
						<span class="pd-btn-text">Tích hợp AMP</span>
					</button>` : ""}
					<button type="button" class="pd-action-btn" onclick="App.clearProjectCache('${safeName}','${safeCat}')">
						<span class="pd-btn-icon">🗑</span>
						<span class="pd-btn-text">Xóa cache trình duyệt</span>
					</button>
				</div>
			</div>

			<div class="pd-env-card">
				<div class="pd-env-header">
					<div class="pd-env-title-row">
						<span class="pd-env-title">MÔI TRƯỜNG DEMO</span>
						<span class="pd-badge ${hasDemo ? "pd-badge-demo" : "pd-badge-neutral"}">${hasDemo ? "✔ Đã deploy" : "Chưa deploy"}</span>
					</div>
				</div>

				<div class="pd-hero-btn ${hasDemo ? "pd-hero-demo" : "pd-hero-disabled"}" onclick="${hasDemo && demoUrl ? `window.open('${getUrl(demoUrl, isDemoSsl)}', '_blank')` : ""}">
					<div class="pd-hero-icon">🔗</div>
					<div class="pd-hero-text">
						<div class="pd-hero-title">${hasDemo ? "Mở Website (Demo)" : "Chưa Deploy Demo"}</div>
					</div>
					<div class="pd-hero-arrow">→</div>
				</div>

				<div class="pd-actions-stack">
					<button type="button" class="pd-action-btn ${hasDemo ? "" : "is-disabled"}" onclick="${hasDemo ? `App.autoLoginAdmin('${safeName}', '${safeCat}', 'demo')` : `UI.notify('Dự án chưa được Deploy Demo! Vui lòng Deploy Demo trước khi đăng nhập.', 'warning')`}" title="${hasDemo ? "Tự động đăng nhập thẳng vào trang quản trị Admin trên Hosting Demo" : "Chưa Deploy Demo — Cần Deploy Demo trước"}">
						<span class="pd-btn-icon">🔑</span>
						<span class="pd-btn-text">Đăng nhập Admin (Demo)</span>
					</button>
					<button type="button" class="pd-action-btn ${isLockedDemo ? "is-disabled" : ""}" onclick="${isLockedDemo ? "UI.notify('Dự án đang bị KHÓA!', 'error')" : `App.deployDemo('${safeName}','${safeCat}')`}">
						<span class="pd-btn-icon">▶</span>
						<span class="pd-btn-text">Deploy Demo</span>
					</button>
					<button type="button" class="pd-action-btn ${isLockedDemo ? "is-disabled" : ""}" onclick="${isLockedDemo ? "UI.notify('Dự án đang bị KHÓA!', 'error')" : `App.deployDbDemo('${safeName}','${safeCat}')`}">
						<span class="pd-btn-icon">▤</span>
						<span class="pd-btn-text">Deploy DB Demo</span>
					</button>
					${hasDemo ? `
					<button type="button" class="pd-action-btn" onclick="App.pushTools('${safeName}', '${safeCat}')">
						<span class="pd-btn-icon">⚡</span>
						<span class="pd-btn-text">Sync Tools</span>
					</button>` : ""}
					${hasDemo && !isConfigPhp ? `
					<button type="button" class="pd-action-btn" onclick="App.downloadPackage('${safeName}','${safeCat}')">
						<span class="pd-btn-icon">⭳</span>
						<span class="pd-btn-text">Download Package</span>
					</button>` : ""}
					${hasDemo ? `
					<button type="button" class="pd-action-btn is-danger" onclick="App.cleanupTools('${safeName}','${safeCat}', 'demo')">
						<span class="pd-btn-icon">✎</span>
						<span class="pd-btn-text">Dọn dẹp Demo</span>
					</button>` : ""}
					<button type="button" class="pd-action-btn" onclick="App.toggleActionLock('${safeName}','demo', '${safeCat}')">
						<span class="pd-btn-icon">🔒</span>
						<span class="pd-btn-text">${isLockedDemo ? "Mở khóa Demo" : "Khóa Demo"}</span>
					</button>
					<button type="button" class="pd-action-btn" onclick="App.showSetDemoAccountModal('${safeName}', '${safeCat}')" title="Gán hoặc chỉnh sửa thông tin kết nối Demo đã có sẵn trên hosting">
						<span class="pd-btn-icon">🔗</span>
						<span class="pd-btn-text">${hasDemo ? "Sửa kết nối Demo" : "Set tài khoản Demo"}</span>
						${!hasDemo ? `<span class="pd-pill-next">Tiếp theo</span>` : ""}
					</button>
				</div>
			</div>

			<div class="pd-env-card">
				<div class="pd-env-header">
					<div class="pd-env-title-row">
						<span class="pd-env-title">MÔI TRƯỜNG PRODUCTION</span>
						<span class="pd-badge ${isConfiguredProd ? "pd-badge-prod" : "pd-badge-warning"}">${isConfiguredProd ? "✔ Sẵn sàng" : "⚠ Thiếu cấu hình"}</span>
					</div>
				</div>

				${!isConfiguredProd ? `
				<div class="pd-hero-btn pd-hero-config" onclick="UI.showModal('${prefix ? "detail-config-modal" : "config-modal"}')">
					<div class="pd-hero-icon">⚙</div>
					<div class="pd-hero-text">
						<div class="pd-hero-title">Cấu hình Hosting</div>
					</div>
					<div class="pd-hero-arrow">→</div>
				</div>
				` : `
				<div class="pd-hero-btn pd-hero-prod" onclick="${prodUrl ? `window.open('${getUrl(prodUrl, isProdSsl)}', '_blank')` : "UI.notify('Chưa cấu hình Domain Production!', 'warning')"}">
					<div class="pd-hero-icon">🌐</div>
					<div class="pd-hero-text">
						<div class="pd-hero-title">Mở Website (Prod)</div>
					</div>
					<div class="pd-hero-arrow">→</div>
				</div>
				<div class="pd-actions-stack">
					<button type="button" class="pd-action-btn ${hasProd ? "" : "is-disabled"}" onclick="${hasProd ? `App.autoLoginAdmin('${safeName}', '${safeCat}', 'prod')` : `UI.notify('Dự án chưa được Publish Production! Vui lòng Publish Production trước khi đăng nhập.', 'warning')`}" title="${hasProd ? "Tự động đăng nhập thẳng vào trang quản trị Admin trên Production" : "Chưa Publish Production — Cần Publish Production trước"}">
						<span class="pd-btn-icon">🔑</span>
						<span class="pd-btn-text">Đăng nhập Admin (Prod)</span>
					</button>
					<button type="button" class="pd-action-btn" onclick="UI.showModal('${prefix ? "detail-config-modal" : "config-modal"}')">
						<span class="pd-btn-icon">⚙</span>
						<span class="pd-btn-text">Cấu hình Hosting</span>
					</button>
					<button type="button" class="pd-action-btn" onclick="App.installSSL('${safeName}', '${safeCat}')">
						<span class="pd-btn-icon">🔒</span>
						<span class="pd-btn-text">Install SSL</span>
					</button>
					<button type="button" class="pd-action-btn" onclick="App.showChangePhpVersionModal('${safeName}', '${safeCat}')">
						<span class="pd-btn-icon">🌐</span>
						<span class="pd-btn-text">Đổi PHP Version</span>
					</button>
					<button type="button" class="pd-action-btn is-danger" onclick="App.cleanupTools('${safeName}','${safeCat}', 'production')">
						<span class="pd-btn-icon">✎</span>
						<span class="pd-btn-text">Dọn dẹp Production</span>
					</button>
					<button type="button" class="pd-action-btn is-danger" onclick="App.toggleActionLock('${safeName}','production', '${safeCat}')">
						<span class="pd-btn-icon">🔒</span>
						<span class="pd-btn-text">${isLockedProd ? "Mở khóa Production" : "Khóa Production"}</span>
					</button>
				</div>
				`}
			</div>
		`;
	},

	togglePasswordText(elId, pass, btn) {
		const el = document.getElementById(elId);
		if (!el) return;
		if (el.innerText === "••••••••••••") {
			el.innerText = pass;
			btn.innerText = "Ẩn";
		} else {
			el.innerText = "••••••••••••";
			btn.innerText = "Hiện";
		}
	},

	renderMasterDeployedInfo(deployed, prefix = "") {
		const container = document.getElementById(
			prefix + "master-deployed-info",
		);
		if (!container) return;

		const hasDemo = deployed && deployed.demo && deployed.demo.deploy_time;
		const hasProd = deployed && deployed.production;

		container.style.display = "block";
		if (!hasDemo && !hasProd) {
			container.innerHTML = `
				<div class="pd-section-card">
					<div class="pd-card-header-title">THÔNG TIN TRIỂN KHAI</div>
					<div class="pd-empty-deploy-row">
						<div class="pd-empty-deploy-left">
							<div class="pd-empty-deploy-icon">🚀</div>
							<div>
								<div class="pd-empty-deploy-title">Chưa Triển Khai</div>
								<div class="pd-empty-deploy-sub">Dự án này chưa được deploy lên môi trường Demo hoặc Production.</div>
							</div>
						</div>
						<button type="button" class="pd-btn-set-demo" onclick="App.showSetDemoAccountModal(App.currentProjectName, App.currentCategory)">
							<span>🔗</span> Set tài khoản Demo
						</button>
					</div>
				</div>
			`;
			return;
		}

		container.innerHTML = `
			<div class="pd-section-card">
				<div class="pd-card-header-title">THÔNG TIN TRIỂN KHAI</div>
				<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
					${
						hasDemo
							? `
					<div class="deploy-box" style="margin:0; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:14px 16px;">
						<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
							<div class="tag" style="margin:0; font-weight:800; color:#5FF0BE;">⚡ DEMO</div>
							<a href="javascript:void(0)" onclick="App.showSetDemoAccountModal(App.currentProjectName, App.currentCategory)" style="font-size:11px; color:#60a5fa; text-decoration:none;" title="Chỉnh sửa thông tin kết nối Demo">✏️ Sửa</a>
						</div>
						${deployed.demo.server_name ? `<div class="kv"><span class="k">Server</span><span class="v">${deployed.demo.server_name}</span></div>` : ""}
						${deployed.demo.matched_folder ? `<div class="kv"><span class="k">Folder</span><span class="v" title="${deployed.demo.matched_folder}">${deployed.demo.matched_folder}</span></div>` : ""}
						<div class="kv"><span class="k">DB</span><span class="v">${deployed.demo.db_name || "—"}</span></div>
						${
							deployed.demo.db_pass
								? `
						<div class="kv">
							<span class="k">Pass</span>
							<span class="v pw-row">
								<span id="${prefix}demo_pw_text">••••••••••••</span>
								<button class="eye-btn" onclick="UI.togglePasswordText('${prefix}demo_pw_text', '${deployed.demo.db_pass}', this)">Hiện</button>
							</span>
						</div>`
								: ""
						}
					</div>`
							: ""
					}

					${
						hasProd
							? `
					<div class="deploy-box prod-box" style="margin:0; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:14px 16px;">
						<div class="tag" style="margin:0 0 8px 0; font-weight:800; color:#c084fc;">🚀 PRODUCTION</div>
						<div class="kv"><span class="k">DB</span><span class="v">${deployed.production.db_name}</span></div>
						<div class="kv"><span class="k">Email</span><span class="v">${deployed.production.email_user || "—"}</span></div>
						<div class="kv">
							<span class="k">Pass</span>
							<span class="v pw-row">
								<span id="${prefix}prod_pw_text">••••••••••••</span>
								<button class="eye-btn" onclick="UI.togglePasswordText('${prefix}prod_pw_text', '${deployed.production.db_pass}', this)">Hiện</button>
							</span>
						</div>
					</div>`
							: ""
					}
				</div>
			</div>
		`;
	},

	renderMasterHistoryInfo(history, prefix = "") {
		const container = document.getElementById(
			prefix + "master-history-info",
		);
		if (!container) return;

		container.style.display = "block";
		if (!history || history.length === 0) {
			container.innerHTML = `
				<div class="pd-section-card">
					<div class="pd-card-header-title">LỊCH SỬ THAO TÁC</div>
					<div style="text-align:center; padding:18px 10px; color:var(--text-muted); font-size:12px; border:1px dashed rgba(255,255,255,0.08); border-radius:10px;">
						Chưa có lịch sử thao tác
					</div>
				</div>
			`;
			return;
		}

		container.innerHTML = `
			<div class="pd-section-card">
				<div class="pd-card-header-title">LỊCH SỬ THAO TÁC</div>
				<div class="history-scroll-container" style="max-height: 280px; overflow-y: auto;">
					${history
						.map(
							(item) => `
					<div class="pd-history-item">
						<div style="display:flex; align-items:center; gap:12px; overflow:hidden;">
							<div class="pd-history-check">✓</div>
							<div style="overflow:hidden;">
								<div class="pd-history-action">${item.action}</div>
								<div class="pd-history-msg">${item.message || "Khởi tạo thành công"}</div>
							</div>
						</div>
						<div class="pd-history-time">${item.time}</div>
					</div>`,
						)
						.join("")}
				</div>
			</div>
		`;
	},

	_addSectionTitle(container, text, color) {
		const div = document.createElement("div");
		div.className = "master-section-title";
		div.style.color = color;
		div.style.marginTop = "15px";
		div.innerText = text;
		container.appendChild(div);
	},

	_createMasterBtn(container, act) {
		if (act.hidden) return;
		const btn = document.createElement("button");
		btn.className = `btn master-btn ${act.disabled ? "disabled" : ""}`;
		if (act.disabled) btn.disabled = true;

		if (!act.disabled) {
			btn.style.color = act.color;
			btn.style.background = `${act.color}12`;
			btn.style.borderColor = `${act.color}22`;
		}

		btn.onclick = (e) => {
			e.preventDefault();
			act.onclick();
		};
		btn.innerHTML = `<span>${act.icon}</span> ${act.label}`;
		container.appendChild(btn);
	},

	renderProjectDetail(name, deployed) {
		document.getElementById("detail-title").innerText =
			`Thông tin: ${name}`;
		const content = document.getElementById("detail-content");

		let html = "";
		if (deployed.demo) {
			html += `
                <div class="info-box info-box-demo">
                    <div class="info-box-header">🌿 Demo</div>
                    <div class="info-box-grid">
                        <div class="info-box-row"><span class="info-box-row-label-demo">Database</span><code class="code-neutral">${deployed.demo.db_name}</code></div>
                        <div class="info-box-row"><span class="info-box-row-label-demo">Username</span><code class="code-neutral">${deployed.demo.db_user}</code></div>
                        <div class="info-box-row"><span class="info-box-row-label-demo">Password</span><code class="code-demo">${deployed.demo.db_pass}</code></div>
                    </div>
                </div>`;
		}
		if (deployed.production) {
			html += `
                <div class="info-box info-box-prod">
                    <div class="info-box-header">🚀 Production</div>
                    <div class="info-box-grid">
                        <div class="info-box-row"><span class="info-box-row-label-prod">Database</span><code class="code-neutral">${deployed.production.db_name}</code></div>
                        <div class="info-box-row"><span class="info-box-row-label-prod">Username</span><code class="code-neutral">${deployed.production.db_user}</code></div>
                        <div class="info-box-row"><span class="info-box-row-label-prod">DB Pass</span><code class="code-prod">${deployed.production.db_pass}</code></div>
                        <div class="info-box-row"><span class="info-box-row-label-prod">Email Pass</span><code class="code-prod">${deployed.production.email_pass || "—"}</code></div>
                        <div class="info-box-meta">Triển khai: ${deployed.production.deploy_time}</div>
                    </div>
                </div>`;
		}

		content.innerHTML =
			html || '<p class="color-muted">Chưa có thông tin triển khai.</p>';
		this.showModal("project-detail-modal");
	},

	_deployTimerInterval: null,
	_deployStepCount: 0,
	_deployCurrentStep: 0,
	_deployModalConfigured: false,

	formatDuration(totalSec) {
		const mins = String(Math.floor(totalSec / 60)).padStart(2, "0");
		const secs = String(totalSec % 60).padStart(2, "0");
		return `⏱️ ${mins}:${secs}`;
	},

	startDeployTimer() {
		this.stopDeployTimer();
		const timerEl = document.getElementById("deploy-timer");
		let sec = 0;
		if (timerEl) timerEl.innerText = "⏱️ 00:00";
		this._deployTimerInterval = setInterval(() => {
			sec++;
			if (timerEl) timerEl.innerText = this.formatDuration(sec);
		}, 1000);
	},

	stopDeployTimer() {
		if (this._deployTimerInterval) {
			clearInterval(this._deployTimerInterval);
			this._deployTimerInterval = null;
		}
		const spinnerEl = document.getElementById("deploy-status-spinner");
		if (spinnerEl) spinnerEl.style.display = "none";
	},

	setupDeployModal(opts = {}) {
		this._deployModalConfigured = true;
		const {
			icon = "🚀",
			title = "Đang triển khai...",
			project = "",
			category = "",
			targetDesc = "Đang xử lý...",
			steps = null,
		} = opts;

		const iconEl = document.getElementById("deploy-modal-icon");
		const titleEl = document.getElementById("deploy-modal-title");
		const projEl = document.getElementById("deploy-project-name");
		const catEl = document.getElementById("deploy-category-badge");
		const descEl = document.getElementById("deploy-target-desc");
		const stepsBox = document.getElementById("deploy-steps-box");
		const bannerEl = document.getElementById("deploy-result-banner");
		const detailsEl = document.getElementById("deploy-log-details");
		const logEl = document.getElementById("log-output");
		const spinnerEl = document.getElementById("deploy-status-spinner");
		const fillEl = document.getElementById("progress-fill");
		const statusEl = document.getElementById("status-text");
		const footerEl = document.getElementById("deploy-footer");

		if (iconEl) iconEl.innerText = icon;
		if (titleEl) titleEl.innerText = title;
		if (projEl) projEl.innerText = project || "--";
		if (catEl) {
			catEl.innerText = category || "Mặc định";
			catEl.style.display = category ? "inline-flex" : "none";
		}
		if (descEl) descEl.innerText = targetDesc;
		if (bannerEl) {
			bannerEl.style.display = "none";
			bannerEl.innerHTML = "";
		}
		if (detailsEl) detailsEl.open = false;
		if (logEl) logEl.innerHTML = "";
		if (spinnerEl) spinnerEl.style.display = "inline-block";
		if (fillEl) {
			fillEl.style.width = "10%";
			fillEl.style.background = "linear-gradient(90deg, #00d2d3, #10b981)";
		}
		if (statusEl) {
			statusEl.innerText = "Đang chuẩn bị...";
			statusEl.style.color = "var(--primary)";
		}
		if (footerEl) footerEl.style.display = "none";

		const stepList = Array.isArray(steps) && steps.length > 0
			? steps
			: [
					{ title: "1. Khởi tạo tác vụ", sub: targetDesc },
					{ title: "2. Thực thi xử lý trên hệ thống", sub: "Đang chạy tiến trình nền..." },
					{ title: "3. Hoàn tất & cập nhật trạng thái", sub: "Lưu cấu hình và làm mới dữ liệu" },
			  ];

		this._deployStepCount = stepList.length;
		this._deployCurrentStep = 1;

		if (stepsBox) {
			stepsBox.innerHTML = stepList
				.map(
					(s, idx) => `
                <div id="deploy-step-${idx + 1}" class="shot-step" style="display:flex; align-items:center; gap:10px; color:${idx === 0 ? "#38bdf8" : "var(--muted)"}; opacity:${idx === 0 ? "1" : "0.55"}; transition:all .25s">
                    <span class="shot-step-icon" style="width:22px; text-align:center; flex-shrink:0">${
						idx === 0
							? '<span class="spinner-small" style="width:13px; height:13px; border:2px solid rgba(255,255,255,0.2); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite; display:inline-block;"></span>'
							: "⚪"
					}</span>
                    <div style="flex:1; min-width:0">
                        <div style="font-weight:600" class="shot-step-title">${s.title}</div>
                        <div style="font-size:0.75rem; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap" class="shot-step-sub">${s.sub || ""}</div>
                    </div>
                </div>`,
				)
				.join("");
		}

		this.startDeployTimer();
	},

	setDeployStep(stepNum, state, subText = null) {
		const stepEl = document.getElementById(`deploy-step-${stepNum}`);
		if (!stepEl) return;
		const iconEl = stepEl.querySelector(".shot-step-icon");
		const subEl = stepEl.querySelector(".shot-step-sub");
		if (subText && subEl) {
			subEl.innerText = subText;
		}
		if (state === "active") {
			stepEl.style.opacity = "1";
			stepEl.style.color = "#38bdf8";
			if (iconEl) {
				iconEl.innerHTML =
					'<span class="spinner-small" style="width:13px; height:13px; border:2px solid rgba(255,255,255,0.2); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite; display:inline-block;"></span>';
			}
		} else if (state === "done") {
			stepEl.style.opacity = "1";
			stepEl.style.color = "#34d399";
			if (iconEl) iconEl.innerHTML = "✅";
		} else if (state === "error") {
			stepEl.style.opacity = "1";
			stepEl.style.color = "#f87171";
			if (iconEl) iconEl.innerHTML = "❌";
		} else {
			stepEl.style.opacity = "0.55";
			stepEl.style.color = "var(--muted)";
			if (iconEl) iconEl.innerHTML = "⚪";
		}
	},

	updateDeployStatus(status, progress, logText = null, stepNum = null) {
		const fillEl = document.getElementById("progress-fill");
		const statusEl = document.getElementById("status-text");
		const titleEl = document.getElementById("deploy-modal-title");
		const spinnerEl = document.getElementById("deploy-status-spinner");
		const bannerEl = document.getElementById("deploy-result-banner");
		const logEl = document.getElementById("log-output");

		if (fillEl && typeof progress === "number") {
			fillEl.style.width = `${Math.max(0, Math.min(100, progress))}%`;
		}

		const isSuccess =
			status === "Thành công!" ||
			status === "Hoàn tất!" ||
			status.includes("Đã xóa");
		const isError =
			status.toLowerCase().includes("lỗi") ||
			status.toLowerCase().includes("thất bại");

		const plainLog = logText
			? String(logText).replace(/<[^>]*>/g, "").replace(/^>\s*/, "").trim()
			: "";

		if (statusEl) {
			statusEl.innerText = plainLog && !isSuccess && !isError ? plainLog : status;
			if (isError) statusEl.style.color = "#f87171";
			else if (isSuccess) statusEl.style.color = "#34d399";
			else statusEl.style.color = "var(--primary)";
		}

		const count = this._deployStepCount || 0;
		if (count > 0) {
			if (isSuccess) {
				for (let s = 1; s <= count; s++) this.setDeployStep(s, "done");
			} else if (isError) {
				const errStep = stepNum || this._deployCurrentStep || 1;
				for (let s = 1; s < errStep; s++) this.setDeployStep(s, "done");
				this.setDeployStep(errStep, "error", plainLog || status);
			} else {
				let targetStep = stepNum;
				if (!targetStep && typeof progress === "number") {
					targetStep = Math.max(
						1,
						Math.min(count, Math.ceil((progress / 100) * count)),
					);
				}
				if (targetStep) {
					this._deployCurrentStep = targetStep;
					for (let s = 1; s < targetStep; s++) this.setDeployStep(s, "done");
					this.setDeployStep(targetStep, "active", plainLog || null);
				} else if (plainLog && this._deployCurrentStep) {
					this.setDeployStep(this._deployCurrentStep, "active", plainLog);
				}
			}
		}

		if (isSuccess || isError) {
			this.stopDeployTimer();
			if (spinnerEl) spinnerEl.style.display = "none";
			if (titleEl) titleEl.innerText = isSuccess ? "Hoàn tất!" : status;
			if (fillEl && isError) {
				fillEl.style.background = "linear-gradient(90deg, #ef4444, #f87171)";
			}
			if (bannerEl) {
				const msgHtml = logText || status;
				if (isSuccess) {
					bannerEl.style.display = "block";
					bannerEl.innerHTML = `<div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius:10px; padding:12px 14px; display:flex; align-items:center; gap:10px"><span style="font-size:1.35rem">🎉</span><div style="flex:1; font-size:0.85rem; color:#34d399; font-weight:600; line-height:1.45">${msgHtml}</div></div>`;
				} else {
					bannerEl.style.display = "block";
					bannerEl.innerHTML = `<div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius:10px; padding:12px 14px; display:flex; align-items:center; gap:10px"><span style="font-size:1.35rem">⚠️</span><div style="flex:1; font-size:0.84rem; color:#fca5a5; font-weight:600; line-height:1.45">${msgHtml}</div></div>`;
				}
			}
		}

		if (logText && logEl) {
			logEl.innerHTML += `${logText}<br>`;
			logEl.scrollTop = logEl.scrollHeight;
		}
	},

	parseQuickConfig(mode = "", ev = null) {
		const prefix = mode === "detail" ? "d_" : "";
		let textarea = null;
		if (ev && ev.target) {
			const box =
				ev.target.closest(".quick-paste-box") ||
				ev.target.closest(".modal");
			if (box) textarea = box.querySelector("textarea");
		}
		if (!textarea) {
			textarea =
				document.getElementById(prefix + "quick_paste") ||
				document.getElementById("d_quick_paste") ||
				document.getElementById("qp_quick_paste") ||
				document.getElementById("quick_paste");
		}
		if (!textarea) return;
		const rawText = textarea.value.trim();
		if (!rawText) {
			this.notify(
				"Vui lòng dán văn bản cấu hình vào ô trước khi phân tích!",
				"warning",
			);
			return;
		}

		// 0. Làm sạch markdown link [text](url) -> text & ký tự ẩn
		let text = rawText
			.replace(/[\u200B-\u200D\uFEFF]/g, "")
			.replace(/\u00A0/g, " ")
			.replace(/\[([^\]]+)\]\((?:mailto:)?([^)]+)\)/g, "$1")
			.trim();

		const config = { da_port: "1111" };

		const extractIp = (str) => {
			if (!str) return "";
			const m = String(str).match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
			return m ? m[1] : "";
		};

		const extractDomains = (str) => {
			if (!str) return [];
			const withoutIps = String(str).replace(
				/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g,
				" ",
			);
			const matches =
				withoutIps.match(
					/(?:https?:\/\/|ftp:\/\/)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})/gi,
				) || [];
			return matches
				.map((m) =>
					m
						.replace(/^(?:https?:\/\/|ftp:\/\/)/i, "")
						.replace(/\/.*$/, "")
						.split(":")[0]
						.trim(),
				)
				.filter(
					(d) =>
						d &&
						!/^(hoặc|hay|or|and|http|https|ftp|mailto)$/i.test(d),
				);
		};

		const cleanHost = (str, preferIp = false) => {
			if (!str) return "";
			const s = String(str).trim();
			if (preferIp) {
				const ip = extractIp(s);
				if (ip) return ip;
			}
			const domains = extractDomains(s);
			if (domains.length > 0) return domains[0];
			const ipFallback = extractIp(s);
			if (ipFallback) return ipFallback;
			return s
				.split(/\s+(?:hoặc|hay|or)\s+|[,;\s]+/i)[0]
				.replace(/^https?:\/\//i, "")
				.replace(/^ftp:\/\//i, "")
				.replace(/\/.*$/, "")
				.split(":")[0]
				.trim();
		};

		const cleanWebDomain = (str) => {
			const d = cleanHost(str, false);
			return d.replace(/^(?:ftp\.|www\.)/i, "").trim();
		};

		const cleanPassword = (str) => {
			if (!str) return "";
			return str
				.replace(
					/\s*(?:[-–—|]\s*)?(?:ngày\s*hết\s*hạn|hết\s*hạn|exp(?:ired|iry)?\b).*$/i,
					"",
				)
				.replace(
					/\s*\((?:ngày\s*hết\s*hạn|hết\s*hạn|exp(?:ired|iry)?\b).*?\)/i,
					"",
				)
				.trim();
		};

		const isPanelOnlyDomain = (d) => {
			if (!d) return true;
			return /(?:^|\.)(?:ninamailservice\.com|directadmin\.com|cpanel\.net|secureserver\.net)$/i.test(
				d,
			);
		};

		const normalizeKey = (str) =>
			String(str || "")
				.toLowerCase()
				.replace(/[:：\t]+/g, " ")
				.replace(/\s+/g, " ")
				.trim();

		const isKeyLabel = (str) => {
			const s = normalizeKey(str);
			return /^(domain|tên miền|web domain|website|control panel|cpanel|directadmin|hosting url|link quản trị|link đăng nhập|link login|url đăng nhập|link hosting|link server|host name|hostname|host|ftp host|ftp server|ftp ip|server ip|ip server|host ip|ip host|ip|username|user name|user|tài khoản|tên đăng nhập|tài khoản ftp|ftp user|ftp username|user ftp|username ftp|panel user|da user|user da|directadmin user|cpanel user|hosting user|user hosting|user server|server user|password|pass|mật khẩu|ftp pass|ftp password|pass ftp|password ftp|mật khẩu ftp|panel pass|da pass|pass da|password da|directadmin pass|cpanel pass|hosting pass|pass hosting|password server|pass server|server pass|server password|mật khẩu server|hết hạn.*|ngày hết hạn.*)$/i.test(
				s,
			);
		};

		const inlineKeyValueRegex =
			/^(thông\s*tin\s*tài\s*khoản\s*ftp|tài\s*khoản\s*ftp|ftp\s*username|username\s*ftp|ftp\s*user|user\s*ftp|directadmin\s*user|cpanel\s*user|hosting\s*user|user\s*hosting|panel\s*user|user\s*server|server\s*user|da\s*user|user\s*da|tên\s*đăng\s*nhập|tài\s*khoản|user\s*name|username|user|mật\s*khẩu\s*server|server\s*password|password\s*server|server\s*pass|pass\s*server|mật\s*khẩu\s*ftp|ftp\s*password|password\s*ftp|ftp\s*pass|pass\s*ftp|directadmin\s*pass|cpanel\s*pass|hosting\s*pass|pass\s*hosting|panel\s*pass|password\s*da|da\s*pass|pass\s*da|mật\s*khẩu|password|pass|link\s*đăng\s*nhập|url\s*đăng\s*nhập|link\s*quản\s*trị|link\s*hosting|link\s*server|hosting\s*url|control\s*panel|directadmin|cpanel|link\s*login|ftp\s*server|ftp\s*host|host\s*name|hostname|server\s*ip|ip\s*server|host\s*ip|ip\s*host|ftp\s*ip|host|ip|web\s*domain|tên\s*miền|website|domain|ngày\s*hết\s*hạn(?:\s+\S+)?|hết\s*hạn(?:\s+\S+)?)(?:\s*[:：]\s*|\t+|\s+)(.+)$/i;

		const rawLines = text
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter((l) => l.length > 0);

		const pairs = [];
		let currentSection = "";
		let explicitWebDomain = false;
		let panelDomainCandidate = "";

		for (let i = 0; i < rawLines.length; i++) {
			const line = rawLines[i];
			const cleanHeaderLine = normalizeKey(line.replace(/[=_\-\[\]]/g, ""));

			// Nhận diện chuyển sang section FTP (tiêu đề thuần túy)
			if (
				/^(thông tin tài khoản ftp|thông tin ftp|ftp account|ftp information|ftp)$/i.test(
					cleanHeaderLine,
				)
			) {
				currentSection = "FTP";
				continue;
			}

			// "Tài khoản FTP": nếu dòng kế tiếp là một nhãn (như Host name / Username) thì là tiêu đề section, ngược lại là nhãn của giá trị FTP user ở dòng dưới
			if (/^tài khoản ftp$/i.test(cleanHeaderLine)) {
				currentSection = "FTP";
				const nextLine = rawLines[i + 1];
				if (!nextLine || isKeyLabel(nextLine)) {
					continue;
				}
			}

			// Nhận diện dòng tiêu đề "Hosting cho tên miền ..."
			if (/hosting\s+cho\s+tên\s+miền/i.test(line)) {
				currentSection = "DA";
				const afterTitle = line.split(/hosting\s+cho\s+tên\s+miền/i)[1] || line;
				const d = cleanWebDomain(afterTitle);
				if (d && !isPanelOnlyDomain(d)) {
					config.web_domain = d;
					explicitWebDomain = true;
				}
				continue;
			}

			// Nhận diện tiêu đề section Hosting / Quản trị thuần túy
			if (
				/^(hosting|thông tin hosting|thông tin quản trị)$/i.test(
					cleanHeaderLine,
				)
			) {
				currentSection = "DA";
				continue;
			}

			// Nếu dòng bắt đầu bằng Control panel / DirectAdmin / cPanel / Link đăng nhập -> đánh dấu section DA nhưng KHÔNG continue để lấy URL ở cùng dòng hoặc dòng kế tiếp
			if (
				/^(control panel|directadmin|cpanel|link đăng nhập|link quản trị|link login|url đăng nhập)\b/i.test(
					cleanHeaderLine,
				)
			) {
				currentSection = "DA";
			}

			// ƯU TIÊN SỐ 1: Toàn bộ dòng hiện tại là một Key Label (kể cả có nhiều từ như "Password FTP", "User server", "Password\tFTP") -> ghép với dòng kế tiếp
			if (isKeyLabel(line)) {
				const nextLine = rawLines[i + 1];
				if (nextLine && !isKeyLabel(nextLine)) {
					pairs.push({
						key: normalizeKey(line),
						val: nextLine.trim(),
						section: currentSection,
					});
					i++;
					continue;
				}
				continue;
			}

			// ƯU TIÊN SỐ 2: Key và Value nằm trên cùng 1 dòng (ưu tiên khớp nhãn dài nhất trước như "Password FTP" trước "Password")
			const inlineMatch = line.match(inlineKeyValueRegex);
			if (inlineMatch) {
				const kPart = normalizeKey(inlineMatch[1]);
				const vPart = inlineMatch[2].trim();
				if (
					vPart &&
					!isKeyLabel(vPart) &&
					!/^(ftp|server|da|panel|hosting|key)$/i.test(vPart)
				) {
					pairs.push({
						key: kPart,
						val: vPart,
						section: currentSection,
					});
					continue;
				}
			}
		}

		pairs.forEach(({ key, val, section }) => {
			const k = normalizeKey(key);

			// 1. Tên miền / Domain
			if (/^(domain|tên\s*miền|web\s*domain|website)$/i.test(k)) {
				const d = cleanWebDomain(val);
				if (d && !isPanelOnlyDomain(d)) {
					config.web_domain = d;
					explicitWebDomain = true;
				}
			}
			// 2. Control Panel / Link đăng nhập
			else if (
				/^(control\s*panel|cpanel|directadmin|hosting\s*url|link\s*quản\s*trị|link\s*đăng\s*nhập|link\s*login|url\s*đăng\s*nhập|link\s*hosting|link\s*server)$/i.test(
					k,
				)
			) {
				const portMatch = val.match(/:(\d{2,5})/);
				if (portMatch) config.da_port = portMatch[1];
				const ip = extractIp(val);
				if (ip) {
					config.ftp_host = ip;
				} else if (!config.ftp_host) {
					config.ftp_host = cleanHost(val, true);
				}
				const domains = extractDomains(val);
				for (const dom of domains) {
					const cleanDom = dom.replace(/^(?:ftp\.|www\.)/i, "");
					if (cleanDom && !isPanelOnlyDomain(cleanDom) && !panelDomainCandidate) {
						panelDomainCandidate = cleanDom;
					}
				}
			}
			// 3. Host name / FTP Host / IP server
			else if (
				/^(host\s*name|hostname|host|ftp\s*host|ftp\s*server|ftp\s*ip|server\s*ip|ip\s*server|host\s*ip|ip\s*host|ip)$/i.test(
					k,
				)
			) {
				const ip = extractIp(val);
				if (ip) {
					config.ftp_host = ip;
				} else if (
					!config.ftp_host ||
					!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(config.ftp_host)
				) {
					config.ftp_host = cleanHost(val, true);
				}
				if (!config.web_domain) {
					const domains = extractDomains(val);
					for (const dom of domains) {
						const cleanDom = dom.replace(/^(?:ftp\.|www\.)/i, "");
						if (cleanDom && !isPanelOnlyDomain(cleanDom)) {
							config.web_domain = cleanDom;
							break;
						}
					}
				}
			}
			// 4. Username
			else if (
				/^(ftp\s*user|ftp\s*username|user\s*ftp|username\s*ftp|tài\s*khoản\s*ftp)$/i.test(
					k,
				)
			) {
				config.ftp_user = val.trim();
				if (config.ftp_user.includes("@") && !explicitWebDomain) {
					const ftpDom = cleanWebDomain(config.ftp_user.split("@")[1]);
					if (ftpDom && !isPanelOnlyDomain(ftpDom)) {
						config.web_domain = ftpDom;
					}
				}
			} else if (
				/^(panel\s*user|da\s*user|user\s*da|directadmin\s*user|cpanel\s*user|hosting\s*user|user\s*hosting|user\s*server|server\s*user)$/i.test(
					k,
				)
			) {
				config.da_user = val.trim();
				if (!config.ftp_user) config.ftp_user = config.da_user;
			} else if (
				/^(username|user\s*name|user|tài\s*khoản|tên\s*đăng\s*nhập)$/i.test(
					k,
				)
			) {
				const v = val.trim();
				if (v.includes("@")) {
					config.ftp_user = v;
					if (!config.da_user) config.da_user = v.split("@")[0];
					if (!explicitWebDomain) {
						const ftpDom = cleanWebDomain(v.split("@")[1]);
						if (ftpDom && !isPanelOnlyDomain(ftpDom)) {
							config.web_domain = ftpDom;
						}
					}
				} else if (section === "DA") {
					config.da_user = v;
					if (!config.ftp_user) config.ftp_user = v;
				} else if (section === "FTP") {
					config.ftp_user = v;
					if (!config.da_user) config.da_user = v;
				} else {
					if (!config.da_user) config.da_user = v;
					if (!config.ftp_user) config.ftp_user = v;
				}
			}
			// 5. Password
			else if (
				/^(ftp\s*pass|ftp\s*password|pass\s*ftp|password\s*ftp|mật\s*khẩu\s*ftp)$/i.test(
					k,
				)
			) {
				config.ftp_pass = cleanPassword(val);
			} else if (
				/^(panel\s*pass|da\s*pass|pass\s*da|password\s*da|directadmin\s*pass|cpanel\s*pass|hosting\s*pass|pass\s*hosting|password\s*server|pass\s*server|server\s*pass|server\s*password|mật\s*khẩu\s*server)$/i.test(
					k,
				)
			) {
				const p = cleanPassword(val);
				config.da_pass = p;
				if (!config.ftp_pass) config.ftp_pass = p;
			} else if (/^(password|pass|mật\s*khẩu)$/i.test(k)) {
				const p = cleanPassword(val);
				if (!config.ftp_pass || section === "FTP") {
					config.ftp_pass = p;
				}
			}
		});

		if (!config.web_domain && panelDomainCandidate) {
			config.web_domain = panelDomainCandidate;
		}

		// Fallback thông minh
		if (!config.web_domain) {
			const m = text.match(
				/(?:domain|tên\s*miền)\s*[:\t]?\s*(?:https?:\/\/)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
			);
			if (m) config.web_domain = cleanWebDomain(m[1]);
		}
		if (!config.ftp_host) {
			const ip = extractIp(text);
			if (ip) {
				config.ftp_host = ip;
			} else {
				const m = text.match(
					/(?:host\s*name|host|ftp\s*host|server\s*ip|ip)\s*[:\t]?\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
				);
				if (m) config.ftp_host = cleanHost(m[1], true);
			}
		}

		// Đổ dữ liệu vào tất cả các form tương ứng
		const setVal = (field, val) => {
			if (!val) return;
			const el1 = document.getElementById(prefix + field);
			if (el1) el1.value = val;
			const el2 = document.getElementById("d_" + field);
			if (el2) el2.value = val;
			const el3 = document.getElementById(field);
			if (el3) el3.value = val;
		};

		setVal("web_domain", config.web_domain);
		setVal("ftp_host", config.ftp_host);
		setVal("ftp_user", config.ftp_user);
		setVal("da_user", config.da_user);
		setVal("ftp_pass", config.ftp_pass);
		if (config.da_port) setVal("da_port", config.da_port);

		textarea.value = "";
		if (mode === "detail") this.hideModal("quick-paste-modal");
		this.notify("Đã phân tích xong dữ liệu cấu hình!", "success");
	},

	togglePassword(targetId, btn) {
		const input = document.getElementById(targetId);
		const isPassword = input.type === "password";
		input.type = isPassword ? "text" : "password";

		// Thay đổi icon
		if (isPassword) {
			btn.innerHTML =
				'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
		} else {
			btn.innerHTML =
				'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
		}
	},

	showToast(message, type = "info") {
		let container = document.getElementById("toast-container");
		if (!container) {
			container = document.createElement("div");
			container.id = "toast-container";
			container.style.cssText =
				"position:fixed; bottom:24px; right:24px; z-index:1000000; display:flex; flex-direction:column; gap:10px; pointer-events:none;";
			document.body.appendChild(container);
		}

		const toast = document.createElement("div");
		let bg = "linear-gradient(135deg, #4F9DFF, #7C6FF5)";
		if (type === "success")
			bg = "linear-gradient(135deg, #3FD8A0, #37D9B8)";
		if (type === "error") bg = "linear-gradient(135deg, #FF5E8F, #FF7E5F)";
		if (type === "warning")
			bg = "linear-gradient(135deg, #FFB74D, #FF7E5F)";

		toast.style.cssText = `background:${bg}; color:#fff; padding:12px 18px; border-radius:12px; font-weight:600; font-size:13px; box-shadow:0 8px 24px rgba(0,0,0,0.35); pointer-events:auto; transition:all 0.3s ease; transform:translateY(10px); opacity:0;`;
		toast.innerText = message;
		container.appendChild(toast);

		requestAnimationFrame(() => {
			toast.style.transform = "translateY(0)";
			toast.style.opacity = "1";
		});

		setTimeout(() => {
			toast.style.transform = "translateY(-10px)";
			toast.style.opacity = "0";
			setTimeout(() => toast.remove(), 300);
		}, 3500);
	},

	notify(message, type = "info") {
		this.showToast(message, type);
	},

	switchProjectTab(btn, tabId) {
		// Toggle Active state on both sidebar items and top buttons
		document
			.querySelectorAll(".project-side-tab, .project-tab-btn")
			.forEach((b) => b.classList.remove("active"));

		if (btn) btn.classList.add("active");
		const matchingSide = document.querySelector(
			`.project-side-tab[data-tab="${tabId}"]`,
		);
		if (matchingSide) matchingSide.classList.add("active");
		const matchingTop = document.querySelector(
			`.project-tab-btn[data-tab="${tabId}"]`,
		);
		if (matchingTop) matchingTop.classList.add("active");

		// Toggle Content in Project Detail
		const layout = document.getElementById("view-project-detail");
		if (layout) {
			layout
				.querySelectorAll(".project-tab-content")
				.forEach((t) => t.classList.add("d-none"));
		}
		const targetContent = document.getElementById(tabId);
		if (targetContent) targetContent.classList.remove("d-none");

		// Update breadcrumb title
		const tabTitles = {
			"d_tab-config": "Cấu hình & Deploy",
			"d_tab-schema": "Visual Schema",
			"d_tab-fonts": "Quản lý Fonts",
			"d_tab-webp": "Convert Ảnh WebP",
			"d_tab-trim": "Trim Ảnh",
			"d_tab-auto-media": "Tự động Map Ảnh",
			"d_tab-seed": "Tạo Dữ Liệu Mẫu",
			"d_tab-filemanager": "Quản lý File (Host)",
			"d_tab-synccenter": "Sync Center",
			"d_tab-backups": "Lịch sử Backup",
		};
		const pathEl = document.getElementById("detail-project-path");
		if (pathEl && tabTitles[tabId]) {
			pathEl.innerText = `${App.currentCategory || "Dự án"} / ${tabTitles[tabId]}`;
		}

		// Hook for specific tabs
		if (tabId === "d_tab-schema") {
			const projectName =
				document.getElementById("d_current-project")?.value ||
				document.getElementById("detail-project-name")?.innerText ||
				"";
			if (typeof SchemaBuilder !== "undefined")
				SchemaBuilder.init(projectName);
		} else if (tabId === "d_tab-fonts") {
			FontManager.loadCssPreview();
		} else if (tabId === "d_tab-webp") {
			WebpManager.loadImages();
		} else if (tabId === "d_tab-trim") {
			ImageTrimManager.init();
		} else if (tabId === "d_tab-auto-media") {
			const projectName =
				document.getElementById("d_current-project")?.value ||
				document.getElementById("detail-project-name")?.innerText?.trim() ||
				"";
			AutoMediaManager.init(projectName);
		} else if (tabId === "d_tab-seed") {
			const projectName =
				document.getElementById("d_current-project")?.value ||
				document.getElementById("detail-project-name")?.innerText?.trim() ||
				(typeof App !== "undefined" && App.currentProject ? App.currentProject : "") ||
				"";
			SeedManager.init(projectName);
		} else if (tabId === "d_tab-synccenter") {
			if (typeof SyncCenter !== "undefined") SyncCenter.init();
		} else if (tabId === "d_tab-backups") {
			if (typeof SyncCenter !== "undefined")
				SyncCenter.openBackupHistoryTab();
		}
	},

	// ===== THEME MANAGEMENT =====
	themeLabels: {
		mint: "Xanh Mint",
		emerald: "Lục Bảo",
		cyan: "Băng Tuyết",
		ocean: "Xanh Biển",
		indigo: "Chàm Indigo",
		purple: "Tím Neon",
		rose: "Hồng Ruby",
		orange: "Cam Cyber",
		amber: "Hoàng Kim",
		red: "Đỏ Crimson",
	},

	initTheme() {
		let currentTheme = localStorage.getItem("rbw_pro_accent") || "indigo";
		if (!this.themeLabels[currentTheme]) currentTheme = "indigo";
		this.applyThemeUI(currentTheme);

		let parentMode = "dark";
		try {
			if (window.parent && window.parent !== window && window.parent.document) {
				parentMode = window.parent.document.documentElement.getAttribute("data-theme") || localStorage.getItem("rbw_theme") || "dark";
			} else {
				parentMode = localStorage.getItem("rbw_theme") || "dark";
			}
		} catch (_) {
			parentMode = localStorage.getItem("rbw_theme") || "dark";
		}
		if (parentMode !== "light" && parentMode !== "dark") parentMode = "dark";
		document.documentElement.setAttribute("data-mode", parentMode);

		window.addEventListener("message", (e) => {
			if (e.data && e.data.type === "rbw-theme-sync" && e.data.mode) {
				document.documentElement.setAttribute("data-mode", e.data.mode);
			}
		});

		window.addEventListener("storage", (e) => {
			if (e.key === "rbw_theme" && (e.newValue === "light" || e.newValue === "dark")) {
				document.documentElement.setAttribute("data-mode", e.newValue);
			}
		});

		// Global click listener to close theme dropdown when clicking outside
		document.addEventListener("click", (e) => {
			const wrapper = document.querySelector(".theme-dropdown-wrapper");
			const dropdown = document.getElementById("theme-menu-dropdown");
			if (wrapper && dropdown && !wrapper.contains(e.target)) {
				dropdown.classList.remove("show");
			}
		});
	},

	toggleThemeMenu(e) {
		if (e) e.stopPropagation();
		const dropdown = document.getElementById("theme-menu-dropdown");
		if (dropdown) {
			dropdown.classList.toggle("show");
		}
	},

	setTheme(themeName) {
		if (!this.themeLabels[themeName]) themeName = "indigo";
		localStorage.setItem("rbw_pro_accent", themeName);
		document.documentElement.setAttribute("data-theme", themeName);
		this.applyThemeUI(themeName);

		const dropdown = document.getElementById("theme-menu-dropdown");
		if (dropdown) dropdown.classList.remove("show");

		this.showToast(
			`Đã chuyển sang tông màu ${this.themeLabels[themeName]}`,
			"success",
		);
	},

	applyThemeUI(themeName) {
		document.documentElement.setAttribute("data-theme", themeName);

		const labelEl = document.getElementById("theme-current-label");
		if (labelEl && this.themeLabels[themeName]) {
			labelEl.textContent = this.themeLabels[themeName];
		}

		const selectorEl = document.getElementById("g_theme_selector");
		if (selectorEl) {
			selectorEl.value = themeName;
		}

		// Update active check in menu
		const items = document.querySelectorAll(".theme-menu-item");
		items.forEach((item) => {
			const val = item.getAttribute("data-theme-val");
			if (val === themeName) {
				item.classList.add("active");
			} else {
				item.classList.remove("active");
			}
		});
	},
};

// Initialize theme on load
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => UI.initTheme());
} else {
	UI.initTheme();
}
