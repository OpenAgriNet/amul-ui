import { testCaseRequest } from "./api";
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
		label?: { category?: string; answer_type?: string };
	};
};

// A case as one table row. Missing text is "", missing lists are [].
export type DatasetRow = {
	id: string;
	receivedAt: string;
	// The feature the labeller filed the case under. "" until it has run.
	category: string;
	answerType: string;
	// The features the tester picked, as hints for the labeller.
	tags: string[];
	caseTypes: string[];
	// The farmer's last question: the one the answer type is about.
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
	const questions = turns.filter((turn) => turn.role === "user");
	return {
		id: item.id,
		receivedAt: text(item.metadata?.received_at),
		category: text(item.metadata?.label?.category),
		answerType: text(item.metadata?.label?.answer_type),
		tags: list(input.tags),
		caseTypes: list(input.case_types),
		// The answer type is about the farmer's last question, so the table names the case
		// by it. The opened row shows the whole chat.
		question: questions[questions.length - 1]?.content ?? "",
		questionCount: questions.length,
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

// "" or [] means no filter on that column.
export type DatasetFilters = {
	// Searches the description, the topic and every turn.
	q: string;
	// Only the Question column.
	question: string;
	category: string;
	answerType: string;
	// A case can have several types, so this picks several: any of them matches.
	caseTypes: string[];
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
	category: "",
	answerType: "",
	caseTypes: [],
	turns: "",
	tester: "",
	source: "",
	persona: "",
	language: "",
	date: ""
};

const DAY_MS = 24 * 60 * 60 * 1000;

const contains = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle);

// A case counts under the labeller's category. Until it is labelled it counts under each
// feature its tester tagged, so it can be found by feature before then.
const inCategory = (row: DatasetRow, category: string) =>
	category === NOT_LABELLED
		? !row.category
		: row.category
			? row.category === category
			: row.tags.includes(category);

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
			(!filters.category || inCategory(row, filters.category)) &&
			(!filters.answerType ||
				(filters.answerType === NOT_LABELLED
					? !row.answerType
					: row.answerType === filters.answerType)) &&
			(filters.caseTypes.length === 0 || filters.caseTypes.some((type) => row.caseTypes.includes(type))) &&
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

// "ask:<what>" answers that don't read as "Asks for the <what>".
const ASKS: Record<string, string> = {
	clarify: "Asks the farmer to clarify",
	signin: "Asks the farmer to sign in"
};

// The label for an id from one of the option lists. The labeller may also answer
// "ask:<what>" for a bot that should ask the farmer something first.
export function optionLabel(list: TestCaseOption[], id: string): string {
	const known = list.find((option) => option.value === id)?.label;
	if (known) return known;
	const asked = /^ask:(.+)$/.exec(id)?.[1];
	if (!asked) return id;
	return ASKS[asked] ?? `Asks for the ${asked.replace(/_/g, " ")}`;
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

export function hasFilters(filters: DatasetFilters): boolean {
	return Object.values(filters).some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)));
}

export const PAGE_SIZES = [10, 25, 50];

// The page buttons to show: the first, the last, and the current one with a neighbour
// on each side; "gap" where pages are skipped. 7 pages or fewer are all shown.
export function pageNumbers(current: number, pageCount: number): Array<number | "gap"> {
	if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
	const pages = [...new Set([1, current - 1, current, current + 1, pageCount])]
		.filter((n) => n >= 1 && n <= pageCount)
		.sort((a, b) => a - b);
	return pages.flatMap((n, i) =>
		i > 0 && n - (pages[i - 1] ?? n) > 1 ? ["gap" as const, n] : [n]
	);
}

// The real cases. Where the backend has test cases off, the screen itself is hidden.
export async function fetchDataset(): Promise<DatasetRow[]> {
	const { items } = await testCaseRequest<{ items: DatasetItem[] }>("/api/test-cases/");
	return (Array.isArray(items) ? items : []).map(toRow);
}
