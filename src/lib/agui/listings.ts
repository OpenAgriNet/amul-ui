import type { ListingFact, ListingFilterDefinition, ListingFilters, ListingSource } from "./types";

// Data helpers for the #641 cattle and fodder cards. Nothing here formats for
// display; the components do that.

/** Values a source sends for "not given". A missing fact is left out, never shown as 0. */
const MISSING = new Set(["", "none", "null", "nan", "undefined", "n/a"]);

export type FactValue = string | number | boolean;

export function isMissing(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (typeof value === "number") return !Number.isFinite(value);
	return typeof value === "string" && MISSING.has(value.trim().toLowerCase());
}

/** Placeholders the cattle source writes in place of a value ("breed not given", "age not given"). */
const NOT_GIVEN = /\bnot given\b/i;

/**
 * Facts that only say "unknown". The cattle source reports an unknown milk
 * yield as 0, which its own text formatter also leaves out.
 */
function saysUnknown(key: string, value: FactValue): boolean {
	if (typeof value === "string" && NOT_GIVEN.test(value)) return true;
	return key === "milk_per_day_litres" && toNumber(value) === 0;
}

/** The facts by key, without the missing ones. */
export function factMap(facts: readonly ListingFact[]): Map<string, FactValue> {
	const map = new Map<string, FactValue>();
	for (const fact of facts) if (!isMissing(fact.value) && !saysUnknown(fact.key, fact.value)) map.set(fact.key, fact.value);
	return map;
}

/** A number from a number or a numeric string ("45000", "8.5"); null otherwise. */
export function toNumber(value: FactValue | undefined): number | null {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value !== "string" || value.trim() === "") return null;
	const parsed = Number(value.trim());
	return Number.isFinite(parsed) ? parsed : null;
}

/** A fodder name/place in Gujarati when the chat is in Gujarati and the source has it. */
export function localName(facts: Map<string, FactValue>, prefix: string, language: string, enKey = "name_en"): string | null {
	const gu = language === "gu" ? facts.get(`${prefix}.name_gu`) : undefined;
	const value = gu ?? facts.get(`${prefix}.${enKey}`);
	return value === undefined ? null : String(value);
}

/** "Village, District" for a card. */
export function placeOf(source: ListingSource, facts: Map<string, FactValue>, language: string): string | null {
	const parts =
		source === "cattle"
			? [facts.get("village"), facts.get("district")].map((v) => (v === undefined ? null : String(v)))
			: [
					localName(facts, "location.village", language) ?? localName(facts, "location.subdistrict", language),
					localName(facts, "location.district", language)
				];
	const unique = parts.filter((p, i): p is string => !!p && parts.indexOf(p) === i);
	return unique.length > 0 ? unique.join(", ") : null;
}

/** Filters that start at a default rather than "any". Not counted as active. */
const DEFAULTED = new Set(["limit"]);

/** How many filters narrow the search, for the "Filters (2)" button. */
export function activeFilterCount(filters: ListingFilters): number {
	return Object.entries(filters).filter(([name, value]) => !DEFAULTED.has(name) && !isMissing(value)).length;
}

/** The form's text for each defined filter. */
export function filterDraft(definitions: readonly ListingFilterDefinition[], filters: ListingFilters): Record<string, string> {
	return Object.fromEntries(
		definitions.map((d) => {
			const value = filters[d.name];
			return [d.name, isMissing(value) ? "" : String(value)];
		})
	);
}

const isWholeNumberFilter = (d: ListingFilterDefinition) => d.name === "limit";

/**
 * The complete filter state to send: every defined filter, null when blank.
 * Numbers must be finite and inside the definition's range; `invalid` names
 * the ones that are not, and nothing should be sent until it is empty.
 */
export function filtersFromDraft(
	definitions: readonly ListingFilterDefinition[],
	draft: Record<string, string>
): { filters: ListingFilters; invalid: string[] } {
	const filters: ListingFilters = {};
	const invalid: string[] = [];
	for (const d of definitions) {
		const text = (draft[d.name] ?? "").trim();
		if (text === "") {
			filters[d.name] = null;
			continue;
		}
		if (d.kind !== "number") {
			filters[d.name] = text;
			continue;
		}
		const value = Number(text);
		const outOfRange =
			!Number.isFinite(value) ||
			(d.minimum !== null && value < d.minimum) ||
			(d.maximum !== null && value > d.maximum) ||
			(isWholeNumberFilter(d) && !Number.isInteger(value));
		if (outOfRange) invalid.push(d.name);
		filters[d.name] = value;
	}
	return { filters, invalid };
}
