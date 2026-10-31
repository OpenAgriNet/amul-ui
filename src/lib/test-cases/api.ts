import apiService from "@/lib/api-service";
import { environment } from "@/lib/config/environment";
import type { SubmitTestCaseResult, TestCasePayload } from "./types";

export type TestCaseFieldError = { loc: Array<string | number>; msg: string };

// A failed call, with a message a tester can act on. A 422 also carries what failed
// where, so the screen can mark the turn or field.
export class TestCaseApiError extends Error {
	status: number;
	fieldErrors: TestCaseFieldError[];

	constructor(status: number, message: string, fieldErrors: TestCaseFieldError[] = []) {
		super(message);
		this.name = "TestCaseApiError";
		this.status = status;
		this.fieldErrors = fieldErrors;
	}
}

const MESSAGES: Record<number, string> = {
	400: "The server could not read the test case. Try again.",
	401: "Your sign-in is no longer valid. Sign in again, then try again. Your draft is kept.",
	404: "Test cases are not switched on for this server.",
	413: "The test case is too big (over 512 KB). Remove some turns or shorten them.",
	503: "The server could not store the test case right now. Try again in a moment."
};

async function toError(response: Response): Promise<TestCaseApiError> {
	const body: unknown = await response.json().catch(() => null);
	const { detail, errors } = (body && typeof body === "object" ? body : {}) as { detail?: unknown; errors?: unknown };
	const fieldErrors = Array.isArray(errors)
		? errors.flatMap((item): TestCaseFieldError[] =>
				item && typeof item.msg === "string" && Array.isArray(item.loc) ? [{ loc: item.loc, msg: item.msg }] : []
			)
		: [];
	// detail starts with a field path; msg is the sentence meant for people.
	const message =
		response.status === 422
			? (fieldErrors[0]?.msg ?? (typeof detail === "string" ? detail : "The server refused the test case."))
			: (MESSAGES[response.status] ?? `The server answered with an error (${response.status}). Try again.`);
	return new TestCaseApiError(response.status, message, fieldErrors);
}

// fetch(), not the axios client, so a 401 shows the error here instead of sending the
// page to /error and losing the draft.
export async function testCaseRequest<T>(path: string, body?: unknown): Promise<T> {
	const token = apiService.getBearerToken();
	let response: Response;
	try {
		response = await fetch(`${environment.apiUrl}${path}`, {
			method: body === undefined ? "GET" : "POST",
			headers: {
				Accept: "application/json",
				Authorization: token ? `Bearer ${token}` : "NA",
				...(body === undefined ? {} : { "Content-Type": "application/json" })
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) })
		});
	} catch {
		throw new TestCaseApiError(0, "Could not reach the server. Check your connection and try again.");
	}
	if (!response.ok) throw await toError(response);
	return response.json() as Promise<T>;
}

// POST /api/test-cases/ (trailing slash: without it the server redirects). Answers 202
// { id, status }, and the same id for the same body, so a retry after a timeout is
// stored once. Bulk upload calls this once per test case.
export function submitTestCase(payload: TestCasePayload): Promise<SubmitTestCaseResult> {
	return testCaseRequest<SubmitTestCaseResult>("/api/test-cases/", payload);
}
