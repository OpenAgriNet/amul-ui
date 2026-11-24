/**
 * Dev-only switch between the dev API and a preview backend.
 *
 * A preview backend runs one amul-oan-api pull request at https://<name>-backend.dev.amulai.in and
 * is listed by the previews panel. A tester picks one in the dev UI; the choice lives in this
 * browser's localStorage only, so it never changes what anyone else sees. Only a build that uses the
 * dev API shows it: one that names https://api.dev.amulai.in, or the dev UI at https://dev.amulai.in
 * calling its own /api (no API base URL, as dev is built). Prod, and local dev through the Vite
 * proxy (also no base URL, but on localhost), ignore the switch entirely, whatever is stored. So
 * does the dev UI inside another site's frame (partners may embed it): it stays on dev and shows
 * no switch.
 *
 * The API base URL is read once when the app loads, so a change takes effect on the next reload.
 */

export const DEV_API_ORIGIN = "https://api.dev.amulai.in";
export const DEV_UI_ORIGIN = "https://dev.amulai.in";
export const PREVIEW_LIST_URL = "https://previews.dev.amulai.in/api/backends";
export const PREVIEW_STORAGE_KEY = "dev_preview_backend";

const PREVIEW_HOST_SUFFIX = "-backend.dev.amulai.in";
// The rule the server uses for preview names: lowercase letters, digits, single dashes, 40 chars.
const PREVIEW_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PREVIEW_NAME_MAX_LENGTH = 40;
const LIST_TIMEOUT_MS = 4000;
const TITLE_MAX_LENGTH = 120;

export type PreviewBackend = {
	name: string;
	/** Always rebuilt from the name, never taken from the response. */
	url: string;
	pr: number | null;
	title: string;
};

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem" | "removeItem">;

/** This page's origin, or "" when there is none (outside a browser). */
export function pageOrigin(): string {
	try {
		return typeof window !== "undefined" ? window.location.origin : "";
	} catch {
		return "";
	}
}

/** True when this page runs inside another page's frame; when that cannot be told, assume it does. */
export function isFramed(
	win: { readonly self: unknown; readonly top: unknown } | undefined = typeof window !== "undefined"
		? window
		: undefined
): boolean {
	if (!win) return false;
	try {
		return win.self !== win.top;
	} catch {
		return true;
	}
}

/**
 * True only for a build that uses the dev API, on a page of its own: its base URL is exactly the dev
 * API, or it has none (it calls its own /api) and this page is the dev UI. Never inside a frame.
 */
export function isPreviewSwitchEnabled(
	apiBaseUrl: string | undefined,
	origin: string = pageOrigin(),
	framed: boolean = isFramed()
): boolean {
	if (framed) return false;
	if (!apiBaseUrl) return origin === DEV_UI_ORIGIN;
	try {
		const url = new URL(apiBaseUrl);
		return url.origin === DEV_API_ORIGIN && url.pathname === "/" && !url.search && !url.hash;
	} catch {
		return false;
	}
}

export function isValidPreviewName(value: unknown): value is string {
	return (
		typeof value === "string" && value.length <= PREVIEW_NAME_MAX_LENGTH && PREVIEW_NAME.test(value)
	);
}

export function previewBackendUrl(name: string): string {
	return `https://${name}${PREVIEW_HOST_SUFFIX}`;
}

/** localStorage when the browser allows it; null when it is missing or blocked. */
export function browserStorage(): Storage | null {
	try {
		return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
	} catch {
		return null;
	}
}

/** The preview this browser picked, or null for dev. Anything malformed counts as dev. */
export function readSelectedPreview(storage: ReadableStorage | null | undefined): string | null {
	try {
		const value = storage?.getItem(PREVIEW_STORAGE_KEY) ?? null;
		return isValidPreviewName(value) ? value : null;
	} catch {
		return null;
	}
}

/** Saves the choice (null = back to dev). Returns false when it could not be saved. */
export function writeSelectedPreview(
	storage: WritableStorage | null | undefined,
	name: string | null
): boolean {
	if (!storage || (name !== null && !isValidPreviewName(name))) return false;
	try {
		if (name === null) storage.removeItem(PREVIEW_STORAGE_KEY);
		else storage.setItem(PREVIEW_STORAGE_KEY, name);
		return true;
	} catch {
		return false;
	}
}

/** The API base URL this browser should use: the picked preview in a dev build, else unchanged. */
export function resolveApiBaseUrl(
	apiBaseUrl: string,
	storage: ReadableStorage | null | undefined,
	origin: string = pageOrigin(),
	framed: boolean = isFramed()
): string {
	if (!isPreviewSwitchEnabled(apiBaseUrl, origin, framed)) return apiBaseUrl;
	const name = readSelectedPreview(storage);
	return name ? previewBackendUrl(name) : apiBaseUrl;
}

/** Keeps the well-formed entries of the panel's list, newest pull request first. */
export function parsePreviewList(payload: unknown): PreviewBackend[] {
	const items =
		payload && typeof payload === "object"
			? (payload as { backends?: unknown }).backends
			: undefined;
	if (!Array.isArray(items)) throw new Error("Unexpected previews list");

	const byName = new Map<string, PreviewBackend>();
	for (const item of items) {
		if (!item || typeof item !== "object") continue;
		const { name, pr, title } = item as Record<string, unknown>;
		if (!isValidPreviewName(name) || byName.has(name)) continue;
		byName.set(name, {
			name,
			url: previewBackendUrl(name),
			pr: typeof pr === "number" && Number.isInteger(pr) && pr > 0 ? pr : null,
			title: typeof title === "string" ? title.trim().slice(0, TITLE_MAX_LENGTH) : ""
		});
	}
	return [...byName.values()].sort(
		(a, b) => (b.pr ?? 0) - (a.pr ?? 0) || a.name.localeCompare(b.name)
	);
}

/** Running previews from the panel. Public endpoint: no token or cookie is sent. */
export async function fetchPreviewBackends(
	fetchImpl: typeof fetch = fetch,
	timeoutMs: number = LIST_TIMEOUT_MS
): Promise<PreviewBackend[]> {
	const response = await fetchImpl(PREVIEW_LIST_URL, {
		credentials: "omit",
		cache: "no-store",
		signal: AbortSignal.timeout(timeoutMs)
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return parsePreviewList(await response.json());
}
