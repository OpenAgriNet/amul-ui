// Test-only fake of the backend's POST /api/chat/ (OpenAgriNet/amul-oan-api#593,
// plus the AI booking flow of #636/#637 and the mandi/scheme pickers of #639/#640).
// It follows the contract: one operation per request, AG-UI events over SSE,
// full STATE_SNAPSHOTs, and 409/422 errors before the stream starts. Only the
// adapter tests import it; the app never does.

import { addDays, daysBetween, fromIsoDate, toIsoDate } from "../state";
import type {
	AguiRequestBody,
	AmulUIState,
	BookingOutcome,
	BookingOutcomeStatus,
	ChartComponent,
	ChatError,
	ChoiceComponent,
	ConfirmComponent,
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

const SPECIES = [
	{ id: "cow", label: "Cow" },
	{ id: "buffalo", label: "Buffalo" }
];

// Option ids are the fake's own, like the backend's, not the API's technician ids.
// Descriptions are the technician's mobile, as in #637. These numbers are made up.
const TECHNICIANS = [
	{ id: "tech_1", label: "Ramesh Patel", description: "90000 00001" },
	{ id: "tech_2", label: "Suresh Desai", description: "90000 00002" },
	// No longer available when picked: the backend shows the technician picker again.
	{ id: "tech_gone", label: "Mahesh Shah", description: "90000 00003" }
];

const BOOKING_ACCOUNT = "Anand Milk Society · 1042";

const BOOKING_WORDS = ["insemination", "technician", "બીજદાન", "ગર્ભાધાન", "गर्भाधान", "रेतन"];

// #640: a mandi question with no known place gets a searchable district picker.
// Ids are opaque, like the backend's; search terms carry the aliases.
const DISTRICTS = [
	{ id: "dist_ahd", label: "Ahmedabad", description: null, search_terms: ["ahmedabad", "amdavad", "અમદાવાદ"] },
	{ id: "dist_anand", label: "Anand", description: null, search_terms: ["anand", "આણંદ"] },
	{ id: "dist_banas", label: "Banaskantha", description: null, search_terms: ["banaskantha", "palanpur", "બનાસકાંઠા"] },
	{ id: "dist_kheda", label: "Kheda", description: null, search_terms: ["kheda", "nadiad", "ખેડા"] },
	{ id: "dist_mehsana", label: "Mehsana", description: null, search_terms: ["mehsana", "મહેસાણા"] },
	{ id: "dist_rajkot", label: "Rajkot", description: null, search_terms: ["rajkot", "રાજકોટ"] },
	{ id: "dist_surat", label: "Surat", description: null, search_terms: ["surat", "સુરત"] },
	{ id: "dist_vadodara", label: "Vadodara", description: null, search_terms: ["vadodara", "baroda", "વડોદરા"] }
];

// Descriptions name the source, as the backend does. The schemes are made up.
const SCHEMES = [
	{ id: "sch_u1", label: "Cattle shed subsidy", description: "Banas dairy union", search_terms: [] },
	{ id: "sch_u2", label: "Fodder seed support", description: "Banas dairy union", search_terms: [] },
	{ id: "sch_c1", label: "PM-KISAN", description: "Central government", search_terms: ["pm kisan", "kisan samman nidhi"] },
	{ id: "sch_c2", label: "Kisan Credit Card", description: "Central government", search_terms: ["kcc"] }
];

const MANDI_WORDS = ["mandi", "મંડી", "मंडी", "ભાવ", "भाव"];
const SCHEME_WORDS = ["scheme", "યોજના", "योजना"];
/** A place the fake treats as outside the mandi search areas. */
const UNSUPPORTED_PLACE = "mumbai";

type Event = Record<string, unknown> & { type: string };

type MockOptions = {
	/** Delay between SSE chunks, in ms. Tests pass 0. */
	chunkDelayMs?: number;
	/** Split every event across this many network chunks, to exercise reassembly. */
	fragments?: number;
	/** What a confirmed booking returns. Defaults to "confirmed" with a ticket. */
	bookingOutcome?: BookingOutcomeStatus;
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
	/** Booking choices so far, by workflow. */
	const bookings = new Map<string, { species?: string; technician?: string }>();
	/** #640 picker workflows, by workflow id. */
	const selectors = new Map<string, "mandi_location" | "scheme">();
	let bookingsMade = 0;

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

	/** `failure` ends the run like the backend does: CUSTOM amul.ui_error, then RUN_ERROR. */
	function stream(body: AguiRequestBody, events: Event[], failure?: ChatError): Response {
		const end: Event[] = failure
			? [
					{ type: "CUSTOM", name: "amul.ui_error", value: failure },
					{ type: "RUN_ERROR", code: failure.error.code, message: failure.error.message }
				]
			: [{ type: "RUN_FINISHED", threadId: body.threadId, runId: body.runId }];
		const all: Event[] = [{ type: "RUN_STARTED", threadId: body.threadId, runId: body.runId }, ...events, ...end];
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

	const base = (messageId: string, workflowId: string, title: string) => ({
		id: nextId("cmp"),
		workflow_id: workflowId,
		message_id: messageId,
		revision: 1,
		title,
		status: "pending" as const
	});

	const speciesPicker = (messageId: string, workflowId: string): ChoiceComponent => ({
		...base(messageId, workflowId, "Choose the animal"),
		kind: "choice",
		purpose: "ai_species",
		options: SPECIES.map(({ id, label }) => ({ id, label, description: null })),
		selected: null
	});

	const technicianPicker = (messageId: string, workflowId: string): ChoiceComponent => ({
		...base(messageId, workflowId, "Choose an AI technician"),
		kind: "choice",
		purpose: "ai_technician",
		options: TECHNICIANS.map(({ id, label, description }) => ({ id, label, description })),
		selected: null
	});

	const confirmCard = (messageId: string, workflowId: string): ConfirmComponent => {
		const booking = bookings.get(workflowId)!;
		const technician = TECHNICIANS.find((t) => t.id === booking.technician)!;
		const species = SPECIES.find((sp) => sp.id === booking.species)!;
		return {
			...base(messageId, workflowId, "Confirm AI visit"),
			kind: "confirm",
			purpose: "ai_booking",
			summary: {
				account_label: BOOKING_ACCOUNT,
				technician: { id: technician.id, label: technician.label, description: technician.description },
				species: species.id as "cow" | "buffalo",
				species_label: species.label
			},
			selected: null,
			outcome: null
		};
	};

	const markSubmitted = (target: UIComponent, selected: unknown, extra: object = {}): UIComponent =>
		({ ...target, status: "submitted", revision: target.revision + 1, selected, ...extra }) as UIComponent;

	/** Expires this booking's pending controls; milk controls are left alone, as in #637. */
	const expireBooking = (components: UIComponent[], workflowId: string): UIComponent[] =>
		components.map((c) =>
			c.workflow_id === workflowId && c.status === "pending" ? ({ ...c, status: "expired", revision: c.revision + 1 } as UIComponent) : c
		);

	function startBookingWorkflow(body: AguiRequestBody, text: string): Response {
		const messageId = nextId("msg");
		const workflowId = nextId("wf");
		// Like the agent: the species is passed only when the farmer named it.
		const species = SPECIES.find((sp) => text.toLowerCase().includes(sp.id))?.id;
		bookings.set(workflowId, { species });
		const others = [...bookings.keys()].filter((id) => id !== workflowId);
		const components = others.reduce((all, id) => expireBooking(all, id), ui.components);
		publish([...components, technicianPicker(messageId, workflowId)]);
		return stream(body, [...textEvents(messageId, "Sure. Which technician should come?"), snapshot()]);
	}

	function handleBookingAction(
		body: AguiRequestBody,
		target: UIComponent,
		action: NonNullable<AguiRequestBody["forwardedProps"]["ui_action"]>
	): Response {
		const workflowId = target.workflow_id;
		const booking = bookings.get(workflowId)!;
		const messageId = nextId("msg");
		const replace = (submitted: UIComponent, ...added: UIComponent[]) =>
			ui.components.map((c) => (c.id === target.id ? submitted : c)).concat(added);

		if (target.kind === "choice" && action.kind === "choice" && target.purpose === "ai_technician") {
			const technician = TECHNICIANS.find((t) => t.id === action.value.option_id);
			if (!technician) return jsonError(422, "INVALID_OPTION", "Choose one of the displayed options.", target.id);
			if (technician.id === "tech_gone") {
				publish([...expireBooking(ui.components, workflowId), technicianPicker(messageId, workflowId)]);
				return stream(body, [...textEvents(messageId, "That technician is no longer available. Please choose again."), snapshot()]);
			}
			booking.technician = technician.id;
			const next = booking.species ? confirmCard(messageId, workflowId) : speciesPicker(messageId, workflowId);
			publish(replace(markSubmitted(target, { option_id: technician.id }), next));
			return stream(body, [...textEvents(messageId, next.title), snapshot()]);
		}

		if (target.kind === "choice" && action.kind === "choice" && target.purpose === "ai_species") {
			const species = SPECIES.find((sp) => sp.id === action.value.option_id);
			if (!species) return jsonError(422, "INVALID_OPTION", "Choose one of the displayed options.", target.id);
			booking.species = species.id;
			const confirm = confirmCard(messageId, workflowId);
			publish(replace(markSubmitted(target, { option_id: species.id }), confirm));
			return stream(body, [...textEvents(messageId, confirm.title), snapshot()]);
		}

		if (target.kind === "confirm" && action.kind === "confirm") {
			if (!action.value.confirmed) {
				publish(expireBooking(replace(markSubmitted(target, { confirmed: false })), workflowId));
				return stream(body, [...textEvents(messageId, "AI booking cancelled."), snapshot()]);
			}
			bookingsMade++;
			const status = options.bookingOutcome ?? "confirmed";
			const outcome: BookingOutcome = {
				status,
				message: {
					confirmed: "Your AI visit is booked. The technician will contact you.",
					rejected: "The booking service did not accept this booking.",
					not_sent: "The booking was not sent.",
					unconfirmed: "The booking could not be confirmed. Please don't book again right away.",
					already_requested: "An AI visit has already been requested."
				}[status],
				ticket: status === "confirmed" ? `AI-${1000 + bookingsMade}` : null
			};
			publish(replace(markSubmitted(target, { confirmed: true }, { outcome })));
			const failure: ChatError | undefined =
				status === "confirmed"
					? undefined
					: { error: { code: `AI_BOOKING_${status.toUpperCase()}`, message: outcome.message, retryable: false } };
			return stream(body, [...textEvents(messageId, outcome.message), snapshot()], failure);
		}

		return jsonError(422, "UNSUPPORTED_ACTION", "This control does not accept that action.", target.id);
	}

	function startSelectorWorkflow(body: AguiRequestBody, purpose: "mandi_location" | "scheme"): Response {
		const messageId = nextId("msg");
		const workflowId = nextId("wf");
		selectors.set(workflowId, purpose);
		const title = purpose === "mandi_location" ? "Choose the search district" : "Choose a scheme";
		const picker: ChoiceComponent = {
			...base(messageId, workflowId, title),
			kind: "choice",
			purpose,
			searchable: true,
			options: (purpose === "mandi_location" ? DISTRICTS : SCHEMES).map((o) => ({ ...o, search_terms: [...o.search_terms] })),
			selected: null
		};
		// Other pending controls stay usable, as in #640.
		publish([...ui.components, picker]);
		return stream(body, [...textEvents(messageId, title), snapshot()]);
	}

	function handleSelectorAction(
		body: AguiRequestBody,
		target: UIComponent,
		action: NonNullable<AguiRequestBody["forwardedProps"]["ui_action"]>
	): Response {
		if (target.kind !== "choice" || action.kind !== "choice") {
			return jsonError(422, "UNSUPPORTED_ACTION", "This control does not accept that action.", target.id);
		}
		const option = target.options.find((o) => o.id === action.value.option_id);
		if (!option) return jsonError(422, "INVALID_OPTION", "Choose one of the displayed options.", target.id);
		const messageId = nextId("msg");
		publish(ui.components.map((c) => (c.id === target.id ? markSubmitted(c, { option_id: option.id }) : c)));
		const text =
			target.purpose === "mandi_location"
				? `Mandi prices for onion near ${option.label}: ₹1,200–₹1,650 per quintal.`
				: `${option.label} (${option.description}): details from the source.`;
		return stream(body, [...textEvents(messageId, text), snapshot()]);
	}

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
			if (BOOKING_WORDS.some((w) => text.toLowerCase().includes(w))) {
				return startBookingWorkflow(body, text);
			}
			if (MILK_WORDS.some((w) => text.toLowerCase().includes(w))) {
				return startMilkWorkflow(body, "Sure.");
			}
			if (MANDI_WORDS.some((w) => text.toLowerCase().includes(w))) {
				if (text.toLowerCase().includes(UNSUPPORTED_PLACE)) {
					const message = "That place is outside the supported mandi search areas. Please choose a supported Gujarat district.";
					return stream(body, textEvents(nextId("msg"), message), {
						error: { code: "MANDI_LOCATION_UNSUPPORTED", message, retryable: false }
					});
				}
				return startSelectorWorkflow(body, "mandi_location");
			}
			if (SCHEME_WORDS.some((w) => text.toLowerCase().includes(w))) {
				return startSelectorWorkflow(body, "scheme");
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

		if (props.command?.kind === "edit_ai_booking" || props.command?.kind === "cancel_ai_booking") {
			const command = props.command;
			if (command.state_revision !== ui.state_revision) {
				return jsonError(409, "STALE_STATE", "The chat changed. Use its latest state revision.");
			}
			const booking = bookings.get(command.workflow_id);
			const pending = ui.components.some((c) => c.workflow_id === command.workflow_id && c.status === "pending");
			if (!booking || !pending) return jsonError(409, "STALE_COMPONENT", "This booking is no longer awaiting a selection.");
			const messageId = nextId("msg");
			const expired = expireBooking(ui.components, command.workflow_id);
			if (command.kind === "cancel_ai_booking") {
				publish(expired);
				return stream(body, [...textEvents(messageId, "AI booking cancelled."), snapshot()]);
			}
			// Editing needs a fresh confirmation; the other choice is kept.
			const picker =
				command.field === "technician" || !booking.technician
					? technicianPicker(messageId, command.workflow_id)
					: speciesPicker(messageId, command.workflow_id);
			publish([...expired, picker]);
			return stream(body, [...textEvents(messageId, picker.title), snapshot()]);
		}

		const action = props.ui_action;
		if (!action) return jsonError(422, "INVALID_REQUEST", "Send one message, ui_action, or command.");

		const target = ui.components.find((c) => c.id === action.component_id);
		if (!target) return jsonError(404, "COMPONENT_NOT_FOUND", "That control no longer exists.", action.component_id);
		if (target.status !== "pending" || target.revision !== action.revision) {
			return jsonError(409, "STALE_COMPONENT", "This control was already used or has changed.", action.component_id);
		}

		if (bookings.has(target.workflow_id)) return handleBookingAction(body, target, action);
		if (selectors.has(target.workflow_id)) return handleSelectorAction(body, target, action);

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
			bookings.clear();
			selectors.clear();
			bookingsMade = 0;
		},
		/** How many bookings were actually made, to check a repeat confirm adds none. */
		bookingsMade: () => bookingsMade
	};
}
