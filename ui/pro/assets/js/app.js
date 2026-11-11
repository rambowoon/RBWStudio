const App = {
	projects: [],
	currentCategory: null,
	globalData: null,
	projectSortType: localStorage.getItem("rbw_project_sort") || "date_desc",
	projectSearchQuery: "",
	projectViewMode: localStorage.getItem("rbw_project_view") || "card",

	async init() {
		this.bindEvents();

		// Init Sort custom dropdown label
		this._applySortLabel(this.projectSortType);

		// Close sort dropdown on outside click
		document.addEventListener("click", (e) => {
			const wrap = document.getElementById("sort-dropdown-wrap");
			if (wrap && !wrap.contains(e.target)) this._closeSortDropdown();
		});

		// Init view mode buttons
		this._applyViewModeUI(this.projectViewMode);

		// Load global config
		try {
			const gRes = await fetch("api.php?action=getGlobalConfig");
			const gData = await gRes.json();
			if (gData.status === "success") {
				this.globalData =
					Array.isArray(gData.data) && gData.data.length === 0
						? {}
						: gData.data;
			}
		} catch (e) {
			console.error("Error loading global config:", e);
		}

		// 1. Tải danh mục vào sidebar (mặc định ban đầu lọc theo tháng)
		const data = await Api.getCategories(true);
		if (data.status === "success" && data.data.length > 0) {
			// Mặc định chọn tháng mới nhất
			this.currentCategory = data.data[0];
			UI.renderCategories(data.data, data.stats || {});

			// 2. Mở thẳng dự án của tháng mới nhất
			await this.loadProjects(this.currentCategory);
		} else {
			// Nếu không có tháng nào, mặc định về dashboard (hiển thị tất cả)
			await this.loadProjects("");
		}

		this.showDashboard();

		// Kiểm tra tham số auto_deploy trên URL (khi mở tab mới từ Nasani)
		const urlParams = new URLSearchParams(window.location.search);
		const autoDeployName = urlParams.get("auto_deploy");
		if (autoDeployName) {
			try {
				const cleanUrl = window.location.origin + window.location.pathname;
				window.history.replaceState({}, document.title, cleanUrl);
			} catch (e) {}
			setTimeout(() => {
				this.showDeployProjectModal(autoDeployName);
			}, 300);
		}

		// Lắng nghe lệnh trực tiếp từ Extension Content Script (khi tab RBWManager đã mở sẵn)
		window.addEventListener("message", (e) => {
			if (e.data && e.data.type === "RBW_TRIGGER_DEPLOY_MODAL") {
				const pName = e.data.projectName || "";
				this.showDeployProjectModal(pName);
			}
		});
	},

	async showCategories() {
		this.setActiveNav(1); // Active mục "Dự án theo tháng"
		const data = await Api.getCategories(true);
		if (data.status === "success" && data.data.length > 0) {
			UI.renderCategories(data.data, data.stats || {});
			// Auto select first month when entering projects by month view
			if (
				!this.currentCategory ||
				!data.data.includes(this.currentCategory)
			) {
				this.currentCategory = data.data[0];
			}
			await this.loadProjects(this.currentCategory);
		}
	},

	setActiveNav(index) {
		const items = document.querySelectorAll(
			"#sidebar-nav-global .nav-item",
		);
		items.forEach((item, i) => {
			if (i === index) item.classList.add("active");
			else item.classList.remove("active");
		});
	},

	getActiveNav() {
		const items = document.querySelectorAll(
			"#sidebar-nav-global .nav-item",
		);
		for (let i = 0; i < items.length; i++) {
			if (items[i].classList.contains("active")) {
				return i;
			}
		}
		return -1;
	},

	hideAllViews() {
		const views = [
			"view-dashboard",
			"view-converter",
			"view-project-detail",
			"view-ai-checker",
			"view-cache-clearer",
			"view-global-config",
			"view-demo-servers",
		];
		views.forEach((id) => {
			const el = document.getElementById(id);
			if (el) el.style.display = "none";
		});
		const projHeader = document.getElementById("project-detail-header");
		if (projHeader) projHeader.style.display = "none";
		const statusEl = document.getElementById("detail-project-status");
		if (statusEl) statusEl.style.display = "none";
		const phpHeaderEl = document.getElementById("detail-project-php");
		if (phpHeaderEl) phpHeaderEl.style.display = "none";
		const sizeHeaderEl = document.getElementById("detail-project-size");
		if (sizeHeaderEl) sizeHeaderEl.style.display = "none";
		const navHeader = document.getElementById("nav-header");
		if (navHeader) navHeader.style.display = "none";
		const dashBreadcrumb = document.getElementById("dashboard-breadcrumb");
		if (dashBreadcrumb) dashBreadcrumb.style.display = "none";

		// Mặc định hiện PHP hệ thống và ẩn nút check deploy của category
		const sysPhpBadge = document.getElementById("system-php-header-badge");
		if (sysPhpBadge) sysPhpBadge.style.display = "inline-flex";
		const btnCheckDeploy = document.getElementById(
			"btn-check-deploy-status",
		);
		if (btnCheckDeploy) btnCheckDeploy.style.display = "none";

		// Reset left sidebar to global navigation
		const sideGlobal = document.getElementById("sidebar-nav-global");
		const sideProject = document.getElementById("sidebar-nav-project");
		if (sideGlobal) sideGlobal.style.display = "block";
		if (sideProject) sideProject.style.display = "none";
	},

	showDashboard() {
		this.hideAllViews();
		this.setActiveNav(this.currentCategory ? 1 : 0);
		document.getElementById("view-dashboard").style.display = "block";
		if (this.currentCategory) {
			const navHeader = document.getElementById("nav-header");
			if (navHeader) navHeader.style.display = "flex";
		} else {
			const dashBreadcrumb = document.getElementById(
				"dashboard-breadcrumb",
			);
			if (dashBreadcrumb) dashBreadcrumb.style.display = "block";
		}
		// Nút kiểm tra trạng thái Deploy chỉ hiển thị khi ở Dashboard / Danh sách theo tháng
		const btnCheckDeploy = document.getElementById(
			"btn-check-deploy-status",
		);
		if (btnCheckDeploy) btnCheckDeploy.style.display = "inline-flex";
		const sysPhpBadge = document.getElementById("system-php-header-badge");
		if (sysPhpBadge) sysPhpBadge.style.display = "inline-flex";
	},

	async showProjectDetail(name, category) {
		const projItem =
			(this.projects && this.projects.find((p) => p.name === name)) ||
			null;
		const effectiveCat =
			category !== undefined && category !== null && category !== ""
				? category
				: (projItem && projItem.category) || this.currentCategory || "";

		this.currentCategory = effectiveCat;
		this.currentProjectName = name;
		this.currentProject = name;

		const curInput = document.getElementById("d_current-project");
		if (curInput) curInput.value = name;

		this.hideAllViews();
		document.getElementById("view-project-detail").style.display = "block";

		// Switch left sidebar to project navigation
		const sideGlobal = document.getElementById("sidebar-nav-global");
		const sideProject = document.getElementById("sidebar-nav-project");
		if (sideGlobal) sideGlobal.style.display = "none";
		if (sideProject) sideProject.style.display = "block";

		const projHeader = document.getElementById("project-detail-header");
		if (projHeader) projHeader.style.display = "flex";

		// Tinh gọn header trong chi tiết dự án:
		// 1. Ẩn nút Check Demo / Prod (vì đây là thao tác quét cả danh mục)
		const btnCheckDeploy = document.getElementById(
			"btn-check-deploy-status",
		);
		if (btnCheckDeploy) btnCheckDeploy.style.display = "none";

		// 2. Ẩn PHP hệ thống (tránh hiện trùng lặp 2 badge PHP bên cạnh nhau)
		const sysPhpBadge = document.getElementById("system-php-header-badge");
		if (sysPhpBadge) sysPhpBadge.style.display = "none";

		const nameEl = document.getElementById("detail-project-name");
		if (nameEl) {
			nameEl.innerText = name;
			nameEl.title = name;
		}
		const pathEl = document.getElementById("detail-project-path");
		if (pathEl)
			pathEl.innerText = `${effectiveCat || "Dự án"} / Cấu hình & Deploy`;

		if (typeof UI !== "undefined" && UI.resetProjectSubTabs) {
			UI.resetProjectSubTabs(name);
		}

		const applyDetailConfigToUI = (rawCfg, historyOverride) => {
			const config = Object.assign(
				{},
				projItem
					? {
							php_version: projItem.php_version,
							php_display: projItem.php_display,
							is_custom_php: !!(
								projItem.php_is_custom || projItem.is_custom_php
							),
							size_formatted: projItem.size_formatted,
							is_config_php: projItem.is_config_php,
							has_config_php: projItem.has_config_php,
							nasani_info: projItem.nasani_info,
						}
					: {},
				rawCfg || {},
			);
			if (Array.isArray(historyOverride) && !config.history) {
				config.history = historyOverride;
			}
			this.currentProjectConfig = config;
			if (projItem) {
				projItem.config = config;
			}

			const hasDemo = !!(config.deployed && config.deployed.demo);
			const hasProd = !!(config.deployed && config.deployed.production);
			const statusEl = document.getElementById("detail-project-status");
			if (statusEl) {
				statusEl.style.display = "inline-flex";
				if (hasProd) {
					statusEl.innerText = "● PRODUCTION";
					statusEl.className = "badge-env badge-env-prod";
					statusEl.style.background = "";
					statusEl.style.color = "";
					statusEl.title = "Trạng thái: Production đang chạy";
				} else if (hasDemo) {
					statusEl.innerText = "● DEMO";
					statusEl.className = "badge-env badge-env-demo";
					statusEl.style.background = "";
					statusEl.style.color = "";
					statusEl.title = "Trạng thái: Demo đang chạy";
				} else {
					statusEl.innerText = "○ CHƯA DEPLOY";
					statusEl.className = "badge-env";
					statusEl.style.background = "var(--surface-2)";
					statusEl.style.color = "var(--text-muted)";
					statusEl.title = "Trạng thái: Chưa deploy";
				}
			}

			// Hiển thị phiên bản PHP của dự án trên Header
			const phpHeaderEl = document.getElementById("detail-project-php");
			if (phpHeaderEl) {
				const isCustom = !!config.is_custom_php;
				const pDisplay =
					config.php_display ||
					(config.php_version
						? config.php_version.replace(/^php-?/i, "PHP ")
						: "PHP");
				const pTitle = isCustom
					? `Phiên bản PHP riêng: ${config.php_version} (Cấu hình riêng trong sites.json)`
					: `Phiên bản PHP mặc định hệ thống: ${config.php_version || "Hệ thống"}`;

				const vNum = parseFloat(
					(config.php_version || "").replace(/[^0-9.]/g, ""),
				);
				let vClass = "php-v-default";
				if (!isNaN(vNum)) {
					if (vNum >= 8.4) vClass = "php-v84";
					else if (vNum >= 8.3 && vNum < 8.4) vClass = "php-v83";
					else if (vNum < 8.0) vClass = "php-v74";
					else vClass = "php-v8x";
				}

				phpHeaderEl.className = `badge-php ${vClass} ${isCustom ? "is-custom" : ""}`;
				phpHeaderEl.innerHTML = `${isCustom ? '<span class="badge-php-dot"></span>' : ""}${pDisplay}`;
				phpHeaderEl.title = pTitle;
				phpHeaderEl.style.display = "inline-flex";
			}

			// Hiển thị dung lượng dự án trên Header
			const sizeHeaderEl = document.getElementById("detail-project-size");
			if (sizeHeaderEl) {
				const sizeStr =
					config.size_formatted ||
					(projItem ? projItem.size_formatted : "");
				if (sizeStr) {
					sizeHeaderEl.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:-1px; margin-right:3px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>${sizeStr}`;
					sizeHeaderEl.title = `Dung lượng mã nguồn dự án: ${sizeStr}`;
					sizeHeaderEl.style.display = "inline-flex";
				} else {
					sizeHeaderEl.style.display = "none";
				}
			}

			UI.fillProjectDetailForm(name, config, effectiveCat);
		};

		// 1. Render ngay lập tức bằng dữ liệu dự án hiện có (không để lưu lại DOM của dự án trước)
		applyDetailConfigToUI(projItem && projItem.config ? projItem.config : {});

		const firstTabBtn =
			document.querySelector(
				'.project-master-tabs .project-tab-btn[data-tab="d_tab-config"]',
			) ||
			document.querySelector(".project-master-tabs .project-tab-btn") ||
			document.querySelector("#sidebar-nav-project .project-side-tab");
		UI.switchProjectTab(firstTabBtn, "d_tab-config");

		// 2. Đồng bộ dữ liệu mới nhất từ SQLite backend
		try {
			const data = await Api.getProjectConfig(name, effectiveCat);
			if (
				data &&
				data.status === "success" &&
				this.currentProjectName === name
			) {
				applyDetailConfigToUI(data.data || {}, data.history);
			}
		} catch (_) {}
	},

	showCacheClearer() {
		this.setActiveNav(3);
		this.hideAllViews();
		document.getElementById("view-cache-clearer").style.display = "block";
	},

	async showAIChecker() {
		this.setActiveNav(3);
		this.hideAllViews();
		document.getElementById("view-ai-checker").style.display = "block";

		// Reset data để reload mới
		AIChecker.data = { gemini: [], claude: [] };

		try {
			const res = await (
				await fetch("api.php?action=getGlobalConfig")
			).json();
			if (res.status === "success") {
				const config =
					Array.isArray(res.data) && res.data.length === 0
						? {}
						: res.data;
				this.globalData = config;
				document.getElementById("gemini-api-key").value =
					config.gemini_key || "";
				document.getElementById("claude-api-key").value =
					config.claude_key || "";

				// Mặc định mở tab Gemini
				await AIChecker.switchTab("gemini");
			}
		} catch (e) {}
	},

	async loadProjects(category) {
		this.currentCategory = category;

		// Xử lý Active Menu chính
		let currentActive = this.getActiveNav();
		if (category === "") {
			this.setActiveNav(0); // Bảng điều khiển
			currentActive = 0;
		} else {
			if (currentActive === -1) {
				currentActive = 1; // Mặc định khi tải trang ban đầu
			}
			this.setActiveNav(currentActive);
		}

		try {
			// Load categories and projects concurrently
			const strict = currentActive === 1;
			const [catData, data] = await Promise.all([
				Api.getCategories(strict),
				Api.getProjects(category),
			]);
			if (catData.status === "success") {
				UI.renderCategories(catData.data, catData.stats || {});
			}

			if (data.status === "success") {
				this.projects = data.data || [];
				this.currentCategoryTotalSize =
					data.category_total_size_formatted || null;
				UI.renderProjects(
					this.getProcessedProjects(),
					category,
					data.category_total_size_formatted,
				);
				this._applyViewModeUI(this.projectViewMode);
				this.updateStats(data.category_total_size_formatted);

				// Cập nhật live kích thước vào subtitle của sidebar item tương ứng
				if (category && data.category_total_size_formatted) {
					const catSub = document.querySelector(
						`.category-item[data-category="${category}"] .category-item-subtitle`,
					);
					if (
						catSub &&
						!catSub.innerText.includes(
							data.category_total_size_formatted,
						)
					) {
						const parts = catSub.innerText
							.split("•")
							.map((s) => s.trim());
						catSub.innerText = `${parts[0]} • ${data.category_total_size_formatted}`;
					}
				}

				if (category !== "") {
					document
						.querySelectorAll(".category-item")
						.forEach((item) => {
							if (item.dataset.category === category)
								item.classList.add("active");
							else item.classList.remove("active");
						});

					// Kiểm tra xem có dự án nào chưa có size không để tính ngầm
					const missingAny = this.projects.some(
						(p) => !p.size || p.size === null,
					);
					if (missingAny) {
						this.fetchSizesInBackground(category);
					}
				} else {
					// Xóa active ở cột tháng
					document
						.querySelectorAll(".category-item")
						.forEach((i) => i.classList.remove("active"));
				}
			}
		} catch (err) {
			await UI.alert("Lỗi tải danh sách dự án");
		}
	},

	async fetchSizesInBackground(category) {
		try {
			const res = await Api.calculateCategorySizes(category);
			if (res && res.status === "success") {
				// 1. Cập nhật dữ liệu trong mảng projects
				if (res.projects && Array.isArray(this.projects)) {
					this.projects.forEach((p) => {
						if (res.projects[p.name]) {
							p.size = res.projects[p.name].size;
							p.size_formatted =
								res.projects[p.name].size_formatted;
						}
					});
				}

				// 2. Cập nhật trực tiếp giao diện các thẻ đang mở mà không cần render lại toàn trang
				if (this.currentCategory === category) {
					if (res.projects) {
						Object.keys(res.projects).forEach((pName) => {
							const info = res.projects[pName];
							const card = document.querySelector(
								`.item-card[data-project="${pName}"]`,
							);
							if (card) {
								let sizeRow =
									card.querySelector(".item-card-size");
								if (sizeRow && info.size_formatted) {
									sizeRow.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><span>${info.size_formatted}</span>`;
									sizeRow.title = `Dung lượng dự án: ${info.size_formatted}`;
									sizeRow.style.display = "flex";
								}
							}
						});
					}

					this.updateStats(res.category_total_size_formatted);
				}

				// Cập nhật subtitle ở sidebar
				if (category && res.category_total_size_formatted) {
					const catSub = document.querySelector(
						`.category-item[data-category="${category}"] .category-item-subtitle`,
					);
					if (catSub) {
						const parts = catSub.innerText
							.split("•")
							.map((s) => s.trim());
						catSub.innerText = `${parts[0]} • ${res.category_total_size_formatted}`;
					}
				}
			}
		} catch (e) {}
	},

	getProcessedProjects() {
		let list = Array.isArray(this.projects) ? [...this.projects] : [];

		// 1. Filter by Search query
		if (this.projectSearchQuery) {
			const q = this.projectSearchQuery;
			list = list.filter((p) => {
				const name = (p.name || "").toLowerCase();
				const relPath = (p.relPath || "").toLowerCase();
				return name.includes(q) || relPath.includes(q);
			});
		}

		// 2. Sort by chosen sortType
		const sortType = this.projectSortType || "date_desc";
		list.sort((a, b) => {
			const mtimeA = Number(a.mtime || 0);
			const mtimeB = Number(b.mtime || 0);
			const nameA = (a.name || "").toLowerCase();
			const nameB = (b.name || "").toLowerCase();

			if (sortType === "date_desc") {
				if (mtimeB !== mtimeA) return mtimeB - mtimeA;
				return nameA.localeCompare(nameB);
			} else if (sortType === "date_asc") {
				if (mtimeA !== mtimeB) return mtimeA - mtimeB;
				return nameA.localeCompare(nameB);
			} else if (sortType === "size_desc") {
				const sA = Number(a.size || 0);
				const sB = Number(b.size || 0);
				if (sB !== sA) return sB - sA;
				return nameA.localeCompare(nameB);
			} else if (sortType === "size_asc") {
				const sA = Number(a.size || 0);
				const sB = Number(b.size || 0);
				if (sA !== sB) return sA - sB;
				return nameA.localeCompare(nameB);
			} else if (sortType === "name_asc") {
				return nameA.localeCompare(nameB);
			} else if (sortType === "name_desc") {
				return nameB.localeCompare(nameA);
			}
			return 0;
		});

		return list;
	},

	onProjectSortChange(sortType) {
		this.projectSortType = sortType;
		try {
			localStorage.setItem("rbw_project_sort", sortType);
		} catch (e) {}
		this._applySortLabel(sortType);
		this._closeSortDropdown();
		UI.renderProjects(this.getProcessedProjects(), this.currentCategory);
	},

	toggleSortDropdown(e) {
		e.stopPropagation();
		const menu = document.getElementById("sort-dropdown-menu");
		const btn = document.getElementById("sort-dropdown-btn");
		if (!menu) return;
		const isOpen = menu.classList.contains("open");
		if (isOpen) {
			this._closeSortDropdown();
		} else {
			menu.classList.add("open");
			if (btn) btn.classList.add("open");
		}
	},

	_closeSortDropdown() {
		const menu = document.getElementById("sort-dropdown-menu");
		const btn = document.getElementById("sort-dropdown-btn");
		if (menu) menu.classList.remove("open");
		if (btn) btn.classList.remove("open");
	},

	_applySortLabel(sortType) {
		const labels = {
			date_desc: "Mới nhất trước",
			date_asc: "Cũ nhất trước",
			size_desc: "Dung lượng: Lớn → Nhỏ",
			size_asc: "Dung lượng: Nhỏ → Lớn",
			name_asc: "Tên: A → Z",
			name_desc: "Tên: Z → A",
		};
		const labelEl = document.getElementById("sort-label-text");
		if (labelEl) labelEl.textContent = labels[sortType] || "Sắp xếp";
		document.querySelectorAll(".sort-opt").forEach((el) => {
			el.classList.toggle("active", el.dataset.val === sortType);
		});
	},

	onProjectSearch(query) {
		this.projectSearchQuery = (query || "").trim().toLowerCase();
		UI.renderProjects(this.getProcessedProjects(), this.currentCategory);
	},

	onViewModeChange(mode) {
		this.projectViewMode = mode;
		try {
			localStorage.setItem("rbw_project_view", mode);
		} catch (e) {}
		this._applyViewModeUI(mode);
		UI.renderProjects(this.getProcessedProjects(), this.currentCategory);
	},

	_applyViewModeUI(mode) {
		const btnCard = document.getElementById("view-btn-card");
		const btnList = document.getElementById("view-btn-list");
		if (btnCard) btnCard.classList.toggle("active", mode === "card");
		if (btnList) btnList.classList.toggle("active", mode === "list");
		const list = document.getElementById("project-list");
		if (list) list.classList.toggle("list-mode", mode === "list");
	},

	updateStats(categoryTotalSizeFormatted = null) {
		let total = this.projects.length;
		let configured = 0;
		let demo = 0;
		let totalBytes = 0;

		this.projects.forEach((p) => {
			const isConfigured =
				p.config &&
				(p.config.ftp_host ||
					(p.config.prod && p.config.prod.ftp_host));
			const isLockedDemo = !!(p.config && p.config.lock_demo);

			if (isConfigured) configured++;
			if (isLockedDemo) demo++;
			if (p.size) totalBytes += Number(p.size);
		});

		const elTotal = document.getElementById("stat-total-projects");
		const elConfigured = document.getElementById("stat-configured");
		const elDemo = document.getElementById("stat-demo");
		const elStorage = document.getElementById("stat-total-size");
		const elStorageLabel = document.getElementById("stat-storage-label");

		if (elTotal) elTotal.innerText = total;
		if (elConfigured) elConfigured.innerText = configured;
		if (elDemo) elDemo.innerText = demo;
		if (elStorage) {
			const displaySize =
				categoryTotalSizeFormatted || UI.formatBytes(totalBytes);
			elStorage.innerText =
				displaySize && displaySize !== "0 B" ? displaySize : "0 MB";
		}
		if (elStorageLabel) {
			elStorageLabel.innerText = this.currentCategory
				? "Dung lượng tháng"
				: "Tổng dung lượng";
		}
	},

	bindEvents() {
		const configForm = document.getElementById("config-form");
		configForm.addEventListener("submit", async (e) => {
			e.preventDefault();
			await this.saveConfig();
		});

		const globalForm = document.getElementById("global-config-form");
		globalForm.addEventListener("submit", async (e) => {
			e.preventDefault();
			await this.saveGlobalConfig();
		});
		const detailForm = document.getElementById("detail-config-form");
		if (detailForm) {
			detailForm.addEventListener("submit", async (e) => {
				e.preventDefault();
				await this.saveConfig(true);
			});
		}

		const packUploadCheck = document.getElementById(
			"pre_deploy_pack_upload",
		);
		if (packUploadCheck) {
			packUploadCheck.addEventListener("change", (e) => {
				const use7zipCheck = document.getElementById(
					"pre_deploy_use_7zip",
				);
				if (use7zipCheck) {
					use7zipCheck.disabled = !e.target.checked;
					if (!e.target.checked) use7zipCheck.checked = false;
					else use7zipCheck.checked = true;
				}
			});
		}
	},

	globalData: null,

	async showGlobalConfig() {
		this.setActiveNav(5);
		this.hideAllViews();
		document.getElementById("view-global-config").style.display = "block";

		try {
			const res = await (
				await fetch("api.php?action=getGlobalConfig")
			).json();
			if (res.status === "success") {
				const config = res.data;
				this.globalData = config;

				document.getElementById("g_cf_account_id").value =
					config.cf_account_id || "";
				document.getElementById("g_cf_api_token").value =
					config.cf_api_token || "";
				document.getElementById("g_cf_auth_email").value =
					config.cf_auth_email || "";
				document.getElementById("g_gemini_key").value =
					config.gemini_key || "";
				document.getElementById("g_claude_key").value =
					config.claude_key || "";
				document.getElementById("g_source_path").value =
					config.source_path || "";
				document.getElementById("g_source_db_name").value =
					config.source_db_name || "";
				document.getElementById("g_editor_path").value =
					config.editor_path || "";
				document.getElementById("g_font_source_path").value =
					config.font_source_path || "";
				document.getElementById("g_images_pool_path").value =
					config.images_pool_path || "";
				if (document.getElementById("g_month_folder_format")) {
					document.getElementById("g_month_folder_format").value =
						config.month_folder_format || "YYYY_MM";
				}
			}
		} catch (err) {
			await UI.alert("Lỗi tải cấu hình chung");
		}
	},

	async showDemoServers() {
		this.setActiveNav(4);
		this.hideAllViews();
		document.getElementById("view-demo-servers").style.display = "block";

		if (!this.globalData) {
			try {
				const res = await (
					await fetch("api.php?action=getGlobalConfig")
				).json();
				if (res.status === "success") {
					this.globalData =
						Array.isArray(res.data) && res.data.length === 0
							? {}
							: res.data;
				}
			} catch (err) {}
		}

		if (this.globalData) {
			if (!this.globalData.demo_list) {
				this.globalData.demo_list = [
					{
						id: "legacy",
						name: "Server Demo 1 (Mặc định)",
						ftp_host: this.globalData.ftp_host || "",
						web_domain: this.globalData.web_domain || "",
						da_port: this.globalData.da_port || "1111",
						ftp_user: this.globalData.ftp_user || "",
						ftp_pass: this.globalData.ftp_pass || "",
						ftp_root: this.globalData.ftp_root || "",
					},
				];
				this.globalData.default_demo_id = "legacy";
			}
			this.renderDemoServersGrid();
		}
	},

	renderDemoServersGrid() {
		const list = document.getElementById("demo-servers-list");
		list.innerHTML = "";

		this.globalData.demo_list.forEach((demo) => {
			const isDefault = demo.id === this.globalData.default_demo_id;
			const card = document.createElement("div");
			card.className = "card-padded";
			card.style.position = "relative";
			if (isDefault) card.style.border = "1px solid var(--primary)";

			card.innerHTML = `
				<div class="flex-between-center-mb20">
					<h3 class="card-title-sm">${isDefault ? "⭐ " : ""} <input type="text" style="background:transparent; border:none; border-bottom:1px solid #555; color:#fff; font-size:1rem; width:150px; outline:none;" value="${demo.name || ""}" onchange="App.updateDemoField('${demo.id}', 'name', this.value)" placeholder="Tên Server"></h3>
					<div class="flex-align-center-gap10">
						${!isDefault ? `<button class="btn btn-ghost" style="padding:4px 8px; font-size:0.75rem;" onclick="App.setDefaultDemoGrid('${demo.id}')">Làm mặc định</button>` : ""}
						<button class="btn btn-ghost" style="padding:4px 8px; font-size:0.75rem; color:var(--danger);" onclick="App.deleteDemoGrid('${demo.id}')">Xóa</button>
					</div>
				</div>
				<div style="margin-bottom:15px;">
					<button class="btn btn-ghost" style="width: 100%; border: 1px dashed var(--border); color: var(--primary);" onclick="App.showDemoQuickPaste('${demo.id}')">⚡ Dán nhanh cấu hình</button>
				</div>
				<div class="form-group" style="margin-bottom:10px;">
					<label style="font-size:0.7rem;">Host / IP</label>
					<input type="text" class="form-control" value="${demo.ftp_host || ""}" oninput="App.updateDemoField('${demo.id}', 'ftp_host', this.value)">
				</div>
				<div class="form-group" style="margin-bottom:10px;">
					<label style="font-size:0.7rem;">Tên miền (Mặc định)</label>
					<input type="text" class="form-control" value="${demo.web_domain || ""}" oninput="App.updateDemoField('${demo.id}', 'web_domain', this.value)">
				</div>
				<div class="form-group" style="margin-bottom:10px;">
					<label style="font-size:0.7rem;">Username</label>
					<input type="text" class="form-control" value="${demo.ftp_user || ""}" oninput="App.updateDemoField('${demo.id}', 'ftp_user', this.value)">
				</div>
				<div class="form-group" style="margin-bottom:10px;">
					<label style="font-size:0.7rem;">Password</label>
					<input type="text" class="form-control" value="${demo.ftp_pass || ""}" oninput="App.updateDemoField('${demo.id}', 'ftp_pass', this.value)">
				</div>
				<div class="form-grid-2">
					<div class="form-group" style="margin-bottom:0;">
						<label style="font-size:0.7rem;">Port (DA)</label>
						<input type="text" class="form-control" value="${demo.da_port || "1111"}" oninput="App.updateDemoField('${demo.id}', 'da_port', this.value)">
					</div>
					<div class="form-group" style="margin-bottom:0;">
						<label style="font-size:0.7rem;">FTP Root</label>
						<input type="text" class="form-control" value="${demo.ftp_root || ""}" oninput="App.updateDemoField('${demo.id}', 'ftp_root', this.value)">
					</div>
				</div>
			`;
			list.appendChild(card);
		});

		const saveDiv = document.createElement("div");
		saveDiv.style.gridColumn = "1 / -1";
		saveDiv.style.textAlign = "right";
		saveDiv.innerHTML = `<button class="btn btn-primary btn-submit-large" onclick="App.saveDemoListConfig()">💾 Lưu Danh sách Demo</button>`;
		list.appendChild(saveDiv);
	},

	async saveDemoListConfig() {
		if (!this.globalData) return;
		const defaultDemo =
			this.globalData.demo_list.find(
				(d) => d.id === this.globalData.default_demo_id,
			) || this.globalData.demo_list[0];
		if (defaultDemo) {
			this.globalData.ftp_host = defaultDemo.ftp_host;
			this.globalData.web_domain = defaultDemo.web_domain;
			this.globalData.da_port = defaultDemo.da_port;
			this.globalData.ftp_user = defaultDemo.ftp_user;
			this.globalData.ftp_pass = defaultDemo.ftp_pass;
			this.globalData.ftp_root = defaultDemo.ftp_root;
		}
		const res = await (
			await fetch("api.php?action=saveGlobalConfig", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(this.globalData),
			})
		).json();
		if (res.status === "success") {
			UI.notify("Đã lưu danh sách Demo thành công!", "success");
		}
	},

	showDemoQuickPaste(demoId) {
		document.getElementById("demo_quick_paste_target_id").value = demoId;
		document.getElementById("demo_quick_paste_text").value = "";
		UI.showModal("demo-quick-paste-modal");
	},

	processDemoQuickPaste() {
		const demoId = document.getElementById(
			"demo_quick_paste_target_id",
		).value;
		const rawText = document
			.getElementById("demo_quick_paste_text")
			.value.trim();
		if (!rawText) {
			UI.hideModal("demo-quick-paste-modal");
			return;
		}

		const demo = this.globalData.demo_list.find((d) => d.id === demoId);
		if (!demo) return;

		let text = rawText
			.replace(/[\u200B-\u200D\uFEFF]/g, "")
			.replace(/\u00A0/g, " ")
			.replace(/\[([^\]]+)\]\((?:mailto:)?([^)]+)\)/g, "$1")
			.trim();

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

		const rawLines = text
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter((l) => l.length > 0);

		const pairs = [];
		let currentSection = "";
		let explicitWebDomain = false;
		let panelDomainCandidate = "";

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

		for (let i = 0; i < rawLines.length; i++) {
			const line = rawLines[i];
			const cleanHeaderLine = normalizeKey(line.replace(/[=_\-\[\]]/g, ""));

			if (
				/^(thông tin tài khoản ftp|thông tin ftp|ftp account|ftp information|ftp)$/i.test(
					cleanHeaderLine,
				)
			) {
				currentSection = "FTP";
				continue;
			}
			if (/^tài khoản ftp$/i.test(cleanHeaderLine)) {
				currentSection = "FTP";
				const nextLine = rawLines[i + 1];
				if (!nextLine || isKeyLabel(nextLine)) {
					continue;
				}
			}
			if (/hosting\s+cho\s+tên\s+miền/i.test(line)) {
				currentSection = "DA";
				const afterTitle = line.split(/hosting\s+cho\s+tên\s+miền/i)[1] || line;
				const d = cleanWebDomain(afterTitle);
				if (d && !isPanelOnlyDomain(d)) {
					demo.web_domain = d;
					explicitWebDomain = true;
				}
				continue;
			}
			if (
				/^(hosting|thông tin hosting|thông tin quản trị)$/i.test(
					cleanHeaderLine,
				)
			) {
				currentSection = "DA";
				continue;
			}
			if (
				/^(control panel|directadmin|cpanel|link đăng nhập|link quản trị|link login|url đăng nhập)\b/i.test(
					cleanHeaderLine,
				)
			) {
				currentSection = "DA";
			}

			if (isKeyLabel(line)) {
				const nextLine = rawLines[i + 1];
				if (nextLine && !isKeyLabel(nextLine)) {
					pairs.push({
						key: normalizeKey(line),
						val: nextLine.trim(),
						section: currentSection,
					});
					i++;
				}
				continue;
			}

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
				}
			}
		}

		pairs.forEach(({ key, val, section }) => {
			const k = normalizeKey(key);

			if (/^(domain|tên\s*miền|web\s*domain|website)$/i.test(k)) {
				const d = cleanWebDomain(val);
				if (d && !isPanelOnlyDomain(d)) {
					demo.web_domain = d;
					explicitWebDomain = true;
				}
			} else if (
				/^(control\s*panel|cpanel|directadmin|hosting\s*url|link\s*quản\s*trị|link\s*đăng\s*nhập|link\s*login|url\s*đăng\s*nhập|link\s*hosting|link\s*server)$/i.test(
					k,
				)
			) {
				const portMatch = val.match(/:(\d{2,5})/);
				if (portMatch) demo.da_port = portMatch[1];
				const ip = extractIp(val);
				if (ip) {
					demo.ftp_host = ip;
				} else if (!demo.ftp_host) {
					demo.ftp_host = cleanHost(val, true);
				}
				const domains = extractDomains(val);
				for (const dom of domains) {
					const cleanDom = dom.replace(/^(?:ftp\.|www\.)/i, "");
					if (cleanDom && !isPanelOnlyDomain(cleanDom) && !panelDomainCandidate) {
						panelDomainCandidate = cleanDom;
					}
				}
			} else if (
				/^(host\s*name|hostname|host|ftp\s*host|ftp\s*server|ftp\s*ip|server\s*ip|ip\s*server|host\s*ip|ip\s*host|ip)$/i.test(
					k,
				)
			) {
				const ip = extractIp(val);
				if (ip) {
					demo.ftp_host = ip;
				} else if (
					!demo.ftp_host ||
					!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(demo.ftp_host)
				) {
					demo.ftp_host = cleanHost(val, true);
				}
				if (!demo.web_domain) {
					const domains = extractDomains(val);
					for (const dom of domains) {
						const cleanDom = dom.replace(/^(?:ftp\.|www\.)/i, "");
						if (cleanDom && !isPanelOnlyDomain(cleanDom)) {
							demo.web_domain = cleanDom;
							break;
						}
					}
				}
			} else if (
				/^(ftp\s*user|ftp\s*username|user\s*ftp|username\s*ftp|tài\s*khoản\s*ftp)$/i.test(
					k,
				)
			) {
				demo.ftp_user = val.trim();
				if (demo.ftp_user.includes("@") && !explicitWebDomain) {
					const ftpDom = cleanWebDomain(demo.ftp_user.split("@")[1]);
					if (ftpDom && !isPanelOnlyDomain(ftpDom)) {
						demo.web_domain = ftpDom;
					}
				}
			} else if (
				/^(panel\s*user|da\s*user|user\s*da|directadmin\s*user|cpanel\s*user|hosting\s*user|user\s*hosting|user\s*server|server\s*user)$/i.test(
					k,
				)
			) {
				if (!demo.ftp_user) demo.ftp_user = val.trim();
			} else if (
				/^(username|user\s*name|user|tài\s*khoản|tên\s*đăng\s*nhập)$/i.test(k)
			) {
				const v = val.trim();
				if (section === "FTP" || v.includes("@")) {
					demo.ftp_user = v;
					if (v.includes("@") && !explicitWebDomain) {
						const ftpDom = cleanWebDomain(v.split("@")[1]);
						if (ftpDom && !isPanelOnlyDomain(ftpDom)) {
							demo.web_domain = ftpDom;
						}
					}
				} else if (!demo.ftp_user) {
					demo.ftp_user = v;
				}
			} else if (
				/^(ftp\s*pass|ftp\s*password|pass\s*ftp|password\s*ftp|mật\s*khẩu\s*ftp|panel\s*pass|da\s*pass|pass\s*da|password\s*da|hosting\s*pass|pass\s*hosting|password\s*server|pass\s*server|server\s*pass|server\s*password|mật\s*khẩu\s*server|password|pass|mật\s*khẩu)$/i.test(
					k,
				)
			) {
				const p = cleanPassword(val);
				if (
					!demo.ftp_pass ||
					section === "FTP" ||
					/ftp/i.test(k)
				) {
					demo.ftp_pass = p;
				}
			}
		});

		if (!demo.web_domain && panelDomainCandidate) {
			demo.web_domain = panelDomainCandidate;
		}

		this.renderDemoServersGrid();
		UI.hideModal("demo-quick-paste-modal");
		UI.notify("Đã dán và trích xuất cấu hình tự động!", "success");
		this.saveDemoListConfig();
	},

	updateDemoField(id, field, value) {
		const demo = this.globalData.demo_list.find((d) => d.id === id);
		if (demo) demo[field] = value;
	},

	setDefaultDemoGrid(id) {
		this.globalData.default_demo_id = id;
		this.renderDemoServersGrid();
	},

	async deleteDemoGrid(id) {
		if (this.globalData.demo_list.length <= 1)
			return await UI.alert("Phải có ít nhất 1 Server Demo!");
		if (!(await UI.confirm("Xóa Server Demo này?"))) return;
		this.globalData.demo_list = this.globalData.demo_list.filter(
			(d) => d.id !== id,
		);
		if (this.globalData.default_demo_id === id)
			this.globalData.default_demo_id = this.globalData.demo_list[0].id;
		this.renderDemoServersGrid();
	},

	addDemoServer() {
		const newId = "demo_" + Date.now();
		this.globalData.demo_list.push({
			id: newId,
			name: "Server Demo Mới",
			ftp_host: "",
			web_domain: "",
			da_port: "1111",
			ftp_user: "",
			ftp_pass: "",
			ftp_root: "",
		});
		this.renderDemoServersGrid();
	},

	async saveGlobalConfig() {
		if (!this.globalData) return;

		this.globalData.cf_account_id =
			document.getElementById("g_cf_account_id").value;
		this.globalData.cf_api_token =
			document.getElementById("g_cf_api_token").value;
		this.globalData.cf_auth_email =
			document.getElementById("g_cf_auth_email").value;
		this.globalData.gemini_key =
			document.getElementById("g_gemini_key").value;
		this.globalData.claude_key =
			document.getElementById("g_claude_key").value;
		this.globalData.source_path =
			document.getElementById("g_source_path").value;
		this.globalData.source_folder_name =
			this.globalData.source_path
				.split(/[\\/]/)
				.filter(Boolean)
				.pop() || "";
		this.globalData.source_db_name =
			document.getElementById("g_source_db_name").value;
		this.globalData.editor_path =
			document.getElementById("g_editor_path").value;
		this.globalData.font_source_path =
			document.getElementById("g_font_source_path").value;
		this.globalData.images_pool_path =
			document.getElementById("g_images_pool_path").value;
		this.globalData.month_folder_format = document.getElementById(
			"g_month_folder_format",
		)
			? document.getElementById("g_month_folder_format").value
			: "YYYY_MM";

		const res = await (
			await fetch("api.php?action=saveGlobalConfig", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(this.globalData),
			})
		).json();

		if (res.status === "success") {
			UI.notify("Đã lưu cấu hình Setting thành công!", "success");
		}
	},

	async openConfig(name, category) {
		this.showProjectDetail(name, category);
	},

	async deleteConfig(name) {
		if (
			!(await UI.confirm(
				`Bạn có chắc muốn xóa cấu hình của dự án ${name}?`,
			))
		)
			return;
		try {
			const res = await (
				await fetch("api.php?action=deleteConfig", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name }),
				})
			).json();
			if (res.status === "success") {
				this.loadProjects(this.currentCategory);
			}
		} catch (err) {
			await UI.alert("Lỗi khi xóa cấu hình");
		}
	},

	async setupLocalSource(name, category, forceOverwriteDb = null) {
		UI.setupDeployModal({
			icon: "🗄️",
			title: "Cấu hình Source Local & Database",
			project: name,
			category: category || "",
			targetDesc: "Khởi tạo Database Local, import SQL & cấu hình .env",
			steps: [
				{ title: "1. Kết nối & kiểm tra MySQL/MariaDB", sub: "Kiểm tra dịch vụ DB & tên Database mục tiêu" },
				{ title: "2. Quét & import dữ liệu SQL", sub: "Tạo Database và nạp tệp .sql vào localhost" },
				{ title: "3. Cấu hình .env & config.php", sub: "Cập nhật SITE_PATH, DB_DATABASE và lưu SQLite" },
			],
		});
		UI.showModal("deploy-modal");

		UI.updateDeployStatus(
			"Đang xử lý...",
			40,
			"🔍 Đang kiểm tra MySQL, tạo Database & nạp tệp SQL...",
			2,
		);

		try {
			const res = await Api.setupLocalSource(
				name,
				category,
				forceOverwriteDb,
			);

			if (res.status === "db_exists_prompt") {
				UI.hideModal("deploy-modal");
				document.getElementById("local-db-confirm-message").innerHTML =
					`Database <b>${res.db_name}</b> đã tồn tại trên phpMyAdmin.<br>File SQL nguồn: <code style="color:var(--primary);">${res.sql_file}</code>.<br><br>Bạn có muốn <b>GHI ĐÈ</b> (xóa DB cũ & nạp lại) không?`;
				UI.showModal("local-db-confirm-modal");

				document.getElementById("btn-local-db-overwrite").onclick =
					async () => {
						UI.hideModal("local-db-confirm-modal");
						await this.setupLocalSource(name, category, true);
					};

				document.getElementById("btn-local-db-skip").onclick =
					async () => {
						UI.hideModal("local-db-confirm-modal");
						await this.setupLocalSource(name, category, false);
					};
				return;
			}

			if (res.status === "success") {
				UI.updateDeployStatus(
					"Thành công!",
					100,
					`<span style="color:#5FF0BE;font-weight:700;">${res.message || "✅ Cấu hình Source Local thành công!"}</span>`,
				);
				document.getElementById("deploy-footer").style.display = "flex";
				UI.showToast(
					res.message || "Cấu hình Source Local thành công!",
					"success",
				);
				await this.loadProjects(category);
				await this.showProjectDetail(name, category);
			} else {
				UI.updateDeployStatus(
					"Lỗi!",
					100,
					`<span style="color:#FF5E8F;font-weight:700;">❌ ${res.message || "Lỗi cấu hình Source Local!"}</span>`,
				);
				document.getElementById("deploy-footer").style.display = "flex";
				UI.showToast(
					res.message || "Lỗi cấu hình Source Local!",
					"error",
				);
			}
		} catch (e) {
			UI.updateDeployStatus(
				"Lỗi!",
				100,
				`<span style="color:#FF5E8F;font-weight:700;">❌ Lỗi kết nối: ${e.message}</span>`,
			);
			document.getElementById("deploy-footer").style.display = "flex";
			UI.showToast("Lỗi kết nối: " + e.message, "error");
		}
	},

	async refreshSystemCache() {
		UI.showToast(
			"↻ Đang quét và đồng bộ lại danh mục tháng & dự án...",
			"info",
		);
		try {
			await Api.reindexProjects();
			await this.loadProjects(this.currentCategory || "");
			if (
				document.getElementById("view-project-detail").style.display ===
				"block"
			) {
				const currentName = document.getElementById(
					"detail-project-name",
				)?.innerText;
				if (currentName)
					await this.showProjectDetail(
						currentName,
						this.currentCategory,
					);
			}
			UI.showToast(
				"✅ Đã cập nhật chỉ mục & danh mục tháng thành công!",
				"success",
			);
		} catch (e) {
			UI.showToast("Lỗi khi làm mới: " + e.message, "error");
		}
	},

	async saveConfig(isDetail = false) {
		const prefix = isDetail ? "d_" : "";
		const name = document.getElementById(prefix + "current-project").value;

		// Lấy cấu hình hiện tại để không ghi đè mất các thông tin khác (lock_demo, ssl, deployed...)
		const pIdx = this.projects.findIndex((p) => p.name === name);
		const existingConfig =
			this.currentProjectConfig ||
			(pIdx !== -1 && this.projects[pIdx].config
				? this.projects[pIdx].config
				: {});

		// Clone cấu hình cũ
		const config = JSON.parse(JSON.stringify(existingConfig));
		if (!config.prod) config.prod = {};

		// Cập nhật các trường từ form
		config.prod.ftp_host = document.getElementById(
			prefix + "ftp_host",
		).value;
		config.prod.web_domain = document.getElementById(
			prefix + "web_domain",
		).value;
		config.prod.ftp_user = document.getElementById(
			prefix + "ftp_user",
		).value;
		config.prod.da_user = document.getElementById(prefix + "da_user").value;
		config.prod.ftp_pass = document.getElementById(
			prefix + "ftp_pass",
		).value;
		config.prod.ftp_root = document.getElementById(
			prefix + "ftp_root",
		).value;

		const res = await (
			await fetch("api.php?action=saveConfig", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name,
					config,
					category: this.currentCategory,
				}),
			})
		).json();

		if (res.status === "success") {
			this.currentProjectConfig = config;
			if (pIdx !== -1) {
				this.projects[pIdx].config = config;
			}

			if (!isDetail) {
				UI.hideModal("config-modal");
				UI.notify("Đã lưu cấu hình dự án!", "success");
			} else {
				UI.hideModal("detail-config-modal");
				UI.notify("Đã lưu cấu hình dự án!", "success");
			}

			// Cập nhật lại toàn bộ giao diện chi tiết dự án & master actions ngay lập tức
			UI.fillProjectDetailForm(name, config, this.currentCategory);
			UI.fillConfigForm(name, config);

			// Cập nhật badge trạng thái dự án trên header
			const hasDemo = !!(config.deployed && config.deployed.demo);
			const hasProd = !!(config.deployed && config.deployed.production);
			const statusEl = document.getElementById("detail-project-status");
			if (statusEl) {
				statusEl.style.display = "inline-flex";
				if (hasProd) {
					statusEl.innerText = "● PRODUCTION";
					statusEl.className = "badge-env badge-env-prod";
					statusEl.title = "Trạng thái: Production đang chạy";
				} else if (hasDemo) {
					statusEl.innerText = "● DEMO";
					statusEl.className = "badge-env badge-env-demo";
					statusEl.title = "Trạng thái: Demo đang chạy";
				} else {
					statusEl.innerText = "○ CHƯA DEPLOY";
					statusEl.className = "badge-env";
					statusEl.style.background = "var(--surface-2)";
					statusEl.style.color = "var(--text-muted)";
					statusEl.title = "Trạng thái: Chưa deploy";
				}
			}

			await this.loadProjects(this.currentCategory);
		} else {
			UI.notify("Lưu thất bại: " + res.message, "error");
		}
	},

	async deployProject(name) {
		await this._deployFlow(name, "deploy", this.currentCategory);
	},

	_isDeploying: false,

	async handleDeployDemo(name, category, options) {
		if (this._isDeploying) return;
		this._isDeploying = true;

		UI.setupDeployModal({
			icon: "🔎",
			title: "Kiểm tra & Deploy Demo",
			project: name,
			category: category || "",
			targetDesc: "Xác minh Database & kết nối DirectAdmin trước khi Deploy",
			steps: [
				{ title: "1. Kiểm tra Database DirectAdmin", sub: "Xác minh Database & thông số kết nối Server Demo" },
				{ title: "2. Chuẩn bị đóng gói & tải lên", sub: "Kiểm tra dữ liệu hiện có trên Server Demo" },
			],
		});
		UI.showModal("deploy-modal");
		UI.updateDeployStatus(
			"Đang kiểm tra...",
			35,
			"Đang xác minh Database trên DirectAdmin...",
			1,
		);

		try {
			const checkRes = await (
				await fetch("api.php?action=preCheckDeployDemo", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name,
						category,
						manual_db_suffix: options.manual_db_suffix,
						demo_server_id: options.demo_server_id,
					}),
				})
			).json();

			if (checkRes.status === "error") {
				this._isDeploying = false;
				UI.updateDeployStatus(
					"Lỗi!",
					10,
					`❌ ${checkRes.message}`,
				);
				document.getElementById("deploy-footer").style.display = "flex";
				return;
			}

			const dbPass = checkRes.db_pass;
			const passwordUpdated = !!checkRes.password_updated;

			if (checkRes.action === "prompt_confirm") {
				this._isDeploying = false;
				UI.hideModal("deploy-modal");

				document.getElementById("db-confirm-message").innerText =
					`Database '${name}' đã tồn tại trên demo và đang chứa dữ liệu.`;
				UI.showModal("deploy-db-confirm-modal");

				document.getElementById("btn-db-overwrite").onclick =
					async () => {
						if (this._isDeploying) return;
						this._isDeploying = true;
						UI.hideModal("deploy-db-confirm-modal");
						try {
							await this._deployFlow(name, "deployDemo", category, {
								...options,
								create_db: false,
								clear_db: 1,
								db_pass: dbPass,
								password_updated: passwordUpdated,
							});
						} finally {
							this._isDeploying = false;
						}
					};

				document.getElementById("btn-db-skip").onclick = async () => {
					if (this._isDeploying) return;
					this._isDeploying = true;
					UI.hideModal("deploy-db-confirm-modal");
					try {
						await this._deployFlow(name, "deployDemo", category, {
							...options,
							export_upload: false,
							create_db: false,
							clear_db: 0,
							db_pass: dbPass,
							password_updated: passwordUpdated,
						});
					} finally {
						this._isDeploying = false;
					}
				};
			} else {
				try {
					await this._deployFlow(name, "deployDemo", category, {
						...options,
						clear_db: 0,
						db_pass: dbPass,
						password_updated: passwordUpdated,
					});
				} finally {
					this._isDeploying = false;
				}
			}
		} catch (err) {
			this._isDeploying = false;
			UI.updateDeployStatus(
				"Lỗi kết nối!",
				10,
				"❌ Không thể kết nối tới API kiểm tra.",
			);
			document.getElementById("deploy-footer").style.display = "flex";
		}
	},

	async deployDemo(name, category) {
		document.getElementById("pre-deploy-project-desc").innerText =
			`Dự án: ${name} (${category})`;
		document.getElementById("manual_db_suffix").value = "";
		if (document.getElementById("custom_demo_domain"))
			document.getElementById("custom_demo_domain").value = "";
		document.getElementById("pre_deploy_ssl").checked = false;
		document.getElementById("pre_deploy_pack_upload").checked = true;
		try {
			const res = await (
				await fetch("api.php?action=getGlobalConfig")
			).json();
			if (res.status === "success") {
				this.globalData =
					Array.isArray(res.data) && res.data.length === 0
						? {}
						: res.data;
			}
		} catch (e) {}

		if (document.getElementById("pre_deploy_use_7zip")) {
			document.getElementById("pre_deploy_use_7zip").checked = true;
		}
		document.getElementById("pre_deploy_export_upload").checked = true;
		document.getElementById("pre_deploy_create_db").checked = true;
		document.getElementById("pre_deploy_extract_setup").checked = true;

		// Populate demo server selector
		const demoSelect = document.getElementById("pre_deploy_demo_server_id");
		if (demoSelect) {
			demoSelect.innerHTML = "";
			const list = (this.globalData && Array.isArray(this.globalData.demo_list))
				? this.globalData.demo_list
				: [];
			if (list.length === 0) {
				const opt = document.createElement("option");
				opt.value = "";
				opt.innerText = "⚠️ Chưa cấu hình Server Demo (vào Cài đặt chung)";
				demoSelect.appendChild(opt);
			} else {
				const defaultId = this.globalData.default_demo_id || (list[0] && list[0].id) || "";
				list.forEach((demo) => {
					const option = document.createElement("option");
					option.value = demo.id;
					option.innerText =
						(demo.name || demo.web_domain || "Server Demo") +
						(demo.web_domain ? " (" + demo.web_domain + ")" : "") +
						(demo.id === defaultId ? " ⭐" : "");
					if (demo.id === defaultId) option.selected = true;
					demoSelect.appendChild(option);
				});
			}
		}

		UI.showModal("pre-deploy-modal");

		document.getElementById("confirm-deploy-btn").onclick = async () => {
			const manualSuffix =
				document.getElementById("manual_db_suffix").value;
			const demoServerId = document.getElementById(
				"pre_deploy_demo_server_id",
			)
				? document.getElementById("pre_deploy_demo_server_id").value
				: "";
			const useSSL = document.getElementById("pre_deploy_ssl").checked;
			const packUpload = document.getElementById(
				"pre_deploy_pack_upload",
			).checked;
			const use7zip = document.getElementById("pre_deploy_use_7zip")
				? document.getElementById("pre_deploy_use_7zip").checked
				: true;
			const exportUpload = document.getElementById(
				"pre_deploy_export_upload",
			).checked;
			const createDb = document.getElementById(
				"pre_deploy_create_db",
			).checked;
			const extractSetup = document.getElementById(
				"pre_deploy_extract_setup",
			).checked;

			UI.hideModal("pre-deploy-modal");
			await this.handleDeployDemo(name, category, {
				manual_db_suffix: manualSuffix,
				demo_server_id: demoServerId,
				custom_domain: "",
				use_ssl: useSSL,
				use_7zip: use7zip,
				pack_upload: packUpload,
				export_upload: exportUpload,
				create_db: createDb,
				extract_setup: extractSetup,
			});
		};
	},

	async deployDbDemo(name, category) {
		try {
			const res = await (
				await fetch("api.php?action=getGlobalConfig")
			).json();
			if (res.status === "success") {
				this.globalData =
					Array.isArray(res.data) && res.data.length === 0
						? {}
						: res.data;
			}
		} catch (e) {}

		document.getElementById("pre-deploy-project-desc").innerText =
			`Dự án: ${name} (${category}) - Chỉ Deploy Database`;
		document.getElementById("manual_db_suffix").value = "";
		document.getElementById("pre_deploy_ssl").checked = false;
		document.getElementById("pre_deploy_pack_upload").checked = false;
		if (document.getElementById("pre_deploy_use_7zip")) {
			document.getElementById("pre_deploy_use_7zip").checked = false;
		}
		document.getElementById("pre_deploy_export_upload").checked = true;
		document.getElementById("pre_deploy_create_db").checked = true;
		document.getElementById("pre_deploy_extract_setup").checked = true;

		// Populate demo server selector
		const demoSelect = document.getElementById("pre_deploy_demo_server_id");
		if (demoSelect) {
			demoSelect.innerHTML = "";
			const list = (this.globalData && Array.isArray(this.globalData.demo_list))
				? this.globalData.demo_list
				: [];
			if (list.length === 0) {
				const opt = document.createElement("option");
				opt.value = "";
				opt.innerText = "⚠️ Chưa cấu hình Server Demo (vào Cài đặt chung)";
				demoSelect.appendChild(opt);
			} else {
				const defaultId = this.globalData.default_demo_id || (list[0] && list[0].id) || "";
				list.forEach((demo) => {
					const option = document.createElement("option");
					option.value = demo.id;
					option.innerText =
						(demo.name || demo.web_domain || "Server Demo") +
						(demo.web_domain ? " (" + demo.web_domain + ")" : "") +
						(demo.id === defaultId ? " ⭐" : "");
					if (demo.id === defaultId) option.selected = true;
					demoSelect.appendChild(option);
				});
			}
		}

		UI.showModal("pre-deploy-modal");

		document.getElementById("confirm-deploy-btn").onclick = async () => {
			const manualSuffix =
				document.getElementById("manual_db_suffix").value;
			const demoServerId = document.getElementById(
				"pre_deploy_demo_server_id",
			)
				? document.getElementById("pre_deploy_demo_server_id").value
				: "";
			const useSSL = document.getElementById("pre_deploy_ssl").checked;
			const packUpload = document.getElementById(
				"pre_deploy_pack_upload",
			).checked;
			const use7zip = document.getElementById("pre_deploy_use_7zip")
				? document.getElementById("pre_deploy_use_7zip").checked
				: false;
			const exportUpload = document.getElementById(
				"pre_deploy_export_upload",
			).checked;
			const createDb = document.getElementById(
				"pre_deploy_create_db",
			).checked;
			const extractSetup = document.getElementById(
				"pre_deploy_extract_setup",
			).checked;

			UI.hideModal("pre-deploy-modal");
			await this.handleDeployDemo(name, category, {
				manual_db_suffix: manualSuffix,
				demo_server_id: demoServerId,
				custom_domain: "",
				use_ssl: useSSL,
				use_7zip: use7zip,
				pack_upload: packUpload,
				export_upload: exportUpload,
				create_db: createDb,
				extract_setup: extractSetup,
			});
		};
	},

	async pushTools(name, category) {
		await this._deployFlow(
			name,
			"pushTools",
			category,
			{},
			"Đang cập nhật Bridge (Tools)...",
		);
	},

	async integrateAMP(name, category) {
		const confirmed = await UI.confirm(
			`⚡ Tích hợp AMP NASANI vào dự án "${name}"\n\nThao tác này sẽ:\n• Copy views, assets, helpers AMP vào dự án\n• Cập nhật config/app.php, config/view.php\n• Inject AMP routes vào src/Routes/web.php\n• Merge AMP methods vào Func.php\n• Cập nhật ApiController.php\n• Thêm <link rel="amphtml"> vào head.blade.php\n\nBạn có chắc chắn muốn tiếp tục?`,
		);
		if (!confirmed) return;

		UI.setupDeployModal({
			icon: "⚡",
			title: "Tích hợp AMP NASANI",
			project: name,
			category: category || "",
			targetDesc: "Cài đặt views, routes, helpers và thẻ amphtml",
			steps: [
				{ title: "1. Copy giao diện & tài nguyên AMP", sub: "Sao chép views, assets, helpers AMP vào dự án" },
				{ title: "2. Cập nhật cấu hình & Routes", sub: "Cập nhật config/app.php, web.php, Func.php" },
				{ title: "3. Hoàn tất tích hợp AMP", sub: "Thêm thẻ amphtml & kiểm tra hoàn chỉnh" },
			],
		});
		UI.showModal("deploy-modal");
		UI.updateDeployStatus(
			"Đang tích hợp AMP...",
			35,
			"Đang chạy integrate script...",
			2,
		);

		try {
			const res = await (
				await fetch("api.php?action=integrateAMP", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name, category }),
				})
			).json();

			if (res.status === "success") {
				const logLines = (res.logs || [])
					.map((l) => `> ${l}`)
					.join("<br>");
				UI.updateDeployStatus(
					"Tích hợp AMP thành công!",
					100,
					logLines +
						'<br><br><span style="color:var(--success); font-weight:bold;">✅ ' +
						res.message +
						"</span>",
				);
				confetti({
					particleCount: 120,
					spread: 65,
					origin: { y: 0.6 },
				});
			} else {
				UI.updateDeployStatus(
					"Lỗi!",
					50,
					`<span style="color:var(--danger)">❌ ${res.message}</span>`,
				);
			}
		} catch (err) {
			UI.updateDeployStatus("Lỗi kết nối!", 0, "Không thể kết nối API.");
		}
		document.getElementById("deploy-footer").style.display = "flex";
		await this.loadProjects(this.currentCategory);
	},

	async clearProjectCache(name, category) {
		const project = this.projects.find((p) => p.name === name);
		const relPath = project ? project.relPath.replace(/\\/g, "/") : "";
		const localUrl = relPath
			? `http://localhost/${relPath}/`
			: `http://localhost/${name}/`;

		const confirmed = await UI.confirm(
			`🧹 Xác nhận XÓA CACHE cho dự án:\n"${name}"?\n\n` +
				`• Ép trình duyệt tải lại từ mạng (Bypass Cache, bỏ redirect 301)\n` +
				`• Tự động dọn dẹp các tệp tin cache & views của dự án\n\n` +
				`Bạn có chắc chắn muốn thực hiện?`,
		);
		if (!confirmed) return;

		UI.showLoading(`Đang xóa cache cho dự án "${name}"...`);

		try {
			// 1. Gửi request lên server xóa cache file dự án
			await fetch("api.php?action=clearProjectCache", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, category }),
			}).catch(() => null);

			// 2. Gửi request Bypass Cache trình duyệt cho Local URL (HTTP & HTTPS)
			let httpUrl = localUrl;
			let httpsUrl = localUrl.replace(/^http:/i, "https:");

			const fetchOptions = {
				method: "GET",
				headers: {
					"Cache-Control": "no-cache, no-store, must-revalidate",
					Pragma: "no-cache",
					Expires: "0",
				},
				cache: "reload",
				mode: "no-cors",
				credentials: "omit",
			};

			const p1 = fetch(httpUrl, fetchOptions).catch(() => null);
			const p2 = fetch(httpsUrl, fetchOptions).catch(() => null);
			// Gửi thêm POST request để phá vỡ triệt để redirect cache 301
			const p3 = fetch(httpUrl, {
				method: "POST",
				cache: "reload",
				mode: "no-cors",
				credentials: "omit",
			}).catch(() => null);

			await Promise.all([p1, p2, p3]);

			UI.hideLoading();
			UI.showToast(
				`✅ Đã xóa cache thành công cho dự án "${name}"! Hãy nhấn Ctrl + F5 để kiểm tra.`,
				"success",
			);
		} catch (err) {
			UI.hideLoading();
			UI.showToast("Lỗi khi xóa cache: " + (err.message || err), "error");
		}
	},

	async publishToProduction(name, category) {
		await this._deployFlow(
			name,
			"publishToProduction",
			category,
			{},
			"Cloud Transfer: Demo -> Production...",
		);
	},

	async downloadPackage(name, category) {
		await this._deployFlow(
			name,
			"downloadPackage",
			category,
			{},
			"Đang chuẩn bị đóng gói và tải mã nguồn từ Demo...",
		);
	},

	async installSSL(name, category) {
		document.getElementById("ssl-project-name").innerText = name;
		document.getElementById("ssl-log-output").innerHTML = "";
		document.getElementById("ssl-footer").style.display = "none";
		document.getElementById("ssl-confirm-footer").style.display = "flex";
		document.getElementById("ssl-status-icon").style.display = "none";
		const bar = document.getElementById("ssl-progress-bar");
		if (bar) bar.style.width = "0%";
		const setSslStep = (idx, state) => {
			const el = document.getElementById(`ssl-step-${idx}`);
			if (!el) return;
			const ic = el.querySelector(".shot-step-icon");
			if (state === "active") {
				el.style.opacity = "1";
				el.style.color = "#38bdf8";
				if (ic) ic.innerHTML = '<span class="spinner-small" style="width:13px;height:13px;border:2px solid rgba(255,255,255,0.2);border-top-color:#38bdf8;border-radius:50%;animation:spin 0.8s linear infinite;display:inline-block"></span>';
			} else if (state === "done") {
				el.style.opacity = "1";
				el.style.color = "#34d399";
				if (ic) ic.innerHTML = "✅";
			} else if (state === "error") {
				el.style.opacity = "1";
				el.style.color = "#f87171";
				if (ic) ic.innerHTML = "❌";
			} else {
				el.style.opacity = "0.55";
				el.style.color = "var(--muted)";
				if (ic) ic.innerHTML = "⚪";
			}
		};
		setSslStep(1, "waiting");
		setSslStep(2, "waiting");
		setSslStep(3, "waiting");
		document.getElementById("ssl-status-text").innerText =
			"Xác nhận cài đặt SSL Let's Encrypt cho tên miền dự án.";

		UI.showModal("ssl-modal");

		const startBtn = document.getElementById("ssl-start-btn");
		startBtn.onclick = async () => {
			document.getElementById("ssl-confirm-footer").style.display = "none";
			document.getElementById("ssl-status-icon").style.display = "inline-block";
			document.getElementById("ssl-status-text").innerText =
				"Đang gửi yêu cầu cài đặt (2048-bit)...";
			setSslStep(1, "done");
			setSslStep(2, "active");
			if (bar) bar.style.width = "50%";

			try {
				const res = await (
					await fetch(`api.php?action=installSSL`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ name, category }),
					})
				).json();

				const logOutput = document.getElementById("ssl-log-output");
				if (res.status === "success") {
					setSslStep(2, "done");
					setSslStep(3, "done");
					if (bar) bar.style.width = "100%";
					document.getElementById("ssl-status-text").innerText =
						"Cài đặt thành công!";
					logOutput.innerHTML = `<div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:10px 12px;color:#34d399;font-weight:600">🎉 ${res.message}</div>`;
					confetti({
						particleCount: 100,
						spread: 70,
						origin: { y: 0.6 },
					});
				} else {
					setSslStep(2, "error");
					document.getElementById("ssl-status-text").innerText =
						"Cài đặt thất bại";
					logOutput.innerHTML = `<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:10px 12px;color:#fca5a5;font-weight:600">⚠️ ${res.message}</div>`;
				}
				document.getElementById("ssl-status-icon").style.display = "none";
				document.getElementById("ssl-footer").style.display = "flex";
			} catch (err) {
				setSslStep(2, "error");
				document.getElementById("ssl-status-text").innerText = "Lỗi kết nối";
				document.getElementById("ssl-footer").style.display = "flex";
			}
		};
	},

	async toggleLock(name, btn) {
		try {
			const res = await (
				await fetch(`api.php?action=toggleLock`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name }),
				})
			).json();

			if (res.status === "success") {
				const isLocked = res.locked;
				if (isLocked) {
					btn.classList.add("btn-danger");
					btn.title = "Mở khóa website";
					btn.innerHTML =
						'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
				} else {
					btn.classList.remove("btn-danger");
					btn.title = "Khóa website";
					btn.innerHTML =
						'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
				}
			}
		} catch (err) {
			console.error("Lỗi toggle lock");
		}
	},

	async toggleActionLock(name, type, category) {
		try {
			const res = await (
				await fetch(`api.php?action=toggleActionLock`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name, type, category }),
				})
			).json();

			if (res.status === "success") {
				// Cập nhật dữ liệu local để UI thay đổi liền
				const configRes = await Api.getProjectConfig(name, category);
				if (configRes.status === "success") {
					// Cập nhật trong danh sách projects
					const pIdx = this.projects.findIndex(
						(p) => p.name === name,
					);
					if (pIdx !== -1)
						this.projects[pIdx].config = configRes.data;

					// Render lại các nút bấm ở trang chi tiết (nếu đang mở)
					UI.renderMasterActions(
						name,
						this.currentCategory,
						configRes.data,
						"d_",
					);

					// Render lại Dashboard để cập nhật màu nút Deploy ngoài kia
					UI.renderProjects(this.projects, this.currentCategory);
				}

				UI.notify(
					`Đã ${res.locked ? "Khóa" : "Mở khóa"} ${type === "demo" ? "Demo" : "Production"} thành công!`,
					"success",
				);
			}
		} catch (err) {
			UI.notify(
				"Lỗi khi thay đổi trạng thái khóa: " + err.message,
				"error",
			);
		}
	},

	async _deployFlow(
		name,
		action,
		category = null,
		extraData = {},
		customInitiator = "Khởi tạo quy trình...",
	) {
		const jobId = "job_" + Date.now();
		const presets = {
			deployNewProject: {
				icon: "🚀",
				title: "Đúc dự án mới",
				targetDesc: customInitiator || "Copy Source mẫu & khởi tạo Database tự động",
				steps: [
					{ title: "1. Sao chép mã nguồn mẫu", sub: "Copy Source gốc vào thư mục dự án" },
					{ title: "2. Tích hợp .agents & chuẩn bị SQL", sub: "Tìm tệp .sql hoặc trích xuất từ Database nguồn" },
					{ title: "3. Khởi tạo MySQL Database mới", sub: "Kiểm tra MariaDB/MySQL và tạo Database dự án" },
					{ title: "4. Import SQL & cấu hình môi trường", sub: "Nạp dữ liệu bảng, cập nhật .env / config.php" },
					{ title: "5. Hoàn tất & lưu hồ sơ dự án", sub: "Dọn tệp SQL tạm & ghi cấu hình vào SQLite" },
				],
			},
			deployDemo: {
				icon: "☁️",
				title: "Deploy lên Server Demo",
				targetDesc: customInitiator,
				steps: [
					{ title: "1. Đóng gói mã nguồn & xuất SQL", sub: "Chuẩn bị dữ liệu dự án Local" },
					{ title: "2. Kết nối DirectAdmin & FTP", sub: "Tạo Database và tải gói mã nguồn lên Server Demo" },
					{ title: "3. Giải nén, import DB & hoàn tất", sub: "Cấu hình môi trường trên Demo Server" },
				],
			},
			publishToProduction: {
				icon: "🌐",
				title: "Xuất bản lên Production",
				targetDesc: customInitiator,
				steps: [
					{ title: "1. Cấu hình bảo mật & Cloudflare", sub: "Khởi tạo key bảo mật và DNS/Turnstile" },
					{ title: "2. Khởi tạo DB & chuyển mã nguồn", sub: "Cloud Transfer từ Demo sang Production" },
					{ title: "3. Hoàn tất xuất bản", sub: "Đồng bộ cấu hình và lưu lịch sử" },
				],
			},
		};
		const preset = presets[action] || {
			icon: "⚙️",
			title: "Đang triển khai...",
			targetDesc: customInitiator,
			steps: null,
		};
		UI.setupDeployModal({
			...preset,
			project: name,
			category: category || "",
		});
		UI.showModal("deploy-modal");
		UI.updateDeployStatus("Đang chuẩn bị...", 10, customInitiator, 1);

		let progress = 15;
		let processedLogsCount = 0;
		let isFinished = false;
		let isPolling = false;
		let cleanedUp = false;

		const cleanUpJob = async () => {
			if (pollInterval) clearInterval(pollInterval);
			if (cleanedUp) return;
			cleanedUp = true;
			try {
				await fetch(`api.php?action=deleteLog&jobId=${jobId}`);
			} catch (e) {
				console.warn("Lỗi xóa log:", e);
			}
			document.getElementById("deploy-footer").style.display = "flex";

			// Làm mới danh sách dự án
			await this.loadProjects(this.currentCategory);

			// Nếu đang ở trang chi tiết dự án, làm mới để cập nhật nút mở website và thông tin triển khai
			if (
				document.getElementById("view-project-detail").style.display ===
				"block"
			) {
				await this.showProjectDetail(name, this.currentCategory);
			}
		};

		// Khởi động vòng lặp lấy log (Polling) với khóa chống chạy chồng
		const pollInterval = setInterval(async () => {
			if (isFinished || isPolling) return;
			isPolling = true;
			try {
				const res = await (
					await fetch(`api.php?action=getLogs&jobId=${jobId}`)
				).json();
				if (
					res.status === "success" &&
					Array.isArray(res.logs) &&
					res.logs.length > processedLogsCount
				) {
					const newLogs = res.logs.slice(processedLogsCount);
					processedLogsCount = res.logs.length;
					newLogs.forEach((item) => {
						if (item.status === "info") {
							if (typeof item.progress === "number") {
								progress = Math.max(progress, item.progress);
							} else {
								progress = Math.min(progress + 12, 95);
							}
							UI.updateDeployStatus(
								"Đang xử lý...",
								progress,
								`> ${item.log}`,
								item.step || null,
							);
						} else if (item.status === "success") {
							isFinished = true;
							UI.updateDeployStatus(
								"Thành công!",
								100,
								`${item.message || item.log}`,
								item.step || null,
							);
							if (item.logs)
								item.logs.forEach((l) =>
									UI.updateDeployStatus(
										"Thành công!",
										100,
										`> ${l}`,
									),
								);
							confetti({
								particleCount: 150,
								spread: 70,
								origin: { y: 0.6 },
							});

							if (item.url) {
								const fileName = item.url.split("/").pop();
								UI.updateDeployStatus(
									"Thành công!",
									100,
									`> 📦 Gói mã nguồn đã được lưu an toàn trong thư mục download của dự án.<br>` +
									`> 📥 Nếu cần tải thêm về máy: <a href="${item.url}" download="${fileName}" style="color:var(--primary); font-weight:600; text-decoration:underline;">Bấm vào đây để tải file</a>`,
								);
							}

							cleanUpJob();
						} else if (item.status === "error") {
							isFinished = true;
							UI.updateDeployStatus(
								"Lỗi!",
								progress,
								`${item.message || item.log || "Có lỗi xảy ra"}`,
								item.step || null,
							);
							cleanUpJob();
						}
					});
				}
			} catch (e) {
				console.error("Polling error:", e);
			} finally {
				isPolling = false;
			}
		}, 350);

		try {
			const response = await fetch(`api.php?action=${action}`, {
				method: "POST",
				body: JSON.stringify({ name, category, jobId, ...extraData }),
				headers: { "Content-Type": "application/json" },
			});

			let result = null;
			if (response.ok) {
				try {
					result = await response.json();
				} catch (e) {
					console.error("Lỗi parse JSON phản hồi:", e);
				}
			}

			const isBackgroundAction =
				action === "deploy" ||
				action === "deployDemo" ||
				action === "downloadPackage";

			if (!isBackgroundAction || (result && result.status === "error")) {
				setTimeout(async () => {
					if (isFinished) return;
					isFinished = true;

					await cleanUpJob();

					if (result && result.status === "error") {
						UI.updateDeployStatus(
							"Lỗi!",
							progress,
							`${result.message || "Thực thi thất bại"}`,
						);
					} else if (!response.ok) {
						UI.updateDeployStatus(
							"Lỗi hệ thống!",
							0,
							`API trả về HTTP code: ${response.status}`,
						);
					} else {
						UI.updateDeployStatus(
							"Thành công!",
							100,
							`${(result && result.message) || "Triển khai dự án thành công!"}`,
						);
						confetti({
							particleCount: 150,
							spread: 70,
							origin: { y: 0.6 },
						});
					}
				}, 400);
			}
		} catch (err) {
			const isBackgroundAction =
				action === "deploy" ||
				action === "deployDemo" ||
				action === "downloadPackage";
			if (!isBackgroundAction) {
				setTimeout(async () => {
					if (isFinished) return;
					isFinished = true;
					await cleanUpJob();
					UI.updateDeployStatus(
						"Lỗi kết nối!",
						0,
						"Kết nối API thất bại.",
					);
				}, 2000);
			} else {
				console.warn(
					"Fetch failed/timed out for background action, continuing polling...",
					err,
				);
				UI.updateDeployStatus(
					"Đang xử lý...",
					progress,
					"> ⚠️ Mất kết nối HTTP tạm thời với server. Đang tiếp tục theo dõi tiến trình chạy ngầm...",
				);
			}
		}
	},
	async cleanupTools(name, category, type = "demo") {
		if (
			!(await UI.confirm(
				`Bạn có chắc muốn xóa file Bridge (Tool) trên ${type === "demo" ? "Demo" : "Production"}?`,
			))
		)
			return;

		UI.showModal("deploy-modal");
		UI.updateDeployStatus(
			"Đang dọn dẹp...",
			50,
			`Gửi lệnh tự hủy tới Bridge (${type})...`,
		);

		try {
			const res = await (
				await fetch(`api.php?action=cleanupTools`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name, category, type }),
				})
			).json();

			if (res.status === "success") {
				UI.updateDeployStatus("Đã xóa Bridge!", 100, res.message);
				document.getElementById("deploy-footer").style.display = "flex";
			} else {
				UI.updateDeployStatus(
					"Lỗi dọn dẹp",
					50,
					`<span style="color:var(--error)">${res.message}</span>`,
				);
				document.getElementById("deploy-footer").style.display = "flex";
			}
		} catch (err) {
			console.error("Cleanup API error:", err);
			UI.updateDeployStatus(
				"Lỗi kết nối!",
				0,
				"Không thể kết nối API hoặc phản hồi từ server không hợp lệ.",
			);
			document.getElementById("deploy-footer").style.display = "flex";
		}
	},

	async executeChangeType() {
		const name = document.getElementById("ct-project-name").value;
		const category = document.getElementById("ct-project-category").value;
		const module = document.getElementById("ct-module").value;
		const oldType = document.getElementById("ct-old-type").value.trim();
		const newType = document.getElementById("ct-new-type").value.trim();

		if (!oldType || !newType) {
			UI.notify("Vui lòng nhập đầy đủ Type cũ và mới!", "error");
			return;
		}

		if (
			!(await UI.confirm(
				`Bạn có chắc muốn đổi tất cả Type từ "${oldType}" sang "${newType}" cho module ${module}?\n\nHành động này không thể hoàn tác!`,
			))
		) {
			return;
		}

		UI.hideModal("change-type-modal");
		UI.showModal("deploy-modal");
		UI.updateDeployStatus(
			"Đang thực thi...",
			30,
			"Đang kết nối Database Local...",
		);

		try {
			const res = await (
				await fetch(`api.php?action=changeDatabaseType`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name,
						category,
						module,
						old_type: oldType,
						new_type: newType,
					}),
				})
			).json();

			if (res.status === "success") {
				UI.updateDeployStatus(
					"Thành công!",
					100,
					`Đã cập nhật xong Type database cho dự án ${name}.<br>Chi tiết: ${res.message}`,
				);
				UI.notify("Cập nhật database thành công!", "success");
			} else {
				UI.updateDeployStatus(
					"Lỗi thực thi",
					50,
					`<span style="color:var(--danger)">${res.message}</span>`,
				);
				UI.notify("Lỗi: " + res.message, "error");
			}
			document.getElementById("deploy-footer").style.display = "flex";
		} catch (err) {
			UI.updateDeployStatus("Lỗi kết nối!", 0, "Không thể kết nối API.");
			document.getElementById("deploy-footer").style.display = "flex";
		}
	},

	showDeployProjectModal(prefilledName = "") {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const shortYear = String(year).slice(-2);

		const fmt =
			this.globalData && this.globalData.month_folder_format
				? this.globalData.month_folder_format
				: "YYYY_MM";
		let autoMonth = `${year}_${month}`;
		if (fmt === "YYYY/thangMM") autoMonth = `${year}/thang${month}`;
		else if (fmt === "thangMM") autoMonth = `thang${month}`;
		else if (fmt === "YYYY/YYtMM")
			autoMonth = `${year}/${shortYear}t${month}`;

		// Default to current month if not selected
		if (!this.currentCategory) {
			this.currentCategory = autoMonth;
		}

		const displayMonth = document.getElementById("dp-current-month");
		if (displayMonth) displayMonth.innerText = this.currentCategory;

		const projectNameInput = document.getElementById("dp-project-name");
		if (projectNameInput) {
			projectNameInput.value = prefilledName || "";
			if (prefilledName) {
				setTimeout(() => projectNameInput.focus(), 150);
			}
		}

		UI.showModal("deploy-project-modal");
	},

	async createCustomMonthFolder() {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const shortYear = String(year).slice(-2);
		const fmt =
			this.globalData && this.globalData.month_folder_format
				? this.globalData.month_folder_format
				: "YYYY_MM";

		let defaultFolder = `${year}_${month}`;
		if (fmt === "YYYY/thangMM") defaultFolder = `${year}/thang${month}`;
		else if (fmt === "thangMM") defaultFolder = `thang${month}`;
		else if (fmt === "YYYY/YYtMM")
			defaultFolder = `${year}/${shortYear}t${month}`;

		const monthFolder = prompt(
			"Nhập tên thư mục tháng cần tạo (Ví dụ: 2026_08, 2026_09, 2026/thang08):",
			defaultFolder,
		);
		if (!monthFolder) return;

		try {
			const res = await (
				await fetch("api.php?action=createMonthCategory", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ monthFolder: monthFolder.trim() }),
				})
			).json();

			if (res.status === "success") {
				UI.notify(res.message, "success");
				this.currentCategory = monthFolder.trim();
				await this.showCategories();
				await this.loadProjects(this.currentCategory);
			} else {
				UI.notify("Lỗi: " + res.message, "error");
			}
		} catch (e) {
			UI.notify("Lỗi tạo thư mục tháng: " + e.message, "error");
		}
	},

	async executeDeployProject() {
		const projectName = document
			.getElementById("dp-project-name")
			.value.trim();
		const sourceKey = document.getElementById("dp-source-key").value;
		const category = this.currentCategory;

		if (!projectName) {
			UI.notify("Vui lòng nhập tên dự án!", "error");
			return;
		}

		UI.hideModal("deploy-project-modal");

		await this._deployFlow(
			projectName,
			"deployNewProject",
			category,
			{ projectName, sourceKey },
			"Khởi tạo đúc dự án từ source gốc...",
		);
	},

	async showChangePhpVersionModal(name, category) {
		document.getElementById("cpp-project-name").value = name;
		document.getElementById("cpp-project-category").value = category;

		const selectEl = document.getElementById("cpp-php-index");
		selectEl.innerHTML =
			'<option value="">⏳ Đang tải phiên bản PHP từ host...</option>';
		selectEl.disabled = true;

		UI.showModal("change-php-modal");

		try {
			const res = await (
				await fetch("api.php?action=getAvailablePhpVersions", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name }),
				})
			).json();

			if (res.status === "success" && res.data && res.data.length > 0) {
				selectEl.innerHTML = "";
				res.data.forEach((item) => {
					const opt = document.createElement("option");
					opt.value = item.index;
					opt.innerText = `${item.version}${item.active ? " (Đang hoạt động)" : ""}`;
					if (item.active) {
						opt.selected = true;
					}
					selectEl.appendChild(opt);
				});
				selectEl.disabled = false;
			} else {
				selectEl.innerHTML = `<option value="">❌ Không thể lấy thông tin PHP: ${res.message || "Lỗi không xác định"}</option>`;
				UI.notify("Lỗi: " + (res.message || ""), "error");
			}
		} catch (err) {
			selectEl.innerHTML = '<option value="">❌ Lỗi kết nối API</option>';
			UI.notify("Lỗi kết nối API DirectAdmin!", "error");
		}
	},

	async executeChangePhpVersion() {
		const name = document.getElementById("cpp-project-name").value;
		const category = document.getElementById("cpp-project-category").value;
		const phpIndex = document.getElementById("cpp-php-index").value;

		UI.hideModal("change-php-modal");
		UI.showModal("deploy-modal");
		UI.updateDeployStatus(
			"Đang thực thi...",
			30,
			"Đang gửi yêu cầu thay đổi phiên bản PHP tới DirectAdmin...",
		);

		try {
			const res = await (
				await fetch(`api.php?action=changePhpVersion`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name,
						category,
						php_version_index: phpIndex,
					}),
				})
			).json();

			if (res.status === "success") {
				UI.updateDeployStatus(
					"Thành công!",
					100,
					`Đã thay đổi phiên bản PHP thành công cho dự án ${name}.<br>DirectAdmin phản hồi: <span style="color:#34d399">${res.message}</span>`,
				);
				UI.notify("Thay đổi phiên bản PHP thành công!", "success");

				// Cập nhật lại lịch sử dự án
				const configRes = await Api.getProjectConfig(name, category);
				if (configRes.status === "success") {
					UI.renderMasterHistoryInfo(configRes.data.history, "d_");
				}
			} else {
				UI.updateDeployStatus(
					"Lỗi thực thi",
					50,
					`<span style="color:var(--danger)">${res.message}</span>`,
				);
				UI.notify("Lỗi: " + res.message, "error");
			}
			document.getElementById("deploy-footer").style.display = "flex";
		} catch (err) {
			UI.updateDeployStatus("Lỗi kết nối!", 0, "Không thể kết nối API.");
			document.getElementById("deploy-footer").style.display = "flex";
		}
	},

	async openAntigravity(name) {
		try {
			const categoryQuery = this.currentCategory
				? `&category=${encodeURIComponent(this.currentCategory)}`
				: "";
			const res = await (
				await fetch(
					`api.php?action=openProject&name=${encodeURIComponent(name)}${categoryQuery}`,
				)
			).json();
			if (res.status === "success") {
				UI.notify("Đã yêu cầu mở dự án: " + name, "success");
			} else {
				UI.notify("Lỗi: " + res.message, "error");
			}
		} catch (err) {
			UI.notify("Lỗi kết nối API", "error");
		}
	},

	async previewOrCapture(name, category, screenshotUrl) {
		if (screenshotUrl) {
			this.showScreenshotModal(name, category, screenshotUrl);
		} else {
			await this.captureScreenshot(name, category);
		}
	},

	showScreenshotModal(name, category, screenshotUrl) {
		let modal = document.getElementById("screenshot-preview-modal");
		if (!modal) {
			modal = document.createElement("div");
			modal.id = "screenshot-preview-modal";
			modal.className = "modal-backdrop";
			modal.innerHTML = `
				<div class="modal-card modal-screenshot-preview" onclick="event.stopPropagation();">
					<div class="modal-header">
						<div class="modal-title-wrap">
							<span style="font-size: 1.2rem;">📸</span>
							<h3 class="modal-title" id="modal-screenshot-title">Ảnh Website</h3>
						</div>
						<button class="modal-close-btn" onclick="App.closeScreenshotModal()">✕</button>
					</div>
					<div class="modal-body" style="padding: 14px; text-align: center;">
						<div class="screenshot-img-frame">
							<img id="modal-screenshot-img" src="" alt="Screenshot" />
						</div>
					</div>
					<div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px;">
						<div id="modal-screenshot-url-text" style="font-size: 0.8rem; color: var(--text-muted); font-family: var(--mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%;"></div>
						<div style="display: flex; gap: 8px;">
							<button class="btn btn-ghost" onclick="App.closeScreenshotModal()">Đóng</button>
							<button class="btn btn-primary" id="modal-screenshot-recapture-btn">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
								Chụp lại
							</button>
						</div>
					</div>
				</div>
			`;
			modal.onclick = () => App.closeScreenshotModal();
			document.body.appendChild(modal);
		}

		document.getElementById("modal-screenshot-title").textContent =
			`${name} - Ảnh đại diện`;
		const img = document.getElementById("modal-screenshot-img");
		img.src = screenshotUrl;

		const recaptureBtn = document.getElementById(
			"modal-screenshot-recapture-btn",
		);
		recaptureBtn.onclick = async () => {
			App.closeScreenshotModal();
			await App.captureScreenshot(name, category);
		};

		modal.style.display = "flex";
	},

	closeScreenshotModal() {
		const modal = document.getElementById("screenshot-preview-modal");
		if (modal) modal.style.display = "none";
	},

	async captureScreenshot(
		name,
		category,
		customUrl = null,
		isSilent = false,
	) {
		const targetCat = category || this.currentCategory || "";

		// Visual indicator on target card if visible
		const card = document.querySelector(
			`.item-card[data-project="${name}"]`,
		);
		const thumbWrap = card
			? card.querySelector(".item-card-thumb-wrap")
			: null;
		if (thumbWrap) {
			thumbWrap.classList.add("capturing");
		}

		if (isSilent) {
			try {
				const res = await Api.captureScreenshot(
					name,
					targetCat,
					customUrl,
				);
				if (thumbWrap) thumbWrap.classList.remove("capturing");
				return res;
			} catch (err) {
				if (thumbWrap) thumbWrap.classList.remove("capturing");
				throw err;
			}
		}

		// Khởi tạo Popup Chi tiết Tiến trình Chụp ảnh
		const modalId = "single-screenshot-modal";
		UI.showModal(modalId);

		// Elements
		const projNameEl = document.getElementById("single-shot-proj-name");
		const catBadgeEl = document.getElementById(
			"single-shot-category-badge",
		);
		const targetUrlEl = document.getElementById("single-shot-target-url");
		const procSection = document.getElementById(
			"single-shot-processing-section",
		);
		const successSection = document.getElementById(
			"single-shot-success-section",
		);
		const errorSection = document.getElementById(
			"single-shot-error-section",
		);
		const statusTextEl = document.getElementById("single-shot-status-text");
		const timerEl = document.getElementById("single-shot-timer");
		const progressBar = document.getElementById("single-shot-progress-bar");
		const previewImg = document.getElementById("single-shot-preview-img");
		const metaEl = document.getElementById("single-shot-meta");
		const errorMsgEl = document.getElementById("single-shot-error-msg");
		const btnClose = document.getElementById("btn-single-shot-close");
		const btnRetry = document.getElementById("btn-single-shot-retry");
		const btnViewFull = document.getElementById(
			"btn-single-shot-view-full",
		);

		if (projNameEl) projNameEl.innerText = name;
		if (catBadgeEl) catBadgeEl.innerText = targetCat || "Mặc định";

		// Tìm URL dự kiến từ project cache nếu có
		const pObj = (this.projects || []).find((p) => p.name === name);
		let guessedUrl = customUrl;
		if (!guessedUrl && pObj) {
			if (pObj.prod && pObj.prod.web_domain) {
				const ssl = pObj.prod.ssl ? "https://" : "http://";
				guessedUrl = pObj.prod.web_domain.startsWith("http")
					? pObj.prod.web_domain
					: ssl + pObj.prod.web_domain;
			} else if (pObj.demo_url) {
				guessedUrl = pObj.demo_url.startsWith("http")
					? pObj.demo_url
					: "http://" + pObj.demo_url;
			} else if (
				pObj.deployed &&
				pObj.deployed.demo &&
				pObj.deployed.demo.url
			) {
				guessedUrl = pObj.deployed.demo.url;
			}
		}

		if (targetUrlEl) {
			if (guessedUrl) {
				targetUrlEl.innerText = guessedUrl;
				targetUrlEl.href = guessedUrl;
			} else {
				targetUrlEl.innerText =
					"Đang tự động xác định URL từ cấu hình...";
				targetUrlEl.removeAttribute("href");
			}
		}

		// Reset hiển thị các section
		if (procSection) procSection.style.display = "block";
		if (successSection) successSection.style.display = "none";
		if (errorSection) errorSection.style.display = "none";
		if (btnRetry) btnRetry.style.display = "none";
		if (btnViewFull) btnViewFull.style.display = "none";
		if (progressBar) progressBar.style.width = "15%";

		// Helper cập nhật trạng thái của từng bước
		const setStepState = (stepNum, state) => {
			const stepEl = document.getElementById(`step-single-${stepNum}`);
			if (!stepEl) return;
			const iconEl = stepEl.querySelector(".shot-step-icon");
			if (state === "active") {
				stepEl.style.opacity = "1";
				stepEl.style.color = "#38bdf8";
				if (iconEl)
					iconEl.innerHTML =
						'<span class="spinner-small" style="width:13px; height:13px; border:2px solid rgba(255,255,255,0.2); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite; display:inline-block;"></span>';
			} else if (state === "done") {
				stepEl.style.opacity = "1";
				stepEl.style.color = "#34d399";
				if (iconEl) iconEl.innerHTML = "✅";
			} else if (state === "error") {
				stepEl.style.opacity = "1";
				stepEl.style.color = "#f87171";
				if (iconEl) iconEl.innerHTML = "❌";
			} else {
				stepEl.style.opacity = "0.5";
				stepEl.style.color = "var(--muted)";
				if (iconEl) iconEl.innerHTML = "⚪";
			}
		};

		// Reset các bước
		setStepState(1, "active");
		for (let s = 2; s <= 5; s++) setStepState(s, "waiting");

		// Timer bắt đầu chạy
		let elapsedSeconds = 0;
		if (timerEl) timerEl.innerText = "⏱️ 00:00";
		const timerInterval = setInterval(() => {
			elapsedSeconds++;
			if (timerEl) timerEl.innerText = UI.formatDuration(elapsedSeconds);
		}, 1000);

		// Animation tuần tự giả lập các giai đoạn backend đang thực thi
		const timeout1 = setTimeout(() => {
			setStepState(1, "done");
			setStepState(2, "active");
			if (progressBar) progressBar.style.width = "35%";
			if (statusTextEl)
				statusTextEl.innerHTML =
					'<span class="spinner-small" style="width:12px; height:12px; border:2px solid rgba(255,255,255,0.2); border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite; display:inline-block;"></span> Đang nạp trang web & tải toàn bộ tài nguyên...';
		}, 1200);

		const timeout2 = setTimeout(() => {
			setStepState(2, "done");
			setStepState(3, "active");
			if (progressBar) progressBar.style.width = "60%";
			if (statusTextEl)
				statusTextEl.innerHTML =
					'<span class="spinner-small" style="width:12px; height:12px; border:2px solid rgba(255,255,255,0.2); border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite; display:inline-block;"></span> Đang cuộn trang & nạp Lazyload / Slider Swiper...';
		}, 3000);

		const timeout3 = setTimeout(() => {
			setStepState(3, "done");
			setStepState(4, "active");
			if (progressBar) progressBar.style.width = "80%";
			if (statusTextEl)
				statusTextEl.innerHTML =
					'<span class="spinner-small" style="width:12px; height:12px; border:2px solid rgba(255,255,255,0.2); border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite; display:inline-block;"></span> Đang kết xuất ảnh chụp Full Page từ Header đến Footer...';
		}, 5500);

		const timeout4 = setTimeout(() => {
			setStepState(4, "done");
			setStepState(5, "active");
			if (progressBar) progressBar.style.width = "92%";
			if (statusTextEl)
				statusTextEl.innerHTML =
					'<span class="spinner-small" style="width:12px; height:12px; border:2px solid rgba(255,255,255,0.2); border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite; display:inline-block;"></span> Đang tối ưu hóa dung lượng WebP...';
		}, 8000);

		try {
			const res = await Api.captureScreenshot(name, targetCat, customUrl);

			// Dọn dẹp timers
			clearInterval(timerInterval);
			clearTimeout(timeout1);
			clearTimeout(timeout2);
			clearTimeout(timeout3);
			clearTimeout(timeout4);

			// Cập nhật URL thực tế nếu có trong phản hồi
			if (res && res.targetUrl && targetUrlEl) {
				targetUrlEl.innerText = res.targetUrl;
				targetUrlEl.href = res.targetUrl;
			}

			if (res && res.status === "success") {
				// Đánh dấu hoàn tất toàn bộ các bước
				for (let s = 1; s <= 5; s++) setStepState(s, "done");
				if (progressBar) progressBar.style.width = "100%";

				const rawUrl = res.screenshot || res.url;
				const cleanUrl = rawUrl ? rawUrl.split("?")[0] : "";
				const freshUrl = cleanUrl ? `${cleanUrl}?v=${Date.now()}` : "";

				// Cập nhật model & cache
				if (pObj) {
					pObj.screenshot = freshUrl;
				}

				// Cập nhật DOM thumbnail trên card ngoài màn hình chính
				if (thumbWrap && freshUrl) {
					thumbWrap.classList.remove("capturing");
					thumbWrap.onclick = (e) => {
						e.stopPropagation();
						App.previewOrCapture(name, targetCat, freshUrl);
					};
					thumbWrap.title = "Nhấn để xem hoặc cập nhật ảnh website";

					let existingImg = thumbWrap.querySelector(
						".item-card-thumb-img",
					);
					if (existingImg) {
						existingImg.src = freshUrl;
					} else {
						const placeholder = thumbWrap.querySelector(
							".item-card-thumb-placeholder",
						);
						if (placeholder) placeholder.remove();

						const newImg = document.createElement("img");
						newImg.className = "item-card-thumb-img";
						newImg.alt = name;
						newImg.src = freshUrl;
						thumbWrap.insertBefore(newImg, thumbWrap.firstChild);
					}
				} else if (thumbWrap) {
					thumbWrap.classList.remove("capturing");
				}

				// Hiển thị khung thành công trong modal
				if (procSection) procSection.style.display = "none";
				if (successSection) successSection.style.display = "flex";
				if (previewImg && freshUrl) previewImg.src = freshUrl;

				const sizeText = res.size
					? `Dung lượng: ~${Math.round(res.size / 1024)} KB`
					: "Dung lượng tối ưu";
				const timeText =
					elapsedSeconds > 0
						? `Thời gian: ${elapsedSeconds}s`
						: "Hoàn tất tức thì";
				if (metaEl)
					metaEl.innerText = `${sizeText} | ${timeText} | Định dạng: WebP Full Page`;

				if (btnViewFull && freshUrl) {
					btnViewFull.href = freshUrl;
					btnViewFull.style.display = "inline-flex";
				}

				if (typeof confetti === "function") {
					try {
						confetti({
							particleCount: 40,
							spread: 50,
							origin: { y: 0.6 },
						});
					} catch (e) {}
				}
				UI.notify(`Đã chụp ảnh thành công cho [${name}]!`, "success");
			} else {
				if (thumbWrap) thumbWrap.classList.remove("capturing");
				for (let s = 1; s <= 5; s++) {
					const el = document.getElementById(`step-single-${s}`);
					if (
						el &&
						el.style.opacity === "1" &&
						!el.innerText.includes("✅")
					) {
						setStepState(s, "error");
						break;
					}
				}

				if (procSection) procSection.style.display = "none";
				if (errorSection) errorSection.style.display = "flex";
				const errMsg =
					res && res.message
						? res.message
						: "Không thể chụp được ảnh website này.";
				if (errorMsgEl) errorMsgEl.innerText = errMsg;

				if (btnRetry) {
					btnRetry.style.display = "inline-flex";
					btnRetry.onclick = () =>
						App.captureScreenshot(name, category, customUrl);
				}
				UI.notify("Lỗi chụp ảnh: " + errMsg, "error");
			}
		} catch (err) {
			if (thumbWrap) thumbWrap.classList.remove("capturing");
			clearInterval(timerInterval);
			clearTimeout(timeout1);
			clearTimeout(timeout2);
			clearTimeout(timeout3);
			clearTimeout(timeout4);

			if (procSection) procSection.style.display = "none";
			if (errorSection) errorSection.style.display = "flex";
			if (errorMsgEl)
				errorMsgEl.innerText =
					"Lỗi kết nối máy chủ API: " +
					(err.message || "Network Error");
			if (btnRetry) {
				btnRetry.style.display = "inline-flex";
				btnRetry.onclick = () =>
					App.captureScreenshot(name, category, customUrl);
			}
			UI.notify("Lỗi kết nối khi chụp ảnh website", "error");
		}
	},

	stopBatchCapture() {
		this.isBatchCapturing = false;
		const statusMsg = document.getElementById(
			"batch-screenshot-status-msg",
		);
		if (statusMsg) statusMsg.innerText = "Đang dừng lại sau dự án này...";
		const stopBtn = document.getElementById("btn-batch-screenshot-stop");
		if (stopBtn) stopBtn.disabled = true;
	},

	async batchCaptureScreenshots(category = null) {
		const targetCat = category || this.currentCategory;
		if (!targetCat) {
			UI.notify(
				"Vui lòng chọn một danh mục tháng cụ thể để chụp ảnh!",
				"warning",
			);
			return;
		}

		const confirmed = await UI.confirm(
			`Bạn có chắc muốn tự động chụp ảnh tất cả website trong danh mục [${targetCat}] không?\nQuá trình này sẽ chụp tuần tự từng website để đảm bảo hình ảnh đầy đủ.`,
		);
		if (!confirmed) {
			return;
		}

		const titleEl = document.getElementById("batch-screenshot-title");
		const closeX = document.getElementById("batch-screenshot-close-x");
		const currentProjEl = document.getElementById(
			"batch-screenshot-current-project",
		);
		const countEl = document.getElementById("batch-screenshot-count");
		const progressFill = document.getElementById(
			"batch-screenshot-progress-fill",
		);
		const spinner = document.getElementById("batch-screenshot-spinner");
		const statusMsg = document.getElementById(
			"batch-screenshot-status-msg",
		);
		const logBox = document.getElementById("batch-screenshot-log");
		const stopBtn = document.getElementById("btn-batch-screenshot-stop");
		const doneBtn = document.getElementById("btn-batch-screenshot-done");

		if (titleEl)
			titleEl.innerHTML = `<span>📸</span> Tiến trình chụp ảnh danh mục [${targetCat}]`;
		if (closeX) closeX.style.display = "none";
		if (currentProjEl)
			currentProjEl.innerText = "Đang lấy danh sách dự án...";
		if (countEl) countEl.innerText = "0 / 0";
		if (progressFill) progressFill.style.width = "0%";
		if (spinner) spinner.style.display = "inline-block";
		if (statusMsg) statusMsg.innerText = "Đang chuẩn bị...";
		if (logBox) logBox.innerHTML = "";
		if (stopBtn) {
			stopBtn.style.display = "inline-flex";
			stopBtn.disabled = false;
		}
		if (doneBtn) doneBtn.style.display = "none";

		UI.showModal("batch-screenshot-modal");
		this.isBatchCapturing = true;

		const btn = document.getElementById("btn-batch-screenshot");
		const originalHtml = btn ? btn.innerHTML : "";
		if (btn) {
			btn.disabled = true;
			btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
		}

		try {
			const pRes = await Api.getProjects(targetCat);
			const projects =
				pRes && pRes.status === "success" && Array.isArray(pRes.data)
					? pRes.data
					: this.projects || [];

			if (!projects || projects.length === 0) {
				if (currentProjEl)
					currentProjEl.innerText = "Không có dự án nào";
				if (statusMsg)
					statusMsg.innerText =
						"Danh mục này trống hoặc không tìm thấy dự án.";
				if (spinner) spinner.style.display = "none";
				if (stopBtn) stopBtn.style.display = "none";
				if (doneBtn) doneBtn.style.display = "inline-flex";
				if (closeX) closeX.style.display = "flex";
				return;
			}

			const total = projects.length;
			let successCount = 0;
			let failCount = 0;

			const addLog = (icon, text, color) => {
				if (!logBox) return;
				const div = document.createElement("div");
				div.style.color = color;
				div.style.lineHeight = "1.4";
				div.style.wordBreak = "break-word";
				div.innerHTML = `${icon} ${text}`;
				logBox.appendChild(div);
				logBox.scrollTop = logBox.scrollHeight;
			};

			addLog(
				"🚀",
				`Bắt đầu chụp ảnh tự động cho ${total} website...`,
				"#38bdf8",
			);

			for (let i = 0; i < total; i++) {
				if (!this.isBatchCapturing) {
					addLog(
						"⏹️",
						"Tiến trình đã được dừng lại theo yêu cầu.",
						"#fbbf24",
					);
					break;
				}

				const p = projects[i];
				const pName = p.name;
				const pCat = p.category || targetCat;
				const stepNum = i + 1;

				if (currentProjEl) currentProjEl.innerText = `📂 ${pName}`;
				if (countEl) countEl.innerText = `${stepNum} / ${total}`;
				const pct = Math.round((i / total) * 100);
				if (progressFill) progressFill.style.width = `${pct}%`;
				if (statusMsg)
					statusMsg.innerText = `[${stepNum}/${total}] Đang nạp trang & chụp ảnh website...`;

				const itemLog = document.createElement("div");
				itemLog.style.color = "#94a3b8";
				itemLog.style.lineHeight = "1.4";
				itemLog.innerHTML = `⏳ [${stepNum}/${total}] <strong>${pName}</strong>: Đang xử lý...`;
				logBox.appendChild(itemLog);
				logBox.scrollTop = logBox.scrollHeight;

				try {
					const res = await Api.captureScreenshot(pName, pCat);
					if (res && res.status === "success") {
						successCount++;
						const sizeKb = res.size
							? ` (${Math.round(res.size / 1024)} KB)`
							: "";
						itemLog.style.color = "#34d399";
						itemLog.innerHTML = `✅ [${stepNum}/${total}] <strong>${pName}</strong>: Chụp thành công${sizeKb}`;

						// Cập nhật realtime ảnh thumbnail trên card nếu đang mở
						const safeName = pName.replace(/[^a-zA-Z0-9_-]/g, "_");
						const safeCat = pCat.replace(/[^a-zA-Z0-9_-]/g, "_");
						const card = document.querySelector(
							`.item-card[data-project="${safeName}"][data-category="${safeCat}"]`,
						);
						const shotUrl = res.url || res.screenshot;
						if (card && shotUrl) {
							const freshUrl = shotUrl.split("?")[0] + "?v=" + Date.now();
							const thumbWrap = card.querySelector(
								".item-card-thumb-wrap",
							);
							if (thumbWrap) {
								let existingImg = thumbWrap.querySelector(
									".item-card-thumb-img",
								);
								if (existingImg) {
									existingImg.src = freshUrl;
								} else {
									const placeholder = thumbWrap.querySelector(
										".item-card-thumb-placeholder",
									);
									if (placeholder) placeholder.remove();
									const newImg =
										document.createElement("img");
									newImg.className = "item-card-thumb-img";
									newImg.alt = pName;
									newImg.src = freshUrl;
									thumbWrap.insertBefore(
										newImg,
										thumbWrap.firstChild,
									);
								}
							}
						}
					} else {
						failCount++;
						const errMsg =
							res && res.message
								? res.message
								: "Không thể chụp ảnh";
						itemLog.style.color = "#fb7185";
						itemLog.innerHTML = `⚠️ [${stepNum}/${total}] <strong>${pName}</strong>: ${errMsg}`;
					}
				} catch (err) {
					failCount++;
					itemLog.style.color = "#fb7185";
					itemLog.innerHTML = `❌ [${stepNum}/${total}] <strong>${pName}</strong>: Lỗi kết nối API`;
				}

				if (progressFill)
					progressFill.style.width = `${Math.round(((i + 1) / total) * 100)}%`;
			}

			// Hoàn tất tiến trình
			if (progressFill) progressFill.style.width = "100%";
			if (currentProjEl)
				currentProjEl.innerText = this.isBatchCapturing
					? "Hoàn tất!"
					: "Đã dừng!";
			if (spinner) spinner.style.display = "none";
			if (statusMsg)
				statusMsg.innerText = `Đã xử lý xong: ${successCount} thành công, ${failCount} thất bại / bỏ qua (Tổng ${total} dự án).`;
			addLog(
				"🏁",
				`Hoàn tất tiến trình chụp ảnh! Thành công: ${successCount}/${total}`,
				"#38bdf8",
			);

			if (successCount > 0 && typeof confetti === "function") {
				try {
					confetti({
						particleCount: 50,
						spread: 60,
						origin: { y: 0.7 },
					});
				} catch (e) {}
			}
		} catch (err) {
			if (statusMsg)
				statusMsg.innerText =
					"Lỗi trong quá trình chụp hàng loạt: " + err.message;
		} finally {
			this.isBatchCapturing = false;
			if (btn) {
				btn.disabled = false;
				btn.innerHTML = originalHtml;
			}
			if (stopBtn) stopBtn.style.display = "none";
			if (doneBtn) doneBtn.style.display = "inline-flex";
			if (closeX) closeX.style.display = "flex";
		}
	},

	async checkCategoryDeployStatus() {
		const category = this.currentCategory;
		if (!category) {
			UI.showToast(
				"Vui lòng chọn danh mục/tháng trước khi kiểm tra!",
				"warning",
			);
			return;
		}

		const btn = document.getElementById("btn-check-deploy-status");
		const originalHtml = btn ? btn.innerHTML : "";
		if (btn) {
			btn.disabled = true;
			btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Đang quét...`;
		}

		const titleEl = document.getElementById("check-deploy-modal-title");
		const bodyEl = document.getElementById("check-deploy-modal-body");

		if (titleEl) {
			titleEl.innerHTML = `
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5FF0BE" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6M8 11h6"/></svg>
				<span>Trạng thái Demo / Production: <strong>${category}</strong></span>
			`;
		}
		if (bodyEl) {
			bodyEl.innerHTML = `
				<div style="text-align:center; padding: 30px 10px;">
					<div class="spinner" style="margin: 0 auto 15px auto; width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #5FF0BE; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
					<div style="font-size: 1rem; color: var(--text); font-weight: 600; margin-bottom: 6px;">Đang quét các phân vùng Demo...</div>
					<div style="font-size: 0.8rem; color: var(--muted);">Đang kết nối FTP để kiểm tra thư mục mã nguồn trên tất cả các server Demo</div>
				</div>
			`;
		}
		UI.showModal("check-deploy-status-modal");

		try {
			const res = await Api.checkCategoryDeployStatus(category);

			if (res.status === "success") {
				const counts = res.counts || {
					local: 0,
					demo: 0,
					production: 0,
				};
				const results = res.results || [];

				let rowsHtml = "";
				results.forEach((item, idx) => {
					let badge = `<span class="badge badge-pending" style="font-size:0.75rem;">⏳ Local</span>`;
					let statusColor = "#94a3b8";
					if (item.status === "production") {
						badge = `<span class="badge badge-prod" style="font-size:0.75rem;">🚀 Production</span>`;
						statusColor = "#fb7185";
					} else if (item.status === "demo") {
						badge = `<span class="badge badge-ok" style="font-size:0.75rem;">🌿 Demo</span>`;
						statusColor = "#5FF0BE";
					}

					const serverText = item.server_name
						? `<span style="color:#38bdf8; font-size:0.78rem; white-space:nowrap;">${item.server_name}</span>`
						: `<span style="color:var(--muted); font-size:0.78rem;">—</span>`;
					const folderText = item.matched_folder
						? `<code style="font-size:0.75rem; color:${statusColor}; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; word-break:break-all;">${item.matched_folder}</code>`
						: `<span style="color:var(--muted); font-size:0.75rem;">—</span>`;

					rowsHtml += `
						<tr style="border-bottom: 1px solid var(--border);">
							<td style="padding: 9px 10px; font-size: 0.8rem; color: var(--muted); white-space:nowrap;">${idx + 1}</td>
							<td style="padding: 9px 10px; font-weight: 600; font-size: 0.85rem; color: var(--text);">${item.name}</td>
							<td style="padding: 9px 10px; white-space:nowrap;">${badge}</td>
							<td style="padding: 9px 10px;">${serverText}</td>
							<td style="padding: 9px 10px;">${folderText}</td>
						</tr>
					`;
				});

				if (bodyEl) {
					bodyEl.innerHTML = `
						<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
							<div style="background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; text-align: center;">
								<div style="font-size: 0.72rem; color: var(--muted); margin-bottom: 4px;">Tổng dự án</div>
								<div style="font-size: 1.25rem; font-weight: 700; color: var(--text);">${res.total}</div>
							</div>
							<div style="background: rgba(95, 240, 190, 0.06); border: 1px solid rgba(95, 240, 190, 0.25); border-radius: 8px; padding: 10px 12px; text-align: center;">
								<div style="font-size: 0.72rem; color: #5FF0BE; margin-bottom: 4px;">🌿 Đã Up Demo</div>
								<div style="font-size: 1.25rem; font-weight: 700; color: #5FF0BE;">${counts.demo}</div>
							</div>
							<div style="background: rgba(251, 113, 133, 0.06); border: 1px solid rgba(251, 113, 133, 0.25); border-radius: 8px; padding: 10px 12px; text-align: center;">
								<div style="font-size: 0.72rem; color: #fb7185; margin-bottom: 4px;">🚀 Đã Up Production</div>
								<div style="font-size: 1.25rem; font-weight: 700; color: #fb7185;">${counts.production}</div>
							</div>
							<div style="background: rgba(148, 163, 184, 0.06); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 8px; padding: 10px 12px; text-align: center;">
								<div style="font-size: 0.72rem; color: #94a3b8; margin-bottom: 4px;">⏳ Đang ở Local</div>
								<div style="font-size: 1.25rem; font-weight: 700; color: #94a3b8;">${counts.local}</div>
							</div>
						</div>

						<div style="background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; overflow-x: auto;">
							<table style="width: 100%; border-collapse: collapse; text-align: left;">
								<thead>
									<tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border); font-size: 0.75rem; color: var(--muted); text-transform: uppercase;">
										<th style="padding: 10px; white-space:nowrap;">#</th>
										<th style="padding: 10px; white-space:nowrap;">Dự án</th>
										<th style="padding: 10px; white-space:nowrap;">Trạng thái</th>
										<th style="padding: 10px; white-space:nowrap;">Phân vùng Demo</th>
										<th style="padding: 10px; white-space:nowrap;">Thư mục nhận diện</th>
									</tr>
								</thead>
								<tbody>
									${rowsHtml}
								</tbody>
							</table>
						</div>
					`;
				}

				UI.showToast(
					`Đã đồng bộ trạng thái: ${counts.demo} Demo, ${counts.production} Production, ${counts.local} Local`,
					"success",
				);
				// Tự động load lại danh sách dự án để cập nhật badge ngay lập tức
				await this.loadProjects(category, true);
			} else {
				if (bodyEl) {
					bodyEl.innerHTML = `<div style="color: var(--danger); text-align:center; padding:20px;">❌ Lỗi: ${res.message || "Không thể kiểm tra trạng thái"}</div>`;
				}
				UI.showToast(res.message || "Lỗi kiểm tra trạng thái", "error");
			}
		} catch (err) {
			if (bodyEl) {
				bodyEl.innerHTML = `<div style="color: var(--danger); text-align:center; padding:20px;">❌ Lỗi kết nối: ${err.message}</div>`;
			}
			UI.showToast(
				"Lỗi kết nối kiểm tra trạng thái: " + err.message,
				"error",
			);
		} finally {
			if (btn) {
				btn.disabled = false;
				btn.innerHTML = originalHtml;
			}
		}
	},

	async autoLoginAdmin(name, category = "", env = "local") {
		if (!name) {
			name = this.currentProjectName;
		}
		if (!name) {
			UI.showToast("Không xác định được tên dự án!", "error");
			return;
		}
		const cat = category || this.currentCategory || "";
		const envLabel =
			env === "prod" || env === "production"
				? "Production"
				: env === "demo"
					? "Demo"
					: "Local";
		UI.showToast(
			`Đang chuẩn bị phiên đăng nhập Admin (${envLabel}) cho "${name}"...`,
			"info",
		);
		try {
			const res = await Api.autoLoginAdmin(name, cat, env);
			if (res && res.status === "success" && res.login_url) {
				window.open(res.login_url, "_blank");
				UI.showToast(
					`Đã mở phiên đăng nhập Admin ${envLabel} (${res.username || "admin"}) thành công!`,
					"success",
				);
			} else {
				UI.showToast(
					res.message ||
						`Không thể tạo phiên đăng nhập tự động trên ${envLabel}!`,
					"error",
				);
			}
		} catch (err) {
			console.error("autoLoginAdmin error:", err);
			UI.showToast(
				"Lỗi tự động đăng nhập: " + (err.message || err),
				"error",
			);
		}
	},

	async showSetDemoAccountModal(name, category = "") {
		const projName = name || this.currentProjectName;
		const cat = category || this.currentCategory || "";
		if (!projName) {
			UI.notify("Không tìm thấy thông tin dự án!", "error");
			return;
		}

		document.getElementById("set_demo_project_name").value = projName;
		document.getElementById("set_demo_category").value = cat;
		document.getElementById("set_demo_badge_name").innerText = `${cat ? cat + "/" : ""}${projName}`;

		// Clear test result
		const resBox = document.getElementById("set-demo-test-result");
		if (resBox) {
			resBox.style.display = "none";
			resBox.innerHTML = "";
		}

		// Ensure globalData is loaded for demo_list
		if (!this.globalData || !this.globalData.demo_list) {
			try {
				const gRes = await (await fetch("api.php?action=getGlobalConfig")).json();
				if (gRes.status === "success") {
					this.globalData = gRes.data;
				}
			} catch (e) {
				console.error("Lỗi tải demo_config:", e);
			}
		}

		// Populate demo server select
		const demoSelect = document.getElementById("set_demo_server_id");
		if (demoSelect && this.globalData && this.globalData.demo_list) {
			demoSelect.innerHTML = "";
			const defaultId = this.globalData.default_demo_id || "demo_1785834732693";
			this.globalData.demo_list.forEach((demo) => {
				const option = document.createElement("option");
				option.value = demo.id;
				option.innerText = `${demo.name} (${demo.web_domain})${demo.id === defaultId ? " ⭐" : ""}`;
				demoSelect.appendChild(option);
			});
		}

		// Fetch fresh project config directly from server
		let pConfig = null;
		try {
			const cRes = await (await fetch(`api.php?action=getProjectConfig&name=${encodeURIComponent(projName)}&category=${encodeURIComponent(cat)}`)).json();
			if (cRes && cRes.status === "success" && cRes.data) {
				pConfig = cRes.data;
			}
		} catch (e) {
			console.error("Lỗi lấy project config:", e);
		}

		if (!pConfig) {
			pConfig = (this.currentProjectName === projName && this.currentProjectConfig)
				? this.currentProjectConfig
				: ((this.projects && this.projects.find(p => p.name === projName)?.config) || {});
		}

		const demoInfo = (pConfig && pConfig.deployed && pConfig.deployed.demo) ? pConfig.deployed.demo : {};
		const hasDemo = !!(demoInfo && (demoInfo.deploy_time || demoInfo.url || demoInfo.demo_server_id || demoInfo.server_id || demoInfo.matched_folder || demoInfo.db_name));

		// Set status badge & unlink button
		const statusBadge = document.getElementById("set_demo_status_badge");
		const unlinkBtn = document.getElementById("btn-unlink-demo");
		if (statusBadge) {
			statusBadge.className = hasDemo ? "badge badge-ok" : "badge badge-pending";
			statusBadge.innerText = hasDemo ? "✓ Đã liên kết Demo" : "Chưa liên kết Demo";
		}
		if (unlinkBtn) {
			unlinkBtn.style.display = hasDemo ? "inline-block" : "none";
		}

		// Select demo server: match by demo_server_id, or match by URL domain
		let targetServerId = demoInfo.demo_server_id || demoInfo.server_id;
		if (!targetServerId && demoInfo.url && this.globalData && this.globalData.demo_list) {
			const matched = this.globalData.demo_list.find(d => d.web_domain && demoInfo.url.includes(d.web_domain));
			if (matched) {
				targetServerId = matched.id;
			}
		}
		if (!targetServerId && this.globalData) {
			targetServerId = this.globalData.default_demo_id || "demo_1785834732693";
		}
		if (demoSelect && targetServerId) {
			demoSelect.value = targetServerId;
		}

		// Set folder: default to category/projName or projName
		const defaultFolder = cat ? `${cat}/${projName}` : projName;
		const folderInput = document.getElementById("set_demo_folder");
		if (folderInput) {
			let currentFolder = demoInfo.matched_folder || defaultFolder;
			if (cat && currentFolder !== cat && !currentFolder.startsWith(cat + "/")) {
				currentFolder = `${cat}/${currentFolder}`;
			}
			folderInput.value = currentFolder;
		}

		// Set URL
		const urlInput = document.getElementById("set_demo_url");
		if (urlInput) {
			let currentUrl = demoInfo.url || "";
			if (cat && currentUrl && !currentUrl.includes("/" + cat + "/")) {
				this.onSetDemoServerOrFolderChange();
			} else {
				urlInput.value = currentUrl;
				if (!urlInput.value) {
					this.onSetDemoServerOrFolderChange();
				}
			}
		}

		// Advanced fields
		const customDomainInput = document.getElementById("set_demo_custom_domain");
		if (customDomainInput) customDomainInput.value = demoInfo.custom_domain || "";

		const dbNameInput = document.getElementById("set_demo_db_name");
		if (dbNameInput) dbNameInput.value = demoInfo.db_name || "";

		const dbUserInput = document.getElementById("set_demo_db_user");
		if (dbUserInput) dbUserInput.value = demoInfo.db_user || "";

		const dbPassInput = document.getElementById("set_demo_db_pass");
		if (dbPassInput) dbPassInput.value = demoInfo.db_pass || "";

		// Tự động mở accordion tùy chọn nâng cao nếu có dữ liệu database hoặc custom domain
		const advDetails = document.getElementById("set_demo_advanced_details");
		if (advDetails) {
			advDetails.open = !!(demoInfo.db_name || demoInfo.custom_domain || demoInfo.db_pass || demoInfo.db_user);
		}

		UI.showModal("set-demo-modal");
	},

	onSetDemoServerOrFolderChange() {
		const demoSelect = document.getElementById("set_demo_server_id");
		const folderInput = document.getElementById("set_demo_folder");
		const urlInput = document.getElementById("set_demo_url");
		if (!demoSelect || !folderInput || !urlInput) return;

		const sId = demoSelect.value;
		const folder = folderInput.value.trim().replace(/^\/+|\/+$/g, "");
		const server = (this.globalData && this.globalData.demo_list)
			? this.globalData.demo_list.find(s => s.id === sId)
			: null;

		if (server && server.web_domain && folder) {
			const cleanDomain = server.web_domain.replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
			const protocol = server.ssl ? "https://" : "http://";
			urlInput.value = `${protocol}${cleanDomain}/${folder}/`;
		}
	},

	async testDemoConnection() {
		const demoServerId = document.getElementById("set_demo_server_id").value;
		const matchedFolder = document.getElementById("set_demo_folder").value.trim();
		const customDomain = document.getElementById("set_demo_custom_domain").value.trim();
		const resBox = document.getElementById("set-demo-test-result");
		const spinner = document.getElementById("test-demo-spinner");
		const testBtn = document.getElementById("btn-test-demo-conn");

		if (!matchedFolder) {
			UI.notify("Vui lòng nhập thư mục trên Hosting Demo!", "warning");
			return;
		}

		if (spinner) spinner.style.display = "inline";
		if (testBtn) testBtn.disabled = true;
		if (resBox) {
			resBox.style.display = "block";
			resBox.style.background = "rgba(255,255,255,0.05)";
			resBox.style.border = "1px solid rgba(255,255,255,0.1)";
			resBox.style.color = "var(--text-secondary)";
			resBox.innerHTML = "⏳ Đang kết nối FTP và kiểm tra thư mục trên hosting...";
		}

		try {
			const res = await Api.testDemoConnection({
				demo_server_id: demoServerId,
				matched_folder: matchedFolder,
				custom_domain: customDomain
			});

			if (resBox) {
				if (res && res.status === "success") {
					if (res.folder_exists) {
						resBox.style.background = "rgba(95, 240, 190, 0.1)";
						resBox.style.border = "1px solid rgba(95, 240, 190, 0.3)";
						resBox.style.color = "#5FF0BE";
						resBox.innerHTML = `<strong>✓ KẾT NỐI THÀNH CÔNG:</strong> ${res.message}<br><small style="color:var(--text-muted);">Đường dẫn: <code>${res.target_path}</code></small>`;
					} else {
						resBox.style.background = "rgba(255, 183, 77, 0.1)";
						resBox.style.border = "1px solid rgba(255, 183, 77, 0.3)";
						resBox.style.color = "#FFCB7A";
						resBox.innerHTML = `<strong>⚠️ KẾT NỐI SERVER OK:</strong> ${res.message}<br><small style="color:var(--text-muted);">Đường dẫn: <code>${res.target_path}</code></small>`;
					}
				} else {
					resBox.style.background = "rgba(255, 94, 143, 0.1)";
					resBox.style.border = "1px solid rgba(255, 94, 143, 0.3)";
					resBox.style.color = "#ff5e8f";
					resBox.innerHTML = `<strong>✗ LỖI KẾT NỐI:</strong> ${res.message || "Không thể kết nối tới server Demo!"}`;
				}
			}
		} catch (err) {
			if (resBox) {
				resBox.style.background = "rgba(255, 94, 143, 0.1)";
				resBox.style.border = "1px solid rgba(255, 94, 143, 0.3)";
				resBox.style.color = "#ff5e8f";
				resBox.innerHTML = `<strong>✗ LỖI KẾT NỐI:</strong> ${err.message || err}`;
			}
		} finally {
			if (spinner) spinner.style.display = "none";
			if (testBtn) testBtn.disabled = false;
		}
	},

	async saveSetDemoAccount() {
		const name = document.getElementById("set_demo_project_name").value;
		const category = document.getElementById("set_demo_category").value;
		const demoServerId = document.getElementById("set_demo_server_id").value;
		const matchedFolder = document.getElementById("set_demo_folder").value.trim();
		const url = document.getElementById("set_demo_url").value.trim();
		const customDomain = document.getElementById("set_demo_custom_domain").value.trim();
		const dbName = document.getElementById("set_demo_db_name").value.trim();
		const dbUser = document.getElementById("set_demo_db_user").value.trim();
		const dbPass = document.getElementById("set_demo_db_pass").value.trim();
		const saveBtn = document.getElementById("btn-save-set-demo");

		if (!name) {
			UI.notify("Thiếu tên dự án!", "error");
			return;
		}
		if (!matchedFolder) {
			UI.notify("Vui lòng nhập thư mục trên Hosting Demo!", "warning");
			return;
		}

		if (saveBtn) saveBtn.disabled = true;
		try {
			const res = await Api.setProjectDemoConfig({
				name,
				category,
				demo_server_id: demoServerId,
				matched_folder: matchedFolder,
				url,
				custom_domain: customDomain,
				db_name: dbName,
				db_user: dbUser,
				db_pass: dbPass
			});

			if (res && res.status === "success") {
				UI.notify(res.message || "Đã lưu cấu hình tài khoản Demo thành công!", "success");
				UI.hideModal("set-demo-modal");

				// Refresh state & UI
				if (this.currentProjectName === name) {
					await this.openConfig(name, category);
				} else {
					await this.loadProjects(this.currentCategory || category);
				}
			} else {
				UI.notify(res.message || "Không thể lưu cấu hình Demo!", "error");
			}
		} catch (err) {
			UI.notify("Lỗi: " + (err.message || err), "error");
		} finally {
			if (saveBtn) saveBtn.disabled = false;
		}
	},

	async unlinkDemoAccount() {
		const name = document.getElementById("set_demo_project_name").value;
		const category = document.getElementById("set_demo_category").value;

		if (!name) return;
		if (!confirm(`Bạn có chắc chắn muốn gỡ liên kết Demo của dự án "${name}" không?\n\n(Lưu ý: Dữ liệu và file trên hosting sẽ không bị xóa, hệ thống chỉ gỡ thông tin kết nối trong RBWManager)`)) {
			return;
		}

		try {
			const res = await Api.setProjectDemoConfig({
				name,
				category,
				unlink: true
			});

			if (res && res.status === "success") {
				UI.notify(res.message || "Đã gỡ liên kết Demo!", "success");
				UI.hideModal("set-demo-modal");

				if (this.currentProjectName === name) {
					await this.openConfig(name, category);
				} else {
					await this.loadProjects(this.currentCategory || category);
				}
			} else {
				UI.notify(res.message || "Không thể gỡ liên kết Demo!", "error");
			}
		} catch (err) {
			UI.notify("Lỗi: " + (err.message || err), "error");
		}
	},
};

document.addEventListener("DOMContentLoaded", () => App.init());
