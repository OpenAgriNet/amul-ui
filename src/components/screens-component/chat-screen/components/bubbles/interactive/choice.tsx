import { useId, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/hooks/store/chat";
import { filterChoiceOptions } from "@/lib/agui/choice-search";
import type { ChoiceComponent, ChoiceOption, ChoicePurpose } from "@/lib/agui/types";
import { cn } from "@/lib/utils";
import { AnsweredRow, ControlCard, useLabel } from "./shared";

/** Label of the answered row ("Account: …"), by what the picker chooses. */
const ANSWER_LABEL: Record<ChoicePurpose, string> = {
	milk_account: "account",
	ai_technician: "technician",
	ai_species: "animal",
	mandi_location: "district",
	scheme: "scheme"
};

/**
 * A single-choice picker: milk account (#593), AI technician or Cow/Buffalo
 * (#636), mandi district or scheme (#639). Only the option id is sent back;
 * the backend maps it. Booking pickers also offer Cancel, which ends the
 * booking at this stage. Searchable pickers filter their options here.
 */
export function ChoiceControl({ component }: { readonly component: ChoiceComponent }) {
	const { label, language } = useLabel();
	const submitUiAction = useChatStore((s) => s.submitUiAction);
	const cancelAiBooking = useChatStore((s) => s.cancelAiBooking);
	const submittingId = useChatStore((s) => s.submittingComponentId);
	const busy = useChatStore((s) => s.isAssistantTyping);
	const [picked, setPicked] = useState<string | null>(null);
	const [cancelling, setCancelling] = useState(false);
	const [query, setQuery] = useState("");
	const visible = useMemo(
		() => (component.searchable ? filterChoiceOptions(component.options, query) : component.options),
		[component.options, component.searchable, query]
	);

	if (component.status !== "pending") {
		const chosen = component.options.find((o) => o.id === component.selected?.option_id);
		return (
			<AnsweredRow
				label={label(ANSWER_LABEL[component.purpose] ?? "choice")}
				value={chosen?.label ?? (component.status === "expired" ? label("expired") : label("notAnswered"))}
				expired={component.status === "expired"}
			/>
		);
	}

	const submitting = submittingId === component.id;
	const isBooking = component.purpose === "ai_technician" || component.purpose === "ai_species";
	const submit = () => {
		if (!picked) return;
		setCancelling(false);
		void submitUiAction(
			{ component_id: component.id, revision: component.revision, kind: "choice", value: { option_id: picked } },
			language
		);
	};

	// A picked option stays on screen while the search hides the others.
	const pickedOption = picked ? component.options.find((o) => o.id === picked) : undefined;
	const shown: ChoiceOption[] = pickedOption && !visible.includes(pickedOption) ? [pickedOption, ...visible] : visible;

	return (
		<ControlCard>
			<p className="mb-2 text-sm font-semibold text-foreground">{component.title}</p>
			{component.searchable ? <ChoiceSearch value={query} onChange={setQuery} disabled={busy} /> : null}
			<div
				role="radiogroup"
				aria-label={component.title}
				className={cn("flex flex-col gap-2", component.searchable && "max-h-72 overflow-y-auto overscroll-contain p-0.5")}
			>
				{visible.length === 0 ? (
					<p role="status" className="px-1 py-3 text-center text-sm text-muted-foreground">
						{label("noMatches")}
					</p>
				) : null}
				{shown.map((option) => {
					const selected = picked === option.id;
					return (
						<button
							key={option.id}
							type="button"
							role="radio"
							aria-checked={selected}
							disabled={busy}
							onClick={() => setPicked(option.id)}
							className={cn(
								"flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
								"focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-60",
								selected ? "border-primary bg-primary/5" : "border-primary/20 bg-background hover:border-primary/50"
							)}
						>
							<span
								className={cn(
									"grid h-5 w-5 shrink-0 place-items-center rounded-full border",
									selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
								)}
								aria-hidden="true"
							>
								{selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
							</span>
							<span className="min-w-0">
								<span className="block text-sm font-semibold text-foreground wrap-break-word">{option.label}</span>
								{option.description ? (
									<span className="block text-xs text-muted-foreground wrap-break-word">{option.description}</span>
								) : null}
							</span>
						</button>
					);
				})}
			</div>
			<Button className="mt-3 h-10 w-full rounded-xl font-semibold" disabled={!picked || busy} onClick={submit}>
				{submitting && !cancelling ? (
					<>
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
						{label("sending")}
					</>
				) : (
					label("continue")
				)}
			</Button>
			{isBooking ? (
				<Button
					variant="ghost"
					className="mt-1 h-9 w-full rounded-xl text-sm font-semibold text-muted-foreground"
					disabled={busy}
					onClick={() => {
						setCancelling(true);
						void cancelAiBooking(component.id, component.workflow_id, language);
					}}
				>
					{submitting && cancelling ? (
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
					) : (
						<X className="h-4 w-4" aria-hidden="true" />
					)}
					{label("cancelBooking")}
				</Button>
			) : null}
		</ControlCard>
	);
}

/** The search box over a searchable picker. Not focused on its own, so a phone keyboard does not pop up. */
function ChoiceSearch({
	value,
	onChange,
	disabled
}: {
	readonly value: string;
	readonly onChange: Dispatch<SetStateAction<string>>;
	readonly disabled: boolean;
}) {
	const { label } = useLabel();
	const id = useId();
	return (
		<div className="relative mb-2">
			<label htmlFor={id} className="sr-only">
				{label("search")}
			</label>
			<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
			<input
				id={id}
				type="search"
				value={value}
				disabled={disabled}
				onChange={(e) => onChange(e.target.value)}
				placeholder={label("search")}
				autoComplete="off"
				enterKeyHint="search"
				className={cn(
					"h-10 w-full rounded-xl border border-primary/20 bg-background pl-9 pr-9 text-sm text-foreground",
					"placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
					"disabled:cursor-not-allowed disabled:opacity-60 [&::-webkit-search-cancel-button]:hidden"
				)}
			/>
			{value ? (
				<button
					type="button"
					onClick={() => onChange("")}
					aria-label={label("clearSearch")}
					className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
				>
					<X className="h-4 w-4" aria-hidden="true" />
				</button>
			) : null}
		</div>
	);
}
