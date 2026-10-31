import { create } from "zustand";
import { fetchTestCaseOptions, type TestCaseOptions } from "@/lib/test-cases/options";

/* eslint-disable no-unused-vars */
type OptionsStore = {
	status: "idle" | "loading" | "ready" | "error";
	// Why the last load failed, shown under the retry button.
	error: string | null;
	options: TestCaseOptions | null;
	load: () => Promise<void>;
};
/* eslint-enable no-unused-vars */

export const useTestCaseOptions = create<OptionsStore>((set, get) => ({
	status: "idle",
	options: null,
	error: null,

	// Safe to call again: it does nothing while loading or once loaded, and a retry
	// after an error starts a new request.
	load: async () => {
		if (get().status === "loading" || get().status === "ready") return;
		set({ status: "loading", error: null });
		try {
			set({ options: await fetchTestCaseOptions(), status: "ready" });
		} catch (error) {
			console.error("Could not load the test case lists:", error);
			set({ status: "error", error: error instanceof Error ? error.message : String(error) });
		}
	}
}));
