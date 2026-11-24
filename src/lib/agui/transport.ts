import apiService from "@/lib/api-service";
import { environment } from "@/lib/config/environment";
import { getUiFlags } from "@/lib/ui-flags";
import { isSignedInFarmerToken } from "./identity";

/**
 * Whether this turn goes to POST /api/chat/ (AG-UI): only when the backend
 * advertises chat_agui_enabled on /api/ui-flags/ and a farmer is signed in.
 * Guests and everyone else keep the existing GET stream.
 */
export function shouldUseAguiTransport(): boolean {
	return getUiFlags().chatAgui && isSignedInFarmerToken(apiService.getBearerToken());
}

export const aguiApiUrl = (): string => environment.apiUrl;
