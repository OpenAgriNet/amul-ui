import { beforeAll, describe, expect, it, vi } from "vitest";

type ApiService = typeof import("./api-service").default;
let apiService: ApiService;

beforeAll(async () => {
	// api-service reads the token from localStorage when it is imported; the suite runs in node.
	const cells = new Map<string, string>([["auth_jwt", JSON.stringify({ token: "test-token", expiry: 0 })]]);
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: {
			getItem: (key: string) => cells.get(key) ?? null,
			setItem: (key: string, value: string) => void cells.set(key, String(value)),
			removeItem: (key: string) => void cells.delete(key)
		}
	});
	apiService = (await import("./api-service")).default;
});

function stubGet() {
	const get = vi.fn().mockResolvedValue({ data: ["How much milk this week?"] });
	(apiService as unknown as { axiosInstance: { get: typeof get } }).axiosInstance.get = get;
	return get;
}

describe("getSuggestions", () => {
	it("asks for the AG-UI suggestions with scope=agui-v1", async () => {
		const get = stubGet();
		const items = await apiService.getSuggestions("s1", "en", "agui-v1");
		expect(get).toHaveBeenCalledWith("/api/suggest/", expect.objectContaining({
			params: { session_id: "s1", target_lang: "en", scope: "agui-v1" }
		}));
		expect(items).toEqual([{ question: "How much milk this week?" }]);
	});

	it("sends no scope for a text reply", async () => {
		const get = stubGet();
		await apiService.getSuggestions("s1", "en");
		expect(get).toHaveBeenCalledWith("/api/suggest/", expect.objectContaining({
			params: { session_id: "s1", target_lang: "en" }
		}));
	});
});
