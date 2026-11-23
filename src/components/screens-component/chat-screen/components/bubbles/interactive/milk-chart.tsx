import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useChatStore } from "@/hooks/store/chat";
import type { ChartComponent } from "@/lib/agui/types";
import { cn } from "@/lib/utils";
import { ControlCard, formatDate, formatNumber, formatRange, formatRupees, useLabel } from "./shared";

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
	return (
		<div className="min-w-0 rounded-xl bg-muted/50 px-3 py-2 dark:bg-muted/30">
			<div className="truncate text-xs text-muted-foreground">{label}</div>
			<div className="truncate text-base font-bold tabular-nums text-foreground">{value}</div>
		</div>
	);
}

// The numbers below are shown exactly as the backend sent them: no totals or
// averages are recomputed here (#593 contract).
export function MilkChart({ component }: { readonly component: ChartComponent }) {
	const { label, language } = useLabel();
	const changeMilkAccount = useChatStore((s) => s.changeMilkAccount);
	const busy = useChatStore((s) => s.isAssistantTyping);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const { data } = component;
	const { summary } = data;
	const litres = label("litresUnit");

	const chartData = data.daily_quantity.map((d) => ({
		date: d.date,
		day: Number(d.date.slice(8, 10)),
		litres: d.quantity_litres
	}));
	const incomplete = data.warnings.length > 0;

	return (
		<ControlCard>
			<div className="mb-3 flex flex-col items-start gap-1.5">
				<div className="min-w-0">
					<p className="text-sm font-semibold text-foreground">{component.title || label("milkRecords")}</p>
					<p className="text-xs text-muted-foreground">{formatRange(data.period.fromdate, data.period.todate, language)}</p>
				</div>
				{/* The backend's label (name · society · member code) is long; let it wrap rather than cut it off. */}
				<span className="max-w-full break-words rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold leading-snug text-secondary-foreground">
					{data.account.label}
				</span>
			</div>

			{data.status === "no_records" || !summary ? (
				<p className="rounded-xl bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">{label("noRecords")}</p>
			) : (
				<>
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
						<Stat label={label("totalMilk")} value={`${formatNumber(summary.total_quantity_litres)} ${litres}`} />
						<Stat label={label("amount")} value={formatRupees(summary.total_amount_rupees)} />
						<Stat label={label("avgFat")} value={summary.weighted_fat === null ? "–" : `${formatNumber(summary.weighted_fat, 2)}%`} />
						<Stat label={label("avgSnf")} value={summary.weighted_snf === null ? "–" : `${formatNumber(summary.weighted_snf, 2)}%`} />
					</div>
					<p className="mt-2 text-xs text-muted-foreground">{label("daysWithMilk", { count: String(summary.days_with_milk) })}</p>

					<figure className="mt-3" aria-label={label("dailyMilk")}>
						<figcaption className="mb-1 text-xs font-medium text-muted-foreground">{label("dailyMilk")}</figcaption>
						<div className="h-44 w-full">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
									<CartesianGrid vertical={false} stroke="var(--border)" />
									<XAxis
										dataKey="day"
										tickLine={false}
										axisLine={false}
										interval="preserveStartEnd"
										minTickGap={8}
										tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
									/>
									<YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
									<Tooltip
										cursor={{ fill: "var(--muted)", opacity: 0.4 }}
										contentStyle={{
											background: "var(--popover)",
											border: "1px solid var(--border)",
											borderRadius: 8,
											fontSize: 12,
											color: "var(--popover-foreground)"
										}}
										labelFormatter={(_, payload) => {
											const iso = payload?.[0]?.payload?.date as string | undefined;
											return iso ? formatDate(iso, language) : "";
										}}
										formatter={(value) => [value === null || value === undefined ? "–" : `${formatNumber(Number(value))} ${litres}`, label("litres")]}
									/>
									<Bar dataKey="litres" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={22} />
								</BarChart>
							</ResponsiveContainer>
						</div>
					</figure>

					{incomplete ? (
						<p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
							<TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
							{label("chartIncomplete")}
						</p>
					) : null}

					<Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="mt-3">
						<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60">
							{detailsOpen ? label("hideDetails") : label("showDetails")}
							<ChevronDown className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")} aria-hidden="true" />
						</CollapsibleTrigger>
						<CollapsibleContent>
							<div className="mt-2 max-h-72 overflow-auto rounded-lg border border-border">
								<table className="w-full text-xs tabular-nums">
									<thead className="text-left text-muted-foreground">
										<tr>
											<th className="sticky top-0 z-10 bg-card px-2 py-1.5 shadow-[inset_0_-1px_0_var(--border)] font-semibold">{label("date")}</th>
											<th className="sticky top-0 z-10 bg-card px-2 py-1.5 shadow-[inset_0_-1px_0_var(--border)] font-semibold">{label("shift")}</th>
											<th className="sticky top-0 z-10 bg-card px-2 py-1.5 shadow-[inset_0_-1px_0_var(--border)] text-right font-semibold">{label("litres")}</th>
											<th className="sticky top-0 z-10 bg-card px-2 py-1.5 shadow-[inset_0_-1px_0_var(--border)] text-right font-semibold">{label("fat")}</th>
											<th className="sticky top-0 z-10 bg-card px-2 py-1.5 shadow-[inset_0_-1px_0_var(--border)] text-right font-semibold">{label("snf")}</th>
											<th className="sticky top-0 z-10 bg-card px-2 py-1.5 shadow-[inset_0_-1px_0_var(--border)] text-right font-semibold">₹</th>
										</tr>
									</thead>
									<tbody>
										{data.milk.map((row, i) => (
											<tr key={`${row.date}-${row.shift}-${i}`} className="border-t border-border">
												<td className="whitespace-nowrap px-2 py-1.5">{row.date ? formatDate(row.date, language, false) : "–"}</td>
												<td className="px-2 py-1.5">{row.shift ?? "–"}</td>
												<td className="px-2 py-1.5 text-right">{row.qty ?? "–"}</td>
												<td className="px-2 py-1.5 text-right">{row.fat ?? "–"}</td>
												<td className="px-2 py-1.5 text-right">{row.snf ?? "–"}</td>
												<td className="px-2 py-1.5 text-right">{row.amount ?? "–"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
							{data.deductions.length > 0 ? (
								<div className="mt-3">
									<p className="mb-1 text-xs font-semibold text-muted-foreground">{label("deductions")}</p>
									<ul className="flex flex-col gap-1 text-xs">
										{data.deductions.map((d, i) => (
											<li key={`${d.date}-${i}`} className="flex justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5 tabular-nums">
												<span className="min-w-0 truncate">
													{d.account_name ?? "–"}
													{d.date ? <span className="text-muted-foreground"> · {formatDate(d.date, language, false)}</span> : null}
												</span>
												<span className="shrink-0 font-semibold">{d.amount === null ? "–" : formatRupees(d.amount)}</span>
											</li>
										))}
									</ul>
								</div>
							) : null}
						</CollapsibleContent>
					</Collapsible>
				</>
			)}

			<Button
				variant="outline"
				className="mt-3 h-9 w-full rounded-xl border-primary/40 text-sm font-semibold text-primary hover:bg-primary/5 hover:text-primary"
				disabled={busy}
				onClick={() => void changeMilkAccount(language)}
			>
				<RefreshCw className="h-4 w-4" aria-hidden="true" />
				{label("changeAccount")}
			</Button>
		</ControlCard>
	);
}
