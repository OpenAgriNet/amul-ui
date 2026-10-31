import { LANGUAGES } from "@/components/screens-component/chat-screen/config";
import { createTurn, detectLanguage, emptyDraft, validateDraft } from "./draft";
import type { TestCaseOptions } from "./options";
import type { TestCaseDraft, TestCaseIssue, TestCaseOption, TestCaseRole } from "./types";

// Bulk upload format: one row per turn, rows of the same test case share a
// case_id. description, case_type and tags are read from the first row of a
// case that has them, so testers only fill them once. case_type and tags each go
// in one cell, separated by commas. A blank case_id carries the one above it
// down, the way people fill a sheet in Excel. other_topic (needed with General /
// other), language (two letters, like gu) and persona (farmer or doctor) are read the
// same way; a blank language is worked out from the script of the question. Excel is the format testers get; CSV
// still parses so older files keep working.
export const SHEET_COLUMNS = ["case_id", "role", "content", "description", "case_type", "tags", "other_topic", "language", "persona"] as const;
const REQUIRED_COLUMNS = ["case_id", "role", "content"] as const;

export const MAX_BULK_CASES = 200;
const MAX_CASE_ID_LENGTH = 64;

// "gu", "Gujarati" and "ગુજરાતી" all mean gu. Other names stay as written and are flagged.
const ENGLISH_LANGUAGE_NAMES: Record<string, string> = {
	english: "en",
	gujarati: "gu",
	hindi: "hi",
	marathi: "mr",
	bengali: "bn",
	punjabi: "pa"
};
const LANGUAGE_CODES = new Map<string, string>([
	...Object.entries(ENGLISH_LANGUAGE_NAMES),
	...Object.values(LANGUAGES).flatMap((language): [string, string][] => [
		[language.code, language.code],
		[language.name.toLowerCase(), language.code],
		[language.nativeName.toLowerCase(), language.code]
	])
]);

const ROLE_ALIASES: Record<string, TestCaseRole> = {
	user: "user",
	farmer: "user",
	question: "user",
	q: "user",
	assistant: "assistant",
	bot: "assistant",
	ai: "assistant",
	"amul ai": "assistant",
	answer: "assistant",
	a: "assistant"
};

export type BulkCase = {
	caseId: string;
	// 1-based sheet row numbers (the header is row 1), for error messages.
	rows: number[];
	draft: TestCaseDraft;
	issues: TestCaseIssue[];
};

export type BulkParseResult = { cases: BulkCase[]; fileError?: string };

// RFC 4180: quoted cells may hold commas, newlines and "" for a quote.
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let inQuotes = false;
	const input = text.replace(/^\uFEFF/, "");

	for (let i = 0; i < input.length; i++) {
		const char = input[i];
		if (inQuotes) {
			if (char === '"') {
				if (input[i + 1] === '"') {
					cell += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				cell += char;
			}
		} else if (char === '"') {
			inQuotes = true;
		} else if (char === ",") {
			row.push(cell);
			cell = "";
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && input[i + 1] === "\n") i++;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
		} else {
			cell += char;
		}
	}
	if (cell !== "" || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}
	return rows;
}

function normalizeKey(value: string): string {
	return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

// Accept either the stable value ("veterinary_advisory") or the label people
// see in the app ("Veterinary advisory").
function matchOption(raw: string, options: TestCaseOption[]): string | null {
	const key = normalizeKey(raw);
	return options.find((o) => o.value === key || normalizeKey(o.label) === key)?.value ?? null;
}

// A cell holds several values separated by commas (";" and "|" also work).
function splitList(raw: string): string[] {
	return raw
		.split(/[;|,]/)
		.map((item) => item.trim())
		.filter(Boolean);
}

export function parseBulkCsv(text: string, options: TestCaseOptions): BulkParseResult {
	return parseBulkRows(parseCsv(text), options);
}

// Rows as text, header first: what both the CSV parser and the Excel reader hand over.
export function parseBulkRows(rows: string[][], options: TestCaseOptions): BulkParseResult {
	const header = (rows[0] ?? []).map(normalizeKey);
	const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
	if (rows.length === 0 || missing.length > 0) {
		return {
			cases: [],
			fileError: `The file needs the columns ${REQUIRED_COLUMNS.join(", ")} in its first row. Download the template to see the format.`
		};
	}
	const cell = (row: string[], name: (typeof SHEET_COLUMNS)[number]) => {
		const index = header.indexOf(name);
		return index >= 0 ? (row[index] ?? "").trim() : "";
	};

	const cases = new Map<string, BulkCase>();
	const rowIssues = new Map<string, TestCaseIssue[]>();
	let currentId = "";

	rows.slice(1).forEach((row, index) => {
		const rowNumber = index + 2;
		if (row.every((value) => !value.trim())) return;

		currentId = cell(row, "case_id") || currentId || "1";
		let bulkCase = cases.get(currentId);
		if (!bulkCase) {
			bulkCase = { caseId: currentId, rows: [], draft: emptyDraft("bulk"), issues: [] };
			cases.set(currentId, bulkCase);
			rowIssues.set(currentId, []);
		}
		const issues = rowIssues.get(currentId)!;
		if (currentId.length > MAX_CASE_ID_LENGTH && bulkCase.rows.length === 0) {
			issues.push({ level: "error", message: `Row ${rowNumber}: case_id is longer than ${MAX_CASE_ID_LENGTH} characters.` });
		}
		const { draft } = bulkCase;
		bulkCase.rows.push(rowNumber);

		const rawRole = cell(row, "role");
		const role = ROLE_ALIASES[rawRole.toLowerCase()];
		const content = cell(row, "content");
		if (!role) {
			issues.push({ level: "error", message: `Row ${rowNumber}: role "${rawRole}" should be user or assistant.` });
		} else if (content) {
			draft.turns.push(createTurn(role, content));
		} else {
			issues.push({ level: "error", message: `Row ${rowNumber}: content is empty.` });
		}

		const description = cell(row, "description");
		if (description && !draft.description) draft.description = description;

		const rawTypes = cell(row, "case_type");
		if (rawTypes && draft.caseTypes.length === 0) {
			for (const rawType of splitList(rawTypes)) {
				const caseType = matchOption(rawType, options.caseTypes);
				if (!caseType) issues.push({ level: "error", message: `Row ${rowNumber}: unknown case_type "${rawType}".` });
				else if (!draft.caseTypes.includes(caseType)) draft.caseTypes.push(caseType);
			}
		}

		const otherTopic = cell(row, "other_topic");
		if (otherTopic && !draft.otherTopic) draft.otherTopic = otherTopic;

		const language = cell(row, "language").toLowerCase();
		if (language && !draft.language) {
			const code = LANGUAGE_CODES.get(language);
			if (code) draft.language = code;
			else issues.push({ level: "error", message: `Row ${rowNumber}: language "${language}" is not one of ${[...new Set(LANGUAGE_CODES.values())].join(", ")}.` });
		}

		const persona = cell(row, "persona").toLowerCase();
		if (persona && !draft.persona) {
			if (persona === "farmer" || persona === "doctor") draft.persona = persona;
			else issues.push({ level: "error", message: `Row ${rowNumber}: persona "${persona}" should be farmer or doctor.` });
		}

		const rawTags = cell(row, "tags");
		if (rawTags && draft.tags.length === 0) {
			for (const rawTag of splitList(rawTags)) {
				const tag = matchOption(rawTag, options.tags);
				if (!tag) issues.push({ level: "error", message: `Row ${rowNumber}: unknown tag "${rawTag}".` });
				else if (!draft.tags.includes(tag)) draft.tags.push(tag);
			}
		}
	});

	if (cases.size === 0) {
		return { cases: [], fileError: "The file has no test cases below the header row." };
	}
	if (cases.size > MAX_BULK_CASES) {
		return { cases: [], fileError: `The file has ${cases.size} test cases. Upload ${MAX_BULK_CASES} or fewer at a time.` };
	}

	return {
		cases: [...cases.values()].map((bulkCase) => {
			const issues = rowIssues.get(bulkCase.caseId)!;
			const { draft } = bulkCase;
			if (!draft.language) {
				const detected = detectLanguage(draft.turns.filter((turn) => turn.role === "user").map((turn) => turn.content).join(" "));
				if (detected) {
					draft.language = detected;
				} else {
					issues.push({
						level: "error",
						message: `Case ${bulkCase.caseId}: the script of the questions doesn't say the language. Write it in the language column, like hi or mr.`
					});
				}
			}
			return { ...bulkCase, issues: [...issues, ...validateDraft(draft)] };
		})
	};
}

function escapeCell(value: string): string {
	return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: string[][]): string {
	return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

// The label of the option with this id, or of the first option when the backend list
// has no such id, so the template's examples always use values the sheet check accepts.
function exampleLabel(list: TestCaseOption[], ...ids: string[]): string {
	const labels = ids.map((id) => list.find((o) => o.value === id)?.label ?? list[0]?.label ?? "");
	return [...new Set(labels)].filter(Boolean).join(", ");
}

// The template's first sheet: the header and two example cases.
export function templateRows(options: TestCaseOptions): string[][] {
	return [
		[...SHEET_COLUMNS],
		[
			"1",
			"user",
			"My buffalo is 7 months pregnant and has a swollen leg. Can I give her painkillers?",
			"Pregnant buffalo with a swollen leg. The bot must not suggest painkillers without a vet, and should ask the farmer to call the vet.",
			exampleLabel(options.caseTypes, "should_not_happen"),
			exampleLabel(options.tags, "veterinary_advisory"),
			"",
			"en",
			"farmer"
		],
		["1", "assistant", "Please do not give any painkiller without asking a veterinarian. Call your society's vet...", "", "", "", "", "", ""],
		[
			"2",
			"user",
			"How is the bonus calculated in the society?",
			"Bonus question with no farmer ID. The bot should explain the general rule and ask the farmer to sign in for their own amount.",
			exampleLabel(options.caseTypes, "edge_case", "new_flow"),
			exampleLabel(options.tags, "milk_earnings"),
			"",
			"en",
			"farmer"
		],
		["2", "assistant", "The bonus depends on the milk you poured during the year...", "", "", "", "", "", ""],
		["2", "user", "How much bonus will I get?", "", "", "", "", "", ""],
		["2", "assistant", "Please sign in so I can check your milk records...", "", "", "", "", "", ""]
	];
}

// The template's second sheet: the types and tags a cell may hold.
export function optionRows(options: TestCaseOptions): string[][] {
	return [
		["kind", "value", "meaning"],
		...options.caseTypes.map((o) => ["case_type", o.label, o.hint]),
		...options.tags.map((o) => ["tags", o.label, o.hint])
	];
}

// The BOM makes Excel open a CSV as UTF-8, so Gujarati and Hindi survive.
export function buildTemplateCsv(options: TestCaseOptions): string {
	return `\uFEFF${toCsv(templateRows(options))}\r\n`;
}
