import type { SubmitTestCaseResult, TestCasePayload } from "./types";

const MOCK_LATENCY_MS = 600;

// Mock of POST /submit-test-case, the endpoint the backend is adding to the Amul OAN
// API (behind its own flag). Bulk upload calls this once per test case, so the
// real version only has to accept a single case. Replace the body with
// apiService / axios once the endpoint exists; callers already await it and
// handle a thrown error as a failed submission.
export async function submitTestCase(payload: TestCasePayload): Promise<SubmitTestCaseResult> {
	console.info("[test-cases] POST /submit-test-case (mock)", payload);
	await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
	return { id: crypto.randomUUID(), status: "received" };
}
