import { describe, expect, it } from "vitest";
import type { UIComponent } from "./types";
import { onlyRepeatsControlTitle, parseProviderDate } from "./state";

describe("parseProviderDate", () => {
	const ymd = (d: Date | null) => d && [d.getFullYear(), d.getMonth() + 1, d.getDate()];

	it("reads ISO dates", () => {
		expect(ymd(parseProviderDate("2026-10-18"))).toEqual([2026, 10, 18]);
	});

	it("reads the provider's day-first dates (detail rows)", () => {
		// Read as ISO, "18-10-2026" rolled over into "18 Apr" on screen.
		expect(ymd(parseProviderDate("18-10-2026"))).toEqual([2026, 10, 18]);
		expect(ymd(parseProviderDate("01/10/2026"))).toEqual([2026, 10, 1]);
	});

	it("rejects impossible or unknown dates", () => {
		expect(parseProviderDate("31-02-2026")).toBeNull();
		expect(parseProviderDate("2026/10/18")).toBeNull();
		expect(parseProviderDate("")).toBeNull();
	});
});

const control = (title: string) =>
	({ id: "c1", workflow_id: "w", message_id: "m", revision: 1, title, status: "pending", kind: "date_range" }) as unknown as UIComponent;

describe("onlyRepeatsControlTitle", () => {
	it("hides a message that only repeats its control's title", () => {
		expect(onlyRepeatsControlTitle("Milk records", [control("Milk records")])).toBe(true);
		expect(onlyRepeatsControlTitle("  choose the milk record dates. ", [control("Choose the milk record dates")])).toBe(true);
	});

	it("hides an empty anchor message that has a control", () => {
		expect(onlyRepeatsControlTitle("", [control("Milk records")])).toBe(true);
	});

	it("keeps a message with its own text", () => {
		expect(onlyRepeatsControlTitle("Here are your records for October.", [control("Milk records")])).toBe(false);
	});

	it("keeps every message without a control, even an empty one", () => {
		expect(onlyRepeatsControlTitle("", [])).toBe(false);
	});
});
