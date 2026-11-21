import { useMemo, useState } from "react";
import type { DateRange, Matcher } from "react-day-picker";
import { bn, enIN, gu, hi, type Locale } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useChatStore } from "@/hooks/store/chat";
import { addDays, daysBetween, fromIsoDate, isRangeAllowed, toIsoDate } from "@/lib/agui/state";
import type { DateRangeComponent } from "@/lib/agui/types";
import { cn } from "@/lib/utils";
import { AnsweredRow, ControlCard, formatRange, useLabel } from "./shared";

// date-fns has no Marathi or Punjabi locale; Indian English keeps the week on Monday like the others.
const CALENDAR_LOCALES: Record<string, Locale> = { gu, hi, bn, en: enIN };

type Preset = { key: string; from: Date; to: Date };

function buildPresets(today: Date): Preset[] {
	const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
	const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
	const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
	return [
		{ key: "last7", from: addDays(today, -6), to: today },
		{ key: "last15", from: addDays(today, -14), to: today },
		{ key: "thisMonth", from: firstOfMonth, to: today },
		{ key: "lastMonth", from: firstOfLastMonth, to: endOfLastMonth }
	];
}

const sameDay = (a?: Date, b?: Date) => !!a && !!b && toIsoDate(a) === toIsoDate(b);

export function MilkDateRange({ component }: { readonly component: DateRangeComponent }) {
	const { label, language } = useLabel();
	const submitUiAction = useChatStore((s) => s.submitUiAction);
	const submittingId = useChatStore((s) => s.submittingComponentId);
	const busy = useChatStore((s) => s.isAssistantTyping);
	const [range, setRange] = useState<DateRange | undefined>();

	const maxDays = component.constraints.max_difference_days;
	const maxDate = useMemo(() => {
		const today = new Date();
		const limit = component.constraints.max_date ? fromIsoDate(component.constraints.max_date) : today;
		return limit < today ? limit : today;
	}, [component.constraints.max_date]);
	const minDate = component.constraints.min_date ? fromIsoDate(component.constraints.min_date) : undefined;

	const presets = useMemo(
		() => buildPresets(maxDate).filter((p) => (!minDate || p.from >= minDate) && isRangeAllowed(p.from, p.to, maxDays)),
		[maxDate, minDate, maxDays]
	);

	if (component.status !== "pending") {
		const sel = component.selected;
		return (
			<AnsweredRow
				label={label("dates")}
				value={sel ? formatRange(sel.fromdate, sel.todate, language) : component.status === "expired" ? label("expired") : label("notAnswered")}
				expired={component.status === "expired"}
			/>
		);
	}

	const from = range?.from;
	const to = range?.to ?? range?.from;
	const tooLong = !!from && !!to && !isRangeAllowed(from, to, maxDays);
	const ready = !!from && !!to && !tooLong;
	const submitting = submittingId === component.id;

	// Once a start is picked, days past the limit are greyed out so the farmer can't pick them.
	const disabled: Matcher[] = [{ after: maxDate }];
	if (minDate) disabled.push({ before: minDate });
	if (from && !range?.to) disabled.push({ after: addDays(from, maxDays) });

	const submit = () => {
		if (!from || !to || !ready) return;
		void submitUiAction(
			{
				component_id: component.id,
				revision: component.revision,
				kind: "date_range",
				value: { fromdate: toIsoDate(from), todate: toIsoDate(to) }
			},
			language
		);
	};

	return (
		<ControlCard>
			<p className="mb-2 text-sm font-semibold text-foreground">{component.title}</p>

			<div className="mb-2 flex flex-wrap gap-2">
				{presets.map((preset) => {
					const active = sameDay(preset.from, from) && sameDay(preset.to, to);
					return (
						<button
							key={preset.key}
							type="button"
							disabled={busy}
							onClick={() => setRange({ from: preset.from, to: preset.to })}
							aria-pressed={active}
							className={cn(
								"h-8 rounded-full border px-3 text-xs font-medium transition-colors",
								"focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:opacity-60",
								active ? "border-primary bg-primary text-primary-foreground" : "border-primary/20 bg-background text-foreground hover:border-primary/50"
							)}
						>
							{label(preset.key)}
						</button>
					);
				})}
			</div>

			<div className="flex justify-center">
				<Calendar
					mode="range"
					selected={range}
					onSelect={setRange}
					disabled={busy ? true : disabled}
					defaultMonth={maxDate}
					endMonth={maxDate}
					startMonth={minDate}
					locale={CALENDAR_LOCALES[language] ?? enIN}
					// The shared calendar paints ranges and today with --accent, which is green next to
					// the chat's primary colour; keep the whole range in the primary hue instead.
					className={cn(
						"rounded-xl bg-transparent p-1 [--cell-size:--spacing(9)]",
						"[&_button[data-range-middle=true]]:bg-primary/15 [&_button[data-range-middle=true]]:text-foreground",
						String.raw`[&_td.rdp-range\_start]:bg-primary/15 [&_td.rdp-range\_end]:bg-primary/15`,
						"[&_td.rdp-today]:bg-transparent [&_td.rdp-today:not([data-selected=true])_button]:font-bold [&_td.rdp-today:not([data-selected=true])_button]:text-primary"
					)}
				/>
			</div>

			<p className={cn("mt-1 min-h-5 text-center text-sm", tooLong ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
				{tooLong
					? label("rangeTooLong", { max: String(maxDays) })
					: from && to
						? `${formatRange(toIsoDate(from), toIsoDate(to), language)} · ${label("dayCount", { count: String(daysBetween(from, to) + 1) })}`
						: label("pickDates")}
			</p>

			<Button className="mt-2 h-10 w-full rounded-xl font-semibold" disabled={!ready || busy} onClick={submit}>
				{submitting ? (
					<>
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
						{label("sending")}
					</>
				) : (
					label("showRecords")
				)}
			</Button>
		</ControlCard>
	);
}
