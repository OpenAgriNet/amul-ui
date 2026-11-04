import { testCaseRequest } from "./api";
import type { TestCaseOption } from "./types";

export type Tester = { id: string; label: string };

// The dropdown lists the backend serves. The screen shows these and sends the ids; it
// holds no list of its own, so a change on the backend needs no release here.
export type TestCaseOptions = {
	testers: Tester[];
	caseTypes: TestCaseOption[];
	tags: TestCaseOption[];
	// The labeller's lists, shown in the Dataset tab: the group a case is about (the
	// Category column) and what the bot should do (the Answer type column).
	groups: TestCaseOption[];
	answerTypes: TestCaseOption[];
};

type WireOption = { id: string; label: string; hint?: string };
export type WireOptions = {
	testers: WireOption[];
	case_types: WireOption[];
	tags: WireOption[];
	groups?: WireOption[];
	answer_types?: WireOption[];
};

// The server may still send test_accounts; they are left out until v2.
const toOption = ({ id, label, hint }: WireOption): TestCaseOption => ({ value: id, label, hint: hint ?? "" });

export function parseOptions(wire: WireOptions): TestCaseOptions {
	return {
		testers: wire.testers.map(({ id, label }) => ({ id, label })),
		caseTypes: wire.case_types.map(toOption),
		tags: wire.tags.map(toOption),
		groups: (wire.groups ?? []).map(toOption),
		answerTypes: (wire.answer_types ?? []).map(toOption)
	};
}

// GET /api/test-cases/options/: same token and flag as the submit route, so it exists
// where test cases are switched on. If it fails the screen shows the error with a retry;
// there is no list to fall back on.
export async function fetchTestCaseOptions(): Promise<TestCaseOptions> {
	return parseOptions(await testCaseRequest<WireOptions>("/api/test-cases/options/"));
}
