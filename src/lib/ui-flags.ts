import { create } from "zustand";
import { environment } from "@/lib/config/environment";

export type UiFlags = {
	testCaseEntry: boolean;
	doctorPersonaSelector: boolean;
};

const FLAGS_TIMEOUT_MS = 3000;

// Off until the backend says otherwise.
export const useUiFlags = create<UiFlags>(() => ({ testCaseEntry: false, doctorPersonaSelector: false }));

export const getUiFlags = (): UiFlags => useUiFlags.getState();

let loading: Promise<UiFlags> | null = null;

// GET /api/ui-flags/: public, no token, so the clipboard icon is known before login.
// A failed request leaves everything off.
export function loadUiFlags(): Promise<UiFlags> {
	loading ??= (async () => {
		try {
			const response = await fetch(`${environment.apiUrl}/api/ui-flags/`, { signal: AbortSignal.timeout(FLAGS_TIMEOUT_MS) });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const { test_case_entry, doctor_persona_selector } = (await response.json()) as Record<string, unknown>;
			useUiFlags.setState({ testCaseEntry: test_case_entry === true, doctorPersonaSelector: doctor_persona_selector === true });
		} catch (error) {
			console.warn("UI flags unavailable, leaving the flagged features off", error);
		}
		return getUiFlags();
	})();
	return loading;
}
