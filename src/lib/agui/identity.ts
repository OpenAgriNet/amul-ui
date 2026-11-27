import { decodeJwt } from "jose";

/**
 * Whether a token belongs to a signed-in farmer, the only user the interactive
 * endpoint serves: it needs a phone number and must not be an anonymous or
 * guest token (the backend answers those with 403 FARMER_SIGN_IN_REQUIRED).
 */
export function isSignedInFarmerToken(token: string | null): boolean {
	if (!token) return false;
	try {
		const claims = decodeJwt(token) as Record<string, unknown>;
		if (claims.anonymous === true || claims.is_guest_user === true) return false;
		const phone = claims.phone ?? claims.mobile;
		return typeof phone === "string" && phone.trim() !== "";
	} catch {
		return false;
	}
}
