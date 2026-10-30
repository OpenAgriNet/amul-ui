import { beforeAll, describe, expect, it } from "vitest";

import bnData from "../../../../translations/bn.json";
import enData from "../../../../translations/en.json";
import guData from "../../../../translations/gu.json";
import hiData from "../../../../translations/hi.json";
import type { QuickAction } from ".";

const BUNDLES: Record<string, any> = { en: enData, gu: guData, hi: hiData, bn: bnData };

// Mirrors the i18n lookup the chat screen passes in: dotted keys, and the key
// itself back when nothing defines it.
function makeT(bundle: Record<string, any>) {
	return (key: string) => key.split(".").reduce<any>((acc, part) => acc?.[part], bundle) ?? key;
}

/* eslint-disable no-unused-vars */
let buildQuickActions: (t: (key: string) => any) => QuickAction[];
/* eslint-enable no-unused-vars */

beforeAll(async () => {
	// The store module reaches for browser globals at import time; the suite runs
	// in node, so stand up the little of them that the auth token lookup and the
	// telemetry fingerprint touch.
	Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis });
	const cells = new Map<string, string>();
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: {
			getItem: (key: string) => cells.get(key) ?? null,
			setItem: (key: string, value: string) => void cells.set(key, String(value)),
			removeItem: (key: string) => void cells.delete(key),
			clear: () => cells.clear(),
			key: (index: number) => [...cells.keys()][index] ?? null,
			get length() {
				return cells.size;
			}
		}
	});
	({ buildQuickActions } = await import("."));
});

describe("welcome quick actions", () => {
	// AMUL-87: the weather question is the third card on the welcome screen, so
	// it is pinned above the FAQ card rather than listed with the fixed
	// questions that render below it.
	it.each(Object.keys(BUNDLES))("puts the weather question in slot 3 (%s)", (lang) => {
		const bundle = BUNDLES[lang];
		const actions = buildQuickActions(makeT(bundle));

		expect(actions).toHaveLength(11);

		const weatherCard = actions[2];
		if (!weatherCard) throw new Error(`no third card for ${lang}`);
		expect(weatherCard.title).toBe(bundle.pinnedQuestions[2]);
		expect(weatherCard.icon).toBe("cloud");
		expect(weatherCard.kind).toBe("ask");
		expect(bundle.fixedQuestions).not.toContain(weatherCard.title);
	});

	// AMUL-118: the animal-details question is the second fixed card. It is also
	// in the random pool, so it has to match that entry exactly for the pool to
	// drop it; otherwise the random tail could show it a second time.
	it.each(Object.keys(BUNDLES))("puts the animal-details question second among the fixed cards, once (%s)", (lang) => {
		const bundle = BUNDLES[lang];
		const animalDetails = bundle.fixedQuestions[1];
		expect(animalDetails).toContain("AI");
		expect(bundle.questions).toContain(animalDetails);

		for (let i = 0; i < 20; i++) {
			const titles = buildQuickActions(makeT(bundle)).map((action) => action.title);
			const fixedCards = titles.filter((title) => bundle.fixedQuestions.includes(title));
			expect(fixedCards[1]).toBe(animalDetails);
			expect(titles.filter((title) => title === animalDetails)).toHaveLength(1);
		}
	});
});
