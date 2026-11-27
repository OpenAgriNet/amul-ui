import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Pencil, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/hooks/store/chat";
import type { BookingOutcome, BookingOutcomeStatus, BookingSummary, ConfirmComponent } from "@/lib/agui/types";
import { cn } from "@/lib/utils";
import { AnsweredRow, ControlCard, useLabel } from "./shared";

type Pressed = "confirm" | "cancel" | "technician" | "species";

/**
 * #636: the AI booking review, and after Confirm, its outcome. The backend
 * localises the title and species label; account and technician names are
 * shown as the API returns them. Row labels and buttons are ours.
 */
export function BookingConfirm({ component }: { readonly component: ConfirmComponent }) {
	const { label } = useLabel();

	if (component.status === "submitted" && component.selected?.confirmed && component.outcome) {
		return <BookingOutcomeCard summary={component.summary} outcome={component.outcome} />;
	}
	if (component.status !== "pending") {
		const expired = component.status === "expired";
		let value = label("notAnswered");
		if (expired) value = label("expired");
		else if (component.selected?.confirmed === false) value = label("bookingCancelled");
		else if (component.selected?.confirmed === true) value = label("bookingSent");
		return <AnsweredRow label={label("booking")} value={value} expired={expired} />;
	}
	return <PendingConfirm component={component} />;
}

function SummaryRows({ summary }: { readonly summary: BookingSummary }) {
	const { label } = useLabel();
	const rows: Array<[string, string, string | null]> = [
		[label("technician"), summary.technician.label, summary.technician.description],
		[label("animal"), summary.species_label, null],
		[label("account"), summary.account_label, null]
	];
	return (
		<dl className="flex flex-col divide-y divide-primary/15 rounded-xl border border-primary/20 bg-background px-3">
			{rows.map(([term, value, detail]) => (
				<div key={term} className="flex items-start justify-between gap-3 py-2 text-sm">
					<dt className="shrink-0 text-muted-foreground">{term}</dt>
					<dd className="min-w-0 wrap-break-word text-right">
						<span className="block font-semibold text-foreground">{value}</span>
						{detail ? <span className="block text-xs text-muted-foreground tabular-nums">{detail}</span> : null}
					</dd>
				</div>
			))}
		</dl>
	);
}

function PendingConfirm({ component }: { readonly component: ConfirmComponent }) {
	const { label, language } = useLabel();
	const submitUiAction = useChatStore((s) => s.submitUiAction);
	const editAiBooking = useChatStore((s) => s.editAiBooking);
	const submittingId = useChatStore((s) => s.submittingComponentId);
	const busy = useChatStore((s) => s.isAssistantTyping);
	const [pressed, setPressed] = useState<Pressed | null>(null);

	const spinner = (button: Pressed) =>
		submittingId === component.id && pressed === button ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null;

	const answer = (confirmed: boolean) => {
		setPressed(confirmed ? "confirm" : "cancel");
		void submitUiAction(
			{ component_id: component.id, revision: component.revision, kind: "confirm", value: { confirmed } },
			language
		);
	};

	const edit = (field: "technician" | "species") => {
		setPressed(field);
		void editAiBooking(component.id, component.workflow_id, field, language);
	};

	// Labels may wrap to two lines on a phone ("Change technician" does not fit in English).
	const outline =
		"h-auto min-h-9 whitespace-normal rounded-xl border-primary/40 px-2 py-1.5 text-sm leading-tight font-semibold text-primary hover:bg-primary/5 hover:text-primary";

	return (
		<ControlCard>
			<p className="mb-2 text-sm font-semibold text-foreground">{component.title}</p>
			<SummaryRows summary={component.summary} />

			<Button className="mt-3 h-10 w-full rounded-xl font-semibold" disabled={busy} onClick={() => answer(true)}>
				{spinner("confirm")}
				{submittingId === component.id && pressed === "confirm" ? label("sending") : label("confirmBooking")}
			</Button>
			<div className="mt-2 grid grid-cols-2 gap-2">
				<Button variant="outline" className={outline} disabled={busy} onClick={() => edit("technician")}>
					{spinner("technician") ?? <Pencil className="h-4 w-4" aria-hidden="true" />}
					<span>{label("changeTechnician")}</span>
				</Button>
				<Button variant="outline" className={outline} disabled={busy} onClick={() => edit("species")}>
					{spinner("species") ?? <Pencil className="h-4 w-4" aria-hidden="true" />}
					<span>{label("changeAnimal")}</span>
				</Button>
			</div>
			<Button
				variant="ghost"
				className="mt-1 h-9 w-full rounded-xl text-sm font-semibold text-muted-foreground"
				disabled={busy}
				onClick={() => answer(false)}
			>
				{spinner("cancel") ?? <X className="h-4 w-4" aria-hidden="true" />}
				{label("cancelBooking")}
			</Button>
		</ControlCard>
	);
}

const OUTCOME: Record<BookingOutcomeStatus, { icon: typeof CheckCircle2; tone: string }> = {
	confirmed: { icon: CheckCircle2, tone: "text-primary" },
	rejected: { icon: XCircle, tone: "text-destructive" },
	not_sent: { icon: XCircle, tone: "text-destructive" },
	// The visit may or may not be booked: never offer a resubmit.
	unconfirmed: { icon: AlertTriangle, tone: "text-amber-600 dark:text-amber-400" },
	already_requested: { icon: AlertTriangle, tone: "text-amber-600 dark:text-amber-400" }
};

/**
 * The result of a confirmed booking, on the same card. The backend also sends
 * `message` as a new assistant message below, so it is not repeated here. The
 * ticket is shown only when the booking API returned one.
 */
function BookingOutcomeCard({ summary, outcome }: { readonly summary: BookingSummary; readonly outcome: BookingOutcome }) {
	const { label } = useLabel();
	const look = OUTCOME[outcome.status] ?? OUTCOME.unconfirmed;
	const Icon = look.icon;
	const heading = OUTCOME[outcome.status] ? `outcome.${outcome.status}` : "outcome.unconfirmed";

	return (
		<ControlCard>
			<div role="status" className="mb-3 flex items-start gap-3">
				<Icon className={cn("mt-0.5 h-5 w-5 shrink-0", look.tone)} aria-hidden="true" />
				<div className="min-w-0 flex-1">
					<p className="text-sm font-semibold text-foreground">{label(heading)}</p>
					{outcome.ticket ? (
						<p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm">
							<span className="text-muted-foreground">{label("ticket")}:</span>
							<span className="select-all break-all font-mono font-semibold text-foreground">{outcome.ticket}</span>
						</p>
					) : null}
				</div>
			</div>
			<SummaryRows summary={summary} />
		</ControlCard>
	);
}
