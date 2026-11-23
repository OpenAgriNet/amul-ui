// Test-only fake of the backend's POST /api/chat/ (OpenAgriNet/amul-oan-api#593).
// It follows the contract: one operation per request, AG-UI events over SSE,
// full STATE_SNAPSHOTs, and 409/422 errors before the stream starts. Only the
// adapter tests import it; the app never does.

import { addDays, daysBetween, fromIsoDate, toIsoDate } from "../state";
import type {
	AguiRequestBody,
	AmulUIState,
	ChartComponent,
	ChatError,
	ChoiceComponent,
	DateRangeComponent,
	MilkResult,
	UIComponent
} from "../types";

const MAX_DAYS = 31;

const ACCOUNTS = [
	{ id: "opt_a1", label: "Anand Milk Society", description: "Member 1042 · Cow" },
	{ id: "opt_b2", label: "Vadod Milk Society", description: "Member 377 · Buffalo" }
];

const MILK_WORDS = ["milk", "દૂધ", "दूध", "दुध", "দুধ", "ਦੁੱਧ"];

type Event = Record<string, unknown> & { type: string };

type MockOptions = {
	/** Delay between SSE chunks, in ms. Tests pass 0. */
	chunkDelayMs?: number;
	/** Split every event across this many network chunks, to exercise reassembly. */
	fragments?: number;
};

let counter = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

function jsonError(status: number, code: string, message: string, componentId?: string): Response {
	const body: ChatError = { error: { code, message, retryable: false, ...(componentId && { component_id: componentId }) } };
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Deterministic pseudo-random numbers so the chart looks the same on every run. */
function seeded(seed: number) {
	let s = seed;
	return () => {
		s = (s * 9301 + 49297) % 233280;
		return s / 233280;
	};
}

function buildMilkResult(account: { id: string; label: string }, fromdate: string, todate: string): MilkResult {
	const rand = seeded(account.id.length * 97 + fromdate.length + Number(fromdate.slice(-2)));
	const start = fromIsoDate(fromdate);
	const days = daysBetween(start, fromIsoDate(todate)) + 1;
	const milk: MilkResult["milk"] = [];
	const daily: MilkResult["daily_quantity"] = [];
	let litres = 0;
	let rupees = 0;
	let fatWeighted = 0;
	let snfWeighted = 0;
	let daysWithMilk = 0;

	for (let i = 0; i < days; i++) {
		const date = toIsoDate(addDays(start, i));
		if (rand() < 0.08) {
			daily.push({ date, quantity_litres: null });
			continue;
		}
		let dayTotal = 0;
		for (const shift of ["Morning", "Evening"]) {
			const qty = Math.round((3.2 + rand() * 2.6) * 10) / 10;
			const fat = Math.round((4.1 + rand() * 1.4) * 10) / 10;
			const snf = Math.round((8.2 + rand() * 0.6) * 10) / 10;
			const amount = Math.round(qty * (38 + fat * 2.2) * 100) / 100;
			milk.push({ date, shift, qty, fat, snf, amount });
			dayTotal += qty;
			litres += qty;
			rupees += amount;
			fatWeighted += fat * qty;
			snfWeighted += snf * qty;
		}
		daysWithMilk++;
		daily.push({ date, quantity_litres: Math.round(dayTotal * 10) / 10 });
	}

	const hasRecords = milk.length > 0;
	return {
		status: hasRecords ? "ok" : "no_records",
		account: { option_id: account.id, label: account.label },
		period: { fromdate, todate },
		summary: hasRecords
			? {
					days_with_milk: daysWithMilk,
					total_quantity_litres: Math.round(litres * 10) / 10,
					total_amount_rupees: Math.round(rupees * 100) / 100,
					weighted_fat: Math.round((fatWeighted / litres) * 100) / 100,
					weighted_snf: Math.round((snfWeighted / litres) * 100) / 100
				}
			: null,
		milk,
		deductions: hasRecords ? [{ date: todate, account_name: "Cattle feed", amount: 640 }] : [],
		daily_quantity: daily,
		warnings: []
	};
}

export function createMockChatServer(options: MockOptions = {}) {
	const chunkDelayMs = options.chunkDelayMs ?? 35;
	const fragments = Math.max(1, options.fragments ?? 1);

	let ui: AmulUIState = { version: 1, state_revision: 0, selected_milk_account: null, components: [] };

	const publish = (components: UIComponent[], selected = ui.selected_milk_account) => {
		ui = { ...ui, state_revision: ui.state_revision + 1, selected_milk_account: selected, components };
	};

	const expirePending = (components: UIComponent[]): UIComponent[] =>
		components.map((c) => (c.status === "pending" ? ({ ...c, status: "expired", revision: c.revision + 1 } as UIComponent) : c));

	const accountPicker = (messageId: string, workflowId: string): ChoiceComponent => ({
		id: nextId("cmp"),
		workflow_id: workflowId,
		message_id: messageId,
		revision: 1,
		title: "Choose an account",
		status: "pending",
		kind: "choice",
		purpose: "milk_account",
		options: ACCOUNTS.map(({ id, label, description }) => ({ id, label, description })),
		selected: null
	});

	const datePicker = (messageId: string, workflowId: string): DateRangeComponent => ({
		id: nextId("cmp"),
		workflow_id: workflowId,
		message_id: messageId,
		revision: 1,
		title: "Choose the dates",
		status: "pending",
		kind: "date_range",
		purpose: "milk_period",
		// Like the real backend: no min_date / max_date today.
		constraints: { date_format: "YYYY-MM-DD", max_difference_days: MAX_DAYS },
		selected: null
	});

	function textEvents(messageId: string, text: string): Event[] {
		const words = text.split(/(?<= )/);
		return [
			{ type: "TEXT_MESSAGE_START", messageId, role: "assistant" },
			...words.map((delta) => ({ type: "TEXT_MESSAGE_CONTENT", messageId, delta })),
			{ type: "TEXT_MESSAGE_END", messageId }
		];
	}

	function stream(body: AguiRequestBody, events: Event[]): Response {
		const all: Event[] = [
			{ type: "RUN_STARTED", threadId: body.threadId, runId: body.runId },
			...events,
			{ type: "RUN_FINISHED", threadId: body.threadId, runId: body.runId }
		];
		const encoder = new TextEncoder();
		const readable = new ReadableStream<Uint8Array>({
			async start(controller) {
				for (const event of all) {
					const frame = `data: ${JSON.stringify(event)}\n\n`;
					const size = Math.ceil(frame.length / fragments);
					for (let i = 0; i < frame.length; i += size) {
						controller.enqueue(encoder.encode(frame.slice(i, i + size)));
						if (chunkDelayMs > 0) await new Promise((r) => setTimeout(r, chunkDelayMs));
					}
				}
				controller.close();
			}
		});
		return new Response(readable, {
			status: 200,
			headers: {
				"Content-Type": "text/event-stream",
				"X-Chat-Format": "agui-v1",
				"X-Trace-Id": nextId("trace")
			}
		});
	}

	const snapshot = (): Event => ({ type: "STATE_SNAPSHOT", snapshot: { amul_ui: ui } });

	function startMilkWorkflow(body: AguiRequestBody, intro: string): Response {
		const messageId = nextId("msg");
		const workflowId = nextId("wf");
		const remembered = ui.selected_milk_account;
		const component = remembered ? datePicker(messageId, workflowId) : accountPicker(messageId, workflowId);
		publish([...expirePending(ui.components), component]);
		const text = remembered ? `${intro} Which dates for ${remembered.label}?` : `${intro} Which account should I check?`;
		return stream(body, [...textEvents(messageId, text), snapshot()]);
	}

	function handle(body: AguiRequestBody): Response {
		const props = body.forwardedProps;

		if (body.messages.length === 1 && !props.ui_action && !props.command) {
			const text = body.messages[0]?.content ?? "";
			if (MILK_WORDS.some((w) => text.toLowerCase().includes(w))) {
				return startMilkWorkflow(body, "Sure.");
			}
			const messageId = nextId("msg");
			return stream(body, textEvents(messageId, "This is mock mode. Ask about your milk records to try the new controls."));
		}

		if (props.command?.kind === "change_milk_account") {
			if (props.command.state_revision !== ui.state_revision) {
				return jsonError(409, "STALE_STATE", "The chat has changed. Please try again.");
			}
			ui = { ...ui, selected_milk_account: null };
			return startMilkWorkflow(body, "Okay.");
		}

		const action = props.ui_action;
		if (!action) return jsonError(422, "INVALID_REQUEST", "Send one message, ui_action, or command.");

		const target = ui.components.find((c) => c.id === action.component_id);
		if (!target) return jsonError(404, "COMPONENT_NOT_FOUND", "That control no longer exists.", action.component_id);
		if (target.status !== "pending" || target.revision !== action.revision) {
			return jsonError(409, "STALE_COMPONENT", "This control was already used or has changed.", action.component_id);
		}

		if (action.kind === "choice" && target.kind === "choice") {
			const option = ACCOUNTS.find((a) => a.id === action.value.option_id);
			if (!option) return jsonError(422, "INVALID_OPTION", "That account is not available.", target.id);
			const messageId = nextId("msg");
			const submitted: ChoiceComponent = { ...target, status: "submitted", revision: target.revision + 1, selected: { option_id: option.id } };
			const dates = datePicker(messageId, target.workflow_id);
			publish(
				ui.components.map((c) => (c.id === target.id ? submitted : c)).concat(dates),
				{ option_id: option.id, label: option.label }
			);
			return stream(body, [...textEvents(messageId, `Which dates for ${option.label}?`), snapshot()]);
		}

		if (action.kind === "date_range" && target.kind === "date_range") {
			const { fromdate, todate } = action.value;
			const diff = daysBetween(fromIsoDate(fromdate), fromIsoDate(todate));
			if (diff < 0 || diff > MAX_DAYS) {
				return jsonError(422, "INVALID_DATE_RANGE", `The end date can be at most ${MAX_DAYS} days after the start date.`, target.id);
			}
			const account = ui.selected_milk_account;
			if (!account) return jsonError(409, "NO_ACCOUNT", "Choose an account first.", target.id);
			const messageId = nextId("msg");
			const submitted: DateRangeComponent = { ...target, status: "submitted", revision: target.revision + 1, selected: { fromdate, todate } };
			const chart: ChartComponent = {
				id: nextId("cmp"),
				workflow_id: target.workflow_id,
				message_id: messageId,
				revision: 1,
				title: "Milk records",
				status: "submitted",
				kind: "chart",
				purpose: "milk_records",
				data: buildMilkResult({ id: account.option_id, label: account.label }, fromdate, todate)
			};
			publish(ui.components.map((c) => (c.id === target.id ? submitted : c)).concat(chart));
			return stream(body, [...textEvents(messageId, `Here are the milk records for ${account.label}.`), snapshot()]);
		}

		return jsonError(422, "UNSUPPORTED_ACTION", "This control does not accept that action.", target.id);
	}

	return {
		fetch: async (_url: string, init: RequestInit): Promise<Response> => {
			const body = JSON.parse(String(init.body)) as AguiRequestBody;
			return handle(body);
		},
		reset: () => {
			ui = { version: 1, state_revision: 0, selected_milk_account: null, components: [] };
		}
	};
}
