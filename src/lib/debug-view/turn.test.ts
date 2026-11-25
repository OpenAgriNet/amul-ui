import { describe, expect, it, vi } from "vitest";
import {
	backendLabel,
	buildSteps,
	detailOf,
	documentsOf,
	fetchDebugTurn,
	formatMs,
	kindOf,
	labelOf,
	prettyValue,
	summarize,
	type DebugSpan,
	type DebugTurn
} from "./turn";

const MS = 1e6;
// A real epoch in nanoseconds: past 2^53, as the backend sends them.
const T0 = 1_795_000_000_000 * MS;

function span(
	id: string,
	parent: string | null,
	name: string,
	startMs: number,
	endMs: number,
	attributes: Record<string, unknown> = {},
	extra: Partial<DebugSpan> = {}
): DebugSpan {
	return {
		id,
		parent,
		name,
		start_ns: T0 + startMs * MS,
		end_ns: T0 + endMs * MS,
		status: "ok",
		attributes,
		...extra
	};
}

const docs = JSON.stringify([
	{ title: "Green fodder guide", source: "doc-1", score: 0.91 },
	{ title: "Silage basics", source: "doc-2", score: 0.77 },
	{ note: "no title, skipped" }
]);

// As the backend stores them: in the order they ended, children before parents.
const SPANS: DebugSpan[] = [
	span("m", "t", "moderation", 10, 600, { "langfuse.observation.output": '{"allowed": true}' }),
	span("c1", "a", "chat gemma-4-31b-it", 700, 2800, {
		"gen_ai.operation.name": "chat",
		"gen_ai.request.model": "gemma-4-31b-it",
		"gen_ai.usage.input_tokens": 1200,
		"gen_ai.usage.output_tokens": 30,
		"gen_ai.output.messages": JSON.stringify([
			{
				role: "assistant",
				parts: [
					{ type: "tool_call", name: "search_documents", arguments: '{"query":"green fodder"}' }
				]
			}
		])
	}),
	span("tl", "ts", "running tool", 2810, 3700, {
		"gen_ai.tool.name": "search_documents",
		tool_arguments: '{"query":"green fodder"}',
		tool_response: docs
	}),
	span("ts", "a", "running tools", 2805, 3705, { tools: ["search_documents"] }),
	span("c2", "a", "chat gemma-4-31b-it", 3710, 9900, {
		"gen_ai.operation.name": "chat",
		"gen_ai.request.model": "gemma-4-31b-it",
		"gen_ai.usage.input_tokens": 1900,
		"gen_ai.usage.output_tokens": 380,
		"gen_ai.output.messages": JSON.stringify([
			{ role: "assistant", parts: [{ type: "text", content: "Green fodder helps..." }] }
		])
	}),
	span("a", "t", "agent run", 650, 9950, {
		"gen_ai.agent.name": "amul",
		"gen_ai.usage.input_tokens": 3100,
		"gen_ai.usage.output_tokens": 410
	}),
	span(
		"x",
		"t",
		"translation",
		9960,
		10400,
		{},
		{ status: "error", error: "ValueError: translator down" }
	),
	span("t", null, "turn", 0, 10500),
	span("s", "t", "suggestions", 10600, 15200)
];

function byId(id: string): DebugSpan {
	const found = SPANS.find((s) => s.id === id);
	if (!found) throw new Error(`no span ${id}`);
	return found;
}

const TURN: DebugTurn = {
	trace_id: "0123456789abcdef0123456789abcdef",
	session_id: "s1",
	started_at: "2026-11-25T10:00:00+00:00",
	backend: { environment: "preview-pr-588", release: "a2a9ae7f0c1d2e3f" },
	complete: true,
	spans: SPANS,
	langfuse_url: null
};

describe("steps", () => {
	it("puts each step under its parent, in the order they started", () => {
		const { steps, totalMs } = buildSteps(SPANS);
		expect(steps.map((s) => [s.span.id, s.depth])).toEqual([
			["t", 0],
			["m", 1],
			["a", 1],
			["c1", 2],
			["ts", 2],
			["tl", 3],
			["c2", 2],
			["x", 1],
			["s", 1]
		]);
		expect(totalMs).toBe(15200);
		expect(steps.find((s) => s.span.id === "tl")).toMatchObject({
			offsetMs: 2810,
			durationMs: 890
		});
	});

	it("names steps by what they are", () => {
		expect(["t", "a", "c1", "ts", "tl", "m"].map((id) => kindOf(byId(id)))).toEqual([
			"turn",
			"agent",
			"model",
			"tools",
			"tool",
			"step"
		]);
		expect(labelOf(byId("a"))).toBe("Agent · amul");
		expect(labelOf(byId("c1"))).toBe("Model · gemma-4-31b-it");
		expect(labelOf(byId("tl"))).toBe("Tool · search_documents");
		expect(labelOf(byId("m"))).toBe("moderation");
	});

	it("says what each step did in a line", () => {
		expect(detailOf(byId("c1"))).toBe("1200 → 30 tokens · calls search_documents");
		expect(detailOf(byId("c2"))).toBe("1900 → 380 tokens · answers");
		expect(detailOf(byId("tl"))).toBe('{"query":"green fodder"} → 2 results');
		expect(detailOf(byId("x"))).toBe("ValueError: translator down");
		expect(detailOf(byId("m"))).toBe('{"allowed":true}');
	});

	it("keeps spans whose parent was not kept, at the top", () => {
		const { steps } = buildSteps([
			span("o", "missing", "orphan", 0, 5),
			span("d", null, "(only the first 300 spans are kept)", 0, 0, {}, { dropped: true })
		]);
		expect(steps.map((s) => [s.span.id, s.depth])).toEqual([["o", 0]]);
	});
});

describe("search results", () => {
	it("lists the documents a tool returned", () => {
		expect(documentsOf(byId("tl"))).toEqual([
			{ title: "Green fodder guide", source: "doc-1", score: 0.91 },
			{ title: "Silage basics", source: "doc-2", score: 0.77 }
		]);
	});

	it("finds them inside a results object, and gives nothing for anything else", () => {
		const wrapped = span("w", null, "running tool", 0, 1, {
			tool_response: JSON.stringify({ results: [{ name: "Doc A", relevance: 0.5 }] })
		});
		expect(documentsOf(wrapped)).toEqual([{ title: "Doc A", source: null, score: 0.5 }]);
		for (const response of ["plain text", "{not json", "42", undefined]) {
			expect(
				documentsOf(span("n", null, "running tool", 0, 1, { tool_response: response }))
			).toEqual([]);
		}
	});
});

describe("summary", () => {
	it("adds up the turn", () => {
		expect(summarize(TURN)).toEqual({
			totalMs: 15200,
			models: ["gemma-4-31b-it"],
			inputTokens: 3100,
			outputTokens: 410,
			toolCalls: 1,
			errors: 1,
			droppedSpans: false
		});
	});

	it("names the backend that answered", () => {
		expect(backendLabel(TURN)).toBe("pr-588 · a2a9ae7");
		expect(
			backendLabel({ ...TURN, backend: { environment: "chat-development", release: "unknown" } })
		).toBe("dev");
		expect(backendLabel({ ...TURN, backend: {} })).toBe("backend");
	});

	it("formats durations", () => {
		expect([0.2, 12.4, 850, 1234, 11_840].map(formatMs)).toEqual([
			"<1 ms",
			"12 ms",
			"850 ms",
			"1.23 s",
			"11.8 s"
		]);
	});

	it("pretty-prints JSON values and leaves text alone", () => {
		expect(prettyValue('{"a":1}')).toBe('{\n  "a": 1\n}');
		expect(prettyValue("plain")).toBe("plain");
		expect(prettyValue(12)).toBe("12");
	});
});

describe("fetchDebugTurn", () => {
	it("asks the backend for the turn", async () => {
		const get = vi.fn().mockResolvedValue(TURN);
		await expect(fetchDebugTurn(TURN.trace_id, get as never)).resolves.toBe(TURN);
		expect(get).toHaveBeenCalledWith(`/api/debug/turns/${TURN.trace_id}`);
	});

	it("never sends something that is not a trace id", async () => {
		const get = vi.fn();
		for (const id of ["", "../user/me", "ABCDEF0123456789abcdef0123456789", "0123"]) {
			await expect(fetchDebugTurn(id, get as never)).rejects.toThrow("Not a trace id");
		}
		expect(get).not.toHaveBeenCalled();
	});
});
