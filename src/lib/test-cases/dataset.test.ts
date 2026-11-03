import { describe, expect, it, vi } from "vitest";

// dataset.ts reaches api-service, which reads the saved token as soon as it is imported.
vi.hoisted(() => vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} }));
import { datasetQuery, EMPTY_FILTERS, filterCases, type DatasetCase } from "./dataset";
import { SAMPLE_CASES, SAMPLE_COVERAGE } from "./dataset-sample";

const make = (id: string, received_at: string, extra: Partial<DatasetCase> = {}): DatasetCase => ({
	id,
	received_at,
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
	...extra
});

describe("dataset view", () => {
	it("sends the filters the way the list route reads them", () => {
		const query = datasetQuery({ ...EMPTY_FILTERS, tags: ["weather", "loan"], caseTypes: ["edge_case"], persona: "farmer", q: "  rain " }, 2);
		const params = new URLSearchParams(query);
		expect(params.getAll("tag")).toEqual(["weather", "loan"]);
		expect(params.getAll("case_type")).toEqual(["edge_case"]);
		expect(params.get("persona")).toBe("farmer");
		expect(params.get("q")).toBe("rain");
		expect(params.get("page")).toBe("2");
		expect(params.get("limit")).toBe("20");
		expect(params.has("language")).toBe(false);
		expect(params.has("submitted_by")).toBe(false);
	});

	it("filters the sample like the backend: any tag, exact fields, text in turns, newest first", () => {
		const cases = [
			make("a", "2026-11-01T00:00:00Z", { tags: ["weather"] }),
			make("b", "2026-11-03T00:00:00Z", { tags: ["loan"], submitted_by: "suraj" }),
			make("c", "2026-11-02T00:00:00Z", { tags: ["weather", "loan"], language: "en" })
		];
		const ids = (filters: Partial<typeof EMPTY_FILTERS>) => filterCases(cases, { ...EMPTY_FILTERS, ...filters }, 1).items.map((c) => c.id);
		expect(ids({})).toEqual(["b", "c", "a"]);
		expect(ids({ tags: ["weather"] })).toEqual(["c", "a"]);
		expect(ids({ tags: ["weather", "loan"] })).toEqual(["b", "c", "a"]);
		expect(ids({ submittedBy: "suraj" })).toEqual(["b"]);
		expect(ids({ language: "en" })).toEqual(["c"]);
		expect(ids({ q: "answer a" })).toEqual(["a"]);
	});

	it("pages the sample", () => {
		const cases = Array.from({ length: 25 }, (_, i) => make(String(i).padStart(2, "0"), `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00Z`));
		const second = filterCases(cases, EMPTY_FILTERS, 2);
		expect(second.total).toBe(25);
		expect(second.items).toHaveLength(5);
		expect(second.page).toBe(2);
	});

	it("keeps the sample consistent with the counts", () => {
		expect(SAMPLE_CASES).toHaveLength(SAMPLE_COVERAGE.total);
		expect(SAMPLE_CASES.filter((c) => c.tags.length === 0)).toHaveLength(SAMPLE_COVERAGE.untagged);
		for (const { id, count } of SAMPLE_COVERAGE.tags) {
			expect(SAMPLE_CASES.filter((c) => c.tags.includes(id))).toHaveLength(count);
		}
	});
});
