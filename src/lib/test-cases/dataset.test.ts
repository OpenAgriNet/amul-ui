import { describe, expect, it, vi } from "vitest";

// dataset.ts reaches api-service, which reads the saved token as soon as it is imported.
vi.hoisted(() =>
	vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
);
import {
	EMPTY_FILTERS,
	filterChoices,
	filterRows,
	hasFilters,
	pageNumbers,
	NOT_LABELLED,
	optionLabel,
	toRow,
	type DatasetItem
} from "./dataset";
import { TEST_OPTIONS } from "./test-fixtures";

const NOW = Date.parse("2026-11-04T12:00:00Z");

const item = (
	id: string,
	days: number,
	input: DatasetItem["input"] = {},
	label?: { group: string; answer_type: string }
): DatasetItem => ({
	id,
	input: {
		source: "chat",
		submitted_by: "vishal",
		persona: "farmer",
		language: "gu",
		description: `Case ${id}`,
		case_types: [],
		tags: [],
		turns: [
			{ role: "user", content: `Question ${id}` },
			{ role: "assistant", content: `Answer ${id}` }
		],
		...input
	},
	metadata: {
		received_at: new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString(),
		...(label ? { label } : {})
	}
});

describe("dataset view", () => {
	it("reads a case whose fields are missing without failing", () => {
		const row = toRow({
			id: "x",
			input: { turns: [{ role: "user" }, { content: "no role" } as never] }
		});
		expect(row).toMatchObject({
			id: "x",
			question: "",
			questionCount: 1,
			tags: [],
			caseTypes: [],
			group: "",
			answerType: "",
			receivedAt: ""
		});
		expect(toRow({ id: "y" }).turns).toEqual([]);
	});

	it("takes the label, the last question and the edits from the stored case", () => {
		const row = toRow({
			id: "z",
			input: {
				turns: [
					{ role: "user", content: "First?" },
					{ role: "assistant", content: "Fixed answer", original_content: "Bot answer" },
					{ role: "user", content: "Second?" }
				]
			},
			metadata: { label: { group: "milk", answer_type: "answer" } }
		});
		expect(row).toMatchObject({
			question: "Second?",
			questionCount: 2,
			group: "milk",
			answerType: "answer"
		});
		expect(row.turns[1]?.originalContent).toBe("Bot answer");
	});

	it("filters every column in the browser", () => {
		const rows = [
			item(
				"a",
				0,
				{ tags: ["weather"], case_types: ["edge_case"] },
				{ group: "milk", answer_type: "answer" }
			),
			item("b", 3, {
				tags: ["loan", "weather"],
				submitted_by: "suraj",
				source: "bulk",
				language: "en"
			}),
			item(
				"c",
				20,
				{
					persona: "doctor",
					turns: [
						{ role: "user", content: "One" },
						{ role: "assistant", content: "A" },
						{ role: "user", content: "Two" },
						{ role: "assistant", content: "fever answer" }
					]
				},
				{ group: "vet-health", answer_type: "vet" }
			)
		].map(toRow);
		const ids = (filters: Partial<typeof EMPTY_FILTERS>) =>
			filterRows(rows, { ...EMPTY_FILTERS, ...filters }, NOW).map((r) => r.id);
		expect(ids({})).toEqual(["a", "b", "c"]);
		expect(ids({ group: "milk" })).toEqual(["a"]);
		expect(ids({ group: NOT_LABELLED })).toEqual(["b"]);
		expect(ids({ answerType: "vet" })).toEqual(["c"]);
		expect(ids({ tags: ["weather"] })).toEqual(["a", "b"]);
		expect(ids({ tags: ["loan"] })).toEqual(["b"]);
		// Several picked: a case with any of them matches.
		expect(ids({ tags: ["loan", "weather"] })).toEqual(["a", "b"]);
		expect(ids({ caseTypes: ["edge_case"] })).toEqual(["a"]);
		expect(ids({ turns: "2-5" })).toEqual(["c"]);
		expect(ids({ tester: "suraj", source: "bulk", language: "en" })).toEqual(["b"]);
		expect(ids({ persona: "doctor" })).toEqual(["c"]);
		expect(ids({ date: "7" })).toEqual(["a", "b"]);
		expect(ids({ date: "1" })).toEqual(["a"]);
		expect(ids({ question: "question b" })).toEqual(["b"]);
		expect(ids({ q: "fever" })).toEqual(["c"]);
		expect(ids({ q: "case a" })).toEqual(["a"]);
	});

	it("names labels, including ask: answers and ids the list doesn't know", () => {
		expect(optionLabel(TEST_OPTIONS.answerTypes, "vet")).toBe("Sends to a vet");
		expect(optionLabel(TEST_OPTIONS.answerTypes, "ask:farmer_code")).toBe(
			"Asks for the farmer code"
		);
		expect(optionLabel(TEST_OPTIONS.answerTypes, "ask:signin")).toBe("Asks the farmer to sign in");
		expect(optionLabel(TEST_OPTIONS.answerTypes, "ask:clarify")).toBe("Asks the farmer to clarify");
		expect(optionLabel(TEST_OPTIONS.groups, "old_group")).toBe("old_group");
		const choices = filterChoices(TEST_OPTIONS.answerTypes, ["vet", "ask:farmer_code", ""]);
		expect(choices.map((c) => c.value)).toEqual(["answer", "book", "vet", "ask:farmer_code"]);
	});

	it("counts an empty list as no filter", () => {
		expect(hasFilters(EMPTY_FILTERS)).toBe(false);
		expect(hasFilters({ ...EMPTY_FILTERS, tags: ["weather"] })).toBe(true);
		expect(hasFilters({ ...EMPTY_FILTERS, persona: "doctor" })).toBe(true);
	});

	it("shows the first, last and nearby pages, with gaps between", () => {
		expect(pageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
		expect(pageNumbers(1, 12)).toEqual([1, 2, "gap", 12]);
		expect(pageNumbers(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
		expect(pageNumbers(12, 12)).toEqual([1, "gap", 11, 12]);
		expect(pageNumbers(1, 1)).toEqual([1]);
	});
});
