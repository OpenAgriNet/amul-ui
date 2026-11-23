import { environment } from "@/lib/config/environment";
import { getUiFlags } from "@/lib/ui-flags";

/**
 * Whether this turn goes to POST /api/chat/ (AG-UI). Only when the backend
 * advertises chat_agui_enabled on /api/ui-flags/; otherwise the chat keeps the
 * existing GET stream.
 */
export function shouldUseAguiTransport(): boolean {
	return getUiFlags().chatAgui;
}

export const aguiApiUrl = (): string => environment.apiUrl;
