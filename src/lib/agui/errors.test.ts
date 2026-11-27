import { describe, expect, it } from "vitest";
import en from "../../../translations/en.json";
import gu from "../../../translations/gu.json";
import hi from "../../../translations/hi.json";
import mr from "../../../translations/mr.json";
import { aguiErrorText, GENERIC_CHAT_ERROR } from "./errors";

const translations = { en, gu, hi, mr };

// Codes the backend raises in OpenAgriNet/amul-oan-api#628 (app/agui/service.py).
const BACKEND_CODES = [
	"SESSION_LIMIT",
	"COMPONENT_NOT_FOUND",
	"STALE_COMPONENT",
	"UNSUPPORTED_ACTION",
	"INVALID_OPTION",
	"STALE_STATE",
	"ACCOUNTS_UNAVAILABLE",
	"MILK_UNAVAILABLE",
	"NO_FARMER_ACCOUNT",
	"STATE_UNAVAILABLE",
	"RUN_IN_PROGRESS",
	"SESSION_BUSY",
	"FARMER_SIGN_IN_REQUIRED",
	// AI booking, OpenAgriNet/amul-oan-api#637. AI_BOOKING_NOT_ALLOWED is left to
	// the backend's own localised union-policy message.
	"BOOKING_CONTEXT_UNAVAILABLE",
	"TECHNICIANS_UNAVAILABLE",
	"NO_AI_TECHNICIANS",
	"AI_BOOKING_REJECTED",
	"AI_BOOKING_NOT_SENT",
	"AI_BOOKING_UNCONFIRMED",
	"AI_BOOKING_ALREADY_REQUESTED",
	// Mandi and scheme sources, OpenAgriNet/amul-oan-api#640.
	"MANDI_LOCATION_UNSUPPORTED",
	"MANDI_UNAVAILABLE",
	"SCHEMES_UNAVAILABLE",
	"SCHEME_ACCESS_CHANGED"
];

describe("aguiErrorText", () => {
	it("has a translation for every backend code in every language we ship", () => {
		for (const lang of ["en", "gu", "hi", "mr"] as const) {
			for (const code of BACKEND_CODES) {
				expect((translations[lang].agui.errors as Record<string, string>)[code], `${lang} ${code}`).toBeTruthy();
			}
		}
	});

	it("uses the frontend translation over the backend message", () => {
		expect(aguiErrorText(translations, "gu", "STALE_COMPONENT", "This control was used or changed.")).toBe(
			gu.agui.errors.STALE_COMPONENT
		);
	});

	it("falls back to English for a language without the key", () => {
		expect(aguiErrorText(translations, "pa", "SESSION_BUSY", "backend text")).toBe(en.agui.errors.SESSION_BUSY);
	});

	it("falls back to the backend message for an unknown code", () => {
		expect(aguiErrorText(translations, "gu", "SOMETHING_NEW", "Backend says no.")).toBe("Backend says no.");
	});

	it("falls back to the generic text when there is nothing else", () => {
		expect(aguiErrorText(translations, "gu", null, null)).toBe(GENERIC_CHAT_ERROR);
	});
});
