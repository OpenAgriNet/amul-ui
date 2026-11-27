import type { AmulUIState, UIComponent } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function emptyUiState(): AmulUIState {
	return { version: 1, state_revision: 0, selected_milk_account: null, components: [] };
}

/** Pulls `amul_ui` out of a STATE_SNAPSHOT payload, or null if it isn't one we understand. */
export function readAmulUiSnapshot(snapshot: unknown): AmulUIState | null {
	if (!snapshot || typeof snapshot !== "object") return null;
	const amulUi = (snapshot as { amul_ui?: unknown }).amul_ui;
	if (!amulUi || typeof amulUi !== "object") return null;
	const candidate = amulUi as Partial<AmulUIState>;
	if (candidate.version !== 1 || typeof candidate.state_revision !== "number" || !Array.isArray(candidate.components)) {
		return null;
	}
	return candidate as AmulUIState;
}

/**
 * Snapshots are complete, so the newest one wins. An older or equal revision
 * can arrive from a slow request or a duplicate, and is dropped.
 */
export function applySnapshot(current: AmulUIState, next: AmulUIState): AmulUIState {
	return next.state_revision > current.state_revision ? next : current;
}

export function componentsForMessage(state: AmulUIState, messageId: string): UIComponent[] {
	return state.components.filter((component) => component.message_id === messageId);
}

const normalise = (text: string) => text.trim().replace(/[.:!?।]+$/u, "").toLowerCase();

/**
 * The backend anchors every control to a short assistant message. When that
 * message only repeats a control's title ("Milk records"), showing it as its
 * own bubble duplicates the title, so the bubble is left out.
 */
export function onlyRepeatsControlTitle(body: string, components: UIComponent[]): boolean {
	if (components.length === 0) return false;
	const text = normalise(body);
	return text === "" || components.some((c) => normalise(c.title) === text);
}

/** "YYYY-MM-DD" in local time, matching what the farmer picked on the calendar. */
export function toIsoDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/**
 * A real calendar date from "YYYY-MM-DD" (chart, period) or the provider's
 * "DD-MM-YYYY" / "DD/MM/YYYY" (detail rows). Null for anything else, including
 * impossible dates like 31-02-2026.
 */
export function parseProviderDate(value: string): Date | null {
	const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	const dmy = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(value);
	const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : [];
	if (!y || !m || !d) return null;
	const date = new Date(Number(y), Number(m) - 1, Number(d));
	const real = date.getFullYear() === Number(y) && date.getMonth() === Number(m) - 1 && date.getDate() === Number(d);
	return real ? date : null;
}

export function fromIsoDate(value: string): Date {
	const [y, m, d] = value.split("-").map(Number);
	return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Whole days from `from` to `to`; 1 Jan → 1 Feb is 31. */
export function daysBetween(from: Date, to: Date): number {
	const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
	const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
	return Math.round((b - a) / DAY_MS);
}

/** The backend rule: the end date may be up to `maxDays` days after the start. */
export function isRangeAllowed(from: Date, to: Date, maxDays: number): boolean {
	const diff = daysBetween(from, to);
	return diff >= 0 && diff <= maxDays;
}

export function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}
