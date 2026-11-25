/**
 * The Debug panel's data: what one chat turn did, step by step.
 *
 * It comes from GET /api/debug/turns/{trace_id} (amul-oan-api app/debug_view.py), which only a dev
 * or preview backend with the debug view on has, and which gives a turn to the user who asked it
 * alone. The spans are the turn's OpenTelemetry spans (the ones Langfuse gets), cut down by the
 * backend: no system prompt or history, secrets dropped, long values shortened.
 */

import { request } from "@/config/request";

export type DebugSpan = {
	id: string;
	parent: string | null;
	name: string;
	start_ns: number;
	end_ns: number;
	status: "ok" | "error";
	error?: string;
	attributes: Record<string, unknown>;
	cut?: boolean;
	dropped?: boolean;
};

export type DebugTurn = {
	trace_id: string;
	session_id: string | null;
	started_at: string | null;
	backend: { environment?: string; release?: string };
	complete: boolean;
	spans: DebugSpan[];
	langfuse_url: string | null;
};

export type StepKind = "turn" | "agent" | "model" | "tool" | "tools" | "step";

export type Step = {
	span: DebugSpan;
	kind: StepKind;
	label: string;
	detail: string;
	depth: number;
	offsetMs: number;
	durationMs: number;
};

export type DocumentRow = { title: string; source: string | null; score: number | null };

const TRACE_ID = /^[0-9a-f]{32}$/;

export function isTraceId(value: unknown): value is string {
	return typeof value === "string" && TRACE_ID.test(value);
}

/** The turn as the backend keeps it; throws with the backend's reason (404: none for you). */
export function fetchDebugTurn(traceId: string, get: typeof request = request): Promise<DebugTurn> {
	if (!isTraceId(traceId)) return Promise.reject(new Error("Not a trace id"));
	return get<DebugTurn>(`/api/debug/turns/${traceId}`);
}

function text(value: unknown): string | null {
	return typeof value === "string" && value ? value : null;
}

function count(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** A JSON attribute (the backend keeps JSON as strings) parsed, or the value as it is. */
export function parsed(value: unknown): unknown {
	if (typeof value !== "string") return value;
	const trimmed = value.trimStart();
	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

export function kindOf(span: DebugSpan): StepKind {
	const a = span.attributes;
	if (span.name === "turn") return "turn";
	if (span.name === "running tool" || a["gen_ai.tool.name"]) return "tool";
	if (span.name === "running tools") return "tools";
	if (a["gen_ai.operation.name"] === "chat" || span.name.startsWith("chat ")) return "model";
	if (span.name === "agent run" || a["gen_ai.agent.name"] || a["agent_name"]) return "agent";
	return "step";
}

export function labelOf(span: DebugSpan, kind: StepKind = kindOf(span)): string {
	const a = span.attributes;
	switch (kind) {
		case "turn":
			return "Turn";
		case "agent":
			return `Agent · ${text(a["gen_ai.agent.name"]) ?? text(a["agent_name"]) ?? "run"}`;
		case "model":
			return `Model · ${text(a["gen_ai.response.model"]) ?? text(a["gen_ai.request.model"]) ?? span.name.replace(/^chat /, "")}`;
		case "tool":
			return `Tool · ${text(a["gen_ai.tool.name"]) ?? "?"}`;
		case "tools":
			return "Tools";
		default:
			return span.name;
	}
}

/** The rows of a search-like tool's result: a list of objects with a title (or name) each. */
export function documentsOf(span: DebugSpan): DocumentRow[] {
	let value = parsed(span.attributes["tool_response"]);
	if (value && typeof value === "object" && !Array.isArray(value)) {
		const holder = value as Record<string, unknown>;
		value = holder.results ?? holder.documents ?? holder.data ?? holder.items;
	}
	if (!Array.isArray(value)) return [];
	const rows: DocumentRow[] = [];
	for (const item of value) {
		if (!item || typeof item !== "object") continue;
		const o = item as Record<string, unknown>;
		const title =
			text(o.title) ??
			text(o.name) ??
			text(o.heading) ??
			text(o.doc_name) ??
			text(o.document_title);
		if (!title) continue;
		const score = [o.score, o.relevance, o._score, o.similarity].find((s) => typeof s === "number");
		rows.push({
			title,
			source: text(o.source) ?? text(o.url) ?? text(o.doc_id) ?? text(o.id) ?? null,
			score: typeof score === "number" ? score : null
		});
	}
	return rows;
}

function short(value: unknown, max = 80): string {
	const raw = typeof value === "string" ? value : JSON.stringify(value);
	const one = (raw ?? "").replace(/\s+/g, " ").trim();
	return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

/** What the model asked for: the tools it called, or "answers". */
function modelOutcome(span: DebugSpan): string {
	const out = parsed(span.attributes["gen_ai.output.messages"]);
	if (!Array.isArray(out)) return "";
	const tools: string[] = [];
	let answers = false;
	for (const message of out) {
		const parts = (message as { parts?: unknown })?.parts;
		if (!Array.isArray(parts)) continue;
		for (const part of parts) {
			const p = part as { type?: string; name?: string };
			if (p.type === "tool_call" && p.name) tools.push(p.name);
			if (p.type === "text") answers = true;
		}
	}
	if (tools.length) return `calls ${tools.join(", ")}`;
	return answers ? "answers" : "";
}

export function detailOf(span: DebugSpan, kind: StepKind = kindOf(span)): string {
	if (span.error) return short(span.error, 100);
	const a = span.attributes;
	if (kind === "model") {
		const tokens = `${count(a["gen_ai.usage.input_tokens"])} → ${count(a["gen_ai.usage.output_tokens"])} tokens`;
		const outcome = modelOutcome(span);
		return outcome ? `${tokens} · ${outcome}` : tokens;
	}
	if (kind === "tool") {
		const args = a["tool_arguments"] === undefined ? "" : short(parsed(a["tool_arguments"]), 60);
		const docs = documentsOf(span);
		const result = docs.length
			? `${docs.length} results`
			: a["tool_response"] === undefined
				? ""
				: short(a["tool_response"], 40);
		return [args, result].filter(Boolean).join(" → ");
	}
	if (kind === "agent") {
		const tokens = count(a["gen_ai.usage.input_tokens"]) + count(a["gen_ai.usage.output_tokens"]);
		return tokens ? `${tokens} tokens in all` : "";
	}
	const output = a["langfuse.observation.output"];
	return output === undefined ? "" : short(parsed(output), 80);
}

/** The steps in order, each under its parent, with where it starts and how long it took. */
export function buildSteps(spans: DebugSpan[]): { steps: Step[]; totalMs: number } {
	const kept = spans.filter(
		(s) => !s.dropped && typeof s.start_ns === "number" && typeof s.end_ns === "number"
	);
	if (!kept.length) return { steps: [], totalMs: 0 };
	const ids = new Set(kept.map((s) => s.id));
	const children = new Map<string | null, DebugSpan[]>();
	for (const span of kept) {
		const parent = span.parent && ids.has(span.parent) ? span.parent : null;
		const list = children.get(parent) ?? [];
		list.push(span);
		children.set(parent, list);
	}
	for (const list of children.values())
		list.sort((x, y) => x.start_ns - y.start_ns || x.end_ns - y.end_ns);
	const start = Math.min(...kept.map((s) => s.start_ns));
	const end = Math.max(...kept.map((s) => s.end_ns));
	// Epoch nanoseconds are past 2^53, so JSON hands JavaScript them a few hundred ns off: round to 1 µs.
	const ms = (ns: number) => Math.round(ns / 1e3) / 1e3;
	const steps: Step[] = [];
	const visit = (span: DebugSpan, depth: number) => {
		const kind = kindOf(span);
		steps.push({
			span,
			kind,
			label: labelOf(span, kind),
			detail: detailOf(span, kind),
			depth,
			offsetMs: ms(span.start_ns - start),
			durationMs: ms(span.end_ns - span.start_ns)
		});
		for (const child of children.get(span.id) ?? []) visit(child, depth + 1);
	};
	for (const root of children.get(null) ?? []) visit(root, 0);
	return { steps, totalMs: ms(end - start) };
}

export type TurnSummary = {
	totalMs: number;
	models: string[];
	inputTokens: number;
	outputTokens: number;
	toolCalls: number;
	errors: number;
	droppedSpans: boolean;
};

export function summarize(turn: DebugTurn): TurnSummary {
	const { steps, totalMs } = buildSteps(turn.spans);
	const models = new Set<string>();
	let inputTokens = 0;
	let outputTokens = 0;
	for (const step of steps) {
		if (step.kind !== "model") continue;
		const a = step.span.attributes;
		const model = text(a["gen_ai.response.model"]) ?? text(a["gen_ai.request.model"]);
		if (model) models.add(model);
		inputTokens += count(a["gen_ai.usage.input_tokens"]);
		outputTokens += count(a["gen_ai.usage.output_tokens"]);
	}
	return {
		totalMs,
		models: [...models],
		inputTokens,
		outputTokens,
		toolCalls: steps.filter((s) => s.kind === "tool").length,
		errors: steps.filter((s) => s.span.status === "error").length,
		droppedSpans: turn.spans.some((s) => s.dropped)
	};
}

/** Which backend answered: "pr-588" for a preview, "dev", or what it calls itself; and its commit. */
export function backendLabel(turn: DebugTurn): string {
	const env = turn.backend?.environment ?? "";
	const name =
		/^preview-(.+)$/.exec(env)?.[1] ?? (/development/.test(env) ? "dev" : env || "backend");
	const release = turn.backend?.release;
	return release && release !== "unknown" ? `${name} · ${release.slice(0, 7)}` : name;
}

export function formatMs(ms: number): string {
	if (!Number.isFinite(ms) || ms < 1) return "<1 ms";
	if (ms < 1000) return `${Math.round(ms)} ms`;
	return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
}

/** An attribute for display: JSON pretty-printed, anything else as text. */
export function prettyValue(value: unknown): string {
	const v = parsed(value);
	if (typeof v === "string") return v;
	return JSON.stringify(v, null, 2) ?? String(v);
}
