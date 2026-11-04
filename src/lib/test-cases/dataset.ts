import { testCaseRequest } from "./api";
import { SAMPLE_ITEMS } from "./dataset-sample";
import type { TestCaseOption, TestCaseRole } from "./types";

// Read-only view of the cases already in the dataset (amul-oan-api#552):
// GET /api/test-cases/ answers {items} with every case that isn't archived, newest
// first, with no paging or filters, so the screen fetches once and filters here.

type StoredTurn = {
	role?: TestCaseRole;
	content?: string;
	original_content?: string;
	trace_id?: string;
};

// One case as the API stores it. input is the body the screen sent, and any field of it
// can be missing (older cases, other contracts); label is empty until the labeller has
// run on the case.
export type DatasetItem = {
	id: string;
	input?: {
		source?: string;
		submitted_by?: string;
		persona?: string;
		language?: string;
		description?: string;
		case_types?: string[];
		tags?: string[];
		other_topic?: string;
		turns?: StoredTurn[];
	};
	metadata?: {
		received_at?: string;
		label?: { group?: string; answer_type?: string };
	};
};

// A case as one table row. Missing text is "", missing lists are [].
export type DatasetRow = {
	id: string;
	receivedAt: string;
	group: string;
	answerType: string;
	tags: string[];
	caseTypes: string[];
	// The farmer's first question, which names the case in the table.
	question: string;
	questionCount: number;
	tester: string;
	source: string;
	persona: string;
	language: string;
	description: string;
	otherTopic: string;
	turns: Array<{ role: TestCaseRole; content: string; originalContent?: string }>;
};

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const list = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

export function toRow(item: DatasetItem): DatasetRow {
	const input = item.input ?? {};
	const turns = (Array.isArray(input.turns) ? input.turns : []).flatMap((turn) =>
		turn && (turn.role === "user" || turn.role === "assistant")
			? [
					{
						role: turn.role,
						content: text(turn.content),
						...(typeof turn.original_content === "string"
							? { originalContent: turn.original_content }
							: {})
					}
				]
			: []
	);
	return {
		id: item.id,
		receivedAt: text(item.metadata?.received_at),
		group: text(item.metadata?.label?.group),
		answerType: text(item.metadata?.label?.answer_type),
		tags: list(input.tags),
		caseTypes: list(input.case_types),
		question: turns.find((turn) => turn.role === "user")?.content ?? "",
		questionCount: turns.filter((turn) => turn.role === "user").length,
		tester: text(input.submitted_by),
		source: text(input.source),
		persona: text(input.persona),
		language: text(input.language),
		description: text(input.description),
		otherTopic: text(input.other_topic),
		turns
	};
}

// Filter value for a case the labeller hasn't reached yet.
export const NOT_LABELLED = "not-labelled";

export const TURN_RANGES = [
	{ value: "1", label: "1 question", min: 1, max: 1 },
	{ value: "2-5", label: "2 to 5", min: 2, max: 5 },
	{ value: "6+", label: "6 or more", min: 6, max: Infinity }
];

export const DATE_RANGES = [
	{ value: "1", label: "Last 24 hours", days: 1 },
	{ value: "7", label: "Last 7 days", days: 7 },
	{ value: "30", label: "Last 30 days", days: 30 }
];

// "" means no filter on that column.
export type DatasetFilters = {
	// Searches the description, the topic and every turn.
	q: string;
	// Only the Question column.
	question: string;
	group: string;
	tag: string;
	answerType: string;
	caseType: string;
	turns: string;
	tester: string;
	source: string;
	persona: string;
	language: string;
	date: string;
};

export const EMPTY_FILTERS: DatasetFilters = {
	q: "",
	question: "",
	group: "",
	tag: "",
	answerType: "",
	caseType: "",
	turns: "",
	tester: "",
	source: "",
	persona: "",
	language: "",
	date: ""
};

const DAY_MS = 24 * 60 * 60 * 1000;

const contains = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle);

export function filterRows(
	rows: DatasetRow[],
	filters: DatasetFilters,
	now = Date.now()
): DatasetRow[] {
	const q = filters.q.trim().toLowerCase();
	const question = filters.question.trim().toLowerCase();
	const turnRange = TURN_RANGES.find((range) => range.value === filters.turns);
	const dateRange = DATE_RANGES.find((range) => range.value === filters.date);
	return rows.filter((row) => {
		const time = Date.parse(row.receivedAt);
		return (
			(!filters.group ||
				(filters.group === NOT_LABELLED ? !row.group : row.group === filters.group)) &&
			(!filters.answerType ||
				(filters.answerType === NOT_LABELLED
					? !row.answerType
					: row.answerType === filters.answerType)) &&
			(!filters.tag || row.tags.includes(filters.tag)) &&
			(!filters.caseType || row.caseTypes.includes(filters.caseType)) &&
			(!turnRange || (row.questionCount >= turnRange.min && row.questionCount <= turnRange.max)) &&
			(!filters.tester || row.tester === filters.tester) &&
			(!filters.source || row.source === filters.source) &&
			(!filters.persona || row.persona === filters.persona) &&
			(!filters.language || row.language === filters.language) &&
			(!dateRange || (!Number.isNaN(time) && now - time <= dateRange.days * DAY_MS)) &&
			(!question || contains(row.question, question)) &&
			(!q ||
				[row.description, row.otherTopic, ...row.turns.map((turn) => turn.content)].some((value) =>
					contains(value, q)
				))
		);
	});
}

// The label for an id from one of the option lists. The labeller may also answer
// "ask:<what>" for a bot that should ask the farmer something first.
export function optionLabel(list: TestCaseOption[], id: string): string {
	const known = list.find((option) => option.value === id)?.label;
	if (known) return known;
	const asked = /^ask:(.+)$/.exec(id)?.[1];
	return asked ? `Asks for the ${asked.replace(/_/g, " ")}` : id;
}

// A column filter's choices: the known list, plus any value the cases hold that the
// list doesn't (an older id, or an "ask:" answer type), so every row can be found.
export function filterChoices(
	known: TestCaseOption[],
	values: string[]
): Array<{ value: string; label: string }> {
	const extra = [...new Set(values)]
		.filter((value) => value && !known.some((option) => option.value === value))
		.sort();
	return [
		...known.map(({ value, label }) => ({ value, label })),
		...extra.map((value) => ({ value, label: optionLabel(known, value) }))
	];
}

// Dev is frozen for the demo, so #552 isn't on dev yet. Until it is, the screen reads a
// sample in its shape. Set this to false once #552 is on dev.
const USE_SAMPLE_DATA = true;
const SAMPLE_LATENCY_MS = 300;

export async function fetchDataset(): Promise<DatasetRow[]> {
	const { items } = USE_SAMPLE_DATA
		? await new Promise<{ items: DatasetItem[] }>((resolve) =>
				setTimeout(() => resolve({ items: SAMPLE_ITEMS }), SAMPLE_LATENCY_MS)
			)
		: await testCaseRequest<{ items: DatasetItem[] }>("/api/test-cases/");
	return (Array.isArray(items) ? items : []).map(toRow);
}
