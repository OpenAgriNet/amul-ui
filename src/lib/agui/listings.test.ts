import { describe, expect, it } from "vitest";
import { activeFilterCount, factMap, filterDraft, filtersFromDraft, isMissing, placeOf, toNumber } from "./listings";
import type { ListingFilterDefinition } from "./types";

const def = (name: string, kind: ListingFilterDefinition["kind"], extra: Partial<ListingFilterDefinition> = {}): ListingFilterDefinition => ({
	name,
	kind,
	options: [],
	minimum: null,
	maximum: null,
	unit: null,
	...extra
});

const FODDER = [
	def("q", "text"),
	def("form", "select", { options: ["GREEN", "DRY"] }),
	def("max_rate_per_kg", "number", { minimum: 0, unit: "INR/kg" }),
	def("limit", "number", { minimum: 1, maximum: 20 })
];

describe("listing facts", () => {
	it("drops missing values, including a source's literal 'None'", () => {
		const facts = factMap([
			{ key: "asking_price_inr", value: "45000" },
			{ key: "milk_per_day_litres", value: "None" },
			{ key: "lactation", value: "" },
			{ key: "age", value: "3 years old" }
		]);
		expect([...facts.keys()]).toEqual(["asking_price_inr", "age"]);
		expect(isMissing(0)).toBe(false);
	});

	it("drops the cattle source's 'not given' placeholders and a 0 milk yield", () => {
		const facts = factMap([
			{ key: "breed", value: "breed not given" },
			{ key: "age", value: "age not given" },
			{ key: "milk_per_day_litres", value: "0" },
			{ key: "asking_price_inr", value: "0" },
			{ key: "species", value: "buffalo" }
		]);
		// A price of 0 is a value, not a placeholder.
		expect([...facts.keys()]).toEqual(["asking_price_inr", "species"]);
	});

	it("reads numbers from numbers and numeric strings only", () => {
		expect(toNumber("8.5")).toBe(8.5);
		expect(toNumber(12)).toBe(12);
		expect(toNumber("about 8")).toBeNull();
		expect(toNumber(undefined)).toBeNull();
	});

	it("builds the place, in Gujarati for fodder when the source has it", () => {
		const cattle = factMap([
			{ key: "village", value: "Deesa" },
			{ key: "district", value: "Banaskantha" }
		]);
		expect(placeOf("cattle", cattle, "en")).toBe("Deesa, Banaskantha");

		const fodder = factMap([
			{ key: "location.district.name_en", value: "Anand" },
			{ key: "location.district.name_gu", value: "આણંદ" },
			{ key: "location.subdistrict.name_en", value: "Petlad" }
		]);
		expect(placeOf("fodder", fodder, "en")).toBe("Petlad, Anand");
		expect(placeOf("fodder", fodder, "gu")).toBe("Petlad, આણંદ");
		expect(placeOf("cattle", factMap([]), "en")).toBeNull();
	});
});

describe("listing filters", () => {
	it("sends every defined filter, null when blank, numbers as numbers", () => {
		const { filters, invalid } = filtersFromDraft(FODDER, { q: " maize ", form: "", max_rate_per_kg: "6.5", limit: "" });
		expect(filters).toEqual({ q: "maize", form: null, max_rate_per_kg: 6.5, limit: null });
		expect(invalid).toEqual([]);
	});

	it("flags numbers outside the range, and a fractional limit", () => {
		expect(filtersFromDraft(FODDER, { max_rate_per_kg: "-1" }).invalid).toEqual(["max_rate_per_kg"]);
		expect(filtersFromDraft(FODDER, { limit: "25" }).invalid).toEqual(["limit"]);
		expect(filtersFromDraft(FODDER, { limit: "2.5" }).invalid).toEqual(["limit"]);
		expect(filtersFromDraft(FODDER, { max_rate_per_kg: "abc" }).invalid).toEqual(["max_rate_per_kg"]);
	});

	it("fills the form from the active filters and counts them without the limit", () => {
		const active = { q: "maize", form: null, max_rate_per_kg: 6, limit: 5 };
		expect(filterDraft(FODDER, active)).toEqual({ q: "maize", form: "", max_rate_per_kg: "6", limit: "5" });
		expect(activeFilterCount(active)).toBe(2);
	});
});
