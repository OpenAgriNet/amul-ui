import { describe, expect, it } from "vitest";
import type { BaseEvent } from "@ag-ui/core";
import { buildRequestBody, ChatRequestError, runChatTurn, type FetchFn } from "./adapter";
import { createMockChatServer } from "./testing/fake-backend";
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

describe("runChatTurn against the fake backend", () => {
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

describe("AI booking flow against the fake backend (#636, backend #637)", () => {
	type Server = ReturnType<typeof createMockChatServer>;

	const pick = async (server: Server, ui: AmulUIState, purpose: string, optionId: string) => {
		const picker = ui.components.find((c) => c.kind === "choice" && c.purpose === purpose && c.status === "pending");
		if (picker?.kind !== "choice") throw new Error(`expected a pending ${purpose} picker`);
		const { events } = await turn(server.fetch, {
			kind: "ui_action",
			action: { component_id: picker.id, revision: picker.revision, kind: "choice", value: { option_id: optionId } }
		});
		return latestUi(events, ui);
	};

	const pendingConfirm = (ui: AmulUIState) => {
		const confirm = ui.components.find((c) => c.kind === "confirm" && c.status === "pending");
		if (confirm?.kind !== "confirm") throw new Error("expected a pending confirm");
		return confirm;
	};

	const confirmOp = (confirm: { id: string; revision: number }, confirmed: boolean): ChatOperation => ({
		kind: "ui_action",
		action: { component_id: confirm.id, revision: confirm.revision, kind: "confirm", value: { confirmed } }
	});

	async function upToConfirm(server: Server) {
		let ui = latestUi((await turn(server.fetch, { kind: "message", text: "book AI technician" })).events);
		ui = await pick(server, ui, "ai_technician", "tech_2");
		ui = await pick(server, ui, "ai_species", "buffalo");
		return ui;
	}

	it("technician, then animal, then a review with the summary object", async () => {
		const server = createMockChatServer({ chunkDelayMs: 0 });
		const first = latestUi((await turn(server.fetch, { kind: "message", text: "book AI technician" })).events);
		// Technician comes first, always.
		expect(first.components.map((c) => c.kind === "choice" && c.purpose)).toEqual(["ai_technician"]);

		const ui = await upToConfirm(server);
		const confirm = pendingConfirm(ui);
		expect(confirm.purpose).toBe("ai_booking");
		expect(confirm.outcome).toBeNull();
		expect(confirm.summary).toMatchObject({
			technician: { id: "tech_2", label: "Suresh Desai" },
			species: "buffalo",
			species_label: "Buffalo"
		});
	});

	it("skips the animal picker when the farmer already named it", async () => {
		const server = createMockChatServer({ chunkDelayMs: 0 });
		let ui = latestUi((await turn(server.fetch, { kind: "message", text: "AI technician for my cow" })).events);
		ui = await pick(server, ui, "ai_technician", "tech_1");
		expect(ui.components.some((c) => c.kind === "choice" && c.purpose === "ai_species")).toBe(false);
		expect(pendingConfirm(ui).summary.species).toBe("cow");
	});

	it("confirm puts the outcome on the same control; a repeat books nothing more", async () => {
		const server = createMockChatServer({ chunkDelayMs: 0 });
		let ui = await upToConfirm(server);
		const confirm = pendingConfirm(ui);
		const { events } = await turn(server.fetch, confirmOp(confirm, true));
		ui = latestUi(events, ui);
		expect(events.at(-1)?.type).toBe("RUN_FINISHED");
		const done = ui.components.find((c) => c.id === confirm.id);
		expect(done).toMatchObject({ status: "submitted", selected: { confirmed: true }, outcome: { status: "confirmed" } });
		if (done?.kind !== "confirm") throw new Error("expected the confirm");
		expect(done.outcome?.ticket).toMatch(/^AI-/);

		await expect(turn(server.fetch, confirmOp(confirm, true))).rejects.toMatchObject({ status: 409, code: "STALE_COMPONENT" });
		expect(server.bookingsMade()).toBe(1);
	});

	it("an unconfirmed outcome has no ticket and ends with ui_error and RUN_ERROR", async () => {
		const server = createMockChatServer({ chunkDelayMs: 0, bookingOutcome: "unconfirmed" });
		let ui = await upToConfirm(server);
		const confirm = pendingConfirm(ui);
		const { events } = await turn(server.fetch, confirmOp(confirm, true));
		ui = latestUi(events, ui);
		expect(ui.components.find((c) => c.id === confirm.id)).toMatchObject({ outcome: { status: "unconfirmed", ticket: null } });
		expect(events.find((e) => e.type === "CUSTOM")).toMatchObject({
			name: "amul.ui_error",
			value: { error: { code: "AI_BOOKING_UNCONFIRMED" } }
		});
		expect(events.at(-1)).toMatchObject({ type: "RUN_ERROR", code: "AI_BOOKING_UNCONFIRMED" });
	});

	it("confirmed: false cancels without booking", async () => {
		const server = createMockChatServer({ chunkDelayMs: 0 });
		let ui = await upToConfirm(server);
		const confirm = pendingConfirm(ui);
		ui = latestUi((await turn(server.fetch, confirmOp(confirm, false))).events, ui);
		expect(ui.components.find((c) => c.id === confirm.id)).toMatchObject({ status: "submitted", selected: { confirmed: false } });
		expect(server.bookingsMade()).toBe(0);
	});

	it("edit sends the field and reopens that picker; cancel works at a picker", async () => {
		const server = createMockChatServer({ chunkDelayMs: 0 });
		let ui = await upToConfirm(server);
		const confirm = pendingConfirm(ui);
		const edit: ChatOperation = {
			kind: "command",
			command: { kind: "edit_ai_booking", workflow_id: confirm.workflow_id, state_revision: ui.state_revision, field: "species" }
		};
		const body = buildRequestBody({ ...base, operation: edit });
		expect(body.messages).toEqual([]);
		expect(body.forwardedProps.command).toEqual({
			kind: "edit_ai_booking",
			workflow_id: confirm.workflow_id,
			state_revision: ui.state_revision,
			field: "species"
		});

		ui = latestUi((await turn(server.fetch, edit)).events, ui);
		expect(ui.components.find((c) => c.id === confirm.id)?.status).toBe("expired");
		ui = await pick(server, ui, "ai_species", "cow");
		expect(pendingConfirm(ui).summary).toMatchObject({ technician: { label: "Suresh Desai" }, species: "cow" });

		ui = latestUi(
			(await turn(server.fetch, {
				kind: "command",
				command: { kind: "edit_ai_booking", workflow_id: confirm.workflow_id, state_revision: ui.state_revision, field: "technician" }
			})).events,
			ui
		);
		const picker = ui.components.find((c) => c.kind === "choice" && c.purpose === "ai_technician" && c.status === "pending");
		expect(picker).toBeDefined();

		ui = latestUi(
			(await turn(server.fetch, {
				kind: "command",
				command: { kind: "cancel_ai_booking", workflow_id: confirm.workflow_id, state_revision: ui.state_revision }
			})).events,
			ui
		);
		expect(ui.components.some((c) => c.workflow_id === confirm.workflow_id && c.status === "pending")).toBe(false);
		expect(server.bookingsMade()).toBe(0);
	});

	it("rejects a command sent with an old state_revision", async () => {
		const server = createMockChatServer({ chunkDelayMs: 0 });
		const ui = await upToConfirm(server);
		const confirm = pendingConfirm(ui);
		await expect(
			turn(server.fetch, {
				kind: "command",
				command: { kind: "cancel_ai_booking", workflow_id: confirm.workflow_id, state_revision: ui.state_revision - 1 }
			})
		).rejects.toMatchObject({ status: 409, code: "STALE_STATE" });
	});

	it("an unavailable technician brings back the technician picker", async () => {
		const server = createMockChatServer({ chunkDelayMs: 0 });
		let ui = latestUi((await turn(server.fetch, { kind: "message", text: "technician" })).events);
		const first = ui.components[0]!;
		ui = await pick(server, ui, "ai_technician", "tech_gone");
		expect(ui.components.find((c) => c.id === first.id)?.status).toBe("expired");
		expect(ui.components.filter((c) => c.kind === "choice" && c.purpose === "ai_technician" && c.status === "pending")).toHaveLength(1);
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
