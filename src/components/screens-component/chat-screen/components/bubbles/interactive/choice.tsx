import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/hooks/store/chat";
import type { ChoiceComponent, ChoicePurpose } from "@/lib/agui/types";
import { cn } from "@/lib/utils";
import { AnsweredRow, ControlCard, useLabel } from "./shared";

/** Label of the answered row ("Account: …"), by what the picker chooses. */
const ANSWER_LABEL: Record<ChoicePurpose, string> = {
	milk_account: "account",
	ai_technician: "technician",
	ai_species: "animal"
};

/**
 * A single-choice picker: milk account (#593), AI technician or Cow/Buffalo
 * (#636). Only the option id is sent back; the backend maps it. Booking
 * pickers also offer Cancel, which ends the booking at this stage.
 */
export function ChoiceControl({ component }: { readonly component: ChoiceComponent }) {
	const { label, language } = useLabel();
	const submitUiAction = useChatStore((s) => s.submitUiAction);
	const cancelAiBooking = useChatStore((s) => s.cancelAiBooking);
	const submittingId = useChatStore((s) => s.submittingComponentId);
	const busy = useChatStore((s) => s.isAssistantTyping);
	const [picked, setPicked] = useState<string | null>(null);
	const [cancelling, setCancelling] = useState(false);

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

	return (
		<ControlCard>
			<p className="mb-2 text-sm font-semibold text-foreground">{component.title}</p>
			<div role="radiogroup" aria-label={component.title} className="flex flex-col gap-2">
				{component.options.map((option) => {
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
								<span className="block text-sm font-semibold text-foreground">{option.label}</span>
								{option.description ? (
									<span className="block text-xs text-muted-foreground">{option.description}</span>
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
