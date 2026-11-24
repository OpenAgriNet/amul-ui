import { describe, expect, it } from "vitest";
import { isSignedInFarmerToken } from "./identity";

// Unsigned test tokens: only the claims matter, the signature is never checked here.
const token = (claims: Record<string, unknown>) => {
	const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
	return `${part({ alg: "none", typ: "JWT" })}.${part(claims)}.sig`;
};

describe("isSignedInFarmerToken", () => {
	it("accepts a farmer token with a phone number", () => {
		expect(isSignedInFarmerToken(token({ sub: "9000000001", phone: "9000000001", user_type: "farmer" }))).toBe(true);
	});

	it("keeps guests on the existing chat: anonymous tokens are refused", () => {
		// Shape of /api/auth/anonymous tokens (app/routers/auth.py).
		expect(isSignedInFarmerToken(token({ sub: "anon-abc", anonymous: true }))).toBe(false);
	});

	it("refuses guest-user tokens and tokens without a phone number", () => {
		expect(isSignedInFarmerToken(token({ sub: "x", phone: "9000000001", is_guest_user: true }))).toBe(false);
		expect(isSignedInFarmerToken(token({ sub: "staff@example.com", email: "staff@example.com" }))).toBe(false);
		expect(isSignedInFarmerToken(token({ sub: "x", phone: "  " }))).toBe(false);
	});

	it("refuses a missing or unreadable token", () => {
		expect(isSignedInFarmerToken(null)).toBe(false);
		expect(isSignedInFarmerToken("not-a-jwt")).toBe(false);
	});
});
