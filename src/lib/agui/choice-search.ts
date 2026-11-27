import type { ChoiceOption } from "./types";

/**
 * Lower case, NFKC, and punctuation turned into spaces. Letters, digits and
 * combining marks of every script stay, so Gujarati and Hindi words still match.
 */
export function normalizeSearch(text: string): string {
	return text
		.normalize("NFKC")
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
		.trim();
}

/**
 * #639: options whose label, description or search terms contain every word of
 * the query, in their original order. An empty query keeps them all. Nothing is
 * translated or guessed; the backend still resolves the chosen id.
 */
export function filterChoiceOptions(options: readonly ChoiceOption[], query: string): ChoiceOption[] {
	const words = normalizeSearch(query).split(" ").filter(Boolean);
	if (words.length === 0) return [...options];
	return options.filter((option) => {
		const haystack = normalizeSearch([option.label, option.description ?? "", ...(option.search_terms ?? [])].join(" "));
		return words.every((word) => haystack.includes(word));
	});
}
