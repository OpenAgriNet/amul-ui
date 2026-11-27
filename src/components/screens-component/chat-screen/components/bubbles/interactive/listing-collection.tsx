import { useId, useMemo, useState, type Dispatch } from "react";
import { AlertTriangle, ChevronDown, Eye, Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/hooks/store/chat";
import { activeFilterCount, factMap, filterDraft, filtersFromDraft } from "@/lib/agui/listings";
import type { ListingCard, ListingCollectionComponent, ListingFilterDefinition } from "@/lib/agui/types";
import { cn } from "@/lib/utils";
import { cardRows, enumLabel, formatWhen, headlinePrice, type Labels, listingTitle } from "./listing-format";
import { AnsweredRow, ControlCard, formatNumber, useLabel } from "./shared";

/**
 * #639 / backend #641: verified cattle or fodder listings as cards, with every
 * filter the source supports and View details. Filtering replaces the cards
 * on this same control; details open in their own card below.
 */
export function ListingCollection({ component }: { readonly component: ListingCollectionComponent }) {
	const labels = useLabel();
	const { label } = labels;

	if (component.status === "expired") {
		return <AnsweredRow label={component.title} value={label("expired")} expired />;
	}

	return (
		<ControlCard>
			<p className="text-sm font-semibold text-foreground">{component.title}</p>
			<Counts component={component} labels={labels} />
			<SourceNotice stale={component.stale} notice={component.notice} />
			{/* A new revision brings new filters and cards: start the form from them. */}
			<FilterPanel key={component.revision} component={component} labels={labels} />
			{component.cards.length > 0 ? (
				<ul className="mt-3 flex flex-col gap-2">
					{component.cards.map((card) => (
						<li key={card.listing_ref}>
							<SummaryCard component={component} card={card} labels={labels} />
						</li>
					))}
				</ul>
			) : (
				<p role="status" className="mt-3 rounded-xl bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">
					{emptyText(component.source_status, labels)}
				</p>
			)}
		</ControlCard>
	);
}

function emptyText(status: string, { label }: Labels): string {
	if (status === "unavailable") return label("listing.unavailable");
	if (status === "clarification_needed" || status === "location_not_found" || status === "name_not_resolved") {
		return label("listing.clarifyInChat");
	}
	return label("listing.noMatches");
}

/** Shown, matched and source totals are different numbers and are labelled apart. */
function Counts({ component, labels }: { readonly component: ListingCollectionComponent; readonly labels: Labels }) {
	const { label, language } = labels;
	const n = (value: number) => formatNumber(value, 0);
	const parts: string[] = [];
	if (component.displayed_count > 0) {
		parts.push(
			component.match_count !== null && component.match_count > component.displayed_count
				? label("listing.showingOf", { shown: n(component.displayed_count), matches: n(component.match_count) })
				: label("listing.showing", { shown: n(component.displayed_count) })
		);
	}
	if (component.elsewhere_count) parts.push(label("listing.elsewhere", { count: n(component.elsewhere_count) }));
	if (component.source_total !== null) parts.push(label("listing.sourceTotal", { count: n(component.source_total) }));
	if (component.fetched_at !== null) parts.push(label("listing.updated", { date: formatWhen(component.fetched_at, language) }));
	if (parts.length === 0) return null;
	return <p className="mt-0.5 text-xs text-muted-foreground">{parts.join(" · ")}</p>;
}

/** Stale-data warnings stay visible; other source notices are shown as sent. */
export function SourceNotice({ stale, notice }: { readonly stale: boolean; readonly notice: string | null }) {
	const { label } = useLabel();
	if (!stale && !notice) return null;
	return (
		<p
			role="note"
			className={cn(
				"mt-2 flex items-start gap-2 rounded-xl px-3 py-2 text-xs",
				stale ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" : "bg-muted/60 text-muted-foreground"
			)}
		>
			{stale ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
			<span>{stale ? label("listing.stale") : notice}</span>
		</p>
	);
}

function FilterPanel({ component, labels }: { readonly component: ListingCollectionComponent; readonly labels: Labels }) {
	const { label, labelOr, language } = labels;
	const submitUiAction = useChatStore((s) => s.submitUiAction);
	const submittingId = useChatStore((s) => s.submittingComponentId);
	const busy = useChatStore((s) => s.isAssistantTyping);
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState(() => filterDraft(component.filter_definitions, component.filters));
	const [applying, setApplying] = useState(false);
	const panelId = useId();

	const { filters, invalid } = useMemo(() => filtersFromDraft(component.filter_definitions, draft), [component.filter_definitions, draft]);
	const active = activeFilterCount(component.filters);
	if (component.filter_definitions.length === 0) return null;

	const apply = () => {
		if (invalid.length > 0) return;
		setApplying(true);
		void submitUiAction(
			{ component_id: component.id, revision: component.revision, kind: "listing_filters", value: { source: component.purpose, filters } },
			language
		);
	};

	return (
		<div className="mt-3 rounded-xl border border-primary/20">
			<button
				type="button"
				aria-expanded={open}
				aria-controls={panelId}
				onClick={() => setOpen((v) => !v)}
				className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary"
			>
				<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
				<span className="flex-1 text-left">{active > 0 ? label("listing.filtersActive", { count: String(active) }) : label("listing.filterButton")}</span>
				<ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
			</button>
			{open ? (
				<div id={panelId} className="border-t border-primary/15 px-3 pb-3 pt-2">
					<div className="grid grid-cols-2 items-end gap-x-2.5 gap-y-2">
						{component.filter_definitions.map((definition) => (
							<FilterField
								key={definition.name}
								definition={definition}
								value={draft[definition.name] ?? ""}
								invalid={invalid.includes(definition.name)}
								disabled={busy}
								labels={labels}
								onChange={(value) => setDraft((d) => ({ ...d, [definition.name]: value }))}
							/>
						))}
					</div>
					<div className="mt-3 flex gap-2">
						<Button className="h-10 flex-1 rounded-xl font-semibold" disabled={busy || invalid.length > 0} onClick={apply}>
							{submittingId === component.id && applying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
							{submittingId === component.id && applying ? label("sending") : label("listing.applyFilters")}
						</Button>
						<Button
							variant="ghost"
							className="h-10 rounded-xl font-semibold text-muted-foreground"
							disabled={busy}
							onClick={() => setDraft(Object.fromEntries(component.filter_definitions.map((d) => [d.name, ""])))}
						>
							{labelOr("listing.clearFilters", "Clear")}
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}

const fieldClass = cn(
	"h-10 w-full rounded-lg border bg-background px-2.5 text-sm text-foreground",
	"focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-60"
);

function FilterField({
	definition,
	value,
	invalid,
	disabled,
	labels,
	onChange
}: {
	readonly definition: ListingFilterDefinition;
	readonly value: string;
	readonly invalid: boolean;
	readonly disabled: boolean;
	readonly labels: Labels;
	readonly onChange: Dispatch<string>;
}) {
	const { label, labelOr } = labels;
	const id = useId();
	const name = labelOr(`listing.filters.${definition.name}`, definition.name.replace(/_/g, " "));
	const unit = definition.unit ? ` (${definition.unit})` : "";
	const border = invalid ? "border-destructive" : "border-primary/20";

	let input;
	if (definition.kind === "select") {
		input = (
			<select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={cn(fieldClass, border)}>
				<option value="">{label("listing.any")}</option>
				{definition.options.map((option) => (
					<option key={option} value={option}>
						{enumLabel(labels, option)}
					</option>
				))}
			</select>
		);
	} else if (definition.kind === "number") {
		input = (
			<input
				id={id}
				type="number"
				inputMode="decimal"
				min={definition.minimum ?? undefined}
				max={definition.maximum ?? undefined}
				value={value}
				disabled={disabled}
				aria-invalid={invalid}
				placeholder={definition.name === "limit" ? "5" : label("listing.any")}
				onChange={(e) => onChange(e.target.value)}
				className={cn(fieldClass, border)}
			/>
		);
	} else {
		// Options are source-backed suggestions, not the only allowed values.
		input = (
			<>
				<input
					id={id}
					type="text"
					list={definition.options.length > 0 ? `${id}-options` : undefined}
					value={value}
					disabled={disabled}
					autoComplete="off"
					placeholder={label("listing.any")}
					onChange={(e) => onChange(e.target.value)}
					className={cn(fieldClass, border)}
				/>
				{definition.options.length > 0 ? (
					<datalist id={`${id}-options`}>
						{definition.options.map((option) => (
							<option key={option} value={option} />
						))}
					</datalist>
				) : null}
			</>
		);
	}

	return (
		<div className="min-w-0">
			<label htmlFor={id} className="mb-1 block text-xs font-medium text-muted-foreground">
				{name}
				{unit}
			</label>
			{input}
			{invalid ? (
				<p className="mt-0.5 text-xs text-destructive">
					{definition.minimum !== null && definition.maximum !== null
						? label("listing.between", { min: String(definition.minimum), max: String(definition.maximum) })
						: label("listing.invalidNumber")}
				</p>
			) : null}
		</div>
	);
}

function SummaryCard({
	component,
	card,
	labels
}: {
	readonly component: ListingCollectionComponent;
	readonly card: ListingCard;
	readonly labels: Labels;
}) {
	const { label, language } = labels;
	const submitUiAction = useChatStore((s) => s.submitUiAction);
	const submittingId = useChatStore((s) => s.submittingComponentId);
	const busy = useChatStore((s) => s.isAssistantTyping);
	// The listing whose details are open right now, if any.
	const openRef = useChatStore(
		(s) =>
			s.amulUi.components.find((c) => c.kind === "listing_detail" && c.collection_id === component.id && c.status !== "expired") as
				| { listing_ref: string }
				| undefined
	)?.listing_ref;
	const [opening, setOpening] = useState(false);

	const facts = useMemo(() => factMap(card.facts), [card.facts]);
	const price = headlinePrice(component.purpose, facts, language);
	const rows = cardRows(component.purpose, facts, labels);
	const isOpen = openRef === card.listing_ref;
	const loading = opening && submittingId === component.id;

	const open = () => {
		setOpening(true);
		void submitUiAction(
			{ component_id: component.id, revision: component.revision, kind: "open_listing", value: { listing_ref: card.listing_ref } },
			language
		).finally(() => setOpening(false));
	};

	return (
		<article className={cn("rounded-xl border bg-background p-3", isOpen ? "border-primary" : "border-primary/20")}>
			<div className="flex items-start justify-between gap-2">
				<h4 className="min-w-0 wrap-break-word text-sm font-semibold capitalize text-foreground">
					{listingTitle(component.purpose, card.title, facts, labels)}
				</h4>
				{card.listing_number !== null ? (
					<span className="shrink-0 text-xs text-muted-foreground tabular-nums">#{card.listing_number}</span>
				) : null}
			</div>
			{price ? <p className="mt-0.5 text-base font-bold text-primary tabular-nums">{price}</p> : null}
			{rows.length > 0 ? (
				<dl className="mt-1.5 flex flex-col gap-0.5 text-xs">
					{rows.map((row) => (
						<div key={row.key} className="flex gap-1.5">
							<dt className="shrink-0 text-muted-foreground">{row.label}:</dt>
							<dd className="min-w-0 wrap-break-word text-foreground">{row.value}</dd>
						</div>
					))}
				</dl>
			) : null}
			<Button
				variant="outline"
				className="mt-2 h-9 w-full rounded-xl border-primary/40 text-sm font-semibold text-primary hover:bg-primary/5 hover:text-primary"
				disabled={busy}
				aria-pressed={isOpen}
				onClick={open}
			>
				{loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
				{isOpen ? label("listing.detailsShown") : label("listing.viewDetails")}
			</Button>
		</article>
	);
}
