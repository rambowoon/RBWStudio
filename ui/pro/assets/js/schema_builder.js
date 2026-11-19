const DEFAULT_SCHEMA_PRESETS = {
	products: {
		san_pham: {
			name: "Mẫu Sản phẩm",
			config: {
				title_main: "sanpham",
				website: {
					type: { index: "object", detail: "article" },
					title: "sanpham",
					bre: "product",
				},
				copy: true,
				tags: false,
				slug: true,
				status: { noibat: "noibat", hienthi: "hienthi" },
				images: {
					photo: { title: "anhdaidien", width: 800, height: 800, thumb: "400x400x1" },
				},
				show_images: true,
				gallery: {
					"san-pham": {
						title_main_photo: "hinhanhsanpham",
						title_sub_photo: "hinhanh",
						status_photo: { hienthi: "hienthi" },
						number_photo: 3,
						images_photo: true,
						avatar_photo: true,
						name_photo: true,
						photo_width: 800,
						photo_height: 800,
						photo_thumb: "800x800x1",
					},
				},
				view: true,
				comment: false,
				properties: false,
				code: true,
				regular_price: true,
				sale_price: true,
				discount: true,
				datePublish: true,
				name: true,
				desc: true,
				desc_cke: true,
				content: true,
				content_cke: true,
				schema: true,
				seo: true,
				group: false,
				categories: {
					list: {
						title_main_categories: "danhmuccap1",
						images: {
							photo: { title: "anhdaidien", width: "500", height: "500", thumb: "500x500x1" },
						},
						copy_categories: true,
						show_images_categories: true,
						slug_categories: true,
						status_categories: { noibat: "noibat", hienthi: "hienthi" },
						name_categories: true,
						desc_categories: false,
						desc_categories_cke: false,
						content_categories: true,
						content_categories_cke: true,
						seo_categories: true,
					},
					cat: {
						title_main_categories: "danhmuccap2",
						images: {
							photo: { title: "anhdaidien", width: "500", height: "500", thumb: "500x500x1" },
						},
						copy_categories: true,
						show_images_categories: true,
						slug_categories: true,
						status_categories: { hienthi: "hienthi" },
						gallery_categories: {},
						name_categories: true,
						desc_categories: false,
						desc_categories_cke: false,
						content_categories: true,
						content_categories_cke: true,
						seo_categories: true,
					},
				},
			},
		},
		thuc_don: {
			name: "Mẫu Thực đơn",
			config: {
				title_main: "thucdon",
				website: {
					type: { index: "object", detail: "article" },
					title: "thucdon",
					bre: "product",
				},
				copy: true,
				tags: false,
				slug: true,
				status: { noibat: "noibat", hienthi: "hienthi" },
				images: {
					photo: { title: "anhdaidien", width: 800, height: 800, thumb: "400x400x1" },
				},
				show_images: true,
				gallery: {
					"san-pham": {
						title_main_photo: "hinhanhthucdon",
						title_sub_photo: "hinhanh",
						status_photo: { hienthi: "hienthi" },
						number_photo: 3,
						images_photo: true,
						avatar_photo: true,
						name_photo: true,
						photo_width: 800,
						photo_height: 800,
						photo_thumb: "800x800x1",
					},
				},
				view: true,
				comment: false,
				properties: false,
				code: false,
				regular_price: true,
				sale_price: true,
				discount: true,
				datePublish: true,
				name: true,
				desc: true,
				desc_cke: true,
				content: true,
				content_cke: true,
				schema: true,
				seo: true,
				group: false,
				categories: {
					list: {
						title_main_categories: "danhmuccap1",
						images: {
							photo: { title: "anhdaidien", width: "500", height: "500", thumb: "500x500x1" },
						},
						copy_categories: true,
						show_images_categories: true,
						slug_categories: true,
						status_categories: { hienthi: "hienthi" },
						name_categories: true,
						desc_categories: false,
						desc_categories_cke: false,
						content_categories: true,
						content_categories_cke: true,
						seo_categories: true,
					},
					cat: {
						title_main_categories: "danhmuccap2",
						images: {
							photo: { title: "anhdaidien", width: "500", height: "500", thumb: "500x500x1" },
						},
						copy_categories: true,
						show_images_categories: true,
						slug_categories: true,
						status_categories: { hienthi: "hienthi" },
						gallery_categories: {},
						name_categories: true,
						desc_categories: false,
						desc_categories_cke: false,
						content_categories: true,
						content_categories_cke: true,
						seo_categories: true,
					},
				},
			},
		},
	},
	news: {
		tin_tuc_full: {
			name: "tintuc",
			data: {
				title_main: "tintuc",
				website: {
					type: { index: "object", detail: "article" },
					title: "tintuc",
				},
				status: { hienthi: "hienthi" },
				slug: true,
				seo: true,
				schema: true,
				view: true,
				copy: true,
				datePublish: true,
				name: true,
				desc: true,
				content: true,
				content_cke: true,
				show_images: true,
				images: {
					photo: { title: "anhdaidien", width: 400, height: 270, thumb: "400x270x1" },
				},
			},
		},
		thu_vien_anh: {
			name: "thuvienanh",
			data: {
				title_main: "thuvienanh",
				website: {
					type: { index: "object", detail: "article" },
					title: "thuvienanh",
					view_page: "news.album",
				},
				status: { hienthi: "hienthi" },
				slug: false,
				show_images: true,
				images: {
					photo: { title: "anhdaidien", width: 500, height: 371, thumb: "500x371x1" },
				},
				gallery: {
					album: {
						title_main_photo: "hinhanh",
						title_sub_photo: "hinhanh",
						status_photo: { hienthi: "hienthi" },
						number_photo: 3,
						images_photo: true,
						avatar_photo: true,
						name_photo: true,
						width_photo: 500,
						height_photo: 371,
						thumb_photo: "500x371x1",
					},
				},
			},
		},
		tieu_chi: {
			name: "tieuchi",
			data: {
				title_main: "tieuchi",
				status: { hienthi: "hienthi" },
				show_images: true,
				images: {
					photo: { title: "anhdaidien", width: 50, height: 50, thumb: "50x50x2" },
				},
				name: true,
				desc: true,
			},
		},
	},
	static: {
		gioi_thieu: {
			name: "gioithieu",
			config: {
				title_main: "gioithieu",
				website: { type: "object", title: "gioithieu" },
				images: {
					photo: { title: "hinhanh", width: 533, height: 378, thumb: "533x378x1" },
				},
				show_images: true,
				status: { hienthi: "hienthi" },
				name: true,
				desc: true,
				desc_cke: false,
				content: true,
				content_cke: true,
				seo: true,
			},
		},
		slogan: {
			name: "slogan",
			config: {
				title_main: "slogan",
				name: true,
			},
		},
		footer: {
			name: "footer",
			config: {
				title_main: "footer",
				name: false,
				desc: false,
				desc_cke: false,
				content: true,
				content_cke: true,
			},
		},
	},
	newsletters: {
		lien_he: {
			name: "lienhe",
			config: {
				title_main: "lienhe",
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
			},
		},
		dat_lich: {
			name: "datlich",
			config: {
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
			},
		},
	},
	photos: {
		logo: {
			name: "Logo website",
			config: {
				title_main: "logo",
				kind: "static",
				title: true,
				desc: false,
				desc_cke: false,
				link: false,
				images: true,
				width: 195,
				height: 90,
				thumb: "195x90x2",
			},
		},
		favicon: {
			name: "Favicon",
			config: {
				title_main: "favicon",
				kind: "static",
				images: true,
				width: 48,
				height: 48,
				thumb: "48x48x1",
			},
		},
		slideshow: {
			name: "Slideshow / Banner",
			config: {
				title_main: "slideshow",
				kind: "album",
				status: { hienthi: "hienthi" },
				number: 5,
				images: true,
				show_images: true,
				gallery: true,
				link: true,
				name: true,
				desc: false,
				desc_cke: false,
				width: 1920,
				height: 800,
				thumb: "1920x800x1",
			},
		},
		doi_tac: {
			name: "Đối tác",
			config: {
				title_main: "doitac",
				kind: "album",
				status: { hienthi: "hienthi" },
				number: 5,
				images: true,
				show_images: true,
				gallery: true,
				link: true,
				name: true,
				width: 250,
				height: 160,
				thumb: "250x160x2",
			},
		},
		social: {
			name: "Mạng xã hội",
			config: {
				title_main: "mangxahoi",
				kind: "album",
				status: { hienthi: "hienthi" },
				number: 4,
				show_images: true,
				images: true,
				avatar: true,
				link: true,
				name: true,
				desc: false,
				width: 50,
				height: 50,
				thumb: "50x50x2",
			},
		},
	},
};

const SchemaBuilder = {
	...SchemaComponents,
	currentProject: null,
	currentFile: null,
	currentData: null,
	presets: null,

	async init(projectName) {
		const resolvedProj =
			projectName ||
			(typeof App !== "undefined" && (App.currentProjectName || App.currentProject)) ||
			document.getElementById("d_current-project")?.value ||
			document.getElementById("detail-project-name")?.innerText?.trim() ||
			"";
		this.currentProject = resolvedProj;
		const nameEl = document.getElementById("sb-project-name");
		if (nameEl) nameEl.innerText = `Dự án: ${resolvedProj}`;

		if (!this.presets) {
			await this.loadPresets();
		}

		// Load file list
		const res = await Api.getProjectSchemaList(resolvedProj);
		const standardFiles = [
			"type-products.php",
			"type-news.php",
			"type-static.php",
			"type-photo.php",
			"type-newsletters.php",
			"type-tags.php",
		];
		const rawFiles = res.status === "success" && Array.isArray(res.data) ? res.data : [];
		const mergedFiles = [...rawFiles];
		standardFiles.forEach((sf) => {
			if (!mergedFiles.includes(sf)) mergedFiles.push(sf);
		});

		const select = document.getElementById("sb-file-select");
		if (select) {
			select.innerHTML = mergedFiles
				.map((f) => {
					const existsTag = rawFiles.includes(f) ? "" : " (mẫu)";
					return `<option value="${f}">${f}${existsTag}</option>`;
				})
				.join("");
			if (mergedFiles.length > 0) {
				const defaultFile =
					mergedFiles.find((f) => f === "type-products.php") ||
					mergedFiles[0];
				select.value = defaultFile;
				this.loadSelectedFile();
			}
		}
		if (res.status !== "success" && rawFiles.length === 0) {
			UI.notify(res.message || "Không tìm thấy danh sách file Schema", "warning");
		}
	},

	async loadPresets() {
		const basePresets = JSON.parse(JSON.stringify(DEFAULT_SCHEMA_PRESETS));
		try {
			const res = await (
				await fetch("api.php?action=getSchemaPresets")
			).json();
			if (
				res &&
				res.status === "success" &&
				res.data &&
				!Array.isArray(res.data) &&
				typeof res.data === "object" &&
				Object.keys(res.data).length > 0
			) {
				this.deepMerge(basePresets, res.data);
			}
		} catch (e) {
			console.error("Failed to load presets from api, using built-in presets", e);
		}
		this.presets = basePresets;
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
                <span class="sb-create-toolbar-title" style="display:inline-flex;align-items:center;gap:6px">${fi("plus", 14)} Thêm Type / Module mới</span>
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
                    <button class="btn btn-primary" id="sb-type-add" style="display:inline-flex;align-items:center;gap:6px">${fi("sparkles", 14)} Tạo Type</button>
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
                        <span class="sb-type-tab-icon">${fi("box", 13)}</span>
                        <span class="sb-type-tab-key">${k}</span>
                    </button>`;
				})
				.join("");

			const showAllBtn =
				editableKeys.length > 1
					? `<button type="button" class="sb-type-tab sb-type-tab-all ${this.currentActiveModule === "__ALL__" ? "active" : ""}" data-type-key="__ALL__">
                        <span style="display:inline-flex;align-items:center;gap:5px">${fi("layers", 13)} Xem tất cả (${editableKeys.length})</span>
                       </button>`
					: "";

			summary.innerHTML = `
                <div class="sb-type-switcher-label">
                    <span style="display:inline-flex;align-items:center;gap:5px">${fi("layers", 13)} Đã có <b>${editableKeys.length}</b> Type:</span>
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
				`<div style="margin-bottom:10px;opacity:0.6">${fi("arrowUp", 28)}</div><p>File cấu hình đang trống. Vui lòng <b>Thêm mới</b> một type để bắt đầu.</p>`;

			if (this.currentFile.includes("newsletters")) {
				blankHtml += `<button class="btn btn-outline-warning btn-sm" style="display:inline-flex;align-items:center;gap:6px" onclick="SchemaBuilder.initNewslettersSkeleton()">${fi("sparkles", 13)} Khởi tạo bộ khung Newsletters chuẩn</button>`;
			} else if (this.currentFile.includes("news")) {
				blankHtml += `<button class="btn btn-outline-primary btn-sm" style="display:inline-flex;align-items:center;gap:6px" onclick="SchemaBuilder.initNewsSkeleton()">${fi("sparkles", 13)} Khởi tạo bộ khung Tin tức chuẩn</button>`;
			} else if (this.currentFile.includes("static")) {
				blankHtml += `<button class="btn btn-outline-info btn-sm" style="display:inline-flex;align-items:center;gap:6px" onclick="SchemaBuilder.initStaticSkeleton()">${fi("sparkles", 13)} Khởi tạo bộ khung Trang tĩnh chuẩn</button>`;
			} else if (this.currentFile.includes("product")) {
				blankHtml += `<button class="btn btn-outline-primary btn-sm" style="display:inline-flex;align-items:center;gap:6px" onclick="SchemaBuilder.initProductsSkeleton()">${fi("sparkles", 13)} Khởi tạo bộ khung Sản phẩm chuẩn</button>`;
			} else if (this.currentFile.includes("photo")) {
				blankHtml += `<button class="btn btn-outline-info btn-sm" style="display:inline-flex;align-items:center;gap:6px" onclick="SchemaBuilder.initPhotosSkeleton()">${fi("sparkles", 13)} Khởi tạo bộ khung Hình ảnh chuẩn</button>`;
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
                        <span class="sb-section-icon">${fi("box", 18)}</span>
                        <div>
                            <div class="sb-section-key">Type: <code>${key}</code><span>${typeTitle}</span></div>
                            <div class="sb-section-sub">Cấu hình các trường dữ liệu, SEO, hình ảnh và phân cấp danh mục</div>
                        </div>
                    </div>
                    <div class="sb-section-actions">
                        <button class="btn btn-ghost btn-sm sb-preset-btn" style="display:inline-flex;align-items:center;gap:5px" onclick="SchemaBuilder.showPresetMenu(event, '${key}')">${fi("zap", 13)} Áp dụng Presets</button>
                        <button class="btn btn-danger btn-sm sb-delete-type-btn" style="display:inline-flex;align-items:center;gap:5px" onclick="UI.confirm('Bạn có chắc chắn muốn xóa toàn bộ Type này?').then(res => { if(res) { delete SchemaBuilder.currentData['${key}']; SchemaBuilder.renderForm(); } })">${fi("trash", 13)} Xóa Type</button>
                    </div>
                </div>
            `;

			const formBody = document.createElement("div");
			formBody.className = "sb-form-body";

			// 1. Group Logic
			const logicBox = this.createGroupWrapper(
				`${fi("settings", 13)} Logic & SEO`,
				"logic",
				key,
			);
			const logicGrid = logicBox.querySelector(".sb-grid");
			const logicNested = logicBox.querySelector(".sb-nested-container");

			// 2. Group Standard
			const standardBox = this.createGroupWrapper(
				`${fi("edit", 13)} Nội dung & Thông tin`,
				"standard",
				key,
			);
			const standardGrid = standardBox.querySelector(".sb-grid");
			const standardNested = standardBox.querySelector(
				".sb-nested-container",
			);

			// 3. Group Images
			const imageBox = this.createGroupWrapper(
				`${fi("image", 13)} Hình ảnh & Gallery`,
				"images",
				key,
			);
			const imageGrid = imageBox.querySelector(".sb-grid");
			const imageNested = imageBox.querySelector(".sb-nested-container");

			// 4. Categories
			const catBox = this.createGroupWrapper(
				`${fi("folderOpen", 13)} Danh mục`,
				"categories",
				key,
			);
			const catNested = catBox.querySelector(".sb-nested-container");

			// 5. Status & Options (Others)
			const otherBox = this.createGroupWrapper(
				`${fi("sliders", 13)} Trạng thái & Tùy chọn khác`,
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
			let cleanData = SchemaBuilder.reorderKeys(this.currentData, "root");

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
		const cf = (this.currentFile || "").toLowerCase();
		if (cf.includes("product")) category = "products";
		else if (cf.includes("photo")) category = "photos";
		else if (cf.includes("static")) category = "static";
		else if (cf.includes("newsletter")) category = "newsletters";

		let html =
			'<div style="padding:8px 12px; font-size:0.7rem; color:var(--muted); border-bottom:1px solid var(--border);">CHỌN CẤU HÌNH MẪU</div>';

		const categoryPresets = this.presets
			? this.presets[category] || {}
			: {};
		const otherPresets = {};
		if (this.presets) {
			for (const [grpKey, grpObj] of Object.entries(this.presets)) {
				if (grpKey !== category && grpObj && typeof grpObj === "object") {
					for (const [id, p] of Object.entries(grpObj)) {
						otherPresets[`${grpKey}.${id}`] = {
							...p,
							_cat: grpKey,
							_id: id,
							_label: `${p.name} (${grpKey})`,
						};
					}
				}
			}
		}

		if (Object.keys(categoryPresets).length === 0 && Object.keys(otherPresets).length === 0) {
			html +=
				'<div style="padding:10px; font-size:0.8rem; color:var(--muted);">Không có mẫu nào.</div>';
		} else {
			for (const [id, preset] of Object.entries(categoryPresets)) {
				html += `
                    <button class="action-menu-item" onclick="SchemaBuilder.applyPresetToModule('${moduleKey}', '${id}', '${category}'); SchemaBuilder.hidePresetMenu();">
                        ${preset.name}
                    </button>
                `;
			}
			if (Object.keys(otherPresets).length > 0) {
				html += '<div style="padding:6px 12px; font-size:0.65rem; color:var(--muted); border-top:1px solid var(--border); margin-top:4px;">MẪU NHÓM KHÁC</div>';
				for (const item of Object.values(otherPresets)) {
					html += `
                    <button class="action-menu-item" onclick="SchemaBuilder.applyPresetToModule('${moduleKey}', '${item._id}', '${item._cat}'); SchemaBuilder.hidePresetMenu();">
                        ${item._label}
                    </button>
                `;
				}
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
			// Deep merge preset.config or preset.data into this.currentData[moduleKey]
			const cfg = preset.config || preset.data || {};
			this.deepMerge(this.currentData[moduleKey], JSON.parse(JSON.stringify(cfg)));
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

	reorderKeys(obj, context = "root") {
		if (Array.isArray(obj)) {
			return obj.map((item) => SchemaBuilder.reorderKeys(item, context));
		}
		if (obj === null || typeof obj !== "object") {
			return obj;
		}

		const originalKeys = Object.keys(obj);
		let sortedKeys;

		if (context === "root") {
			// Preserve user's Type order; always keep hinh-thuc-thanh-toan at the end
			sortedKeys = originalKeys.slice().sort((a, b) => {
				if (a === "hinh-thuc-thanh-toan" && b !== "hinh-thuc-thanh-toan") return 1;
				if (b === "hinh-thuc-thanh-toan" && a !== "hinh-thuc-thanh-toan") return -1;
				return originalKeys.indexOf(a) - originalKeys.indexOf(b);
			});
			const sorted = {};
			for (const k of sortedKeys) {
				sorted[k] = SchemaBuilder.reorderKeys(obj[k], "module");
			}
			return sorted;
		}

		if (context === "images") {
			const sorted = {};
			for (const k of originalKeys) {
				sorted[k] = SchemaBuilder.reorderKeys(obj[k], "imageItem");
			}
			return sorted;
		}

		if (context === "gallery") {
			const sorted = {};
			for (const k of originalKeys) {
				sorted[k] = SchemaBuilder.reorderKeys(obj[k], "galleryItem");
			}
			return sorted;
		}

		const priorityMaps = {
			categories: {
				list: 1,
				cat: 2,
				item: 3,
				sub: 4,
			},
			imageItem: {
				title: 1,
				width: 2,
				height: 3,
				thumb: 4,
			},
			galleryItem: {
				title_main_photo: 1,
				title_sub_photo: 2,
				status_photo: 3,
				number_photo: 4,
				images_photo: 5,
				avatar_photo: 6,
				name_photo: 7,
				photo_width: 8,
				photo_height: 9,
				photo_thumb: 10,
				width_photo: 11,
				height_photo: 12,
				thumb_photo: 13,
			},
			website: {
				type: 1,
				title: 2,
				bre: 3,
				view_page: 4,
				amp: 5,
				route: 6,
			},
			websiteType: {
				index: 1,
				detail: 2,
			},
			status: {
				noibat: 1,
				moi: 2,
				banchay: 3,
				hienthi: 1000,
				is_show: 1000,
			},
			module: {
				title_main: 1,
				title_main_categories: 2,
				title_main_brand: 3,
				website: 4,
				amp: 4.1,
				route: 4.2,
				controller: 4.3,
				method: 4.4,
				slugs: 4.5,
				send_email: 5,
				type: 6,
				copy: 10,
				copy_categories: 11,
				copy_brand: 12,
				tags: 15,
				slug: 20,
				slug_categories: 21,
				slug_brand: 22,
				status: 25,
				status_categories: 26,
				status_brand: 27,
				show_images: 30,
				show_images_categories: 31,
				show_images_brand: 32,
				images: 35,
				gallery: 40,
				gallery_categories: 41,
				gallery_brand: 42,
				view: 45,
				comment: 46,
				properties: 47,
				code: 48,
				regular_price: 49,
				sale_price: 50,
				discount: 51,
				datePublish: 52,
				name: 55,
				name_categories: 56,
				name_brand: 57,
				desc: 60,
				desc_cke: 61,
				desc_categories: 62,
				desc_categories_cke: 63,
				desc_brand: 64,
				desc_brand_cke: 65,
				content: 70,
				content_cke: 71,
				content_categories: 72,
				content_categories_cke: 73,
				content_brand: 74,
				content_brand_cke: 75,
				schema: 80,
				seo: 85,
				seo_categories: 86,
				seo_brand: 87,
				group: 90,
				categories: 92,
				brand: 94,
				options2: 96,
				hienthi: 1000,
				is_show: 1000,
			},
		};

		const priorityMap = priorityMaps[context] || priorityMaps.module;
		sortedKeys = originalKeys.slice().sort((a, b) => {
			const pA = priorityMap[a] ?? 500;
			const pB = priorityMap[b] ?? 500;
			if (pA !== pB) return pA - pB;
			return originalKeys.indexOf(a) - originalKeys.indexOf(b);
		});

		const getChildContext = (parentCtx, key) => {
			if (parentCtx === "categories") return "module";
			if (parentCtx === "website" && key === "type") return "websiteType";
			if (parentCtx === "galleryItem" && key === "status_photo") return "status";
			if (key === "categories") return "categories";
			if (key === "images") return "images";
			if (key === "gallery" || key === "gallery_categories" || key === "gallery_brand") return "gallery";
			if (key === "website") return "website";
			if (key === "status" || key === "status_categories" || key === "status_brand" || key === "status_photo") return "status";
			if (key === "brand" || key === "group") return "module";
			return "module";
		};

		const sorted = {};
		for (const k of sortedKeys) {
			sorted[k] = SchemaBuilder.reorderKeys(obj[k], getChildContext(context, k));
		}
		return sorted;
	},

	async save() {
		const btn =
			document.getElementById("sb-btn-save") ||
			document.getElementById("sb-btn-save-top") ||
			document.querySelector("#d_tab-schema .btn-primary") ||
			document.querySelector(".btn-primary");
		const originalHtml = btn ? btn.innerHTML : `${fi("save", 14)} Lưu cấu hình`;
		if (btn) {
			btn.innerHTML = `${fi("loader", 14)} Đang lưu...`;
			btn.disabled = true;
		}

		try {
			// Deep clone and reorder
			const finalData = SchemaBuilder.reorderKeys(this.currentData, "root");

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
				if (typeof SeedManager !== "undefined") SeedManager._typesCache = {};
				if (typeof AutoMediaManager !== "undefined") AutoMediaManager._cache = {};
				UI.notify("Đã lưu cấu hình Schema thành công!", "success");
			} else {
				UI.notify("Lỗi: " + res.message, "error");
			}
		} catch (err) {
			UI.notify("Không thể kết nối Api.", "error");
		} finally {
			if (btn) {
				btn.innerHTML = originalHtml;
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
				const newsPresets = (this.presets && this.presets.news) || {};
				const pKey = m.replace(/-/g, "_");
				const preset =
					newsPresets[pKey] ||
					(m === "tin-tuc" ? newsPresets.tin_tuc_full : null);
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

	async initProductsSkeleton() {
		if (
			!await UI.confirm(
				"Bạn có muốn khởi tạo bộ khung chuẩn cho Sản phẩm (san-pham)?",
			)
		)
			return;

		const prodPresets = (this.presets && this.presets.products) || {};
		const preset = prodPresets.san_pham;
		if (preset && !this.currentData["san-pham"]) {
			const configData = preset.config || preset.data;
			if (configData) {
				this.currentData["san-pham"] = JSON.parse(JSON.stringify(configData));
			}
		}

		UI.notify("Đã khởi tạo bộ khung Sản phẩm!", "success");
		this.renderForm();
	},

	async initPhotosSkeleton() {
		if (
			!await UI.confirm(
				"Bạn có muốn khởi tạo bộ khung chuẩn cho Hình ảnh (Logo, Favicon, Slideshow, Đối tác, Mạng xã hội)?",
			)
		)
			return;

		const photoPresets = (this.presets && this.presets.photos) || {};
		const mapping = [
			["logo", "logo"],
			["favicon", "favicon"],
			["slideshow", "slideshow"],
			["doi-tac", "doi_tac"],
			["social", "social"],
		];
		mapping.forEach(([modKey, pKey]) => {
			if (!this.currentData[modKey] && photoPresets[pKey]) {
				const cfg = photoPresets[pKey].config || photoPresets[pKey].data;
				if (cfg) {
					this.currentData[modKey] = JSON.parse(JSON.stringify(cfg));
				}
			}
		});

		UI.notify("Đã khởi tạo bộ khung Hình ảnh!", "success");
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
            <div style="margin-bottom:15px; font-size:0.8rem; color:var(--muted); display:flex; align-items:center; gap:6px;">
                ${fi("sparkles", 13)} <span>Kéo thả hoặc sử dụng mũi tên để sắp xếp thứ tự xuất hiện của các Type trong file.</span>
            </div>
            <div id="sb-structure-items" style="display:flex; flex-direction:column; gap:8px;">
                ${keys
					.map(
						(k, index) => `
                    <div class="sb-structure-item" data-key="${k}" data-index="${index}">
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

		let dragSource = null;
		let isDragging = false;
		let startY = 0;
		let currentTarget = null;
		let currentPlaceBefore = true;

		const getItems = () => container.querySelectorAll(".sb-structure-item");

		const clearHighlights = () => {
			getItems().forEach((i) => {
				i.classList.remove("dragging", "drag-over-top", "drag-over-bottom");
			});
		};

		const onPointerMove = (e) => {
			if (!dragSource) return;

			const dist = Math.abs(e.clientY - startY);
			if (!isDragging && dist > 3) {
				isDragging = true;
				dragSource.classList.add("dragging");
				dragSource.style.pointerEvents = "none"; // Tránh cản trở elementFromPoint nhận diện item đích
				document.body.style.userSelect = "none";
				document.body.style.cursor = "grabbing";
			}

			if (!isDragging) return;

			// Xóa highlight cũ
			getItems().forEach((i) => i.classList.remove("drag-over-top", "drag-over-bottom"));

			// Tìm phần tử bên dưới con trỏ
			const elem = document.elementFromPoint(e.clientX, e.clientY);
			const targetItem = elem ? elem.closest("#sb-structure-items .sb-structure-item") : null;

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

			if (dragSource) {
				dragSource.style.pointerEvents = "";
			}

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

		getItems().forEach((item) => {
			item.onpointerdown = (e) => {
				// Không kích hoạt khi bấm nút mũi tên hoặc không phải chuột trái
				if (e.target.closest("button") || e.button !== 0) return;

				dragSource = item;
				startY = e.clientY;
				isDragging = false;
				currentTarget = null;

				window.addEventListener("pointermove", onPointerMove);
				window.addEventListener("pointerup", onPointerUp);
				window.addEventListener("pointercancel", onPointerUp);
			};
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
