// The popup is a thin launcher. All mapping, extraction, and rule management
// live in the Angular web app, which is the single source of truth and persists
// rules to the backend. The old in-popup visual mapper was removed in review
// batch 3: it duplicated the Angular UI and wrote rules to chrome.storage.local,
// orphaning them from the backend (see docs/REVIEW-2026-07-03.md, section 🟠).

/**
 * Where the web app is served. Dev default.
 * TODO(batch-6): expose this in a settings UI alongside the backend URL so it
 * is not hard-coded (mirrors the C4 fix for the removed ingest fetch).
 */
const DEFAULT_APP_URL = "http://localhost:4200";

async function resolveAppUrl(): Promise<string> {
	const { appUrl } = await chrome.storage.local.get("appUrl");
	return typeof appUrl === "string" && appUrl.length > 0
		? appUrl
		: DEFAULT_APP_URL;
}

const btnOpen = document.getElementById("btn-open-app") as HTMLButtonElement;
const errorEl = document.getElementById("error")!;

btnOpen.addEventListener("click", async () => {
	try {
		const url = await resolveAppUrl();
		await chrome.tabs.create({ url, active: true });
		window.close();
	} catch (err) {
		errorEl.textContent = `Could not open the web app: ${String(err)}`;
		errorEl.classList.remove("hidden");
	}
});
