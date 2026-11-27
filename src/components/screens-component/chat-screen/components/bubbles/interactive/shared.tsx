import { createContext, useContext, type ReactNode } from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { parseProviderDate } from "@/lib/agui/state";
import { cn } from "@/lib/utils";

/** t() that always returns a string, for labels. */
export function useLabel() {
	const { t, language } = useLanguage();
	const label = (key: string, params?: Record<string, string>) => {
		const value = t(`agui.${key}`, params);
		return Array.isArray(value) ? value.join(" ") : value;
	};
	/** The label, or `fallback` when no language defines the key. */
	const labelOr = (key: string, fallback: string) => {
		const value = label(key);
		return value === `agui.${key}` ? fallback : value;
	};
	return { label, labelOr, language };
}

/** Indian grouping and Latin digits, whatever the chat language. */
export function formatNumber(value: number, fractionDigits = 1): string {
	return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits }).format(value);
}

export function formatRupees(value: number): string {
	return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}`;
}

/**
 * "1 Oct 2026" in the chat language's month names. Takes ISO dates and the
 * provider's DD-MM-YYYY (detail rows keep it); anything else is shown as sent.
 */
export function formatDate(value: string, language: string, withYear = true): string {
	const date = parseProviderDate(value);
	if (!date) return value;
	try {
		return new Intl.DateTimeFormat(`${language}-IN`, {
			day: "numeric",
			month: "short",
			...(withYear && { year: "numeric" }),
			numberingSystem: "latn"
		}).format(date);
	} catch {
		return value;
	}
}

export function formatRange(from: string, to: string, language: string): string {
	return from === to ? formatDate(from, language) : `${formatDate(from, language, from.slice(0, 4) !== to.slice(0, 4))} – ${formatDate(to, language)}`;
}

/**
 * True when the control sits right under its message's text bubble, so it
 * tucks up against it; false when that bubble is hidden.
 */
export const AttachedToBubble = createContext(true);

/** The frame every control sits in, below its assistant message. */
export function ControlCard({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
	const attached = useContext(AttachedToBubble);
	return (
		<div className={cn("w-full max-w-[95%] sm:max-w-[90%] mb-8", attached && "-mt-5", className)}>
			<div className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-black/5 dark:ring-white/10">{children}</div>
		</div>
	);
}

/** One-line record of a control that has been answered or has expired. */
export function AnsweredRow({ label, value, expired }: { readonly label: string; readonly value: string; readonly expired?: boolean }) {
	const attached = useContext(AttachedToBubble);
	return (
		<div
			className={cn(
				"w-full max-w-[95%] sm:max-w-[90%] mb-8 flex items-center gap-2 px-1 text-sm",
				attached && "-mt-5",
				expired ? "text-muted-foreground" : "text-foreground"
			)}
		>
			{expired ? (
				<Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
			) : (
				<CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
			)}
			<span className="text-muted-foreground">{label}:</span>
			<span className={cn("font-semibold min-w-0 truncate", expired && "font-normal")}>{value}</span>
		</div>
	);
}
