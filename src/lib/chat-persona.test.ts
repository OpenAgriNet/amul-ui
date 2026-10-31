import { describe, expect, it } from "vitest";

import { normalizeChatPersona, resolveChatPersona } from "./chat-persona";

describe("chat persona", () => {
	it("normalizes signed doctor claims and defaults unknown values to farmer", () => {
		expect(normalizeChatPersona("doctor")).toBe("doctor");
		expect(normalizeChatPersona("DOCTOR")).toBe("doctor");
		expect(normalizeChatPersona("admin")).toBe("farmer");
		expect(normalizeChatPersona(undefined)).toBe("farmer");
	});

	it("pins the persona to farmer on a build with the selector hidden", () => {
		// A doctor JWT must not flip the header title, welcome copy, or the
		// persona sent to the API when the flag is off.
		expect(resolveChatPersona("doctor", false)).toBe("farmer");
		expect(resolveChatPersona("doctor", true)).toBe("doctor");
		expect(resolveChatPersona(undefined, true)).toBe("farmer");
	});
});
