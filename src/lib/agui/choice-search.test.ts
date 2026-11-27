import { describe, expect, it } from "vitest";
import { filterChoiceOptions, normalizeSearch } from "./choice-search";
import type { ChoiceOption } from "./types";

const DISTRICTS: ChoiceOption[] = [
	{ id: "o1", label: "Ahmedabad", description: null, search_terms: ["ahmedabad", "amdavad", "અમદાવાદ"] },
	{ id: "o2", label: "Banaskantha", description: null, search_terms: ["banaskantha", "palanpur"] },
	{ id: "o3", label: "Rajkot", description: null, search_terms: ["rajkot", "રાજકોટ"] }
];

const SCHEMES: ChoiceOption[] = [
	{ id: "s1", label: "Pashupalan Loan", description: "Banas dairy union" },
	{ id: "s2", label: "PM-KISAN", description: "Central government", search_terms: ["pm kisan", "kisan samman nidhi"] }
];

describe("choice search", () => {
	it("keeps every option, in order, for an empty query", () => {
		expect(filterChoiceOptions(DISTRICTS, "  ").map((o) => o.id)).toEqual(["o1", "o2", "o3"]);
	});

	it("matches the label without caring about case", () => {
		expect(filterChoiceOptions(DISTRICTS, "RAJ").map((o) => o.id)).toEqual(["o3"]);
	});

	it("matches search terms, including Gujarati aliases", () => {
		expect(filterChoiceOptions(DISTRICTS, "palanpur").map((o) => o.id)).toEqual(["o2"]);
		expect(filterChoiceOptions(DISTRICTS, "અમદા").map((o) => o.id)).toEqual(["o1"]);
	});

	it("matches the description, so a source can be searched", () => {
		expect(filterChoiceOptions(SCHEMES, "central").map((o) => o.id)).toEqual(["s2"]);
		expect(filterChoiceOptions(SCHEMES, "banas union").map((o) => o.id)).toEqual(["s1"]);
	});

	it("needs every word and ignores punctuation", () => {
		expect(filterChoiceOptions(SCHEMES, "pm-kisan").map((o) => o.id)).toEqual(["s2"]);
		expect(filterChoiceOptions(SCHEMES, "kisan loan")).toEqual([]);
	});

	it("keeps letters and marks of Indian scripts", () => {
		expect(normalizeSearch("  રાજકોટ, Rajkot! ")).toBe("રાજકોટ rajkot");
	});
});
