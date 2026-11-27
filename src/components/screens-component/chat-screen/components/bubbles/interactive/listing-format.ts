import { type FactValue, localName, placeOf, toNumber } from "@/lib/agui/listings";
import type { ListingSource } from "@/lib/agui/types";
import { formatNumber, formatRupees } from "./shared";

// Turns #641 source facts into labelled rows. Labels are ours (agui.listing.*);
// values keep the source's numbers and units. Missing facts are already gone.

/* eslint-disable no-unused-vars */
export type Labels = {
	label: (key: string, params?: Record<string, string>) => string;
	labelOr: (key: string, fallback: string) => string;
	language: string;
};
/* eslint-enable no-unused-vars */

export type FactRow = { key: string; label: string; value: string; href?: string };

/** Source words we translate when we know them ("cow", "GREEN", "pickup"); anything else is shown as sent. */
const ENUM_KEYS = new Set([
	"species",
	"milking_status",
	"pregnancy_status",
	"material.form",
	"material.processing",
	"material.packaging",
	"quantity.stock_type",
	"delivery.option",
	"price.kind"
]);

export function enumLabel(labels: Labels, value: string): string {
	return labels.labelOr(`listing.values.${value.trim().toLowerCase().replace(/[\s-]+/g, "_")}`, value);
}

const rupees = (value: FactValue | undefined) => {
	const n = toNumber(value);
	return n === null ? (value === undefined ? null : String(value)) : formatRupees(n);
};

/** "30 Nov 2026" for an ISO date or timestamp; the source text otherwise. */
export function formatWhen(value: FactValue | number, language: string): string {
	const date = typeof value === "number" ? new Date(value * 1000) : new Date(String(value));
	if (Number.isNaN(date.getTime())) return String(value);
	try {
		return new Intl.DateTimeFormat(`${language}-IN`, { day: "numeric", month: "short", year: "numeric", numberingSystem: "latn" }).format(date);
	} catch {
		return String(value);
	}
}

/** "₹4.5 / kg": the asking rate in its original unit. */
export function fodderPrice(facts: Map<string, FactValue>, language: string): string | null {
	const rate = rupees(facts.get("price.rate_inr"));
	if (!rate) return null;
	const unit =
		(language === "gu" ? facts.get("price.per_unit_name_gu") : undefined) ??
		facts.get("price.per_unit_name_en") ??
		facts.get("price.per_unit");
	return unit === undefined ? rate : `${rate} / ${String(unit)}`;
}

/** "1,200 kg": the available quantity in its original unit. */
export function fodderQuantity(facts: Map<string, FactValue>): string | null {
	const available = facts.get("quantity.available");
	if (available === undefined) return null;
	const n = toNumber(available);
	const unit = facts.get("quantity.unit_name_en") ?? facts.get("quantity.unit");
	return `${n === null ? String(available) : formatNumber(n, 2)}${unit === undefined ? "" : ` ${String(unit)}`}`;
}

function milkPerDay(labels: Labels, value: FactValue | undefined): string | null {
	const n = toNumber(value);
	if (n === null) return value === undefined ? null : String(value);
	return labels.label("listing.litresPerDay", { count: formatNumber(n, 2) });
}

/** The headline price of a card or detail. */
export function headlinePrice(source: ListingSource, facts: Map<string, FactValue>, language: string): string | null {
	return source === "cattle" ? rupees(facts.get("asking_price_inr")) : fodderPrice(facts, language);
}

/** The card title in Gujarati for fodder when the source has it. */
export function listingTitle(source: ListingSource, title: string, facts: Map<string, FactValue>, language: string): string {
	if (source !== "fodder" || language !== "gu") return title;
	return localName(facts, "material", language, "canonical_name_en") ?? title;
}

/** The few rows a summary card shows under its price. */
export function cardRows(source: ListingSource, facts: Map<string, FactValue>, labels: Labels): FactRow[] {
	const { label, language } = labels;
	const place = placeOf(source, facts, language);
	const rows: Array<[string, string, string | null]> =
		source === "cattle"
			? [
					["milk", label("listing.facts.milk_per_day_litres"), milkPerDay(labels, facts.get("milk_per_day_litres"))],
					["age", label("listing.facts.age"), facts.has("age") ? String(facts.get("age")) : null],
					["place", label("listing.facts.place"), place]
				]
			: [
					["quantity", label("listing.facts.quantity"), fodderQuantity(facts)],
					["place", label("listing.facts.place"), place],
					[
						"valid_until",
						label("listing.facts.freshness.valid_until"),
						facts.has("freshness.valid_until") ? formatWhen(facts.get("freshness.valid_until")!, language) : null
					]
				];
	return rows.filter((row): row is [string, string, string] => row[2] !== null).map(([key, l, value]) => ({ key, label: l, value }));
}

/** Keys folded into another row, or only for machines. */
const HIDDEN = [
	/\.id$/,
	/^listing_id$/,
	/^listing_number$/,
	/^material\.(material_code|canonical_name_en|name_gu|comparison_group)$/,
	/^price\.(rate_inr|per_unit|per_unit_name_en|per_unit_name_gu|conversion_basis|weight_is_estimated)$/,
	/^quantity\.(available|unit|unit_name_en)$/,
	/^location\./,
	/^freshness\.checked_at$/,
	/^summary_en$/,
	/^listing_url$/,
	/^asking_price_inr$/,
	/^village$/,
	/^district$/
];

/** Detail rows in a fixed order; facts we have no label for come last, under their key. */
const ORDER: Record<ListingSource, string[]> = {
	cattle: ["species", "breed", "milk_per_day_litres", "age", "lactation", "milking_status", "pregnancy_status", "place"],
	fodder: [
		"material.form",
		"material.processing",
		"material.packaging",
		"quantity",
		"quantity.approx_kg",
		"quantity.min_purchase",
		"quantity.stock_type",
		"quantity.available_from",
		"price.price_terms",
		"price.normalized_rate_per_kg_inr",
		"delivery.option",
		"delivery.transport_charges",
		"delivery.loading_charges",
		"place",
		"freshness.last_confirmed_at",
		"freshness.valid_until"
	]
};

const humanize = (key: string) => key.split(".").pop()!.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function valueFor(key: string, value: FactValue, labels: Labels): string {
	if (typeof value === "boolean") return labels.label(value ? "listing.yes" : "listing.no");
	if (key === "milk_per_day_litres") return milkPerDay(labels, value) ?? String(value);
	if (key === "price.normalized_rate_per_kg_inr") return `${rupees(value)} / kg`;
	if (/charges$/.test(key)) return rupees(value) ?? String(value);
	if (key.startsWith("freshness.") || key === "quantity.available_from") return formatWhen(value, labels.language);
	if (ENUM_KEYS.has(key) && typeof value === "string") return enumLabel(labels, value);
	const n = typeof value === "number" ? value : null;
	return n === null ? String(value) : formatNumber(n, 2);
}

/** Every available fact of one listing, for the detail card. */
export function detailRows(source: ListingSource, facts: Map<string, FactValue>, labels: Labels): FactRow[] {
	const { label, labelOr, language } = labels;
	const rows = new Map<string, FactRow>();
	const place = placeOf(source, facts, language);
	if (place) rows.set("place", { key: "place", label: label("listing.facts.place"), value: place });
	if (source === "fodder") {
		const quantity = fodderQuantity(facts);
		if (quantity) rows.set("quantity", { key: "quantity", label: label("listing.facts.quantity"), value: quantity });
	}
	for (const [key, value] of facts) {
		if (HIDDEN.some((pattern) => pattern.test(key))) continue;
		rows.set(key, { key, label: labelOr(`listing.facts.${key}`, humanize(key)), value: valueFor(key, value, labels) });
	}
	const order = ORDER[source];
	const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
	const sorted = [...rows.values()].sort((a, b) => rank(a.key) - rank(b.key));
	const url = facts.get("listing_url");
	if (typeof url === "string" && /^https:\/\//.test(url)) {
		sorted.push({ key: "listing_url", label: label("listing.facts.listing_url"), value: label("listing.openSource"), href: url });
	}
	return sorted;
}
