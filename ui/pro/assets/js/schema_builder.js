const SchemaBuilder = {
	...SchemaComponents,
	currentProject: null,
	currentFile: null,
	currentData: null,
	presets: null,

	async init(projectName) {
		this.currentProject = projectName;
		const nameEl = document.getElementById("sb-project-name");
		if (nameEl) nameEl.innerText = `Dự án: ${projectName}`;

		if (!this.presets) {
			await this.loadPresets();
		}

		// Load file list
		const res = await Api.getProjectSchemaList(projectName);
		if (res.status === "success") {
			const select = document.getElementById("sb-file-select");
			select.innerHTML = res.data
				.map((f) => `<option value="${f}">${f}</option>`)
				.join("");
			if (res.data.length > 0) {
				const defaultFile =
					res.data.find((f) => f === "type-products.php") ||
					res.data[0];
				select.value = defaultFile;
				this.loadSelectedFile();
			}
		} else {
			UI.notify(res.message, "error");
		}
	},

	async loadPresets() {
		try {
			const res = await (
				await fetch("api.php?action=getSchemaPresets")
			).json();
			if (res.status === "success") {
				this.presets = res.data;
			}
		} catch (e) {
			console.error("Failed to load presets", e);
		}
	},

	async loadSelectedFile() {
		const file = document.getElementById("sb-file-select").value;
		this.currentFile = file;
		const container = document.getElementById("sb-form-container");
		container.innerHTML =
			'<div style="text-align:center; padding:50px; color:var(--muted);">Đang tải cấu hình...</div>';

		const res = await Api.loadModuleSchema(this.currentProject, file);
		if (res.status === "success") {
			this.currentData = res.data;
			this.currentActiveModule = null; // Reset to blank state initially
			this.renderForm();
		} else {
			UI.notify(res.message, "error");
		}
	},

	renderForm() {
		const container = document.getElementById("sb-form-container");
		container.innerHTML = "";

		if (!this.currentData) return;

		const allKeys = Object.keys(this.currentData);
		const editableKeys = allKeys.filter((k) => {
			if (k === "brand" || k === "default") return false;
			if (
				this.currentFile &&
				this.currentFile.includes("news") &&
				k === "hinh-thuc-thanh-toan"
			)
				return false;
			return true;
		});

		if (
			!this.currentActiveModule ||
			(this.currentActiveModule !== "__ALL__" &&
				!editableKeys.includes(this.currentActiveModule))
		) {
			this.currentActiveModule = editableKeys[0] || null;
		}

		// --- Render Module Toolbar (Thêm Mới Type) ---
		const toolbar = document.createElement("div");
		toolbar.className = "sb-create-toolbar";

		let presetOptions = '<option value="">-- Trống (Mặc định) --</option>';
		if (this.presets) {
			for (const [groupKey, groupData] of Object.entries(this.presets)) {
				presetOptions += `<optgroup label="Module mẫu: ${groupKey.toUpperCase()}">`;
				for (const [pKey, pData] of Object.entries(groupData)) {
					presetOptions += `<option value="preset:${groupKey}.${pKey}">${pData.name}</option>`;
				}
				presetOptions += `</optgroup>`;
			}
		}
		if (editableKeys.length > 0) {
			presetOptions += `<optgroup label="Nhân bản từ Type hiện có">`;
			presetOptions += editableKeys
				.map((k) => `<option value="clone:${k}">Copy: ${k}</option>`)
				.join("");
			presetOptions += `</optgroup>`;
		}

		toolbar.innerHTML = `
            <div class="sb-create-toolbar-head">
                <span class="sb-create-toolbar-title">➕ Thêm Type / Module mới</span>
                <span class="sb-create-toolbar-hint">Chọn khuôn mẫu có sẵn hoặc tạo mới từ đầu</span>
            </div>
            <div class="sb-create-toolbar-grid">
                <div class="sb-create-field">
                    <label>Khuôn mẫu (Preset)</label>
                    <select id="sb-type-preset" class="form-control" title="Chọn khuôn mẫu Module">
                        ${presetOptions}
                    </select>
                </div>
                <div class="sb-create-field">
                    <label>Mã Type (Key)</label>
                    <input type="text" id="sb-type-new" class="form-control" placeholder="vd: tin-tuc, san-pham">
                </div>
                <div class="sb-create-field">
                    <label>Tiêu đề hiển thị</label>
                    <input type="text" id="sb-type-title" class="form-control" placeholder="vd: Tin tức, Sản phẩm">
                </div>
                <div class="sb-create-action">
                    <button class="btn btn-primary" id="sb-type-add">✨ Tạo Type</button>
                </div>
            </div>
        `;

		container.appendChild(toolbar);

		// --- Render Quick Type Switcher Tabs ---
		if (editableKeys.length > 0) {
			const summary = document.createElement("div");
			summary.className = "sb-type-switcher";

			const typeTabsHtml = editableKeys
				.map((k) => {
					const isActive =
						this.currentActiveModule === k ||
						(this.currentActiveModule === "__ALL__" && false);
					const subTitle =
						this.currentData[k] && this.currentData[k].title_main
							? this.currentData[k].title_main
							: "";
					return `
                    <button type="button" class="sb-type-tab ${isActive ? "active" : ""}" data-type-key="${k}" title="${subTitle ? `${subTitle} (${k})` : k}">
                        <span class="sb-type-tab-icon">📦</span>
                        <span class="sb-type-tab-key">${k}</span>
                        ${subTitle && subTitle.toLowerCase() !== k.toLowerCase() ? `<span class="sb-type-tab-name">${subTitle}</span>` : ""}
                    </button>`;
				})
				.join("");

			const showAllBtn =
				editableKeys.length > 1
					? `<button type="button" class="sb-type-tab sb-type-tab-all ${this.currentActiveModule === "__ALL__" ? "active" : ""}" data-type-key="__ALL__">
                        <span>📑 Xem tất cả (${editableKeys.length})</span>
                       </button>`
					: "";

			summary.innerHTML = `
                <div class="sb-type-switcher-label">
                    <span>📚 Đã có <b>${editableKeys.length}</b> Type:</span>
                </div>
                <div class="sb-type-switcher-list">
                    ${typeTabsHtml}
                    ${showAllBtn}
                </div>
            `;

			summary.querySelectorAll(".sb-type-tab").forEach((btn) => {
				btn.onclick = () => {
					this.currentActiveModule = btn.dataset.typeKey;
					this.renderForm();
				};
			});

			container.appendChild(summary);
		}

		// Bind Toolbar Events
		toolbar.querySelector("#sb-type-add").onclick = () => {
			const val = toolbar
				.querySelector("#sb-type-new")
				.value.trim()
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, "-");
			const titleVal = toolbar
				.querySelector("#sb-type-title")
				.value.trim();
			const presetVal = toolbar.querySelector("#sb-type-preset").value;

			if (!val) {
				UI.notify("Vui lòng nhập tên Type (ví dụ: tin-tuc)", "error");
				return;
			}
			if (this.currentData[val]) {
				UI.notify("Type này đã tồn tại trong file!", "error");
				return;
			}

			if (presetVal.startsWith("clone:")) {
				const cloneKey = presetVal.replace("clone:", "");
				this.currentData[val] = JSON.parse(
					JSON.stringify(this.currentData[cloneKey]),
				);
				this.currentData[val].title_main =
					titleVal ||
					"Copy of " + this.currentData[cloneKey].title_main;
			} else if (presetVal.startsWith("preset:")) {
				const [gKey, pKey] = presetVal
					.replace("preset:", "")
					.split(".");
				const presetObj = this.presets[gKey][pKey];
				if (presetObj) {
					const configData = presetObj.data || presetObj.config;
					if (configData) {
						this.currentData[val] = JSON.parse(
							JSON.stringify(configData),
						);
						this.currentData[val].title_main =
							titleVal || presetObj.name || val;
					} else {
						UI.notify(
							"Không tìm thấy dữ liệu cấu hình trong Preset này!",
							"error",
						);
						return;
					}
				}
			} else {
				const isNewsOrStatic =
					this.currentFile &&
					(this.currentFile.includes("news") ||
						this.currentFile.includes("static"));
				this.currentData[val] = {
					title_main: titleVal || val,
					slug: true,
					copy: true,
					tags: true,
					view: true,
					comment: true,
					datePublish: true,
					status: { noibat: "noibat", hienthi: "hienthi" },
					images: {
						photo: {
							title: "anhdaidien",
							width: 800,
							height: 800,
							thumb: "500x500x1",
						},
					},
					show_images: true,
					gallery: {
						[val]: {
							title_main_photo: "hinhanh",
							title_sub_photo: "hinhanh",
							status_photo: { hienthi: "hienthi" },
							number_photo: 3,
							images_photo: true,
							avatar_photo: true,
							name_photo: true,
							photo_width: 800,
							photo_height: 800,
							photo_thumb: "500x500x1",
							sync_with_main: true,
						},
					},
					code: true,
					regular_price: true,
					sale_price: true,
					discount: true,
					name: true,
					desc: true,
					desc_cke: true,
					content: true,
					content_cke: true,
					seo: true,
					schema: true,
					categories: {
						list: {
							title_main_categories: "danhmuccap1",
							copy_categories: true,
							show_images_categories: true,
							images: {
								photo: {
									title: "anhdaidien",
									width: "500",
									height: "500",
									thumb: "500x500x1",
								},
							},
							slug_categories: true,
							status_categories: { hienthi: "hienthi" },
							name_categories: true,
							desc_categories: false,
							content_categories: true,
							content_categories_cke: true,
							seo_categories: true,
						},
					},
				};

				if (!isNewsOrStatic) {
					this.currentData[val].brand = {
						title_main_brand: "danhmuchang",
						show_images_brand: true,
						images: {
							photo: {
								title: "anhdaidien",
								width: "500",
								height: "500",
								thumb: "500x500x1",
							},
						},
						slug_brand: true,
						status_brand: { hienthi: "hienthi" },
						name_brand: true,
						seo_brand: true,
					};
				}
			}

			this.currentActiveModule = val;
			this.syncLabels(); // Ensure sub-titles like gallery/website reflect the new title
			this.renderForm();
		};

		if (editableKeys.length === 0) {
			const blankState = document.createElement("div");
			blankState.style.padding = "50px";
			blankState.style.textAlign = "center";
			blankState.style.color = "var(--muted)";
			let blankHtml =
				"<h2>👆</h2><p>File cấu hình đang trống. Vui lòng <b>Thêm mới</b> một type để bắt đầu.</p>";

			if (this.currentFile.includes("news")) {
				blankHtml += `<button class="btn btn-outline-primary btn-sm" onclick="SchemaBuilder.initNewsSkeleton()">✨ Khởi tạo bộ khung Tin tức chuẩn</button>`;
			} else if (this.currentFile.includes("static")) {
				blankHtml += `<button class="btn btn-outline-info btn-sm" onclick="SchemaBuilder.initStaticSkeleton()">✨ Khởi tạo bộ khung Trang tĩnh chuẩn</button>`;
			} else if (this.currentFile.includes("newsletters")) {
				blankHtml += `<button class="btn btn-outline-warning btn-sm" onclick="SchemaBuilder.initNewslettersSkeleton()">✨ Khởi tạo bộ khung Newsletters chuẩn</button>`;
			}

			blankState.innerHTML = blankHtml;
			container.appendChild(blankState);
			this.renderPreview();
			return;
		}

		// Initial Master order for keys (if not already set)
		if (!this.masterOrder) {
			this.masterOrder = [
				"title_main",
				"website",
				"status",
				"slug",
				"seo",
				"schema",
				"copy",
				"tags",
				"view",
				"comment",
				"datePublish",
				"code",
				"regular_price",
				"sale_price",
				"discount",
				"name",
				"desc",
				"desc_cke",
				"content",
				"content_cke",
				"properties",
				"options2",
				"show_images",
				"images",
				"gallery",
				"group",
				"brand",
				"categories",
			];
		}

		// Definitions for grouping
		this.groups = {
			logic: [
				"website",
				"slug",
				"slug_categories",
				"slug_brand",
				"view",
				"datePublish",
				"schema",
				"seo",
				"seo_categories",
				"seo_brand",
				"copy",
				"copy_categories",
				"copy_brand",
			],
			standard: [
				"title_main",
				"title_main_categories",
				"title_main_brand",
				"name",
				"name_categories",
				"name_brand",
				"desc",
				"desc_categories",
				"desc_brand",
				"desc_cke",
				"desc_categories_cke",
				"desc_brand_cke",
				"content",
				"content_categories",
				"content_brand",
				"content_cke",
				"content_categories_cke",
				"content_brand_cke",
				"tags",
				"comment",
				"properties",
				"code",
				"regular_price",
				"sale_price",
				"discount",
				"options2",
				"file",
				"send_email",
			],
			images: [
				"show_images",
				"show_images_categories",
				"show_images_brand",
				"images",
				"gallery",
				"gallery_categories",
			],
			categories: ["categories", "brand"],
			hidden: ["admin_lang", "group", "dropdown"],
		};

		this.MASTER_DEFAULTS = {
			title_main: "Tên module",
			slug: false,
			copy: false,
			tags: false,
			view: false,
			comment: false,
			datePublish: false,
			code: false,
			regular_price: false,
			sale_price: false,
			discount: false,
			name: true,
			desc: false,
			desc_cke: false,
			content: false,
			content_cke: false,
			show_images: false,
			properties: false,
			brand: false,
			file: false,
			website: {
				type: {
					index: "object",
					detail: "article"
				},
				title: "tentype",
				amp: true,
				route: {
					controller: "Controller@index",
					name: "tentype",
					method: "get",
					slugs: {
						vi: "ten-type"
					}
				}
			}
		};

		// Render ALL modules stacked vertically
		// Sort keys to ensure 'hinh-thuc-thanh-toan' is always last
		const sortedKeys = Object.keys(this.currentData).sort((a, b) => {
			if (a === "hinh-thuc-thanh-toan") return 1;
			if (b === "hinh-thuc-thanh-toan") return -1;
			return 0;
		});

		for (const key of sortedKeys) {
			const rawValue = this.currentData[key];
			if (key === "brand" || key === "default") continue; // Skip helper keys

			// Hide mandatory system type for news to keep UI clean
			if (
				this.currentFile.includes("news") &&
				key === "hinh-thuc-thanh-toan"
			)
				continue;

			const isNewsOrStatic =
				this.currentFile &&
				(this.currentFile.includes("news") ||
					this.currentFile.includes("static"));
			if (isNewsOrStatic) {
				delete this.currentData[key].brand;
			} else if (this.currentData[key].brand === undefined) {
				this.currentData[key].brand = false;
			}
			this.currentData[key] = this.sortObjectKeys(
				this.currentData[key],
				this.masterOrder,
			);
			const value = this.currentData[key];

			if (
				this.currentActiveModule &&
				this.currentActiveModule !== "__ALL__" &&
				key !== this.currentActiveModule
			) {
				continue;
			}

			const section = document.createElement("div");
			section.className = "sb-section";
			section.id = `sb-section-${key}`;
			const typeTitle = value.title_main ? ` — ${value.title_main}` : "";
			section.innerHTML = `
                <div class="sb-section-header">
                    <div class="sb-section-heading">
                        <span class="sb-section-icon">📦</span>
                        <div>
                            <div class="sb-section-key">Type: <code>${key}</code><span>${typeTitle}</span></div>
                            <div class="sb-section-sub">Cấu hình các trường dữ liệu, SEO, hình ảnh và phân cấp danh mục</div>
                        </div>
                    </div>
                    <div class="sb-section-actions">
                        <button class="btn btn-ghost btn-sm sb-preset-btn" onclick="SchemaBuilder.showPresetMenu(event, '${key}')">⚡ Áp dụng Presets</button>
                        <button class="btn btn-danger btn-sm sb-delete-type-btn" onclick="UI.confirm('Bạn có chắc chắn muốn xóa toàn bộ Type này?').then(res => { if(res) { delete SchemaBuilder.currentData['${key}']; SchemaBuilder.renderForm(); } })">🗑️ Xóa Type</button>
                    </div>
                </div>
            `;

			const formBody = document.createElement("div");
			formBody.className = "sb-form-body";

			// 1. Group Logic
			const logicBox = this.createGroupWrapper(
				"⚙️ Logic & SEO",
				"logic",
				key,
			);
			const logicGrid = logicBox.querySelector(".sb-grid");
			const logicNested = logicBox.querySelector(".sb-nested-container");

			// 2. Group Standard
			const standardBox = this.createGroupWrapper(
				"📝 Nội dung & Thông tin",
				"standard",
				key,
			);
			const standardGrid = standardBox.querySelector(".sb-grid");
			const standardNested = standardBox.querySelector(
				".sb-nested-container",
			);

			// 3. Group Images
			const imageBox = this.createGroupWrapper(
				"🖼️ Hình ảnh & Gallery",
				"images",
				key,
			);
			const imageGrid = imageBox.querySelector(".sb-grid");
			const imageNested = imageBox.querySelector(".sb-nested-container");

			// 4. Categories
			const catBox = this.createGroupWrapper(
				"📂 Danh mục",
				"categories",
				key,
			);
			const catNested = catBox.querySelector(".sb-nested-container");

			// 5. Status & Options (Others)
			const otherBox = this.createGroupWrapper(
				"🛠️ Trạng thái & Tùy chọn khác",
				"others",
				key,
			);
			const otherNested = otherBox.querySelector(".sb-nested-container");

			// Render ALL fields based on Master Order (Full Frame)
			const allPossibleKeys = [...this.masterOrder];
			Object.keys(value).forEach((k) => {
				if (!allPossibleKeys.includes(k)) allPossibleKeys.push(k);
			});

			allPossibleKeys.forEach((fieldKey) => {
				// Fields to hide specifically for News & Static modules
				const isNews = this.currentFile.includes("news");
				const isStatic = this.currentFile.includes("static");
				const isNewsletters = this.currentFile.includes("newsletters");
				const isProduct = this.currentFile.includes("product");
				const isContent = isNews || isStatic || isNewsletters;

				let forbidden = [
					"comment",
					"code",
					"regular_price",
					"sale_price",
					"discount",
					"brand",
					"properties",
					"dropdown",
				];

				if (isProduct) {
					forbidden = forbidden.filter((f) => f !== "brand");
				}

				if (isStatic) {
					forbidden = [
						...forbidden,
						"slug",
						"copy",
						"schema",
						"view",
						"datePublish",
						"tags",
						"categories",
					];
				}

				if (isNewsletters) {
					forbidden = [
						...forbidden,
						"slug",
						"copy",
						"schema",
						"view",
						"datePublish",
						"tags",
						"categories",
						"images",
						"gallery",
						"status",
						"name",
						"desc",
						"desc_cke",
						"content",
						"content_cke",
						"desc_categories_cke",
						"content_categories_cke",
						"properties",
						"dropdown",
						"file",
						"comment",
						"email",
						"fullname",
						"phone",
						"address",
						"subject",
						"show_subject",
						"show_fullname",
						"show_phone",
						"dat-lich",
						"show_images",
						"show_images_categories",
						"show_images_brand",
						"options2",
					];
				}

				if (
					this.groups.hidden.includes(fieldKey) ||
					(isContent && forbidden.includes(fieldKey)) ||
					(fieldKey === "brand" && !isProduct)
				)
					return;

				// Full Frame logic:
				const forceManagers = [
					"gallery",
					"gallery_categories",
					"options2",
					"categories",
				];
				let fieldValue = value[fieldKey];

				if (fieldValue === undefined) {
					if (forceManagers.includes(fieldKey)) {
						fieldValue = {}; // Show manager UI with Add button
					} else if (this.MASTER_DEFAULTS.hasOwnProperty(fieldKey)) {
						fieldValue = this.MASTER_DEFAULTS[fieldKey];
					} else {
						return; // Skip unknown fields
					}
				}

				const path = [key, fieldKey];
				const isSimple =
					typeof fieldValue !== "object" || fieldValue === null;
				const el = this.renderField(fieldKey, fieldValue, path);
				if (!el) return;

				if (this.groups.logic.includes(fieldKey)) {
					if (isSimple) logicGrid.appendChild(el);
					else logicNested.appendChild(el);
				} else if (
					this.groups.standard.includes(fieldKey) ||
					fieldKey === "comment" ||
					fieldKey === "comments"
				) {
					if (isSimple) standardGrid.appendChild(el);
					else standardNested.appendChild(el);
				} else if (this.groups.images.includes(fieldKey)) {
					if (fieldKey === "show_images") {
						imageGrid.appendChild(el);
					} else {
						imageNested.appendChild(el);
					}
				} else if (this.groups.categories.includes(fieldKey)) {
					catNested.appendChild(el);
				} else {
					if (isSimple)
						otherBox.querySelector(".sb-grid").appendChild(el);
					else otherNested.appendChild(el);
				}
			});

			if (
				logicGrid.children.length > 0 ||
				logicNested.children.length > 0
			)
				formBody.appendChild(logicBox);
			if (
				standardGrid.children.length > 0 ||
				standardNested.children.length > 0
			)
				formBody.appendChild(standardBox);
			if (
				otherNested.children.length > 0 ||
				otherBox.querySelector(".sb-grid").children.length > 0
			)
				formBody.appendChild(otherBox);
			if (
				imageGrid.children.length > 0 ||
				imageNested.children.length > 0
			)
				formBody.appendChild(imageBox);
			if (catNested.children.length > 0) formBody.appendChild(catBox);

			section.appendChild(formBody);
			container.appendChild(section);
		} // close outer loop

		this.renderPreview();
		this.renderStructure();
	},

	sortObjectKeys(obj, order) {
		if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
		const sorted = {};
		// First, add keys that are in the master order
		order.forEach((key) => {
			if (key in obj) sorted[key] = obj[key];
		});
		// Then, add any remaining keys
		Object.keys(obj).forEach((key) => {
			if (!sorted.hasOwnProperty(key)) sorted[key] = obj[key];
		});
		return sorted;
	},

	createGroupWrapper(title, type, modKey) {
		const div = document.createElement("div");
		div.className = `sb-group-box sb-group-${type}`;

		div.innerHTML = `
            <div class="sb-group-head">
                <div class="sb-group-title">${title}</div>
                ${type === "standard" ? `<button class="btn btn-ghost btn-sm sb-add-opt-btn" onclick="SchemaBuilder.promptAddOption(event, '${modKey}', '${type}')">+ Thêm trường</button>` : ""}
            </div>
            <div class="sb-grid"></div>
            <div class="sb-nested-container"></div>
        `;
		return div;
	},

	renderPreview() {
		const pre = document.getElementById("sb-live-preview");
		if (pre && this.currentData) {
			// First reorder, then deep clean
			let cleanData = SchemaBuilder.reorderKeys(this.currentData);

			const deepClean = (obj) => {
				if (!obj || typeof obj !== "object" || Array.isArray(obj))
					return;
				if (obj.sync_with_main !== undefined) delete obj.sync_with_main;
				if (obj.brand === false) delete obj.brand;
				Object.values(obj).forEach((val) => deepClean(val));
			};
			deepClean(cleanData);

			pre.innerText = JSON.stringify(cleanData, null, 4);
		}
	},

	async toggleCategoryLevel(path, level, active) {
		const keys = path.split(".");
		let current = this.currentData;
		for (let i = 0; i < keys.length; i++) {
			current = current[keys[i]];
		}

		if (active) {
			const templates = {
				list: {
					title_main_categories: "Danh mục cấp 1",
					copy_categories: true,
					show_images_categories: true,
					images: {
						photo: {
							title: "anhdaidien",
							width: "500",
							height: "500",
							thumb: "500x500x1",
						},
					},
					slug_categories: true,
					status_categories: { hienthi: "hienthi" },
					name_categories: true,
					desc_categories: false,
					content_categories: true,
					content_categories_cke: true,
					seo_categories: true,
				},
				cat: {
					title_main_categories: "Danh mục cấp 2",
					copy_categories: true,
					show_images_categories: true,
					images: {
						photo: {
							title: "anhdaidien",
							width: "500",
							height: "500",
							thumb: "500x500x1",
						},
					},
					slug_categories: true,
					status_categories: { hienthi: "hienthi" },
					name_categories: true,
					desc_categories: false,
					content_categories: true,
					content_categories_cke: true,
					seo_categories: true,
				},
				item: {
					title_main_categories: "Danh mục cấp 3",
					copy_categories: true,
					show_images_categories: true,
					images: {
						photo: {
							title: "anhdaidien",
							width: "500",
							height: "500",
							thumb: "500x500x1",
						},
					},
					slug_categories: true,
					status_categories: { hienthi: "hienthi" },
					name_categories: true,
					desc_categories: false,
					content_categories: true,
					content_categories_cke: true,
					seo_categories: true,
				},
				sub: {
					title_main_categories: "Danh mục cấp 4",
					copy_categories: true,
					show_images_categories: true,
					images: {
						photo: {
							title: "anhdaidien",
							width: "500",
							height: "500",
							thumb: "500x500x1",
						},
					},
					slug_categories: true,
					status_categories: { hienthi: "hienthi" },
					name_categories: true,
					desc_categories: false,
					content_categories: true,
					content_categories_cke: true,
					seo_categories: true,
				},
			};
			current[level] = templates[level] || templates.list;
		} else {
			delete current[level];
		}
		this.renderForm();
	},

	updateData(path, value) {
		const keys = path.split(".");
		let current = this.currentData;
		for (let i = 0; i < keys.length - 1; i++) {
			const k = keys[i];
			if (!current[k] || typeof current[k] !== "object") {
				current[k] = {};
			}
			current = current[k];
		}
		const lastKey = keys[keys.length - 1];
		current[lastKey] = value;

		if (
			lastKey === "width" ||
			lastKey === "height" ||
			lastKey === "thumb"
		) {
			// Find the nearest gallery relative to this image
			const imgIdx = keys.indexOf("images");
			if (imgIdx !== -1) {
				const galleryPath = keys
					.slice(0, imgIdx)
					.concat("gallery")
					.join(".");
				this.syncGalleryToMain(galleryPath);
			}
			this.renderPreview();
		}
		// CONDITIONAL LOGIC: sync_with_main toggle
		else if (lastKey === "sync_with_main") {
			// If we are inside gallery, path is like ...gallery.albumName.sync_with_main
			const galIdx = keys.lastIndexOf("gallery");
			if (galIdx !== -1) {
				const galleryPath = keys.slice(0, galIdx + 1).join(".");
				if (value === true) this.syncGalleryToMain(galleryPath);
			}
			this.renderForm();
		}
		// CONDITIONAL LOGIC: title_main synchronization
		else if (lastKey === "title_main") {
			this.syncLabels();
			this.renderForm();
		}
		// CONDITIONAL LOGIC: slug master switch
		else if (lastKey === "slug") {
			const related = [
				"view",
				"datePublish",
				"schema",
				"seo",
				"content",
				"content_cke",
			];
			if (value === false) {
				related.forEach((k) => delete current[k]);
			} else {
				related.forEach((k) => {
					current[k] = true;
				});
			}
			this.renderForm();
		}
		// CONDITIONAL LOGIC: slug_categories switch
		else if (lastKey === "slug_categories") {
			if (value === false) {
				delete current["seo_categories"];
			} else {
				current["seo_categories"] = true;
			}
			this.renderForm();
		}
		// CONDITIONAL LOGIC: slug_brand switch
		else if (lastKey === "slug_brand") {
			if (value === false) {
				delete current["seo_brand"];
			} else {
				current["seo_brand"] = true;
			}
			this.renderForm();
		}
		// CONDITIONAL LOGIC: show_images switches (categories & brand)
		else if (
			lastKey === "show_images_categories" ||
			lastKey === "show_images_brand"
		) {
			if (value === false) {
				delete current["images"];
			} else {
				current["images"] = {
					photo: {
						title: "anhdaidien",
						width: "500",
						height: "500",
						thumb: "500x500x1",
					},
				};
			}
			this.renderForm();
		}
		// CONDITIONAL LOGIC: gallery toggle
		else if (lastKey === "gallery" || lastKey === "gallery_categories") {
			if (value === true) {
				current[lastKey] = {}; // Initialize as empty gallery manager
			} else {
				delete current[lastKey];
			}
			this.renderForm();
		}
		// CONDITIONAL LOGIC: options2 toggle
		else if (lastKey === "options2") {
			if (value === true) {
				current[lastKey] = {}; // Initialize as object manager
			} else {
				delete current[lastKey];
			}
			this.renderForm();
		}
		// CONDITIONAL LOGIC: show_images master switch
		else if (lastKey === "show_images") {
			if (value === false) {
				delete current.images;
				delete current.gallery;
			} else {
				const isProduct = this.currentFile && this.currentFile.includes("product");
				const defW = isProduct ? 800 : 400;
				const defH = isProduct ? 800 : 400;
				const defThumbW = isProduct ? 500 : defW;
				const defThumbH = isProduct ? 500 : defH;

				if (!current.images) {
					current.images = {
						photo: {
							title: "anhdaidien",
							width: defW,
							height: defH,
							thumb: `${defThumbW}x${defThumbH}x1`,
						},
					};
				}
				if (
					!current.gallery ||
					Object.keys(current.gallery).length === 0
				) {
					// Initialize a default gallery album if empty
					const gKey = this.currentActiveModule || "album";
					current.gallery = {
						[gKey]: {
							title_main_photo: "hinhanh",
							title_sub_photo: "hinhanh",
							status_photo: { hienthi: "hienthi" },
							number_photo: 5,
							images_photo: true,
							avatar_photo: true,
							name_photo: true,
							photo_width: defW,
							photo_height: defH,
							photo_thumb: `${defThumbW}x${defThumbH}x1`,
						},
					};
				}
			}
			this.renderForm();
		}
		// CONDITIONAL LOGIC: show_images_categories (levels)
		else if (lastKey === "show_images_categories") {
			if (value === false) {
				delete current.images;
			} else {
				if (!current.images) {
					// Categories always default to 400 regardless of file
					const defW = 400;
					const defH = 400;

					// Rebuild object to insert 'images' exactly after 'show_images_categories'
					const newObj = {};
					for (const [k, v] of Object.entries(current)) {
						newObj[k] = v;
						if (k === "show_images_categories") {
							newObj.images = {
								photo: {
									title: "anhdaidien",
									width: defW,
									height: defH,
									thumb: `${defW}x${defH}x1`,
								},
							};
						}
					}
					// Replace keys in current object
					for (const k in current) delete current[k];
					for (const k in newObj) current[k] = newObj[k];
				}
			}
			this.renderForm();
		}
		// CONDITIONAL LOGIC: show_images_brand (levels)
		else if (lastKey === "show_images_brand") {
			if (value === false) {
				delete current.images;
			} else {
				if (!current.images) {
					current.images = {
						photo: {
							title: "anhdaidien",
							width: "500",
							height: "500",
							thumb: "500x500x1",
						},
					};
				}
			}
			this.renderForm();
		} else {
			if (typeof value === "boolean") {
				this.renderForm();
			} else {
				this.renderPreview();
			}
		}
	},

	async applyPreset(type) {
		// Legacy support or global presets
		if (type === "news-slug" || type === "news-no-slug") {
			const confirmMsg =
				type === "news-slug"
					? "Bạn muốn áp dụng cấu hình 'Có Slug' (SEO, Schema, Slug) cho tất cả các nhóm tin tức?"
					: "Bạn muốn áp dụng cấu hình 'Không Slug' (Tắt SEO, Schema, Slug) cho tất cả các nhóm tin tức?";

			if (!await UI.confirm(confirmMsg)) return;

			for (const key in this.currentData) {
				this.applyPresetToModule(
					key,
					type === "news-slug" ? "standard_news" : "simple_news",
				);
			}

			this.renderForm();
			UI.notify("Đã áp dụng Preset thành công!", "success");
		}
	},

	showPresetMenu(event, moduleKey) {
		event.stopPropagation();
		const trigger = event.currentTarget;
		let menu = document.getElementById("sb-preset-menu");
		if (!menu) {
			menu = document.createElement("div");
			menu.id = "sb-preset-menu";
			menu.className = "action-menu";
			document.body.appendChild(menu);
		}

		// Guess category from file name
		let category = "news";
		if (this.currentFile.includes("product")) category = "products";
		if (this.currentFile.includes("photo")) category = "photos";

		let html =
			'<div style="padding:8px 12px; font-size:0.7rem; color:var(--muted); border-bottom:1px solid var(--border);">CHỌN CẤU HÌNH MẪU</div>';

		const categoryPresets = this.presets
			? this.presets[category] || {}
			: {};
		const otherPresets = {}; // Could add global presets here

		const allAvailable = { ...categoryPresets, ...otherPresets };

		if (Object.keys(allAvailable).length === 0) {
			html +=
				'<div style="padding:10px; font-size:0.8rem; color:var(--muted);">Không có mẫu nào.</div>';
		} else {
			for (const [id, preset] of Object.entries(allAvailable)) {
				html += `
                    <button class="action-menu-item" onclick="SchemaBuilder.applyPresetToModule('${moduleKey}', '${id}', '${category}'); SchemaBuilder.hidePresetMenu();">
                        ${preset.name}
                    </button>
                `;
			}
		}

		menu.innerHTML = html;
		menu.style.display = "block";

		const rect = trigger.getBoundingClientRect();
		menu.style.top = rect.bottom + window.scrollY + 5 + "px";
		menu.style.left = rect.right + window.scrollX - 200 + "px";
		menu.style.width = "200px";

		const closeMenu = (e) => {
			if (!menu.contains(e.target) && e.target !== trigger) {
				this.hidePresetMenu();
				document.removeEventListener("click", closeMenu);
			}
		};
		setTimeout(() => document.addEventListener("click", closeMenu), 10);
	},

	hidePresetMenu() {
		const menu = document.getElementById("sb-preset-menu");
		if (menu) menu.style.display = "none";
	},

	applyPresetToModule(moduleKey, presetId, category = null) {
		if (!this.currentData[moduleKey]) return;

		// Find preset
		let preset = null;
		if (
			category &&
			this.presets[category] &&
			this.presets[category][presetId]
		) {
			preset = this.presets[category][presetId];
		} else {
			// Search all categories
			for (const cat in this.presets) {
				if (this.presets[cat][presetId]) {
					preset = this.presets[cat][presetId];
					break;
				}
			}
		}

		if (!preset) {
			// Fallback for hardcoded news presets
			if (presetId === "standard_news") {
				const mod = this.currentData[moduleKey];
				mod.slug = true;
				mod.seo = true;
				mod.schema = true;
				mod.view = true;
				if (mod.website)
					mod.website.type = { index: "object", detail: "article" };
			} else if (presetId === "simple_news") {
				const mod = this.currentData[moduleKey];
				mod.slug = false;
				mod.seo = false;
				mod.schema = false;
				mod.view = false;
			}
		} else {
			// Deep merge preset.config into this.currentData[moduleKey]
			this.deepMerge(this.currentData[moduleKey], preset.config);
		}

		this.renderForm();
		UI.notify(`Đã áp dụng mẫu cho ${moduleKey}`, "success");
	},

	deepMerge(target, source) {
		for (const key in source) {
			if (
				source[key] !== null &&
				typeof source[key] === "object" &&
				!Array.isArray(source[key])
			) {
				if (!(key in target) || typeof target[key] !== "object")
					target[key] = {};
				this.deepMerge(target[key], source[key]);
			} else {
				target[key] = Array.isArray(source[key])
					? [...source[key]]
					: source[key];
			}
		}
		return target;
	},

	toggleGlobalLang(active) {
		this.adminLang = active;
		this.syncLabels();
		this.renderForm();
	},

	promptAddOption(event, modKey, groupType) {
		event.stopPropagation();
		const modal = document.getElementById("sb-add-opt-modal");
		const input = document.getElementById("sb-new-opt-key");
		const btn = document.getElementById("sb-btn-confirm-add");

		modal.style.display = "flex";
		input.value = "";
		input.focus();

		btn.onclick = () => this.confirmAddOption(modKey, groupType);
		input.onkeyup = (e) => {
			if (e.key === "Enter") this.confirmAddOption(modKey, groupType);
		};
	},

	confirmAddOption(modKey, groupType) {
		const input = document.getElementById("sb-new-opt-key");
		const key = input.value.trim();
		if (!key || !this.currentData[modKey]) return;

		// Default to true as requested, but handle objects like gallery
		let defaultValue =
			groupType === "logic" ||
			groupType === "images" ||
			groupType === "standard" ||
			key === "comment" ||
			key === "tags"
				? true
				: "";
		if (key === "gallery" || key === "gallery_categories") {
			defaultValue = {};
		}
		this.currentData[modKey][key] = defaultValue;

		if (key === "gallery" || key === "gallery_categories") {
			// Automatically prompt to add the first album using modal
			setTimeout(() => {
				this.promptAddAlbum(`${modKey}.${key}`);
			}, 100);
		}

		// Dynamically update masterOrder
		if (this.masterOrder) {
			let anchor = "name";
			if (key === "images") anchor = "show_images";
			else if (key === "gallery") anchor = "images";

			const index = this.masterOrder.indexOf(anchor);
			if (index !== -1) {
				this.masterOrder.splice(index + 1, 0, key);
			} else {
				this.masterOrder.push(key);
			}
		}

		document.getElementById("sb-add-opt-modal").style.display = "none";
		UI.notify(`Đã thêm trường [${key}] vào module [${modKey}]`, "success");
		this.renderForm();
	},

	promptAddAlbum(path) {
		const modal = document.getElementById("sb-add-album-modal");
		const inputName = document.getElementById("sb-album-name");
		const inputKey = document.getElementById("sb-album-key");
		const btn = document.getElementById("sb-btn-confirm-album");

		modal.style.display = "flex";
		inputName.value = "";
		inputKey.value = "";
		inputName.focus();

		// Auto-suggest key based on name
		inputName.oninput = (e) => {
			inputKey.value = e.target.value
				.toLowerCase()
				.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "")
				.replace(/đ/g, "d")
				.replace(/[^a-z0-9]/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, "");
		};

		btn.onclick = () => this.confirmAddAlbum(path);

		const handleKey = (e) => {
			if (e.key === "Enter") this.confirmAddAlbum(path);
		};
		inputName.onkeyup = handleKey;
		inputKey.onkeyup = handleKey;
	},

	confirmAddAlbum(path) {
		const name = document.getElementById("sb-album-name").value.trim();
		const key = document.getElementById("sb-album-key").value.trim();

		if (!name || !key) {
			UI.notify("Vui lòng nhập đầy đủ Tên và Key!", "error");
			return;
		}

		const newGallery = {
			title_main_photo: name,
			title_sub_photo: "hinhanh",
			status_photo: { hienthi: "hienthi" },
			number_photo: 3,
			images_photo: true,
			avatar_photo: true,
			name_photo: true,
			photo_width: 800,
			photo_height: 800,
			photo_thumb: "800x800x1",
		};

		this.updateData(path + "." + key, newGallery);
		document.getElementById("sb-add-album-modal").style.display = "none";
		this.renderForm();
		UI.notify(`Đã thêm album [${name}]`, "success");
	},

	async deleteOption(pathStr) {
		if (!await UI.confirm("Bạn có chắc muốn xóa trường này?")) return;
		const keys = pathStr.split(".");
		const lastKey = keys.pop();
		let current = this.currentData;
		for (const k of keys) current = current[k];

		if (lastKey === "brand") {
			current[lastKey] = false;
		} else {
			delete current[lastKey];
		}

		this.cleanupData();
		this.renderForm();
	},

	cleanupData() {
		if (!this.currentData) return;
		for (const modKey in this.currentData) {
			const mod = this.currentData[modKey];

			// Recursive cleaner function
			const clean = (obj) => {
				if (!obj || typeof obj !== "object") return;
				if (obj.sync_with_main !== undefined) delete obj.sync_with_main;
				if (obj.brand === false) delete obj.brand;
				Object.values(obj).forEach((val) => clean(val));
			};
			clean(mod);

			if (
				mod.gallery &&
				typeof mod.gallery === "object" &&
				Object.keys(mod.gallery).length === 0
			) {
				delete mod.gallery;
			}
			if (
				mod.gallery_categories &&
				typeof mod.gallery_categories === "object" &&
				Object.keys(mod.gallery_categories).length === 0
			) {
				delete mod.gallery_categories;
			}
		}
	},

	syncGalleryToMain(pathStr) {
		if (!pathStr) return;
		const keys = pathStr.split(".");
		let current = this.currentData;
		let parent = null;

		// Navigate to the level where 'gallery' sits
		for (let i = 0; i < keys.length - 1; i++) {
			parent = current[keys[i]];
			current = parent;
		}

		if (!parent) return;

		const gallery = current[keys[keys.length - 1]];
		if (!gallery || typeof gallery !== "object") return;

		// Find the main image settings for this context
		// Priority: images.photo -> images
		const mainImg = parent.images?.photo || parent.images;
		if (!mainImg || !mainImg.width) return;

		// Propagate dimensions to all synced gallery items
		for (const gKey in gallery) {
			const gall = gallery[gKey];
			if (gall.sync_with_main !== false) {
				gall.photo_width = mainImg.width;
				gall.photo_height = mainImg.height;

				// Extract scale from thumb string (e.g. 500x510x1 -> 1)
				const parts = (mainImg.thumb || "").split("x");
				const scale = parts.length > 2 ? parts[2] : 1;

				gall.photo_thumb = mainImg.thumb || `${mainImg.width}x${mainImg.height}x${scale}`;
			}
		}
	},

	syncLabels() {
		if (!this.currentData) return;
		const isLang = this.adminLang || false;

		for (const modKey in this.currentData) {
			const mod = this.currentData[modKey];
			const title = mod.title_main || "";

			if (mod.website) mod.website.title = title;
			if (mod.gallery) {
				const mainLabel = isLang ? "hinhanh" : "Hình ảnh ";
				for (const gKey in mod.gallery) {
					mod.gallery[gKey].title_main_photo = mainLabel + title;
				}
			}
		}
	},

	reorderKeys(obj) {
		if (obj === null || typeof obj !== "object" || Array.isArray(obj))
			return obj;

		const priorityMap = {
			title_main: 1,
			website: 1.1,
			amp: 1.2,
			route: 1.3,
			controller: 1.31,
			method: 1.32,
			slugs: 1.33,
			title_main_categories: 2,
			title_main_brand: 3,
			send_email: 5,
			type: 10,
			name: 20,
			name_categories: 21,
			name_brand: 22,
			slug: 30,
			slug_categories: 31,
			slug_brand: 32,
			seo: 33,
			seo_categories: 34,
			seo_brand: 35,
			show_images: 40,
			show_images_categories: 41,
			show_images_brand: 42,
			images: 43,
			gallery: 50,
			gallery_categories: 51,
			gallery_brand: 52,
			status: 60,
			status_categories: 61,
			status_brand: 62,
			copy_categories: 70,
			copy_brand: 71,
			desc: 80,
			desc_cke: 81,
			desc_categories: 82,
			desc_categories_cke: 83,
			desc_brand: 84,
			desc_brand_cke: 85,
			content: 90,
			content_categories: 91,
			content_brand: 92,
			content_cke: 93,
			content_categories_cke: 94,
			content_brand_cke: 95,
			options2: 96,
			hienthi: 1000,
			is_show: 1000,
		};

		const sorted = {};
		const keys = Object.keys(obj).sort((a, b) => {
			const pA = priorityMap[a] || 999;
			const pB = priorityMap[b] || 999;
			if (pA !== pB) return pA - pB;
			return Object.keys(obj).indexOf(a) - Object.keys(obj).indexOf(b);
		});

		for (const k of keys) {
			sorted[k] = SchemaBuilder.reorderKeys(obj[k]);
		}
		return sorted;
	},

	async save() {
		const btn =
			document.getElementById("sb-btn-save") ||
			document.getElementById("sb-btn-save-top") ||
			document.querySelector("#d_tab-schema .btn-primary") ||
			document.querySelector(".btn-primary");
		const originalText = btn ? btn.innerText : "💾 Lưu cấu hình";
		if (btn) {
			btn.innerText = "⌛ Đang lưu...";
			btn.disabled = true;
		}

		try {
			// Deep clone and reorder
			const finalData = SchemaBuilder.reorderKeys(this.currentData);

			const res = await (
				await fetch(`api.php?action=saveModuleSchema`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: this.currentProject,
						file: this.currentFile,
						config: finalData,
						category: App.currentCategory
					}),
				})
			).json();

			if (res.status === "success") {
				UI.notify("Đã lưu cấu hình Schema thành công!", "success");
			} else {
				UI.notify("Lỗi: " + res.message, "error");
			}
		} catch (err) {
			UI.notify("Không thể kết nối Api.", "error");
		} finally {
			if (btn) {
				btn.innerText = originalText;
				btn.disabled = false;
			}
		}
	},

	async initNewsSkeleton() {
		if (
			!await UI.confirm(
				"Bạn có muốn khởi tạo bộ khung chuẩn cho News (Tin tức, Thư viện ảnh, Tiêu chí)?",
			)
		)
			return;

		const modules = ["tin-tuc", "tieu-chi", "thu-vien-anh"];
		modules.forEach((m) => {
			if (!this.currentData[m]) {
				const preset = this.presets.news[m.replace(/-/g, "_")];
				if (preset) {
					const configData = preset.data || preset.config;
					if (configData) {
						this.currentData[m] = JSON.parse(
							JSON.stringify(configData),
						);
						this.currentData[m].title_main = preset.name;
					}
				}
			}
		});

		UI.notify("Đã khởi tạo bộ khung Tin tức!", "success");
		this.renderForm();
	},

	async initStaticSkeleton() {
		if (
			!await UI.confirm(
				"Bạn có muốn khởi tạo bộ khung chuẩn cho Trang tĩnh (Giới thiệu, Slogan, Footer)?",
			)
		)
			return;

		const modules = ["gioi-thieu", "slogan", "footer"];
		modules.forEach((m) => {
			if (!this.currentData[m]) {
				const preset = this.presets.static[m.replace(/-/g, "_")];
				if (preset) {
					const configData = preset.data || preset.config;
					if (configData) {
						this.currentData[m] = JSON.parse(
							JSON.stringify(configData),
						);
						this.currentData[m].title_main = preset.name;
					}
				}
			}
		});

		UI.notify("Đã khởi tạo bộ khung Trang tĩnh!", "success");
		this.renderForm();
	},

	async initNewslettersSkeleton() {
		if (
			!await UI.confirm(
				"Bạn có muốn khởi tạo bộ khung chuẩn cho Newsletters (Liên hệ, Đặt lịch)?",
			)
		)
			return;

		const modules = ["lien-he", "dat-lich"];
		modules.forEach((m) => {
			if (!this.currentData[m]) {
				const preset = this.presets.newsletters[m.replace(/-/g, "_")];
				if (preset) {
					const configData = preset.data || preset.config;
					if (configData) {
						this.currentData[m] = JSON.parse(
							JSON.stringify(configData),
						);
						this.currentData[m].title_main = preset.name;
					}
				} else if (m === "dat-lich") {
					// Hardcoded mandatory dat-lich if not in presets
					this.currentData[m] = {
						title_main: "datlich",
						file: true,
						send_email: true,
						email: true,
						fullname: true,
						phone: true,
						address: true,
						subject: true,
						show_subject: true,
						show_fullname: true,
						show_phone: false,
					};
				}
			}
		});

		UI.notify("Đã khởi tạo bộ khung Newsletters!", "success");
		this.renderForm();
	},
	switchTab(tab) {
		const preview = document.getElementById("sb-live-preview");
		const structure = document.getElementById("sb-structure-list");
		const btnPreview = document.getElementById("sb-tab-preview");
		const btnStructure = document.getElementById("sb-tab-structure");

		if (tab === "preview") {
			preview.style.display = "block";
			structure.style.display = "none";
			btnPreview.classList.add("active");
			btnPreview.style.borderBottom = "2px solid var(--primary)";
			btnStructure.classList.remove("active");
			btnStructure.style.borderBottom = "none";
		} else {
			preview.style.display = "none";
			structure.style.display = "block";
			btnPreview.classList.remove("active");
			btnPreview.style.borderBottom = "none";
			btnStructure.classList.add("active");
			btnStructure.style.borderBottom = "2px solid var(--primary)";
			this.renderStructure();
		}
	},

	renderStructure() {
		const container = document.getElementById("sb-structure-list");
		if (!container || !this.currentData) return;

		const keys = Object.keys(this.currentData).filter(
			(k) => k !== "brand" && k !== "default",
		);

		if (keys.length === 0) {
			container.innerHTML =
				'<div style="color:var(--muted); text-align:center;">Chưa có Type nào.</div>';
			return;
		}

		container.innerHTML = `
            <div style="margin-bottom:15px; font-size:0.8rem; color:var(--muted);">
                ✨ Kéo thả hoặc sử dụng mũi tên để sắp xếp thứ tự xuất hiện của các Type trong file.
            </div>
            <div id="sb-structure-items" style="display:flex; flex-direction:column; gap:8px;">
                ${keys
					.map(
						(k, index) => `
                    <div class="sb-structure-item" draggable="true" data-key="${k}" data-index="${index}">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div class="sb-drag-handle" title="Kéo để sắp xếp">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                            </div>
                            <span style="color:var(--muted); font-size:0.75rem; font-family:monospace; min-width:24px;">#${index + 1}</span>
                            <span style="font-weight:700; color:var(--primary); font-size:0.88rem;">${k}</span>
                            <span style="font-size:0.75rem; color:var(--muted);">(${this.currentData[k].title_main || "No Title"})</span>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button class="btn btn-ghost btn-sm" onclick="SchemaBuilder.moveModule('${k}', 'up')" ${index === 0 ? "disabled" : ""} style="padding:4px 9px;" title="Chuyển lên">↑</button>
                            <button class="btn btn-ghost btn-sm" onclick="SchemaBuilder.moveModule('${k}', 'down')" ${index === keys.length - 1 ? "disabled" : ""} style="padding:4px 9px;" title="Chuyển xuống">↓</button>
                        </div>
                    </div>
                `,
					)
					.join("")}
            </div>
        `;

		this.initStructureDragAndDrop();
	},

	initStructureDragAndDrop() {
		const container = document.getElementById("sb-structure-items");
		if (!container) return;

		const items = container.querySelectorAll(".sb-structure-item");
		let isDragging = false;
		let dragSource = null;
		let startY = 0;

		const clearHighlights = () => {
			items.forEach((i) => {
				i.classList.remove("dragging", "drag-over-top", "drag-over-bottom");
			});
		};

		// --- 1. HTML5 Native Drag & Drop ---
		items.forEach((item) => {
			item.addEventListener("dragstart", (e) => {
				dragSource = item;
				item.classList.add("dragging");
				e.dataTransfer.effectAllowed = "move";
				try {
					e.dataTransfer.setData("text/plain", item.dataset.key);
				} catch (_) {}
			});

			item.addEventListener("dragend", () => {
				clearHighlights();
				dragSource = null;
			});

			item.addEventListener("dragover", (e) => {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				if (!dragSource || dragSource === item) return;

				const rect = item.getBoundingClientRect();
				const midY = rect.top + rect.height / 2;
				if (e.clientY < midY) {
					item.classList.add("drag-over-top");
					item.classList.remove("drag-over-bottom");
				} else {
					item.classList.add("drag-over-bottom");
					item.classList.remove("drag-over-top");
				}
			});

			item.addEventListener("dragleave", (e) => {
				if (!item.contains(e.relatedTarget)) {
					item.classList.remove("drag-over-top", "drag-over-bottom");
				}
			});

			item.addEventListener("drop", (e) => {
				e.preventDefault();
				e.stopPropagation();
				if (!dragSource || dragSource === item) {
					clearHighlights();
					return;
				}

				const sourceKey = dragSource.dataset.key;
				const targetKey = item.dataset.key;
				const rect = item.getBoundingClientRect();
				const placeBefore = e.clientY < rect.top + rect.height / 2;
				clearHighlights();
				dragSource = null;

				SchemaBuilder.reorderModules(sourceKey, targetKey, placeBefore);
			});
		});

		// --- 2. Pointer Events Drag & Drop (100% tin cậy trên WebView2/Desktop) ---
		let currentTarget = null;
		let currentPlaceBefore = true;

		const onPointerMove = (e) => {
			if (!dragSource) return;

			const dist = Math.abs(e.clientY - startY);
			if (!isDragging && dist > 4) {
				isDragging = true;
				dragSource.classList.add("dragging");
				document.body.style.userSelect = "none";
				document.body.style.cursor = "grabbing";
			}

			if (!isDragging) return;

			// Tìm phần tử bên dưới con trỏ
			const elem = document.elementFromPoint(e.clientX, e.clientY);
			const targetItem = elem ? elem.closest("#sb-structure-items .sb-structure-item") : null;

			items.forEach((i) => i.classList.remove("drag-over-top", "drag-over-bottom"));

			if (targetItem && targetItem !== dragSource) {
				const rect = targetItem.getBoundingClientRect();
				currentPlaceBefore = e.clientY < rect.top + rect.height / 2;
				if (currentPlaceBefore) {
					targetItem.classList.add("drag-over-top");
				} else {
					targetItem.classList.add("drag-over-bottom");
				}
				currentTarget = targetItem;
			} else {
				currentTarget = null;
			}
		};

		const onPointerUp = (e) => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
			document.body.style.userSelect = "";
			document.body.style.cursor = "";

			if (isDragging && dragSource && currentTarget && dragSource !== currentTarget) {
				const sourceKey = dragSource.dataset.key;
				const targetKey = currentTarget.dataset.key;
				const placeBefore = currentPlaceBefore;
				clearHighlights();
				isDragging = false;
				dragSource = null;
				currentTarget = null;
				SchemaBuilder.reorderModules(sourceKey, targetKey, placeBefore);
			} else {
				clearHighlights();
				isDragging = false;
				dragSource = null;
				currentTarget = null;
			}
		};

		items.forEach((item) => {
			item.addEventListener("pointerdown", (e) => {
				// Không bắt sự kiện khi click vào nút ↑ hoặc ↓
				if (e.target.closest("button") || e.button !== 0) return;

				dragSource = item;
				startY = e.clientY;
				isDragging = false;
				currentTarget = null;

				window.addEventListener("pointermove", onPointerMove);
				window.addEventListener("pointerup", onPointerUp);
				window.addEventListener("pointercancel", onPointerUp);
			});
		});
	},

	reorderModules(sourceKey, targetKey, placeBefore) {
		const keys = Object.keys(this.currentData);
		const sourceIndex = keys.indexOf(sourceKey);
		if (sourceIndex === -1) return;

		// Remove source key
		keys.splice(sourceIndex, 1);

		// Find target index and insert
		const targetIndex = keys.indexOf(targetKey);
		if (targetIndex === -1) return;

		const insertIndex = placeBefore ? targetIndex : targetIndex + 1;
		keys.splice(insertIndex, 0, sourceKey);

		// Rebuild object
		const newData = {};
		keys.forEach((k) => {
			newData[k] = this.currentData[k];
		});

		this.currentData = newData;
		this.renderForm();
		this.renderStructure();
		UI.notify(`Đã cập nhật vị trí Type: ${sourceKey}`, "success");
	},

	moveModule(key, direction) {
		const keys = Object.keys(this.currentData);
		const index = keys.indexOf(key);
		if (index === -1) return;

		const newIndex = direction === "up" ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= keys.length) return;

		// Create a new object with reordered keys
		const newKeys = [...keys];
		[newKeys[index], newKeys[newIndex]] = [
			newKeys[newIndex],
			newKeys[index],
		];

		const newData = {};
		newKeys.forEach((k) => {
			newData[k] = this.currentData[k];
		});

		this.currentData = newData;
		this.renderForm();
		this.renderStructure();
		UI.notify(
			`Đã chuyển ${key} ${direction === "up" ? "lên" : "xuống"}`,
			"success",
		);
	},
};
