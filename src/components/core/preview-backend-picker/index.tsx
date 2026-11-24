import { useEffect, useState } from "react";

import type { PreviewBackend } from "@/lib/config/preview-backend";
import {
	browserStorage,
	fetchPreviewBackends,
	isPreviewSwitchEnabled,
	previewBackendUrl,
	readSelectedPreview,
	writeSelectedPreview
} from "@/lib/config/preview-backend";
import { cn } from "@/lib/utils/index";

const BUILD_API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;
const OPTION_TITLE_MAX_LENGTH = 48;

type ListState =
	| { status: "loading" }
	| { status: "ready"; backends: PreviewBackend[] }
	| { status: "failed" };

function optionLabel({ name, title }: PreviewBackend): string {
	const shortTitle =
		title.length > OPTION_TITLE_MAX_LENGTH
			? `${title.slice(0, OPTION_TITLE_MAX_LENGTH - 1)}…`
			: title;
	return `${name}${shortTitle ? ` · ${shortTitle}` : ""}`;
}

/**
 * Dev-only switch, bottom-left: which backend this browser's chat talks to. Renders nothing in a
 * build that does not use the dev API, inside another site's frame, or when the browser cannot
 * store the choice.
 * The rules live in lib/config/preview-backend.ts.
 */
export function PreviewBackendPicker() {
	const [storage] = useState(browserStorage);
	const enabled = storage !== null && isPreviewSwitchEnabled(BUILD_API_BASE_URL);
	const [selected] = useState(() => readSelectedPreview(storage));
	const [list, setList] = useState<ListState>({ status: "loading" });
	const [hidden, setHidden] = useState(false);

	useEffect(() => {
		if (!enabled) return;
		if (selected) console.info(`[dev] API calls go to ${previewBackendUrl(selected)}`);
		let active = true;
		fetchPreviewBackends()
			.then((backends) => {
				if (!active) return;
				const gone = selected !== null && !backends.some((backend) => backend.name === selected);
				// The picked preview was stopped: go back to dev instead of failing every request.
				if (gone && writeSelectedPreview(storage, null)) {
					window.location.reload();
					return;
				}
				setList({ status: "ready", backends });
			})
			.catch((error: unknown) => {
				if (!active) return;
				console.warn("Previews list unavailable, keeping the current backend", error);
				setList({ status: "failed" });
			});
		return () => {
			active = false;
		};
	}, [enabled, selected, storage]);

	if (!enabled || hidden) return null;

	const backends = list.status === "ready" ? list.backends : [];
	// Keep the current choice in the menu while the list loads or when it cannot be loaded.
	const unlisted =
		selected !== null && !backends.some((backend) => backend.name === selected) ? selected : null;
	const onPreview = selected !== null;

	const choose = (value: string) => {
		const next = value === "" ? null : value;
		if (next === selected) return;
		if (writeSelectedPreview(storage, next)) window.location.reload();
	};

	return (
		<div
			className={cn(
				"fixed bottom-2 left-2 z-40 flex max-w-[calc(100vw-1rem)] items-center gap-1.5 rounded-full border px-3 py-1 text-xs shadow-sm",
				onPreview
					? "border-amber-500 bg-amber-100 text-amber-950"
					: "border-border bg-background/95 text-muted-foreground"
			)}
		>
			{/* Visible from sm up; on a phone only the menu shows, so the footer text stays readable. */}
			<label
				htmlFor="dev-preview-backend"
				className="sr-only font-medium whitespace-nowrap sm:not-sr-only"
			>
				{onPreview ? "Preview backend" : "Backend"}
			</label>
			<select
				id="dev-preview-backend"
				value={selected ?? ""}
				onChange={(event) => choose(event.target.value)}
				className="max-w-56 min-w-0 truncate bg-transparent outline-none"
			>
				<option value="">dev (default)</option>
				{unlisted && <option value={unlisted}>{unlisted}</option>}
				{backends.map((backend) => (
					<option key={backend.name} value={backend.name}>
						{optionLabel(backend)}
					</option>
				))}
			</select>
			{list.status === "loading" && <span aria-hidden="true">…</span>}
			{list.status === "failed" && (
				<span title="Could not load the previews list" aria-label="Previews list unavailable">
					!
				</span>
			)}
			<button
				type="button"
				onClick={() => setHidden(true)}
				aria-label="Hide the backend switch until the next reload"
				className="ml-0.5 leading-none opacity-70 hover:opacity-100"
			>
				×
			</button>
		</div>
	);
}
