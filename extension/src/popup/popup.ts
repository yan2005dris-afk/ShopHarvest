import type {
	DomainRule,
	ExtractedProduct,
	FieldMapping,
	FieldDefinition,
} from "../types";

// ── State ─────────────────────────────────────────────────────────────────────

let currentDomain = "";
let currentTabId = 0;
let currentTabUrl: string | undefined;
let currentRule: DomainRule | null = null;

/** User-defined field definitions (shown in home view, sent to content script). */
let fieldDefs: FieldDefinition[] = [];

/** Selectors assigned by the content script during mapping (fieldName → {selector, type, attribute}). */
const pendingMappings = new Map<
	string,
	{ selector: string; type: FieldMapping["type"]; attribute?: string }
>();

let extractedProducts: ExtractedProduct[] = [];

// ── DOM references ────────────────────────────────────────────────────────────

const views = {
	home: document.getElementById("view-home")!,
	mapping: document.getElementById("view-mapping")!,
	data: document.getElementById("view-data")!,
};

const el = {
	domainBadge: document.getElementById("domain-badge")!,
	ruleStatus: document.getElementById("rule-status")!,
	btnStartMapping: document.getElementById(
		"btn-start-mapping",
	) as HTMLButtonElement,
	btnExtract: document.getElementById("btn-extract") as HTMLButtonElement,
	btnViewData: document.getElementById("btn-view-data") as HTMLButtonElement,
	homeError: document.getElementById("home-error")!,
	btnAddField: document.getElementById("btn-add-field") as HTMLButtonElement,
	fieldDefsList: document.getElementById("field-defs-list")!,
	fieldsList: document.getElementById("fields-list")!,
	btnSaveRule: document.getElementById("btn-save-rule") as HTMLButtonElement,
	btnCancelMapping: document.getElementById(
		"btn-cancel-mapping",
	) as HTMLButtonElement,
	btnExportCsv: document.getElementById("btn-export-csv") as HTMLButtonElement,
	btnClearData: document.getElementById("btn-clear-data") as HTMLButtonElement,
	btnBack: document.getElementById("btn-back") as HTMLButtonElement,
	productCount: document.getElementById("product-count")!,
	tableHead: document.getElementById("table-head")!,
	tableBody: document.getElementById("table-body")!,
	// field-container exists in HTML for the container row in mapping view
	fieldContainer: document.getElementById("field-container")!,
	toast: document.getElementById("toast")!,
};

// ── Initialization ────────────────────────────────────────────────────────────

async function init(): Promise<void> {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	if (!tab?.id || !tab.url) {
		showError("Cannot access this page.");
		return;
	}

	currentTabId = tab.id;
	currentTabUrl = tab.url;
	const url = new URL(tab.url);
	currentDomain = url.hostname;
	el.domainBadge.textContent = currentDomain;

	// Load existing rule for this domain
	currentRule = await bgMessage("GET_RULE", currentDomain);
	if (currentRule) {
		el.ruleStatus.classList.remove("hidden");
		// Pre-populate field definitions from the saved rule
		fieldDefs = currentRule.fieldMappings.map((m) => ({
			name: m.canonicalField,
			type: m.type,
			attribute: m.attribute,
		}));
	}

	renderFieldDefs();
	showView("home");
	bindEvents();
}

// ── View management ───────────────────────────────────────────────────────────

function showView(name: keyof typeof views): void {
	Object.values(views).forEach((v) => v.classList.add("hidden"));
	views[name].classList.remove("hidden");
}

// ── Field definitions rendering (home view) ───────────────────────────────────

function renderFieldDefs(): void {
	el.fieldDefsList.innerHTML = "";

	if (fieldDefs.length === 0) {
		// Empty state
		const empty = document.createElement("div");
		empty.textContent =
			'No fields yet. Add fields like "title", "price", "description"...';
		Object.assign(empty.style, {
			color: "#666",
			fontSize: "12px",
			textAlign: "center",
			padding: "12px 8px",
		});
		el.fieldDefsList.appendChild(empty);
		return;
	}

	fieldDefs.forEach((def, i) => {
		const row = document.createElement("div");
		row.className = "field-def-row";

		// Field name input
		const nameInput = document.createElement("input");
		nameInput.type = "text";
		nameInput.value = def.name;
		nameInput.placeholder = "Field name";
		nameInput.addEventListener("input", () => {
			fieldDefs[i] = {
				...fieldDefs[i],
				name: nameInput.value.trim() || nameInput.value,
			};
		});

		// Type selector
		const typeSelect = document.createElement("select");
		["text", "attribute", "html"].forEach((t) => {
			const opt = document.createElement("option");
			opt.value = t;
			opt.textContent = t;
			if (t === def.type) opt.selected = true;
			typeSelect.appendChild(opt);
		});
		typeSelect.addEventListener("change", () => {
			fieldDefs[i] = {
				...fieldDefs[i],
				type: typeSelect.value as FieldMapping["type"],
			};
			// Show/hide attribute input
			const attrInput = row.querySelector(
				".attr-input",
			) as HTMLInputElement | null;
			if (attrInput) {
				attrInput.style.display =
					typeSelect.value === "attribute" ? "" : "none";
			}
		});

		// Attribute input (only visible when type=attribute)
		const attrInput = document.createElement("input");
		attrInput.type = "text";
		attrInput.placeholder = "attr";
		attrInput.className = "attr-input";
		attrInput.value = def.attribute ?? "";
		attrInput.style.display = def.type === "attribute" ? "" : "none";
		attrInput.addEventListener("input", () => {
			fieldDefs[i] = {
				...fieldDefs[i],
				attribute: attrInput.value || undefined,
			};
		});

		// Remove button
		const removeBtn = document.createElement("button");
		removeBtn.className = "btn-small-danger";
		removeBtn.textContent = "✕";
		removeBtn.addEventListener("click", () => {
			fieldDefs.splice(i, 1);
			renderFieldDefs();
		});

		row.appendChild(nameInput);
		row.appendChild(typeSelect);
		row.appendChild(attrInput);
		row.appendChild(removeBtn);
		el.fieldDefsList.appendChild(row);
	});
}

// ── Events ────────────────────────────────────────────────────────────────────

function bindEvents(): void {
	el.btnAddField.addEventListener("click", () => {
		fieldDefs.push({ name: "", type: "text" });
		renderFieldDefs();
		// Scroll to the bottom to show the new field
		el.fieldDefsList.scrollTop = el.fieldDefsList.scrollHeight;
	});

	el.btnStartMapping.addEventListener("click", onStartMapping);
	el.btnExtract.addEventListener("click", onExtract);
	el.btnViewData.addEventListener("click", onViewData);
	el.btnSaveRule.addEventListener("click", onSaveRule);
	el.btnCancelMapping.addEventListener("click", onCancelMapping);
	el.btnExportCsv.addEventListener("click", onExportCsv);
	el.btnClearData.addEventListener("click", onClearData);
	el.btnBack.addEventListener("click", () => showView("home"));

	chrome.runtime.onMessage.addListener((message) => {
		const msg = message as { type: string; payload: unknown };
		if (msg.type === "FIELD_ASSIGNED") {
			const mapping = msg.payload as FieldMapping;
			onFieldAssigned(mapping);
		}
	});
}

async function onStartMapping(): Promise<void> {
	// Only send non-empty field definitions
	const validDefs = fieldDefs.filter((d) => d.name.trim().length > 0);
	if (validDefs.length === 0) {
		showError("Add at least one field before starting.");
		return;
	}
	// Normalize names
	fieldDefs = validDefs.map((d) => ({ ...d, name: d.name.trim() }));

	pendingMappings.clear();
	resetMappingView();

	try {
		// Send field definitions along with START_MAPPING
		await contentMessage("START_MAPPING", {
			fields: fieldDefs,
		});
		showView("mapping");
	} catch {
		showError("Cannot inject into this page. Try a regular website.");
	}
}

async function onExtract(): Promise<void> {
	if (!currentRule) {
		showError("No rule saved for this domain. Map fields first.");
		return;
	}
	el.homeError.classList.add("hidden");

	try {
		const result = await contentMessage<{ products: ExtractedProduct[] }>(
			"EXTRACT",
			currentRule,
		);
		extractedProducts = result.products ?? [];

		// The backend now requires the rule's fieldMappings to map each
		// extracted product to a normalized Product. The extension is
		// authoritative for which canonical field a key represents.
		const ingestRes = await fetch("http://localhost:3000/products/ingest", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				domain: currentDomain,
				pageUrl: currentTabUrl,
				fieldMappings: currentRule.fieldMappings,
				products: extractedProducts,
			}),
		});
		if (!ingestRes.ok) {
			console.warn("Ingest returned", ingestRes.status);
		}

		renderDataView(extractedProducts);
		showView("data");
	} catch (err) {
		showError(`Extraction failed: ${(err as Error).message}`);
	}
}

async function onViewData(): Promise<void> {
	const products = await bgMessage<ExtractedProduct[]>(
		"GET_PRODUCTS",
		currentDomain,
	);
	extractedProducts = products ?? [];
	renderDataView(extractedProducts);
	showView("data");
}

function onFieldAssigned(mapping: FieldMapping): void {
	pendingMappings.set(mapping.canonicalField, {
		selector: mapping.selector,
		type: mapping.type,
		attribute: mapping.attribute,
	});

	if (mapping.canonicalField === "container") {
		const span = document.getElementById("field-container");
		if (span) {
			span.textContent =
				mapping.selector.length > 30
					? `…${mapping.selector.slice(-27)}`
					: mapping.selector;
			span.classList.add("set");
		}
	} else {
		const span = document.getElementById(
			`field-${CSS.escape(mapping.canonicalField)}`,
		);
		if (span) {
			span.textContent =
				mapping.selector.length > 30
					? `…${mapping.selector.slice(-27)}`
					: mapping.selector;
			span.classList.add("set");
		}
	}

	checkSaveEnabled();
}

async function onSaveRule(): Promise<void> {
	const containerEntry = pendingMappings.get("container");
	if (!containerEntry) return;

	const fieldMappings: FieldMapping[] = [];
	pendingMappings.forEach((value, key) => {
		if (key === "container") return;
		fieldMappings.push({
			canonicalField: key,
			selector: value.selector,
			type: value.type,
			attribute: value.attribute,
		});
	});

	const rule: DomainRule = {
		domain: currentDomain,
		containerSelector: containerEntry.selector,
		fieldMappings,
		createdAt: currentRule?.createdAt ?? Date.now(),
		updatedAt: Date.now(),
	};

	await bgMessage("SAVE_RULE", rule);
	currentRule = rule;

	await contentMessage("STOP_MAPPING", undefined).catch(() => {});

	el.ruleStatus.classList.remove("hidden");
	showToast("Rule saved!");
	showView("home");
}

async function onCancelMapping(): Promise<void> {
	await contentMessage("STOP_MAPPING", undefined).catch(() => {});
	showView("home");
}

function onExportCsv(): void {
	if (!extractedProducts.length) return;

	const headers = Object.keys(extractedProducts[0]!);
	const rows = extractedProducts.map((p) =>
		headers.map((h) => JSON.stringify(p[h] ?? "")).join(","),
	);
	const csv = [headers.join(","), ...rows].join("\n");

	const blob = new Blob([csv], { type: "text/csv" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${currentDomain}-products.csv`;
	a.click();
	URL.revokeObjectURL(url);
}

async function onClearData(): Promise<void> {
	await bgMessage("CLEAR_PRODUCTS", currentDomain);
	extractedProducts = [];
	renderDataView([]);
	showToast("Data cleared");
}

// ── Mapping view helpers ──────────────────────────────────────────────────────

function resetMappingView(): void {
	// Reset container row (always exists in HTML)
	el.fieldContainer.textContent = "not set";
	el.fieldContainer.classList.remove("set");

	// Remove all dynamic field rows (everything after the container row)
	const containerRow = el.fieldsList.querySelector('[data-field="container"]');
	el.fieldsList
		.querySelectorAll('[data-field]:not([data-field="container"])')
		.forEach((el) => el.remove());

	// Add dynamic field rows from fieldDefs
	fieldDefs.forEach((def) => {
		const row = document.createElement("div");
		row.className = "field-row";
		row.dataset.field = def.name;

		const nameSpan = document.createElement("span");
		nameSpan.className = "field-name";
		nameSpan.textContent = def.name;

		const selectorSpan = document.createElement("span");
		selectorSpan.className = "field-selector";
		selectorSpan.id = `field-${CSS.escape(def.name)}`;
		selectorSpan.textContent = "not set";

		row.appendChild(nameSpan);
		row.appendChild(selectorSpan);
		// Insert before the container row so container stays last… actually container is first.
		// The container row is the first child. We'll append after it.
		if (containerRow?.nextSibling) {
			el.fieldsList.insertBefore(row, containerRow.nextSibling);
		} else {
			el.fieldsList.appendChild(row);
		}
	});

	el.btnSaveRule.disabled = true;
}

function checkSaveEnabled(): void {
	// All fields must have selectors assigned
	const allAssigned = fieldDefs.every((def) => pendingMappings.has(def.name));
	const hasContainer = pendingMappings.has("container");
	el.btnSaveRule.disabled = !(allAssigned && hasContainer);
}

// ── Data view ─────────────────────────────────────────────────────────────────

function renderDataView(products: ExtractedProduct[]): void {
	el.productCount.textContent = `${products.length} product(s) extracted`;
	el.tableHead.innerHTML = "";
	el.tableBody.innerHTML = "";

	if (!products.length) return;

	const headers = Object.keys(products[0]!);
	headers.forEach((h) => {
		const th = document.createElement("th");
		th.textContent = h;
		el.tableHead.appendChild(th);
	});

	const preview = products.slice(0, 5);
	preview.forEach((product) => {
		const tr = document.createElement("tr");
		headers.forEach((h) => {
			const td = document.createElement("td");
			td.textContent = String(product[h] ?? "");
			td.title = String(product[h] ?? "");
			tr.appendChild(td);
		});
		el.tableBody.appendChild(tr);
	});
}

// ── Messaging helpers ─────────────────────────────────────────────────────────

function bgMessage<T = unknown>(type: string, payload: unknown): Promise<T> {
	return chrome.runtime.sendMessage({ type, payload }) as Promise<T>;
}

function contentMessage<T = unknown>(
	type: string,
	payload: unknown,
): Promise<T> {
	return chrome.tabs.sendMessage(currentTabId, { type, payload }) as Promise<T>;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function showError(msg: string): void {
	el.homeError.textContent = msg;
	el.homeError.classList.remove("hidden");
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string, isError = false): void {
	el.toast.textContent = msg;
	el.toast.className = `toast${isError ? " error-toast" : ""}`;
	if (toastTimer) clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		el.toast.classList.add("hidden");
	}, 2500);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

init().catch(console.error);
