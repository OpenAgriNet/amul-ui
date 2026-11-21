import { describe, expect, it } from "vitest";
import type { BaseEvent } from "@ag-ui/core";
import { buildRequestBody, ChatRequestError, runChatTurn, type FetchFn } from "./adapter";
import { createMockChatServer } from "./mock-server";
import { applySnapshot, emptyUiState, readAmulUiSnapshot } from "./state";
import type { AmulUIState, ChatOperation } from "./types";

const base = { apiUrl: "", authToken: "t", threadId: "s-1", sourceLang: "gu", targetLang: "gu" };

async function turn(fetchFn: FetchFn, operation: ChatOperation) {
	const events: BaseEvent[] = [];
	const format = await runChatTurn({ ...base, operation, fetchFn }, { onEvent: (e) => events.push(e) });
	return { format, events };
}

function latestUi(events: BaseEvent[], current: AmulUIState = emptyUiState()): AmulUIState {
	return events.reduce((ui, event) => {
		if (event.type !== "STATE_SNAPSHOT") return ui;
		const next = readAmulUiSnapshot((event as { snapshot?: unknown }).snapshot);
		return next ? applySnapshot(ui, next) : ui;
	}, current);
}

describe("buildRequestBody", () => {
	it("sends only the new message, with empty state, tools and context", () => {
		const body = buildRequestBody({ ...base, operation: { kind: "message", text: "hello" } });
		expect(body.messages).toHaveLength(1);
		expect(body.messages[0]).toMatchObject({ role: "user", content: "hello" });
		expect(body.state).toEqual({});
		expect(body.tools).toEqual([]);
		expect(body.context).toEqual([]);
		expect(body.forwardedProps).toMatchObject({ version: 1, channel: "web", input_method: "typed" });
		expect(body.forwardedProps.ui_action).toBeUndefined();
	});

	it("sends a pick with no messages", () => {
		const body = buildRequestBody({
			...base,
			operation: { kind: "ui_action", action: { component_id: "c1", revision: 1, kind: "choice", value: { option_id: "o1" } } }
		});
		expect(body.messages).toEqual([]);
		expect(body.forwardedProps.ui_action).toMatchObject({ component_id: "c1", kind: "choice" });
		expect(body.forwardedProps.input_method).toBeUndefined();
	});

	it("uses a new runId for every request", () => {
		const op: ChatOperation = { kind: "message", text: "x" };
		expect(buildRequestBody({ ...base, operation: op }).runId).not.toBe(buildRequestBody({ ...base, operation: op }).runId);
	});
});

describe("runChatTurn against the mock server", () => {
	it("runs the whole milk flow: account, dates, chart", async () => {
		// Split every SSE frame into 7 pieces to check the SDK reassembles them.
		const server = createMockChatServer({ chunkDelayMs: 0, fragments: 7 });

		const first = await turn(server.fetch, { kind: "message", text: "મારું દૂધ milk બતાવો" });
		expect(first.format).toBe("agui-v1");
		expect(first.events[0]?.type).toBe("RUN_STARTED");
		expect(first.events.at(-1)?.type).toBe("RUN_FINISHED");
		let ui = latestUi(first.events);
		const picker = ui.components.find((c) => c.kind === "choice");
		expect(picker?.status).toBe("pending");
		const textStart = first.events.find((e) => e.type === "TEXT_MESSAGE_START") as { messageId?: string } | undefined;
		expect(picker?.message_id).toBe(textStart?.messageId);

		if (picker?.kind !== "choice") throw new Error("expected a choice");
		const second = await turn(server.fetch, {
			kind: "ui_action",
			action: { component_id: picker.id, revision: picker.revision, kind: "choice", value: { option_id: picker.options[1]!.id } }
		});
		ui = latestUi(second.events, ui);
		expect(ui.components.find((c) => c.id === picker.id)?.status).toBe("submitted");
		expect(ui.selected_milk_account?.option_id).toBe(picker.options[1]!.id);
		const dates = ui.components.find((c) => c.kind === "date_range");
		if (dates?.kind !== "date_range") throw new Error("expected a date range");

		const third = await turn(server.fetch, {
			kind: "ui_action",
			action: { component_id: dates.id, revision: dates.revision, kind: "date_range", value: { fromdate: "2026-10-01", todate: "2026-10-31" } }
		});
		ui = latestUi(third.events, ui);
		const chart = ui.components.find((c) => c.kind === "chart");
		if (chart?.kind !== "chart") throw new Error("expected a chart");
		expect(chart.data.period).toEqual({ fromdate: "2026-10-01", todate: "2026-10-31" });
		expect(chart.data.daily_quantity).toHaveLength(31);
	});

	it("rejects a range over 31 days before streaming, leaving the control pending", async () => {
		const server = createMockChatServer({ chunkDelayMs: 0 });
		let ui = latestUi((await turn(server.fetch, { kind: "message", text: "milk" })).events);
		const picker = ui.components[0];
		if (picker?.kind !== "choice") throw new Error("expected a choice");
		ui = latestUi(
			(await turn(server.fetch, {
				kind: "ui_action",
				action: { component_id: picker.id, revision: 1, kind: "choice", value: { option_id: picker.options[0]!.id } }
			})).events,
			ui
		);
		const dates = ui.components.find((c) => c.kind === "date_range")!;

		const attempt = turn(server.fetch, {
			kind: "ui_action",
			action: { component_id: dates.id, revision: dates.revision, kind: "date_range", value: { fromdate: "2026-09-01", todate: "2026-10-03" } }
		});
		await expect(attempt).rejects.toBeInstanceOf(ChatRequestError);
		await expect(attempt).rejects.toMatchObject({ status: 422, code: "INVALID_DATE_RANGE" });
	});

	it("rejects a second pick on a used control with 409", async () => {
		const server = createMockChatServer({ chunkDelayMs: 0 });
		const ui = latestUi((await turn(server.fetch, { kind: "message", text: "milk" })).events);
		const picker = ui.components[0];
		if (picker?.kind !== "choice") throw new Error("expected a choice");
		const pick: ChatOperation = {
			kind: "ui_action",
			action: { component_id: picker.id, revision: 1, kind: "choice", value: { option_id: picker.options[0]!.id } }
		};
		await turn(server.fetch, pick);
		await expect(turn(server.fetch, pick)).rejects.toMatchObject({ status: 409 });
	});
});

describe("runChatTurn with a text-v1 response", () => {
	it("passes raw text chunks through, including Gujarati split mid-character", async () => {
		const bytes = new TextEncoder().encode("નમસ્તે ખેડૂત");
		const fetchFn: FetchFn = async () =>
			new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(bytes.slice(0, 5));
						controller.enqueue(bytes.slice(5));
						controller.close();
					}
				}),
				{ status: 200, headers: { "X-Chat-Format": "text-v1", "X-Trace-Id": "trace-9" } }
			);
		let text = "";
		let traceId = "";
		const format = await runChatTurn(
			{ ...base, operation: { kind: "message", text: "hi" }, fetchFn },
			{ onTextChunk: (c) => (text += c), onTraceId: (id) => (traceId = id) }
		);
		expect(format).toBe("text-v1");
		expect(text).toBe("નમસ્તે ખેડૂત");
		expect(traceId).toBe("trace-9");
	});
});

describe("applySnapshot", () => {
	it("ignores an older or equal revision", () => {
		const newer: AmulUIState = { ...emptyUiState(), state_revision: 5 };
		const older: AmulUIState = { ...emptyUiState(), state_revision: 4 };
		expect(applySnapshot(newer, older)).toBe(newer);
		expect(applySnapshot(newer, { ...newer })).toBe(newer);
		expect(applySnapshot(older, newer)).toBe(newer);
	});
});
