import { afterEach, describe, expect, it, vi } from "vitest";

// The loader caches its request, so each test starts from a fresh module.
async function loadModule() {
	vi.resetModules();
	return import("./ui-flags");
}

describe("ui flags", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("takes the flags the backend sends", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ test_case_entry: true, doctor_persona_selector: false, chat_agui_enabled: true, debug_view: true })
		}));
		const { loadUiFlags, getUiFlags } = await loadModule();
		await loadUiFlags();
		expect(getUiFlags()).toEqual({ testCaseEntry: true, doctorPersonaSelector: false, chatAgui: true, debugView: true });
	});

	it("keeps AG-UI chat and the debug view off for a backend that does not send them", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ test_case_entry: false, doctor_persona_selector: false }) }));
		const { loadUiFlags, getUiFlags } = await loadModule();
		await loadUiFlags();
		expect(getUiFlags().chatAgui).toBe(false);
		expect(getUiFlags().debugView).toBe(false);
	});

	it("stays off when the endpoint is missing", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
		const { loadUiFlags, getUiFlags } = await loadModule();
		await loadUiFlags();
		expect(getUiFlags()).toEqual({ testCaseEntry: false, doctorPersonaSelector: false, chatAgui: false, debugView: false });
	});
});
