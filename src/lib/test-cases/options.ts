import { testCaseRequest } from "./api";
import type { TestCaseOption } from "./types";

export type Tester = { id: string; label: string };

// The dropdown lists the backend serves. The screen shows these and sends the ids; it
// holds no list of its own, so a change on the backend needs no release here.
export type TestCaseOptions = {
	testers: Tester[];
	caseTypes: TestCaseOption[];
	// The bot's features. A tester picks any as hints, and the labeller files the case
	// under one of them: its category.
	tags: TestCaseOption[];
	// The tags a case can be filed under, for the Dataset tab's Category column.
	categories: TestCaseOption[];
	// What the bot should do, as the labeller reads it: the Answer type column.
	answerTypes: TestCaseOption[];
};

// category: false marks a tag that no case is filed under.
type WireOption = { id: string; label: string; hint?: string; category?: boolean };
export type WireOptions = {
	testers: WireOption[];
	case_types: WireOption[];
	tags: WireOption[];
	answer_types?: WireOption[];
};

// The server may still send test_accounts; they are left out until v2.
const toOption = ({ id, label, hint }: WireOption): TestCaseOption => ({ value: id, label, hint: hint ?? "" });

export function parseOptions(wire: WireOptions): TestCaseOptions {
	return {
		testers: wire.testers.map(({ id, label }) => ({ id, label })),
		caseTypes: wire.case_types.map(toOption),
		tags: wire.tags.map(toOption),
		categories: wire.tags.filter((tag) => tag.category !== false).map(toOption),
		answerTypes: (wire.answer_types ?? []).map(toOption)
	};
}

// GET /api/test-cases/options/: same token and flag as the submit route, so it exists
// where test cases are switched on. If it fails the screen shows the error with a retry;
// there is no list to fall back on.
export async function fetchTestCaseOptions(): Promise<TestCaseOptions> {
	return parseOptions(await testCaseRequest<WireOptions>("/api/test-cases/options/"));
}
