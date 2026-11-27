import { useEffect, useMemo, useState } from "react";
import {
	Bug,
	Check,
	ChevronDown,
	ChevronRight,
	Copy,
	ExternalLink,
	RefreshCw,
	X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
	backendLabel,
	buildSteps,
	documentsOf,
	fetchDebugTurn,
	formatMs,
	prettyValue,
	summarize,
	type DebugTurn,
	type Step,
	type StepKind
} from "@/lib/debug-view/turn";
import { cn } from "@/lib/utils";

// While the answer is still being made, the panel asks again this often, for at most this long.
const POLL_MS = 1500;
const POLL_FOR_MS = 90_000;

type State =
	| { status: "loading" }
	| { status: "ready"; turn: DebugTurn }
	| { status: "failed"; message: string };

const BAR: Record<StepKind, string> = {
	turn: "bg-gray-400",
	agent: "bg-violet-500",
	model: "bg-sky-500",
	tool: "bg-amber-500",
	tools: "bg-amber-300",
	step: "bg-emerald-500"
};

function useDebugTurn(traceId: string, open: boolean, refresh: number): State {
	const [state, setState] = useState<State>({ status: "loading" });
	useEffect(() => {
		if (!open) return;
		let active = true;
		let timer: number | undefined;
		const startedAt = Date.now();
		const load = async () => {
			try {
				const turn = await fetchDebugTurn(traceId);
				if (!active) return;
				setState({ status: "ready", turn });
				if (!turn.complete && Date.now() - startedAt < POLL_FOR_MS)
					timer = window.setTimeout(load, POLL_MS);
			} catch (error) {
				if (active)
					setState({
						status: "failed",
						message: error instanceof Error ? error.message : String(error)
					});
			}
		};
		void load();
		return () => {
			active = false;
			if (timer !== undefined) window.clearTimeout(timer);
		};
	}, [traceId, open, refresh]);
	return state;
}

function CopyButton({ text, label }: { readonly text: string; readonly label: string }) {
	const [done, setDone] = useState(false);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setDone(true);
			window.setTimeout(() => setDone(false), 1000);
		} catch {
			// clipboard blocked: nothing to do
		}
	};
	return (
		<Button
			variant="ghost"
			size="sm"
			className="h-7 gap-1 px-2 text-xs"
			onClick={copy}
			aria-label={label}
		>
			{done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
			{label}
		</Button>
	);
}

function StepDetails({ step }: { readonly step: Step }) {
	const documents = step.kind === "tool" ? documentsOf(step.span) : [];
	const attributes = Object.entries(step.span.attributes);
	return (
		<div className="space-y-3 border-l-2 border-gray-200 bg-gray-50 px-3 py-3 text-xs">
			{step.span.error ? (
				<div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 font-mono text-red-700">
					{step.span.error}
				</div>
			) : null}
			{documents.length ? (
				<div>
					<div className="mb-1 font-semibold text-gray-700">{documents.length} results</div>
					<div className="overflow-x-auto">
						<table className="w-full border-collapse">
							<thead>
								<tr className="text-left text-gray-500">
									<th className="py-1 pr-2 font-medium">#</th>
									<th className="py-1 pr-2 font-medium">Title</th>
									<th className="py-1 pr-2 font-medium">Source</th>
									<th className="py-1 font-medium">Score</th>
								</tr>
							</thead>
							<tbody>
								{documents.map((doc, index) => (
									<tr key={`${doc.title}-${index}`} className="border-t border-gray-200 align-top">
										<td className="py-1 pr-2 text-gray-500">{index + 1}</td>
										<td className="py-1 pr-2 text-gray-900">{doc.title}</td>
										<td className="py-1 pr-2 break-all text-gray-600">{doc.source ?? "–"}</td>
										<td className="py-1 text-gray-600 tabular-nums">
											{doc.score === null ? "–" : doc.score.toFixed(3)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			) : null}
			{attributes.length ? (
				<dl className="space-y-2">
					{attributes.map(([key, value]) => (
						<div key={key}>
							<dt className="font-mono text-[11px] text-gray-500">{key}</dt>
							<dd>
								<pre className="mt-0.5 max-h-64 overflow-auto rounded bg-white p-2 font-mono text-[11px] break-words whitespace-pre-wrap text-gray-800 ring-1 ring-gray-200">
									{prettyValue(value)}
								</pre>
							</dd>
						</div>
					))}
				</dl>
			) : (
				<div className="text-gray-500">No details kept for this step.</div>
			)}
			{step.span.cut ? (
				<div className="text-gray-500">
					Some long values were shortened; the full step is in Langfuse.
				</div>
			) : null}
		</div>
	);
}

function StepRow({
	step,
	totalMs,
	open,
	onToggle
}: {
	readonly step: Step;
	readonly totalMs: number;
	readonly open: boolean;
	readonly onToggle: () => void;
}) {
	const left = totalMs > 0 ? (step.offsetMs / totalMs) * 100 : 0;
	const width = totalMs > 0 ? Math.max((step.durationMs / totalMs) * 100, 0.6) : 100;
	const failed = step.span.status === "error";
	return (
		<li>
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={open}
				className={cn(
					"w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none",
					open && "bg-gray-50"
				)}
			>
				<div
					className="flex items-center gap-2"
					style={{ paddingLeft: `${Math.min(step.depth, 6) * 12}px` }}
				>
					{open ? (
						<ChevronDown className="size-3.5 shrink-0 text-gray-400" />
					) : (
						<ChevronRight className="size-3.5 shrink-0 text-gray-400" />
					)}
					<span
						className={cn(
							"shrink-0 text-sm font-medium",
							failed ? "text-red-600" : "text-gray-900"
						)}
					>
						{step.label}
					</span>
					<span className="min-w-0 flex-1 truncate text-xs text-gray-500">{step.detail}</span>
					<span className="shrink-0 text-xs text-gray-600 tabular-nums">
						{formatMs(step.durationMs)}
					</span>
				</div>
				<div
					className="relative mt-1.5 h-1.5 rounded bg-gray-100"
					style={{ marginLeft: `${Math.min(step.depth, 6) * 12 + 22}px` }}
				>
					<div
						className={cn("absolute inset-y-0 rounded", failed ? "bg-red-500" : BAR[step.kind])}
						style={{ left: `${left}%`, width: `${width}%` }}
					/>
				</div>
			</button>
			{open ? <StepDetails step={step} /> : null}
		</li>
	);
}

/**
 * The Debug panel of one answer: which backend answered, every step the turn took (moderation,
 * translation, the agent's model calls and tools) with its time, and each step's details. Shown
 * only where the backend has the debug view on (dev and previews), for the user who asked.
 */
export function DebugPanel({
	traceId,
	open,
	onOpenChange
}: {
	readonly traceId: string;
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
}) {
	const [refresh, setRefresh] = useState(0);
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const state = useDebugTurn(traceId, open, refresh);
	const turn = state.status === "ready" ? state.turn : null;
	const built = useMemo(() => (turn ? buildSteps(turn.spans) : { steps: [], totalMs: 0 }), [turn]);
	const summary = useMemo(() => (turn ? summarize(turn) : null), [turn]);

	const toggle = (id: string) =>
		setExpanded((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
				<div className="flex items-start justify-between gap-2 border-b border-gray-200 px-4 py-3">
					<div className="min-w-0">
						<SheetTitle className="flex items-center gap-2 text-base">
							<Bug className="size-4 text-gray-500" />
							Debug
							{turn ? (
								<span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-normal text-gray-700">
									{backendLabel(turn)}
								</span>
							) : null}
							{turn && !turn.complete ? (
								<span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800">
									still running
								</span>
							) : null}
						</SheetTitle>
						<SheetDescription className="mt-1 truncate font-mono text-xs">
							{traceId}
						</SheetDescription>
					</div>
					<div className="flex shrink-0 items-center gap-1">
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							onClick={() => setRefresh((n) => n + 1)}
							aria-label="Refresh"
						>
							<RefreshCw className="size-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							onClick={() => onOpenChange(false)}
							aria-label="Close"
						>
							<X className="size-4" />
						</Button>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-1 border-b border-gray-200 px-3 py-1.5">
					<CopyButton text={traceId} label="Trace id" />
					{turn ? <CopyButton text={JSON.stringify(turn, null, 2)} label="JSON" /> : null}
					{turn?.langfuse_url ? (
						<a
							href={turn.langfuse_url}
							target="_blank"
							rel="noreferrer"
							className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium hover:bg-gray-100"
						>
							<ExternalLink className="size-3.5" />
							Langfuse
						</a>
					) : null}
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto">
					{state.status === "loading" ? (
						<div className="px-4 py-6 text-sm text-gray-500">Loading…</div>
					) : null}
					{state.status === "failed" ? (
						<div className="space-y-1 px-4 py-6 text-sm">
							<div className="text-red-600">{state.message}</div>
							<div className="text-gray-500">
								This backend keeps a turn for a day, for the person who asked it, once the debug
								view is on.
							</div>
						</div>
					) : null}
					{turn && summary ? (
						<>
							<div className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3 text-xs sm:grid-cols-4">
								<div>
									<div className="text-gray-500">Time</div>
									<div className="font-medium tabular-nums">{formatMs(summary.totalMs)}</div>
								</div>
								<div>
									<div className="text-gray-500">Model</div>
									<div className="truncate font-medium" title={summary.models.join(", ")}>
										{summary.models.join(", ") || "–"}
									</div>
								</div>
								<div>
									<div className="text-gray-500">Tokens in → out</div>
									<div className="font-medium tabular-nums">
										{summary.inputTokens} → {summary.outputTokens}
									</div>
								</div>
								<div>
									<div className="text-gray-500">Tools · errors</div>
									<div className={cn("font-medium tabular-nums", summary.errors && "text-red-600")}>
										{summary.toolCalls} · {summary.errors}
									</div>
								</div>
							</div>
							{built.steps.length ? (
								<ul className="divide-y divide-gray-100 border-t border-gray-200">
									{built.steps.map((step) => (
										<StepRow
											key={step.span.id}
											step={step}
											totalMs={built.totalMs}
											open={expanded.has(step.span.id)}
											onToggle={() => toggle(step.span.id)}
										/>
									))}
								</ul>
							) : (
								<div className="border-t border-gray-200 px-4 py-6 text-sm text-gray-500">
									{turn.complete
										? "Nothing was recorded for this turn: is tracing on for this backend?"
										: "Waiting for the first step…"}
								</div>
							)}
							<div className="border-t border-gray-200 px-4 py-3 text-xs text-gray-500">
								{summary.droppedSpans ? "Only the first steps of this turn were kept. " : ""}
								The system prompt and the conversation so far are not shown here; Langfuse has them.
							</div>
						</>
					) : null}
				</div>
			</SheetContent>
		</Sheet>
	);
}
