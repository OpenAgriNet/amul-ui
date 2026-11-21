import { environment } from "@/lib/config/environment";
import { getUiFlags } from "@/lib/ui-flags";
import type { FetchFn } from "./adapter";

/** VITE_AGUI_MOCK=true runs the chat against the in-browser mock backend. Dev only. */
export const AGUI_MOCK_ENABLED = import.meta.env.VITE_AGUI_MOCK === "true";

/**
 * Whether this turn goes to POST /api/chat/. Until the backend ships the POST
 * endpoint, only the backend flag or mock mode turns it on, so existing
 * deployments keep the GET stream.
 */
export function shouldUseAguiTransport(): boolean {
	return AGUI_MOCK_ENABLED || getUiFlags().chatAgui;
}

let mockFetch: Promise<FetchFn> | null = null;

/** The fetch to use for a POST turn: the mock in mock mode, the network otherwise. */
export function getAguiFetch(): Promise<FetchFn | undefined> {
	if (!AGUI_MOCK_ENABLED) return Promise.resolve(undefined);
	mockFetch ??= import("./mock-server").then(({ createMockChatServer }) => createMockChatServer().fetch);
	return mockFetch;
}

export const aguiApiUrl = (): string => environment.apiUrl;
