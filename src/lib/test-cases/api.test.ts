import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitTestCase, TestCaseApiError } from "./api";
import { fetchTestCaseOptions } from "./options";
import { buildPayload, emptyDraft } from "./draft";
import { TEST_OPTIONS } from "./test-fixtures";

// api-service reads the saved token as soon as it is imported.
const storage = vi.hoisted(() => {
	const stub = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
	vi.stubGlobal("localStorage", stub);
	return stub;
});

const toWire = ({ value, label, hint }: { value: string; label: string; hint: string }) => ({ id: value, label, hint });

const payload = buildPayload({ ...emptyDraft("manual"), description: "x".repeat(25) }, { submittedBy: "vishal" });

const reply = (status: number, body: unknown) =>
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body }));

describe("test case API", () => {
	beforeEach(() => vi.stubGlobal("localStorage", storage));
	afterEach(() => vi.unstubAllGlobals());

	it("posts the body to /api/test-cases/ with a trailing slash and returns the id", async () => {
		reply(202, { id: "abc", status: "received" });
		await expect(submitTestCase(payload)).resolves.toEqual({ id: "abc", status: "received" });
		const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
		expect(String(url)).toMatch(/\/api\/test-cases\/$/);
		expect(init?.method).toBe("POST");
		expect(JSON.parse(String(init?.body))).toEqual(payload);
	});

	it("keeps what failed where from a 422", async () => {
		reply(422, { status: "error", detail: "turns.3.content: A turn is empty", errors: [{ loc: ["turns", 3, "content"], msg: "A turn is empty" }] });
		const error = await submitTestCase(payload).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(TestCaseApiError);
		expect((error as TestCaseApiError).message).toBe("A turn is empty");
		expect((error as TestCaseApiError).fieldErrors).toEqual([{ loc: ["turns", 3, "content"], msg: "A turn is empty" }]);
	});

	it("explains a 401 without redirecting, and a dropped connection", async () => {
		reply(401, { detail: "Could not validate credentials" });
		await expect(submitTestCase(payload)).rejects.toThrow(/Sign in again/);
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
		await expect(submitTestCase(payload)).rejects.toThrow(/Could not reach the server/);
	});

	it("reads the lists from /api/test-cases/options/", async () => {
		reply(200, { testers: TEST_OPTIONS.testers, case_types: TEST_OPTIONS.caseTypes.map(toWire), tags: TEST_OPTIONS.tags.map(toWire) });
		const options = await fetchTestCaseOptions();
		expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toMatch(/\/api\/test-cases\/options\/$/);
		expect(options.tags.some((tag) => tag.value === "vet_office")).toBe(true);
		expect(options.testers[0]).toEqual({ id: "kanav", label: "Kanav" });
	});
});
