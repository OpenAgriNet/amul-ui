import { beforeAll, describe, expect, it } from "vitest";

import bnData from "../../../../translations/bn.json";
import enData from "../../../../translations/en.json";
import guData from "../../../../translations/gu.json";
import hiData from "../../../../translations/hi.json";
import mrData from "../../../../translations/mr.json";
import paData from "../../../../translations/pa.json";
import type { QuickAction } from ".";

const BUNDLES: Record<string, any> = { en: enData, gu: guData, hi: hiData, bn: bnData, mr: mrData, pa: paData };
const AI_MARKER: Record<string, string> = { mr: "रेतन", pa: "ਗਰਭਦਾਨ" };
const FODDER_MARKER: Record<string, string> = {
	en: "fodder",
	gu: "ચારો",
	hi: "चारा",
	bn: "পশুখাদ্য",
	mr: "चारा",
	pa: "ਚਾਰਾ"
};

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
	// it is pinned above the FAQ cards rather than listed with the fixed
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

	// AMUL-118: the animal-details question comes right after Earnings. AMUL-128
	// put the fodder question first, so that is now the third fixed card. It is
	// also in the random pool, so it has to match that entry exactly for the pool
	// to drop it; otherwise the random tail could show it a second time.
	it.each(Object.keys(BUNDLES))("puts the animal-details question right after Earnings, once (%s)", (lang) => {
		const bundle = BUNDLES[lang];
		const animalDetails = bundle.fixedQuestions[2];
		// mr and pa spell artificial insemination out instead of writing "AI".
		expect(animalDetails).toContain(AI_MARKER[lang] ?? "AI");
		expect(bundle.questions).toContain(animalDetails);

		for (let i = 0; i < 20; i++) {
			const titles = buildQuickActions(makeT(bundle)).map((action) => action.title);
			const fixedCards = titles.filter((title) => bundle.fixedQuestions.includes(title));
			expect(fixedCards[2]).toBe(animalDetails);
			expect(titles.filter((title) => title === animalDetails)).toHaveLength(1);
		}
	});

	// AMUL-128: the fodder question is the first card below the "more useful
	// questions" launcher(s), ahead of Earnings. It replaced biogas and the random
	// last card (which could show a deworming question), so the screen ends on the
	// last fixed question and nothing from the random pool is shown.
	it.each(Object.keys(BUNDLES))("puts the fodder question right below the FAQ cards, with no biogas or random card (%s)", (lang) => {
		const bundle = BUNDLES[lang];
		const fodder = bundle.fixedQuestions[0];
		expect(fodder).toContain(FODDER_MARKER[lang]);

		for (let i = 0; i < 20; i++) {
			const actions = buildQuickActions(makeT(bundle));
			const lastFaq = actions.map((action) => action.kind).lastIndexOf("open_faq_panel");
			const card = actions[lastFaq + 1];
			if (!card) throw new Error(`no card below the FAQ cards for ${lang}`);
			expect(card.title).toBe(fodder);
			expect(card.kind).toBe("ask");
			expect(card.icon).toBe("cow");
			expect(actions[lastFaq + 2]?.title).toBe(bundle.fixedQuestions[1]);

			const titles = actions.map((action) => action.title);
			expect(titles.filter((title) => title === fodder)).toHaveLength(1);
			expect(titles.slice(lastFaq + 1)).toEqual(bundle.fixedQuestions);
			expect(titles.some((title) => /biogas|બાયોગેસ|बायोगैस|बायोगॅस|বায়োগ্যাস|ਬਾਇਓਗੈਸ/i.test(title))).toBe(false);
		}
	});
});
