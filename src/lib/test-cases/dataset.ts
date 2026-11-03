import type { ChatPersona } from "@/lib/chat-persona";
import { testCaseRequest } from "./api";
import { SAMPLE_CASES, SAMPLE_COVERAGE } from "./dataset-sample";
import type { TestCaseRole, TestCaseSource } from "./types";

// Read-only view of the cases already in the dataset (amul-oan-api#517, PR #540):
// GET /api/test-cases/ and GET /api/test-cases/coverage/, same token and dev flag as
// the submit route.

export type DatasetCase = {
	id: string;
	received_at: string;
	source: TestCaseSource;
	submitted_by: string;
	persona: ChatPersona;
	language: string;
	description: string;
	case_types: string[];
	tags: string[];
	other_topic?: string;
	turns: Array<{
		role: TestCaseRole;
		content: string;
		original_content?: string;
		trace_id?: string;
	}>;
};

export type DatasetPage = { items: DatasetCase[]; total: number; page: number; limit: number };

export type CoverageCount = { id: string; label: string; count: number };

// Every tag and case type is listed, zeros included, so the gaps show.
export type Coverage = {
	total: number;
	untagged: number;
	tags: CoverageCount[];
	case_types: CoverageCount[];
};

export type DatasetFilters = {
	// A case matches if it has any of these.
	tags: string[];
	caseTypes: string[];
	source: string;
	persona: string;
	language: string;
	submittedBy: string;
	// Searches the description and the turns.
	q: string;
};

export const EMPTY_FILTERS: DatasetFilters = {
	tags: [],
	caseTypes: [],
	source: "",
	persona: "",
	language: "",
	submittedBy: "",
	q: ""
};

export const PAGE_SIZE = 20;

// Dev is frozen for the demo, so these routes aren't on dev yet. Until they are, the
// screen reads the sample responses Suraj shared. Set this to false once #540 is on dev.
const USE_SAMPLE_DATA = true;
const SAMPLE_LATENCY_MS = 300;

export function datasetQuery(filters: DatasetFilters, page: number): string {
	const params = new URLSearchParams();
	filters.tags.forEach((tag) => params.append("tag", tag));
	filters.caseTypes.forEach((caseType) => params.append("case_type", caseType));
	if (filters.source) params.set("source", filters.source);
	if (filters.persona) params.set("persona", filters.persona);
	if (filters.language) params.set("language", filters.language);
	if (filters.submittedBy) params.set("submitted_by", filters.submittedBy);
	if (filters.q.trim()) params.set("q", filters.q.trim());
	params.set("page", String(page));
	params.set("limit", String(PAGE_SIZE));
	return params.toString();
}

// The backend's filter, applied to the sample: any listed tag or type, the exact
// fields, and the text in the description or the turns. Newest first.
export function filterCases(
	cases: DatasetCase[],
	filters: DatasetFilters,
	page: number,
	limit = PAGE_SIZE
): DatasetPage {
	const q = filters.q.trim().toLowerCase();
	const matches = cases
		.filter(
			(c) =>
				(filters.tags.length === 0 || filters.tags.some((tag) => c.tags.includes(tag))) &&
				(filters.caseTypes.length === 0 ||
					filters.caseTypes.some((type) => c.case_types.includes(type))) &&
				(!filters.source || c.source === filters.source) &&
				(!filters.persona || c.persona === filters.persona) &&
				(!filters.language || c.language === filters.language) &&
				(!filters.submittedBy || c.submitted_by === filters.submittedBy) &&
				(!q ||
					[c.description, ...c.turns.map((turn) => turn.content)].some((text) =>
						text.toLowerCase().includes(q)
					))
		)
		.sort((a, b) => b.received_at.localeCompare(a.received_at));
	return {
		items: matches.slice((page - 1) * limit, page * limit),
		total: matches.length,
		page,
		limit
	};
}

const sample = <T>(value: T) =>
	new Promise<T>((resolve) => setTimeout(() => resolve(value), SAMPLE_LATENCY_MS));

export function fetchDatasetPage(filters: DatasetFilters, page: number): Promise<DatasetPage> {
	if (USE_SAMPLE_DATA) return sample(filterCases(SAMPLE_CASES, filters, page));
	return testCaseRequest<DatasetPage>(`/api/test-cases/?${datasetQuery(filters, page)}`);
}

export function fetchCoverage(): Promise<Coverage> {
	if (USE_SAMPLE_DATA) return sample(SAMPLE_COVERAGE);
	return testCaseRequest<Coverage>("/api/test-cases/coverage/");
}
