const SchemaComponents = {
	FIELD_META: {
		slug: { icon: "🔗", title: "Đường dẫn (Slug)" },
		seo: { icon: "🔍", title: "Cấu hình SEO" },
		schema: { icon: "📊", title: "Schema JSON-LD" },
		copy: { icon: "📋", title: "Cho phép Copy" },
		view: { icon: "👁️", title: "Lượt xem (View)" },
		datePublish: { icon: "📅", title: "Ngày xuất bản" },
		tags: { icon: "🏷️", title: "Thẻ Tags" },
		comment: { icon: "💬", title: "Bình luận" },
		code: { icon: "🔢", title: "Mã SP (Code)" },
		regular_price: { icon: "💰", title: "Giá gốc" },
		sale_price: { icon: "🔥", title: "Giá khuyến mãi" },
		discount: { icon: "🏷️", title: "% Giảm giá" },
		name: { icon: "✏️", title: "Tiêu đề (Name)" },
		desc: { icon: "📄", title: "Mô tả ngắn" },
		desc_cke: { icon: "✨", title: "Soạn thảo Mô tả (CKE)" },
		content: { icon: "📝", title: "Nội dung chi tiết" },
		content_cke: { icon: "✨", title: "Soạn thảo Nội dung (CKE)" },
		show_images: { icon: "🖼️", title: "Sử dụng Hình ảnh" },
		properties: { icon: "🧩", title: "Thuộc tính (Properties)" },
		file: { icon: "📎", title: "Tập tin đính kèm" },
		send_email: { icon: "✉️", title: "Gửi Email" },
		amp: { icon: "⚡", title: "Trang AMP" },
		title_main: { icon: "🏷️", title: "Tiêu đề Module chính" },
		index: { icon: "🌐", title: "Loại trang danh sách" },
		detail: { icon: "📄", title: "Loại trang chi tiết" },
		title: { icon: "🔤", title: "Tiêu đề (Lang key)" },
		bre: { icon: "🧭", title: "Breadcrumb key" },
		controller: { icon: "⚙️", title: "Controller xử lý" },
		method: { icon: "📡", title: "Phương thức HTTP" },
		vi: { icon: "🇻🇳", title: "Slug Tiếng Việt" },
		en: { icon: "🇬🇧", title: "Slug Tiếng Anh" },
	},

	getFieldMeta(fieldKey) {
		const baseKey = fieldKey
			.replace(/(_categories_cke|_brand_cke)$/, "_cke")
			.replace(/(_categories|_brand|_photo)$/, "");
		const found = this.FIELD_META[fieldKey] || this.FIELD_META[baseKey];
		if (found) return found;
		const cleanLabel = baseKey.replace(/_/g, " ").toUpperCase();
		return { icon: "🔹", title: cleanLabel };
	},

	renderField(fieldKey, fieldValue, currentPath) {
		const type = typeof fieldValue;
		if (type === "boolean") {
			return this.createToggle(fieldKey, fieldValue, currentPath);
		} else if (type === "string" || type === "number") {
			return this.createInput(fieldKey, fieldValue, currentPath);
		} else if (type === "object" && fieldValue !== null) {
			return this.createNestedSection(fieldKey, fieldValue, currentPath);
		}
		return document.createElement("div");
	},

	createToggle(fieldKey, value, path) {
		const div = document.createElement("div");
		div.className = `sb-field sb-field-toggle ${value ? "is-checked" : ""}`;
		const id = "field-" + path.join("-");
		const meta = this.getFieldMeta(fieldKey);

		div.innerHTML = `
            <label class="sb-label" for="${id}">
                <span class="sb-field-icon">${meta.icon}</span>
                <span class="sb-field-texts">
                    <span class="sb-field-title">${meta.title}</span>
                    <span class="sb-field-code">${fieldKey}</span>
                </span>
            </label>
            <div class="sb-field-actions">
                <button type="button" class="btn-del-opt" title="Xóa thuộc tính ${fieldKey}" onclick="SchemaBuilder.deleteOption('${path.join(".")}')">×</button>
                <label class="sb-switch">
                    <input type="checkbox" id="${id}" ${value ? "checked" : ""} onchange="this.closest('.sb-field-toggle')?.classList.toggle('is-checked', this.checked); SchemaBuilder.updateData('${path.join(".")}', this.checked)">
                    <span class="sb-slider"></span>
                </label>
            </div>
        `;
		return div;
	},

	createInput(fieldKey, value, path) {
		const div = document.createElement("div");
		div.className = "sb-field sb-field-input";
		const id = "field-" + path.join("-");
		const meta = this.getFieldMeta(fieldKey);

		div.innerHTML = `
            <div class="sb-input-head">
                <label class="sb-label" for="${id}">
                    <span class="sb-field-icon-sm">${meta.icon}</span>
                    <span class="sb-field-title">${meta.title}</span>
                    <span class="sb-field-code">${fieldKey}</span>
                </label>
                <button type="button" class="btn-del-opt" title="Xóa thuộc tính ${fieldKey}" onclick="SchemaBuilder.deleteOption('${path.join(".")}')">×</button>
            </div>
            <input type="text" id="${id}" class="form-control sb-text-input" value="${value}" onchange="SchemaBuilder.updateData('${path.join(".")}', this.value)">
        `;
		return div;
	},

	createNestedSection(key, data, path) {
		if (key === "categories") {
			return this.createCategoryManager(key, data, path);
		}

		if (
			key === "gallery" ||
			key === "gallery_categories" ||
			key === "gallery_brand"
		) {
			return this.createGalleryManager(key, data, path);
		}

		if (
			key === "images" ||
			key === "images_categories" ||
			key === "images_brand"
		) {
			return this.createImagesManager(key, data, path);
		}

		const isImg =
			data.width !== undefined &&
			data.height !== undefined &&
			data.thumb !== undefined;
		const isGalleryImg =
			data.photo_width !== undefined &&
			data.photo_height !== undefined &&
			data.photo_thumb !== undefined;

		if (isImg || isGalleryImg) {
			return this.createImageEditor(key, data, path, isGalleryImg);
		}

		if (
			key === "status" ||
			key === "status_categories" ||
			key === "status_brand" ||
			key === "status_photo"
		) {
			return this.createStatusEditor(key, data, path);
		}

		if (key === "options2") {
			return this.createOptions2Editor(key, data, path);
		}

		const nestedTitles = {
			website: "🌐 Cấu hình Website & Định tuyến",
			type: "📑 Loại hiển thị (Object / Article)",
			route: "🛣️ Cấu hình Route",
			slugs: "🔗 Đường dẫn đa ngôn ngữ (Slugs)",
		};
		const displayNestedTitle = nestedTitles[key] || `📁 ${key.toUpperCase()}`;

		const div = document.createElement("div");
		div.className = `sb-nested sb-nested-${key}`;

		const headEl = document.createElement("div");
		headEl.className = "sb-nested-head";
		headEl.innerHTML = `<span class="sb-nested-title">${displayNestedTitle}</span>`;

		const headActions = document.createElement("div");
		headActions.className = "sb-nested-actions";

		if (key === "website") {
			if (data.amp === undefined) {
				const btnAmp = document.createElement("button");
				btnAmp.type = "button";
				btnAmp.className = "btn btn-ghost btn-sm sb-quick-add-btn";
				btnAmp.innerText = "+ AMP";
				btnAmp.onclick = () => {
					SchemaBuilder.updateData(path.join(".") + ".amp", true);
					SchemaBuilder.renderForm();
				};
				headActions.appendChild(btnAmp);
			}

			if (data.route === undefined) {
				const btnRoute = document.createElement("button");
				btnRoute.type = "button";
				btnRoute.className = "btn btn-ghost btn-sm sb-quick-add-btn";
				btnRoute.innerText = "+ Route";
				btnRoute.onclick = () => {
					SchemaBuilder.updateData(path.join(".") + ".route", {
						controller: "Controller@index",
						name: "route_name",
						method: "get",
						slugs: { vi: "slug-vi" },
					});
					SchemaBuilder.renderForm();
				};
				headActions.appendChild(btnRoute);
			}
		}

		const delBtn = document.createElement("button");
		delBtn.type = "button";
		delBtn.className = "btn-del-opt";
		delBtn.title = `Xóa mục ${key}`;
		delBtn.innerText = "×";
		delBtn.onclick = () => SchemaBuilder.deleteOption(path.join("."));
		headActions.appendChild(delBtn);

		headEl.appendChild(headActions);
		div.appendChild(headEl);

		const subGrid = document.createElement("div");
		subGrid.className = "sb-grid";
		const subNested = document.createElement("div");
		subNested.className = "sb-nested-container";

		if (key === "website") {
			subNested.style.display = "grid";
			subNested.style.gridTemplateColumns = "repeat(auto-fit, minmax(260px, 1fr))";
			subNested.style.gap = "12px";
			subNested.style.alignItems = "start";
		}

		for (const [fieldKey, fieldValue] of Object.entries(data)) {
			const el = this.renderField(fieldKey, fieldValue, [
				...path,
				fieldKey,
			]);
			if (typeof fieldValue !== "object" || fieldValue === null) {
				subGrid.appendChild(el);
			} else {
				subNested.appendChild(el);
			}
		}

		div.appendChild(subGrid);
		div.appendChild(subNested);
		return div;
	},

	createImageEditor(key, data, path, isGallery = false, hideTitle = false) {
		const div = document.createElement("div");
		div.className = "sb-nested sb-image-editor";
		const reallyGallery = isGallery || path.includes("gallery");
		const isSync = reallyGallery && data.sync_with_main !== false;

		div.innerHTML = `
            ${
				hideTitle
					? ""
					: `
            <div class="sb-section-title" style="justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:8px; margin:-5px -5px 15px -5px;">
                <span>🖼️ ${reallyGallery ? "Gallery Image" : "Image"}: ${key}</span>
                <button class="btn-del-opt" onclick="SchemaBuilder.deleteOption('${path.join(".")}')">×</button>
            </div>`
			}
            ${
				reallyGallery
					? `
            <div style="display:flex; align-items:center; gap:10px; background:rgba(16, 185, 129, 0.1); padding:6px 12px; border-radius:10px; border:1px solid rgba(16, 185, 129, 0.2); margin-bottom:15px;">
                <div style="flex:1;">
                    <div style="font-size:0.65rem; color:#10b981; font-weight:800; letter-spacing:0.5px;">🔗 ĐỒNG BỘ KÍCH THƯỚC</div>
                    <div style="font-size:0.6rem; color:rgba(16, 185, 129, 0.7);">Tự động lấy thông số từ ảnh chính</div>
                </div>
                <label class="sb-switch">
                    <input type="checkbox" ${isSync ? "checked" : ""} onchange="SchemaBuilder.updateData('${path.join(".")}.sync_with_main', this.checked)">
                    <span class="sb-slider"></span>
                </label>
            </div>`
					: ""
			}
        `;

		if (isSync) {
			const info = document.createElement("div");
			info.className = "alert alert-success";
			info.style.fontSize = "0.75rem";
			info.style.marginTop = "10px";
			info.innerHTML = "✨ Đang đồng bộ thông số từ ảnh chính...";
			div.appendChild(info);
			return div;
		}

		const prefix = reallyGallery ? "photo_" : "";
		const grid = document.createElement("div");
		grid.style.display = "grid";
		grid.style.gridTemplateColumns = "1.2fr 1.5fr 0.8fr";
		grid.style.gap = "10px";
		grid.style.marginTop = "10px";

		// Dynamically find which keys are present (photo_width vs width_photo vs width)
		let keyW = prefix + "width";
		let keyH = prefix + "height";
		let keyT = prefix + "thumb";

		if (data["width_photo"] !== undefined) {
			keyW = "width_photo";
			keyH = "height_photo";
			keyT = "thumb_photo";
		} else if (data["width"] !== undefined) {
			keyW = "width";
			keyH = "height";
			keyT = "thumb";
		}

		const w = data[keyW] || 800;
		const h = data[keyH] || 800;
		const tParts = (data[keyT] || "").split("x");
		const currentS = tParts.length > 2 ? tParts[2] : 1;

		// Simple ratio calculation (using GCD to simplify if possible)
		const getGCD = (a, b) => (b === 0 ? a : getGCD(b, a % b));
		const common = getGCD(w, h);
		const currentRw = w / common;
		const currentRh = h / common;

		const inputW = document.createElement("div");
		inputW.className = "form-group";
		inputW.innerHTML = `<label style="font-size:0.6rem; color:var(--muted); text-transform:uppercase; margin-bottom:5px; display:block;">Width (Default 800)</label><input type="number" class="form-control sb-img-w" data-key="${keyW}" value="${w}" style="height:32px; font-size:0.8rem;">`;

		const inputRatio = document.createElement("div");
		inputRatio.className = "form-group";
		inputRatio.innerHTML = `
            <label style="font-size:0.6rem; color:var(--muted); text-transform:uppercase; margin-bottom:5px; display:block;">Ratio (W:H)</label>
            <div style="display:flex; align-items:center; gap:5px;">
                <input type="number" class="form-control sb-img-rw" value="${currentRw}" style="height:32px; font-size:0.8rem; padding:5px;">
                <span>:</span>
                <input type="number" class="form-control sb-img-rh" value="${currentRh}" style="height:32px; font-size:0.8rem; padding:5px;">
            </div>
        `;

		const inputScale = document.createElement("div");
		inputScale.className = "form-group";
		inputScale.innerHTML = `<label style="font-size:0.6rem; color:var(--muted); text-transform:uppercase; margin-bottom:5px; display:block;">Scale</label><input type="number" step="0.1" class="form-control sb-img-s" value="${currentS}" style="height:32px; font-size:0.8rem;">`;

		grid.appendChild(inputW);
		grid.appendChild(inputRatio);
		grid.appendChild(inputScale);
		div.appendChild(grid);

		const autoSizeWrap = document.createElement("div");
		autoSizeWrap.style.marginTop = "10px";
		autoSizeWrap.innerHTML = `
            <button type="button" class="btn btn-primary sb-auto-size-btn" style="height:34px; font-size:0.78rem; padding:0 14px; font-weight:700; border-color:var(--success); background:linear-gradient(135deg, rgba(16,185,129,0.95), rgba(14,165,233,0.9)); color:#fff; box-shadow:0 6px 18px rgba(16,185,129,0.35);">
                Tự động lấy size theo type
            </button>
        `;
		div.appendChild(autoSizeWrap);

		const getCurrentFile = () =>
			(
				this.currentFile ||
				(typeof SchemaBuilder !== "undefined"
					? SchemaBuilder.currentFile
					: "") ||
				""
			).toLowerCase();
		const checkIsProduct = () => {
			const cf = getCurrentFile();
			return (
				/(^|[\\/])type-products?\.php$/.test(cf) ||
				cf.includes("product") ||
				(path &&
					path.length &&
					(path[0] === "san-pham" || path.includes("products")))
			);
		};

		const isInitialProduct = checkIsProduct();
		const initialThumbW = isInitialProduct ? Math.min(w, 500) : w;
		const initialThumbH = Math.round(
			(initialThumbW * currentRh) / currentRw,
		);
		const defaultThumb = `${initialThumbW}x${initialThumbH}x${currentS}`;
		const displayThumb = data[keyT] || defaultThumb;

		const resultInfo = document.createElement("div");
		resultInfo.style.marginTop = "15px";
		resultInfo.style.fontSize = "0.75rem";
		resultInfo.style.color = "var(--muted)";
		resultInfo.innerHTML = `Result: <b class="res-dim" style="color:var(--primary);">${w} × ${h}</b> | Thumb: <b class="res-thumb" style="color:var(--primary); cursor:pointer;" title="Nhấp để tùy chỉnh kích thước Thumb nếu cần">${displayThumb}</b>`;
		div.appendChild(resultInfo);

		const thumbEl = resultInfo.querySelector(".res-thumb");
		if (thumbEl) {
			thumbEl.onclick = () => {
				const currentVal = thumbEl.innerText;
				const inputVal = prompt(
					"Nhập kích thước Thumb (W x H x Scale, ví dụ: 500x510x1):",
					currentVal,
				);
				if (inputVal && inputVal.trim()) {
					const trimmed = inputVal.trim();
					thumbEl.innerText = trimmed;
					SchemaBuilder.updateData(
						`${path.join(".")}.${keyT}`,
						trimmed,
					);
				}
			};
		}

		// Event listeners for automatic calculation
		const updateRes = () => {
			const nw = parseInt(inputW.querySelector("input").value) || 0;
			const rw =
				parseFloat(inputRatio.querySelectorAll("input")[0].value) || 1;
			const rh =
				parseFloat(inputRatio.querySelectorAll("input")[1].value) || 1;
			const sc = parseFloat(inputScale.querySelector("input").value) || 1;

			const nh = Math.round((nw * rh) / rw);

			// Trong type-products, thumb mặc định chiều rộng tối đa là 500px, tính chiều cao theo tỉ lệ (không kéo chung 800 với photo)
			const isProduct = checkIsProduct();
			const thumbW = isProduct ? Math.min(nw, 500) : nw;
			const thumbH = Math.round((thumbW * rh) / rw);
			const nt = `${thumbW}x${thumbH}x${sc}`;

			resultInfo.querySelector(".res-dim").innerText = `${nw} × ${nh}`;
			resultInfo.querySelector(".res-thumb").innerText = nt;

			// Update actual data
			SchemaBuilder.updateData(`${path.join(".")}.${keyW}`, nw);
			SchemaBuilder.updateData(`${path.join(".")}.${keyH}`, nh);
			SchemaBuilder.updateData(`${path.join(".")}.${keyT}`, nt);
		};

		inputW.querySelector("input").onchange = updateRes;
		inputRatio
			.querySelectorAll("input")
			.forEach((i) => (i.onchange = updateRes));
		inputScale.querySelector("input").onchange = updateRes;

		const autoBtn = autoSizeWrap.querySelector(".sb-auto-size-btn");
		autoBtn.onclick = async () => {
			const baseType = path && path.length ? path[0] : "";
			if (!this.currentProject || !baseType) {
				UI.notify(
					"Không xác định được project/type để lấy kích thước",
					"error",
				);
				return;
			}
			const inCategories =
				path.includes("categories") ||
				path.includes("gallery_categories") ||
				path.includes("images_categories");
			const inBrand =
				path.includes("brand") ||
				path.includes("gallery_brand") ||
				path.includes("images_brand");
			let typeKey = baseType;
			if (inBrand) typeKey = `brand-${baseType}`;
			else if (inCategories) typeKey = `list-${baseType}`;

			autoBtn.disabled = true;
			autoBtn.textContent = "Đang đọc kích thước...";
			try {
				const res = await Api.getTypeImageSize(
					this.currentProject,
					typeKey,
				);
				if (res.status !== "success" || !res.data) {
					UI.notify(
						res.message ||
							`Không tìm thấy ảnh ${typeKey}.* trong assets/images/images`,
						"error",
					);
					return;
				}

				const newW = parseInt(res.data.width, 10) || 0;
				const newH = parseInt(res.data.height, 10) || 0;
				if (!newW || !newH) {
					UI.notify(
						"Ảnh tìm thấy không có kích thước hợp lệ",
						"error",
					);
					return;
				}

				const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
				const common2 = gcd(newW, newH);
				const ratioW = Math.max(1, Math.round(newW / common2));
				const ratioH = Math.max(1, Math.round(newH / common2));
				const isProductsTypeFile = checkIsProduct();
				const defaultWidthLimit =
					inCategories || inBrand
						? 500
						: isProductsTypeFile
							? 800
							: 400;
				const appliedW =
					newW > defaultWidthLimit ? newW : defaultWidthLimit;

				inputW.querySelector("input").value = appliedW;
				inputRatio.querySelectorAll("input")[0].value = ratioW;
				inputRatio.querySelectorAll("input")[1].value = ratioH;
				updateRes();

				UI.notify(
					`Đã lấy size ${newW}x${newH} từ ${res.data.file}`,
					"success",
				);
			} catch (e) {
				UI.notify("Lỗi khi lấy kích thước ảnh theo type", "error");
			} finally {
				autoBtn.disabled = false;
				autoBtn.textContent = "Tự động lấy size theo type";
			}
		};

		return div;
	},

	createStatusEditor(key, data, path) {
		const div = document.createElement("div");
		div.className = "sb-nested";
		div.innerHTML = `<div class="sb-section-title" style="font-size:0.8rem; color:var(--success); display:flex; justify-content:space-between; align-items:center;">
            <span>⚡ Status Flags (${key})</span>
            <span style="font-size:0.68rem; color:var(--muted); font-weight:normal;">Key (DB/Code) ➔ Value (Label/Lang)</span>
        </div>`;

		const getTargetObj = () => {
			let curr = this.currentData;
			for (let i = 0; i < path.length; i++) {
				if (!curr || typeof curr !== "object") return data;
				curr = curr[path[i]];
			}
			return curr && typeof curr === "object" ? curr : data;
		};

		const container = document.createElement("div");
		container.style.display = "flex";
		container.style.flexDirection = "column";
		container.style.gap = "6px";
		container.style.marginBottom = "10px";

		const escapeAttr = (str) =>
			String(str ?? "")
				.replace(/&/g, "&amp;")
				.replace(/"/g, "&quot;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");

		const renderTags = () => {
			container.innerHTML = "";
			const targetObj = getTargetObj();
			Object.entries(targetObj).forEach(([stKey, stVal]) => {
				const row = document.createElement("div");
				row.style.display = "flex";
				row.style.alignItems = "center";
				row.style.gap = "6px";
				row.style.background = "rgba(16, 185, 129, 0.08)";
				row.style.border = "1px solid rgba(16, 185, 129, 0.25)";
				row.style.borderRadius = "6px";
				row.style.padding = "4px 8px";

				row.innerHTML = `
                    <input type="text" class="form-control sb-status-key" value="${escapeAttr(stKey)}" title="Status Key (lưu DB / cột)" placeholder="Key" style="height:26px; font-size:0.78rem; padding:2px 8px; flex:1; min-width:90px; font-family:monospace; color:var(--success); font-weight:600;">
                    <span style="color:var(--muted); font-size:0.75rem; user-select:none;">=></span>
                    <input type="text" class="form-control sb-status-val" value="${escapeAttr(stVal)}" title="Status Value (hiển thị / lang)" placeholder="Value" style="height:26px; font-size:0.78rem; padding:2px 8px; flex:1; min-width:90px;">
                    <button type="button" class="btn-del-opt" title="Xóa status này" style="margin-left:2px;">×</button>
                `;

				const keyInput = row.querySelector(".sb-status-key");
				const valInput = row.querySelector(".sb-status-val");
				const delBtn = row.querySelector(".btn-del-opt");

				keyInput.onchange = () => {
					const newKey = keyInput.value.trim();
					const obj = getTargetObj();
					if (!newKey) {
						keyInput.value = stKey;
						return;
					}
					if (newKey === stKey) return;

					const entries = Object.entries(obj);
					Object.keys(obj).forEach((k) => delete obj[k]);
					entries.forEach(([k, v]) => {
						if (k === stKey) {
							obj[newKey] = valInput.value.trim() || v;
						} else if (k !== newKey) {
							obj[k] = v;
						}
					});
					if (
						typeof SchemaBuilder !== "undefined" &&
						SchemaBuilder.renderPreview
					) {
						SchemaBuilder.renderPreview();
					}
					renderTags();
				};

				valInput.onchange = () => {
					const newVal = valInput.value.trim();
					const obj = getTargetObj();
					obj[stKey] = newVal;
					if (
						typeof SchemaBuilder !== "undefined" &&
						SchemaBuilder.renderPreview
					) {
						SchemaBuilder.renderPreview();
					}
				};

				delBtn.onclick = () => {
					const obj = getTargetObj();
					delete obj[stKey];
					if (
						typeof SchemaBuilder !== "undefined" &&
						SchemaBuilder.renderPreview
					) {
						SchemaBuilder.renderPreview();
					}
					renderTags();
				};

				container.appendChild(row);
			});
		};

		const addRow = document.createElement("div");
		addRow.style.display = "flex";
		addRow.style.gap = "6px";
		addRow.style.alignItems = "center";
		addRow.innerHTML = `
            <input type="text" class="form-control sb-new-status-key" placeholder="Key (vd: is_featured)" style="height:30px; font-size:0.78rem; flex:1; font-family:monospace;">
            <span style="color:var(--muted); font-size:0.75rem;">=></span>
            <input type="text" class="form-control sb-new-status-val" placeholder="Value (vd: noibat)" style="height:30px; font-size:0.78rem; flex:1;">
            <button type="button" class="btn btn-primary" style="padding:0 12px; height:30px; white-space:nowrap;">+ Add</button>
        `;

		const newKeyInput = addRow.querySelector(".sb-new-status-key");
		const newValInput = addRow.querySelector(".sb-new-status-val");
		const addBtn = addRow.querySelector("button");

		const defaultStatusValueMap = {
			is_show: "hienthi",
			is_featured: "noibat",
			hienthi: "hienthi",
			noibat: "noibat",
			moi: "moi",
			banchay: "banchay",
		};

		newKeyInput.oninput = () => {
			const k = newKeyInput.value.trim();
			if (!newValInput.dataset.touched) {
				newValInput.value = defaultStatusValueMap[k] || k;
			}
		};
		newValInput.oninput = () => {
			newValInput.dataset.touched =
				newValInput.value.trim() !== "" ? "1" : "";
		};

		const handleAddStatus = () => {
			const k = newKeyInput.value.trim();
			if (!k) return;
			const v = newValInput.value.trim() || defaultStatusValueMap[k] || k;
			this.updateData(path.join(".") + "." + k, v);
			newKeyInput.value = "";
			newValInput.value = "";
			delete newValInput.dataset.touched;
			if (
				typeof SchemaBuilder !== "undefined" &&
				SchemaBuilder.renderPreview
			) {
				SchemaBuilder.renderPreview();
			}
			renderTags();
		};

		addBtn.onclick = handleAddStatus;
		newKeyInput.onkeydown = (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				handleAddStatus();
			}
		};
		newValInput.onkeydown = (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				handleAddStatus();
			}
		};

		renderTags();
		div.appendChild(container);
		div.appendChild(addRow);
		return div;
	},

	createGalleryManager(key, data, path) {
		const div = document.createElement("div");
		div.className = "sb-nested";

		// Improve title based on path (check if it's a category)
		let displayTitle = `📸 Gallery Manager: ${key}`;
		if (key === "gallery" || key === "gallery_categories") {
			if (path.includes("list"))
				displayTitle = `📸 Gallery: Danh mục cấp 1`;
			else if (path.includes("cat"))
				displayTitle = `📸 Gallery: Danh mục cấp 2`;
			else if (path.includes("item"))
				displayTitle = `📸 Gallery: Danh mục cấp 3`;
			else if (path.includes("sub"))
				displayTitle = `📸 Gallery: Danh mục cấp 4`;
			else if (path.includes("brand"))
				displayTitle = `📸 Gallery: Danh mục Hãng`;
		}

		div.innerHTML = `<div class="sb-section-title" style="font-size:0.8rem; color:var(--success);"><span>${displayTitle}</span></div>`;

		const container = document.createElement("div");
		container.style.display = "flex";
		container.style.flexDirection = "column";
		container.style.gap = "15px";

		Object.entries(data).forEach(([gKey, gVal]) => {
			if (typeof gVal !== "object" || gVal === null) return;

			const box = document.createElement("div");
			box.className = "sb-album-box";

			box.innerHTML = `<div class="sb-album-head">
                <span style="display:flex; align-items:center; gap:8px;">🖼️ Album: <code class="sb-code-pill">${gKey}</code></span>
                <button type="button" class="btn-del-opt" onclick="SchemaBuilder.deleteOption('${path.join(".")}.${gKey}')">×</button>
            </div>`;

			// Integrate Image Dimension Editor with Sync logic
			const imgFields = [
				"photo_width",
				"photo_height",
				"photo_thumb",
				"width_photo",
				"height_photo",
				"thumb_photo",
				"width",
				"height",
				"thumb",
				"sync_with_main",
			];
			const hiddenFields = [
				"title_sub_photo",
				"status_photo",
				"number_photo",
				"images_photo",
				"avatar_photo",
				"name_photo",
				"title_main_photo",
			];
			const skipFields = [...imgFields, ...hiddenFields];

			const hasImg =
				gVal.photo_width !== undefined ||
				gVal.width_photo !== undefined ||
				gVal.width !== undefined;
			if (hasImg) {
				const imgEditor = this.createImageEditor(
					gKey,
					gVal,
					[...path, gKey],
					true,
					true,
				);
				box.appendChild(imgEditor);
			}

			const grid = document.createElement("div");
			grid.className = "sb-grid";
			const nested = document.createElement("div");
			nested.className = "sb-nested-container";

			Object.entries(gVal).forEach(([fKey, fVal]) => {
				if (skipFields.includes(fKey)) return;
				const childPath = [...path, gKey, fKey];
				const el = this.renderField(fKey, fVal, childPath);
				if (typeof fVal !== "object" || fVal === null) {
					grid.appendChild(el);
				} else {
					nested.appendChild(el);
				}
			});

			box.appendChild(grid);
			box.appendChild(nested);
			container.appendChild(box);
		});

		div.appendChild(container);

		// Only show Add Button for main module or Category Level 1 (list)
		const isSubLevel =
			path.includes("cat") ||
			path.includes("item") ||
			path.includes("sub") ||
			path.includes("brand");
		if (!isSubLevel) {
			const addBtn = document.createElement("button");
			addBtn.className = "btn btn-ghost btn-sm";
			addBtn.style.marginTop = "15px";
			addBtn.innerText = "+ Thêm Album mới";
			addBtn.onclick = () => {
				this.promptAddAlbum(path.join("."));
			};
			div.appendChild(addBtn);
		}

		return div;
	},

	createCategoryManager(key, data, path) {
		const div = document.createElement("div");
		div.className = "sb-nested sb-cat-manager";

		div.innerHTML = `<div class="sb-nested-head">
            <span class="sb-nested-title" style="color:#8b5cf6;">📂 QUẢN LÝ PHÂN CẤP DANH MỤC</span>
        </div>`;

		let levels = [
			{ id: "list", name: "Danh mục cấp 1 (list)", color: "#8b5cf6" },
			{ id: "cat", name: "Danh mục cấp 2 (cat)", color: "#7c3aed" },
			{ id: "item", name: "Danh mục cấp 3 (item)", color: "#6d28d9" },
			{ id: "sub", name: "Danh mục cấp 4 (sub)", color: "#5b21b6" },
			{ id: "brand", name: "Danh mục Hãng (brand)", color: "#ec4899" },
		];

		if (
			SchemaBuilder.currentFile &&
			(SchemaBuilder.currentFile.includes("news") ||
				SchemaBuilder.currentFile.includes("static"))
		) {
			levels = levels.filter((lv) => lv.id !== "brand");
		}

		const container = document.createElement("div");
		container.style.display = "flex";
		container.style.flexDirection = "column";
		container.style.gap = "16px";

		levels.forEach((lv) => {
			const isBrand = lv.id === "brand";
			const lvData = isBrand
				? this.currentData[path[0]].brand
				: data[lv.id];
			if (!lvData || typeof lvData !== "object") return;

			const box = document.createElement("div");
			box.className = "sb-cat-level-box";
			box.style.borderColor = lv.color;

			const delPath = isBrand
				? `${path[0]}.brand`
				: `${path.join(".")}.${lv.id}`;
			box.innerHTML = `<div class="sb-cat-level-head" style="color:${lv.color};">
                <span>📂 ${lv.name}</span>
                <button type="button" class="btn-del-opt" onclick="SchemaBuilder.deleteOption('${delPath}')">×</button>
            </div>`;

			const standardGrid = document.createElement("div");
			standardGrid.className = "sb-grid";

			const nestedContainer = document.createElement("div");
			nestedContainer.className = "sb-nested-container";

			// Full Frame logic for category levels (Synchronized with masterOrder)
			const levelOrder = [
				"slug_categories",
				"seo_categories",
				"slug_brand",
				"seo_brand",
				"show_images_categories",
				"show_images_brand",
				"images",
				"gallery",
				"brand",
			];

			// Merge existing keys with order to ensure everything is rendered
			const allFKeys = [...levelOrder];
			Object.keys(lvData).forEach((k) => {
				if (!allFKeys.includes(k)) allFKeys.push(k);
			});

			allFKeys.forEach((fKey) => {
				let fVal = lvData[fKey];

				// Skip missing fields
				if (fVal === undefined) return;

				if (
					fKey === "title_main_categories" ||
					fKey === "title_main_brand"
				)
					return;

				if (fKey === "images") {
					const show = isBrand
						? lvData.show_images_brand
						: lvData.show_images_categories;
					// In Full Frame, we show it anyway if it's there
				}

				const childPath = isBrand
					? [path[0], "brand", fKey]
					: [...path, lv.id, fKey];
				const el = this.renderField(fKey, fVal, childPath);
				if (!el) return;

				if (typeof fVal !== "object" || fVal === null) {
					standardGrid.appendChild(el);
				} else {
					nestedContainer.appendChild(el);
				}
			});

			box.appendChild(standardGrid);
			box.appendChild(nestedContainer);
			container.appendChild(box);
		});

		const addBar = document.createElement("div");
		addBar.style.display = "flex";
		addBar.style.gap = "10px";
		addBar.style.marginTop = "20px";
		levels.forEach((lv) => {
			const isBrand = lv.id === "brand";
			const exists = isBrand
				? this.currentData[path[0]].brand &&
					typeof this.currentData[path[0]].brand === "object"
				: !!data[lv.id];

			if (!exists) {
				const b = document.createElement("button");
				b.className = "btn btn-ghost btn-sm";
				b.innerText = `+ ${lv.id.toUpperCase()}`;
				b.onclick = () => {
					const suffix = isBrand ? "_brand" : "_categories";
					const newObj = {};
					newObj[`title_main${suffix}`] = lv.name;
					newObj[`images`] = {
						photo: {
							title: "anhdaidien",
							width: "500",
							height: "500",
							thumb: "500x500x1",
						},
					};
					newObj[`copy${suffix}`] = isBrand ? false : true;
					newObj[`show_images${suffix}`] = true;
					newObj[`slug${suffix}`] = true;
					newObj[`status${suffix}`] = { hienthi: "hienthi" };
					newObj[`name${suffix}`] = true;
					newObj[`desc${suffix}`] = isBrand ? true : false;
					newObj[`content${suffix}`] = isBrand ? false : true;
					newObj[`content${suffix}_cke`] = isBrand ? false : true;
					newObj[`seo${suffix}`] = true;

					const targetPath = isBrand
						? `${path[0]}.brand`
						: `${path.join(".")}.${lv.id}`;
					this.updateData(targetPath, newObj);
					this.renderForm();
				};
				addBar.appendChild(b);
			}
		});

		div.appendChild(container);
		div.appendChild(addBar);
		return div;
	},

	createOptions2Editor(key, data, path) {
		const div = document.createElement("div");
		div.className = "sb-nested";
		div.innerHTML = `<div class="sb-section-title" style="font-size:0.8rem; color:var(--purple);"><span>🛠️ Options2 Manager: ${key}</span></div>`;

		const table = document.createElement("table");
		table.style.width = "100%";
		table.style.fontSize = "0.75rem";
		table.style.borderCollapse = "collapse";
		table.innerHTML = `
            <thead>
                <tr style="text-align:left; color:var(--muted); border-bottom:1px solid var(--border);">
                    <th style="padding:5px;">Key</th>
                    <th style="padding:5px;">Title</th>
                    <th style="padding:5px;">Type</th>
                    <th style="padding:5px;">Lang</th>
                    <th style="padding:5px; text-align:right;">Action</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

		const tbody = table.querySelector("tbody");
		if (data) {
			for (const [optKey, optVal] of Object.entries(data)) {
				const tr = document.createElement("tr");
				tr.style.borderBottom = "1px solid rgba(255,255,255,0.03)";
				tr.innerHTML = `
                <td style="padding:5px;"><code>${optKey}</code></td>
                <td style="padding:5px;">${optVal.title}</td>
                <td style="padding:5px;"><span class="sb-type-badge">${optVal.type}</span></td>
                <td style="padding:5px;">
                    <label class="sb-switch" style="transform: scale(0.7); margin: 0;">
                        <input type="checkbox" onchange="SchemaBuilder.updateData('${path.join(".")}.${optKey}.lang', this.checked)" ${optVal.lang ? "checked" : ""}>
                        <span class="sb-slider"></span>
                    </label>
                </td>
                <td style="padding:5px; text-align:right;">
                    <button class="btn btn-ghost" style="padding:2px 5px; color:var(--danger);" onclick="SchemaBuilder.deleteOption('${path.join(".")}.${optKey}')">Delete</button>
                </td>
            `;
				tbody.appendChild(tr);
			}
		}

		const addRow = document.createElement("div");
		addRow.style.display = "grid";
		addRow.style.gridTemplateColumns = "1.2fr 1.5fr 1fr auto auto";
		addRow.style.gap = "5px";
		addRow.style.marginTop = "10px";
		addRow.innerHTML = `
            <input type="text" placeholder="key" class="form-control opt-key" style="height:28px; font-size:0.7rem;">
            <input type="text" placeholder="Title" class="form-control opt-title" style="height:28px; font-size:0.7rem;">
            <select class="form-control opt-type" style="height:28px; font-size:0.7rem; padding:2px;">
                <option value="mp4">Video (MP4)</option>
                <option value="file">File (PDF/DOC)</option>
                <option value="code">Code</option>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="color">Color</option>
                <option value="date">Date</option>
                <option value="time">Time</option>
                <option value="datetime">Date Time</option>
                <option value="localdatetime">Local Date Time</option>
            </select>
            <label style="display:flex; align-items:center; font-size:0.7rem; color:var(--muted);"><input type="checkbox" class="opt-lang" style="margin-right:5px;"> Lang</label>
            <button class="btn btn-primary" style="height:28px; padding:0 10px;">+</button>
        `;

		addRow.querySelector("button").onclick = () => {
			const k = addRow.querySelector(".opt-key").value.trim();
			const t = addRow.querySelector(".opt-title").value.trim();
			const ty = addRow.querySelector(".opt-type").value;
			const langChecked = addRow.querySelector(".opt-lang").checked;
			if (k && t) {
				const newData = { title: t, type: ty };
				if (langChecked) newData.lang = true;
				this.updateData(path.join(".") + "." + k, newData);
				this.renderForm();
			}
		};

		div.appendChild(table);
		div.appendChild(addRow);
		return div;
	},

	createImagesManager(key, data, path) {
		const div = document.createElement("div");
		div.className = "sb-nested";
		div.innerHTML = `<div class="sb-section-title" style="color:var(--primary); justify-content:space-between; align-items:center;">
            <span>📸 Image Manager: ${key.toUpperCase()}</span>
            <button class="btn btn-ghost btn-sm" onclick="SchemaBuilder.addImage('${path.join(".")}')">+ Add Image</button>
        </div>`;

		const container = document.createElement("div");
		container.style.display = "flex";
		container.style.flexDirection = "column";
		container.style.gap = "15px";

		Object.entries(data).forEach(([imgKey, imgVal]) => {
			if (typeof imgVal !== "object" || imgVal === null) return;
			const el = this.renderField(imgKey, imgVal, [...path, imgKey]);
			if (el) container.appendChild(el);
		});

		div.appendChild(container);
		return div;
	},

	addImage(path) {
		const modal = document.getElementById("sb-add-image-modal");
		const inputName = document.getElementById("sb-image-name");
		const inputKey = document.getElementById("sb-image-key");
		const btn = document.getElementById("sb-btn-confirm-image");

		inputName.value = "";
		inputKey.value = "";
		modal.style.display = "flex";
		inputName.focus();

		btn.onclick = () => this.confirmAddImage(path);

		const handleKey = (e) => {
			if (e.key === "Enter") this.confirmAddImage(path);
		};
		inputName.onkeydown = handleKey;
		inputKey.onkeydown = handleKey;
	},

	confirmAddImage(path) {
		const name = document.getElementById("sb-image-name").value.trim();
		const key = document.getElementById("sb-image-key").value.trim();

		if (!name || !key) {
			UI.notify("Vui lòng nhập đầy đủ thông tin!", "error");
			return;
		}

		const newImg = {
			title: name,
			width: 800,
			height: 800,
			thumb: "400x400x1",
		};

		this.updateData(path + "." + key, newImg);
		document.getElementById("sb-add-image-modal").style.display = "none";
		this.renderForm();
		UI.notify(`Đã thêm ảnh ${name} thành công!`, "success");
	},
};
