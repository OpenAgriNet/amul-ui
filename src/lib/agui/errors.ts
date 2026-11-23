type TranslationTree = Record<string, any>;

export const GENERIC_CHAT_ERROR = "Sorry, there was an error processing your request. Please try again.";

/**
 * Text for a backend error (#593, Q8): the frontend translates known codes;
 * an unknown code falls back to the backend's own message.
 */
export function aguiErrorText(
	translations: Record<string, TranslationTree>,
	language: string,
	code?: string | null,
	backendMessage?: string | null
): string {
	const lookup = (lang: string): string | undefined => {
		if (!code) return undefined;
		const value = translations[lang]?.agui?.errors?.[code];
		return typeof value === "string" ? value : undefined;
	};
	return lookup(language) ?? lookup("en") ?? (backendMessage || GENERIC_CHAT_ERROR);
}
