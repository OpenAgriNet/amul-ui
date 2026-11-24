import { describe, expect, it, vi } from "vitest";
import {
	DEV_API_ORIGIN,
	DEV_UI_ORIGIN,
	PREVIEW_LIST_URL,
	PREVIEW_STORAGE_KEY,
	fetchPreviewBackends,
	isFramed,
	isPreviewSwitchEnabled,
	isValidPreviewName,
	parsePreviewList,
	readSelectedPreview,
	resolveApiBaseUrl,
	writeSelectedPreview
} from "./preview-backend";

function memoryStorage(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value),
		removeItem: (key: string) => void data.delete(key),
		data
	};
}

const throwingStorage = {
	getItem: () => {
		throw new Error("blocked");
	},
	setItem: () => {
		throw new Error("blocked");
	},
	removeItem: () => {
		throw new Error("blocked");
	}
};

const LOCAL_ORIGIN = "http://localhost:5173";

describe("isPreviewSwitchEnabled", () => {
	it("is on only for the dev API", () => {
		expect(isPreviewSwitchEnabled(DEV_API_ORIGIN, LOCAL_ORIGIN)).toBe(true);
		expect(isPreviewSwitchEnabled(`${DEV_API_ORIGIN}/`, LOCAL_ORIGIN)).toBe(true);
	});

	it("is on for the dev UI calling its own /api, as dev is built", () => {
		expect(isPreviewSwitchEnabled("", DEV_UI_ORIGIN)).toBe(true);
		expect(isPreviewSwitchEnabled(undefined, DEV_UI_ORIGIN)).toBe(true);
	});

	it("is off for prod, local proxy builds and anything unusual", () => {
		for (const url of [
			"https://api.prod.amulai.in",
			"",
			undefined,
			"http://api.dev.amulai.in",
			`${DEV_API_ORIGIN}/v2`,
			`${DEV_API_ORIGIN}/?x=1`,
			"https://api.dev.amulai.in.evil.example",
			"not a url"
		]) {
			expect(isPreviewSwitchEnabled(url, LOCAL_ORIGIN)).toBe(false);
		}
		// No base URL counts only on the dev UI itself.
		for (const origin of [
			"",
			"http://dev.amulai.in",
			"https://dev.amulai.in.evil.example",
			"https://amulai.in",
			"https://previews.dev.amulai.in"
		]) {
			expect(isPreviewSwitchEnabled("", origin)).toBe(false);
		}
		// A prod API stays prod even if the page were on the dev UI's address.
		expect(isPreviewSwitchEnabled("https://api.prod.amulai.in", DEV_UI_ORIGIN)).toBe(false);
	});

	it("is off inside another site's frame, even for the dev UI", () => {
		expect(isPreviewSwitchEnabled("", DEV_UI_ORIGIN, true)).toBe(false);
		expect(isPreviewSwitchEnabled(DEV_API_ORIGIN, LOCAL_ORIGIN, true)).toBe(false);
		expect(isPreviewSwitchEnabled("", DEV_UI_ORIGIN, false)).toBe(true);
	});
});

describe("isFramed", () => {
	it("tells a page of its own from one in a frame", () => {
		const page = {};
		expect(isFramed({ self: page, top: page })).toBe(false);
		expect(isFramed({ self: page, top: {} })).toBe(true);
		expect(isFramed(undefined)).toBe(false);
	});

	it("assumes a frame when the top page cannot be read", () => {
		const guarded = {
			self: {},
			get top(): unknown {
				throw new Error("blocked");
			}
		};
		expect(isFramed(guarded)).toBe(true);
	});
});

describe("isValidPreviewName", () => {
	it("accepts the names the server makes", () => {
		for (const name of ["pr-552", "dev2", "a", "x".repeat(40)])
			expect(isValidPreviewName(name)).toBe(true);
	});

	it("rejects anything that could change the host", () => {
		for (const name of [
			"",
			"PR-552",
			"pr--552",
			"-pr",
			"pr-",
			"pr_552",
			"evil.com/x",
			"a b",
			"x".repeat(41),
			552,
			null
		]) {
			expect(isValidPreviewName(name)).toBe(false);
		}
	});
});

describe("resolveApiBaseUrl", () => {
	it("uses the picked preview in a dev build", () => {
		const storage = memoryStorage({ [PREVIEW_STORAGE_KEY]: "pr-552" });
		expect(resolveApiBaseUrl(DEV_API_ORIGIN, storage)).toBe("https://pr-552-backend.dev.amulai.in");
		// The dev UI has no base URL: its own /api becomes the preview's.
		expect(resolveApiBaseUrl("", storage, DEV_UI_ORIGIN)).toBe(
			"https://pr-552-backend.dev.amulai.in"
		);
		expect(resolveApiBaseUrl("", memoryStorage(), DEV_UI_ORIGIN)).toBe("");
		// Inside a partner's frame the dev UI stays on dev, whatever this browser picked.
		expect(resolveApiBaseUrl("", storage, DEV_UI_ORIGIN, true)).toBe("");
	});

	it("keeps dev when nothing valid is stored or storage is unusable", () => {
		expect(resolveApiBaseUrl(DEV_API_ORIGIN, memoryStorage())).toBe(DEV_API_ORIGIN);
		expect(
			resolveApiBaseUrl(DEV_API_ORIGIN, memoryStorage({ [PREVIEW_STORAGE_KEY]: "evil.com/x" }))
		).toBe(DEV_API_ORIGIN);
		expect(resolveApiBaseUrl(DEV_API_ORIGIN, throwingStorage)).toBe(DEV_API_ORIGIN);
		expect(resolveApiBaseUrl(DEV_API_ORIGIN, null)).toBe(DEV_API_ORIGIN);
	});

	it("never changes a prod or proxy build, whatever is stored", () => {
		const storage = memoryStorage({ [PREVIEW_STORAGE_KEY]: "pr-552" });
		expect(resolveApiBaseUrl("https://api.prod.amulai.in", storage)).toBe(
			"https://api.prod.amulai.in"
		);
		expect(resolveApiBaseUrl("", storage, LOCAL_ORIGIN)).toBe("");
		expect(resolveApiBaseUrl("https://api.prod.amulai.in", storage, DEV_UI_ORIGIN)).toBe(
			"https://api.prod.amulai.in"
		);
	});
});

describe("readSelectedPreview / writeSelectedPreview", () => {
	it("saves, reads and clears a choice", () => {
		const storage = memoryStorage();
		expect(writeSelectedPreview(storage, "pr-600")).toBe(true);
		expect(readSelectedPreview(storage)).toBe("pr-600");
		expect(writeSelectedPreview(storage, null)).toBe(true);
		expect(readSelectedPreview(storage)).toBeNull();
		expect(storage.data.has(PREVIEW_STORAGE_KEY)).toBe(false);
	});

	it("refuses bad names and reports storage that cannot be written", () => {
		const storage = memoryStorage();
		expect(writeSelectedPreview(storage, "evil.com/x")).toBe(false);
		expect(storage.data.size).toBe(0);
		expect(writeSelectedPreview(throwingStorage, "pr-1")).toBe(false);
		expect(writeSelectedPreview(null, "pr-1")).toBe(false);
	});
});

describe("parsePreviewList", () => {
	it("keeps well-formed entries, rebuilds the URL and puts the newest PR first", () => {
		const list = parsePreviewList({
			backends: [
				{
					name: "pr-552",
					pr: 552,
					title: " Test cases ",
					url: "https://evil.example"
				},
				{ name: "pr-600", pr: 600, title: "Voice fix" },
				{ name: "demo", pr: null, title: 7 },
				{ name: "pr-600", pr: 600, title: "duplicate" },
				{ name: "Bad.Name", pr: 1 },
				null,
				"pr-1"
			]
		});
		expect(list.map((b) => b.name)).toEqual(["pr-600", "pr-552", "demo"]);
		expect(list[1]).toEqual({
			name: "pr-552",
			url: "https://pr-552-backend.dev.amulai.in",
			pr: 552,
			title: "Test cases"
		});
		expect(list[2]).toMatchObject({ pr: null, title: "" });
	});

	it("rejects a response that is not a list of backends", () => {
		for (const payload of [null, [], {}, { backends: "x" }]) {
			expect(() => parsePreviewList(payload)).toThrow();
		}
	});
});

describe("fetchPreviewBackends", () => {
	it("asks the panel without credentials", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValue({ ok: true, json: async () => ({ backends: [{ name: "pr-9", pr: 9 }] }) });
		const list = await fetchPreviewBackends(fetchImpl as unknown as typeof fetch);
		expect(list.map((b) => b.name)).toEqual(["pr-9"]);
		expect(fetchImpl).toHaveBeenCalledWith(
			PREVIEW_LIST_URL,
			expect.objectContaining({ credentials: "omit" })
		);
	});

	it("fails on an error status so the caller keeps the current backend", async () => {
		const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 502 });
		await expect(fetchPreviewBackends(fetchImpl as unknown as typeof fetch)).rejects.toThrow(
			"HTTP 502"
		);
	});
});
