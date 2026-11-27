// Test-only fake of the backend's POST /api/chat/ (OpenAgriNet/amul-oan-api#593,
// plus the AI booking flow of #636/#637, the mandi/scheme pickers of #639/#640
// and the cattle/fodder cards of #641).
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
	ListingCard,
	ListingCollectionComponent,
	ListingDetailComponent,
	ListingFact,
	ListingFilterDefinition,
	ListingFilters,
	ListingSource,
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

// #641: made-up listings. Number 9999 is "sold": opening it finds nothing.
const CATTLE = [
	{ number: 1201, species: "cow", breed: "Gir", district: "Banaskantha", village: "Deesa", price: "65000", milk: "12", age: "4 years old", lactation: 2, milking: "milking", pregnancy: "not pregnant" },
	{ number: 1202, species: "buffalo", breed: "Banni", district: "Banaskantha", village: "Dhanera", price: "90000", milk: "14", age: "5 years old", lactation: 3, milking: "milking", pregnancy: "pregnant" },
	{ number: 1203, species: "cow", breed: "Kankrej", district: "Banaskantha", village: "Dhedhal", price: "48000", milk: "None", age: "3 years old", lactation: 1, milking: "dry", pregnancy: "pregnant" },
	{ number: 1204, species: "buffalo", breed: "Mehsani", district: "Mehsana", village: "Unjha", price: "75000", milk: "11", age: "6 years old", lactation: 4, milking: "milking", pregnancy: "not pregnant" },
	{ number: 1205, species: "cow", breed: "Gir", district: "Rajkot", village: "Gondal", price: "70000", milk: "13", age: "5 years old", lactation: 2, milking: "milking", pregnancy: "not pregnant" },
	{ number: 9999, species: "cow", breed: "HF cross", district: "Anand", village: "Borsad", price: "55000", milk: "15", age: "4 years old", lactation: 2, milking: "milking", pregnancy: "not pregnant" }
];
const CATTLE_CAP = 4;
const CATTLE_SOURCE_TOTAL = 120;

const FODDER = [
	{ id: 501, name: "Maize green fodder", name_gu: "મકાઈનો લીલો ચારો", form: "GREEN", rate: 4.5, unit: "kg", qty: 2000, district: "Anand", district_gu: "આણંદ", subdistrict: "Petlad", valid: "2026-12-05T00:00:00Z", shared: true },
	{ id: 502, name: "Wheat straw", name_gu: "ઘઉંનું ભુસું", form: "DRY", rate: 450, unit: "quintal", qty: 40, district: "Kheda", district_gu: "ખેડા", subdistrict: "Nadiad", valid: "2026-12-10T00:00:00Z", shared: false },
	{ id: 503, name: "Maize silage", name_gu: "મકાઈ સાયલેજ", form: "SILAGE", rate: 7, unit: "kg", qty: 5000, district: "Anand", district_gu: "આણંદ", subdistrict: "Anand", valid: "2026-12-01T00:00:00Z", shared: true }
];

const CATTLE_WORDS = ["cattle", "buy cow", "buy buffalo", "cow for sale", "buffalo for sale", "પશુ ખરીદ", "पशु खरीद"];
const FODDER_WORDS = ["fodder", "ઘાસચારો", "ચારો", "चारा"];

const cattleFacts = (c: (typeof CATTLE)[number]): ListingFact[] => [
	{ key: "listing_number", value: c.number },
	{ key: "species", value: c.species },
	{ key: "breed", value: c.breed },
	{ key: "district", value: c.district },
	{ key: "village", value: c.village },
	{ key: "asking_price_inr", value: c.price },
	// Like the backend today: a missing yield arrives as the text "None".
	{ key: "milk_per_day_litres", value: c.milk },
	{ key: "age", value: c.age },
	{ key: "lactation", value: c.lactation },
	{ key: "milking_status", value: c.milking },
	{ key: "pregnancy_status", value: c.pregnancy }
];

const fodderFacts = (f: (typeof FODDER)[number], detail: boolean): ListingFact[] => [
	{ key: "material.canonical_name_en", value: f.name },
	{ key: "material.name_gu", value: f.name_gu },
	{ key: "material.form", value: f.form },
	{ key: "location.district.name_en", value: f.district },
	{ key: "location.district.name_gu", value: f.district_gu },
	{ key: "location.subdistrict.name_en", value: f.subdistrict },
	{ key: "quantity.available", value: f.qty },
	{ key: "quantity.unit_name_en", value: f.unit },
	{ key: "price.rate_inr", value: f.rate },
	{ key: "price.per_unit_name_en", value: f.unit },
	{ key: "freshness.valid_until", value: f.valid },
	...(detail
		? [
				{ key: "listing_id", value: f.id },
				{ key: "delivery.option", value: "pickup" },
				{ key: "freshness.last_confirmed_at", value: "2026-11-26T09:30:00Z" }
			]
		: [])
];

const CATTLE_FILTERS: ListingFilterDefinition[] = [
	{ name: "species", kind: "select", options: ["cow", "buffalo"], minimum: null, maximum: null, unit: null },
	{ name: "breed", kind: "text", options: [...new Set(CATTLE.map((c) => c.breed))].sort(), minimum: null, maximum: null, unit: null },
	{ name: "district", kind: "text", options: [...new Set(CATTLE.map((c) => c.district))].sort(), minimum: null, maximum: null, unit: null },
	{ name: "village", kind: "text", options: [], minimum: null, maximum: null, unit: null },
	{ name: "max_price", kind: "number", options: [], minimum: 0, maximum: null, unit: "INR" },
	{ name: "min_milk_per_day", kind: "number", options: [], minimum: 0, maximum: null, unit: "litres/day" },
	{ name: "milking_status", kind: "select", options: ["milking", "dry"], minimum: null, maximum: null, unit: null },
	{ name: "pregnancy_status", kind: "select", options: ["pregnant", "not pregnant"], minimum: null, maximum: null, unit: null }
];

const FODDER_FILTERS: ListingFilterDefinition[] = [
	{ name: "q", kind: "text", options: [], minimum: null, maximum: null, unit: null },
	{ name: "form", kind: "select", options: ["GREEN", "DRY", "HAY", "SILAGE", "CONCENTRATE"], minimum: null, maximum: null, unit: null },
	{ name: "district", kind: "text", options: [], minimum: null, maximum: null, unit: null },
	{ name: "max_rate_per_kg", kind: "number", options: [], minimum: 0, maximum: null, unit: "INR/kg" },
	{ name: "sort", kind: "select", options: ["recent", "rate", "qty"], minimum: null, maximum: null, unit: null },
	{ name: "limit", kind: "number", options: [], minimum: 1, maximum: 20, unit: null }
];

const same = (a: string, b: unknown) => typeof b === "string" && a.toLowerCase() === b.trim().toLowerCase();

type Event = Record<string, unknown> & { type: string };

type MockOptions = {
	/** Delay between SSE chunks, in ms. Tests pass 0. */
	chunkDelayMs?: number;
	/** Split every event across this many network chunks, to exercise reassembly. */
	fragments?: number;
	/** What a confirmed booking returns. Defaults to "confirmed" with a ticket. */
	bookingOutcome?: BookingOutcomeStatus;
	/** Cattle listings come from an old snapshot (#641 stale warning). */
	listingsStale?: boolean;
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
	/** #641 listing workflows by source: the collection and what each card's ref points to. */
	const listings = new Map<ListingSource, { workflowId: string; collectionId: string; refs: Map<string, number> }>();
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

	function searchListings(source: ListingSource, filters: ListingFilters, refs: Map<string, number>, revision: number) {
		refs.clear();
		const asNumber = (v: unknown) => (typeof v === "number" ? v : null);
		if (source === "cattle") {
			const inDistrict = CATTLE.filter((c) => !filters.district || same(c.district, filters.district));
			const matches = inDistrict.filter(
				(c) =>
					(!filters.species || same(c.species, filters.species)) &&
					(!filters.breed || same(c.breed, filters.breed)) &&
					(!filters.village || same(c.village, filters.village)) &&
					(asNumber(filters.max_price) === null || Number(c.price) <= asNumber(filters.max_price)!) &&
					(asNumber(filters.min_milk_per_day) === null || Number(c.milk) >= asNumber(filters.min_milk_per_day)!) &&
					(!filters.milking_status || same(c.milking, filters.milking_status)) &&
					(!filters.pregnancy_status || same(c.pregnancy, filters.pregnancy_status))
			);
			const cards: ListingCard[] = matches.slice(0, CATTLE_CAP).map((c) => {
				const ref = `ref_${c.number}_r${revision}`;
				refs.set(ref, c.number);
				return { listing_ref: ref, listing_number: c.number, title: `${c.breed} ${c.species}`, facts: cattleFacts(c) };
			});
			return {
				cards,
				match_count: matches.length,
				source_total: CATTLE_SOURCE_TOTAL,
				elsewhere_count: filters.district ? CATTLE.length - inDistrict.length : null
			};
		}
		const limit = asNumber(filters.limit) ?? 5;
		const matches = FODDER.filter(
			(f) =>
				(!filters.q || f.name.toLowerCase().includes(String(filters.q).toLowerCase())) &&
				(!filters.form || f.form === filters.form) &&
				(!filters.district || same(f.district, filters.district)) &&
				(asNumber(filters.max_rate_per_kg) === null || (f.unit === "kg" && f.rate <= asNumber(filters.max_rate_per_kg)!))
		);
		const cards: ListingCard[] = matches.slice(0, limit).map((f) => {
			const ref = `ref_${f.id}_r${revision}`;
			refs.set(ref, f.id);
			return { listing_ref: ref, listing_number: null, title: f.name, facts: fodderFacts(f, false) };
		});
		return { cards, match_count: null, source_total: matches.length, elsewhere_count: null };
	}

	function collectionFields(source: ListingSource, filters: ListingFilters, refs: Map<string, number>, revision: number) {
		const found = searchListings(source, filters, refs, revision);
		const stale = source === "cattle" && !!options.listingsStale;
		return {
			filters,
			filter_definitions: source === "cattle" ? CATTLE_FILTERS : FODDER_FILTERS,
			...found,
			displayed_count: found.cards.length,
			source_status: found.cards.length > 0 ? "ok" : "no_result",
			notice: stale ? "These listings are about 30 hours old and may have been sold." : null,
			fetched_at: source === "cattle" ? 1795700000 : null,
			stale
		};
	}

	const emptyFilters = (source: ListingSource): ListingFilters =>
		Object.fromEntries((source === "cattle" ? CATTLE_FILTERS : FODDER_FILTERS).map((d) => [d.name, d.name === "limit" ? 5 : null]));

	function startListingWorkflow(body: AguiRequestBody, source: ListingSource): Response {
		const messageId = nextId("msg");
		const previous = listings.get(source);
		const components = previous
			? ui.components.map((c) =>
					c.workflow_id === previous.workflowId && c.status !== "expired" ? ({ ...c, status: "expired", revision: c.revision + 1 } as UIComponent) : c
				)
			: ui.components;
		const workflowId = nextId("wf");
		const refs = new Map<string, number>();
		const collection: ListingCollectionComponent = {
			...base(messageId, workflowId, source === "cattle" ? "Verified cattle for sale" : "Fodder for sale"),
			kind: "listing_collection",
			purpose: source,
			...collectionFields(source, emptyFilters(source), refs, 1)
		};
		listings.set(source, { workflowId, collectionId: collection.id, refs });
		publish([...components, collection]);
		const text = `Showing ${collection.displayed_count} listings. Use filters to narrow the search or open a listing for details.`;
		return stream(body, [...textEvents(messageId, text), snapshot()]);
	}

	function handleListingAction(
		body: AguiRequestBody,
		target: UIComponent,
		action: NonNullable<AguiRequestBody["forwardedProps"]["ui_action"]>
	): Response {
		if (target.kind !== "listing_collection") return jsonError(422, "UNSUPPORTED_ACTION", "This control does not accept that action.", target.id);
		const flow = listings.get(target.purpose);
		if (!flow || flow.collectionId !== target.id) return jsonError(409, "STALE_COMPONENT", "This listing collection is no longer active.", target.id);
		const messageId = nextId("msg");

		if (action.kind === "open_listing") {
			const id = flow.refs.get(action.value.listing_ref);
			if (id === undefined) return jsonError(422, "INVALID_LISTING", "Choose a listing from the displayed collection.", target.id);
			const cattle = target.purpose === "cattle" ? CATTLE.find((c) => c.number === id) : undefined;
			const fodder = target.purpose === "fodder" ? FODDER.find((f) => f.id === id) : undefined;
			const found = cattle ? cattle.number !== 9999 : !!fodder;
			const existing = ui.components.find(
				(c): c is ListingDetailComponent => c.kind === "listing_detail" && c.workflow_id === flow.workflowId && c.status !== "expired"
			);
			const detail: ListingDetailComponent = {
				...(existing ?? base(messageId, flow.workflowId, "Listing details")),
				message_id: messageId,
				revision: (existing?.revision ?? 0) + 1,
				status: "submitted",
				kind: "listing_detail",
				purpose: target.purpose,
				collection_id: target.id,
				listing_ref: action.value.listing_ref,
				title: cattle ? `${cattle.breed} ${cattle.species}` : (fodder?.name ?? "Listing"),
				facts: !found ? [] : cattle ? cattleFacts(cattle) : fodderFacts(fodder!, true),
				seller: !found ? null : cattle ? { name: "Kanji Bhai", mobile: "9000000101" } : fodder!.shared ? { name: "Ramesh Patel", mobile: "9000000201" } : null,
				source_status: found ? "ok" : "not_found",
				notice: null,
				fetched_at: cattle ? 1795700000 : null,
				stale: !!cattle && !!options.listingsStale
			};
			publish(existing ? ui.components.map((c) => (c.id === existing.id ? detail : c)) : [...ui.components, detail]);
			const text = found
				? "Listing details are shown below. Confirm availability with the seller before paying."
				: "This listing is no longer available. Search again to see current listings.";
			return stream(body, [...textEvents(messageId, text), snapshot()]);
		}

		if (action.kind === "listing_filters") {
			if (action.value.source !== target.purpose) return jsonError(422, "INVALID_FILTERS", "Filters must match the listing source.", target.id);
			const allowed = new Set((target.purpose === "cattle" ? CATTLE_FILTERS : FODDER_FILTERS).map((d) => d.name));
			const filters: ListingFilters = { ...emptyFilters(target.purpose) };
			for (const [name, value] of Object.entries(action.value.filters)) {
				if (!allowed.has(name)) return jsonError(422, "INVALID_FILTERS", "Unknown filter.", target.id);
				filters[name] = typeof value === "string" && value.trim() === "" ? null : value;
				if (name === "limit" && value === null) filters.limit = 5;
			}
			const revision = target.revision + 1;
			const updated: ListingCollectionComponent = {
				...target,
				message_id: messageId,
				revision,
				...collectionFields(target.purpose, filters, flow.refs, revision)
			};
			// New results: the open details belong to the old ones.
			publish(
				ui.components.map((c) =>
					c.id === target.id
						? updated
						: c.kind === "listing_detail" && c.workflow_id === flow.workflowId && c.status !== "expired"
							? ({ ...c, status: "expired", revision: c.revision + 1 } as UIComponent)
							: c
				)
			);
			const text = updated.cards.length > 0 ? `Showing ${updated.cards.length} listings.` : "No current listings match these filters.";
			return stream(body, [...textEvents(messageId, text), snapshot()]);
		}

		return jsonError(422, "UNSUPPORTED_ACTION", "This control does not accept that action.", target.id);
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
			if (CATTLE_WORDS.some((w) => text.toLowerCase().includes(w))) {
				return startListingWorkflow(body, "cattle");
			}
			if (FODDER_WORDS.some((w) => text.toLowerCase().includes(w))) {
				return startListingWorkflow(body, "fodder");
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
		// A collection stays pending while it is used; its revision still has to match.
		if (target.status !== "pending" || target.revision !== action.revision) {
			return jsonError(409, "STALE_COMPONENT", "This control was already used or has changed.", action.component_id);
		}

		if (bookings.has(target.workflow_id)) return handleBookingAction(body, target, action);
		if (selectors.has(target.workflow_id)) return handleSelectorAction(body, target, action);
		if (target.kind === "listing_collection") return handleListingAction(body, target, action);

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
			listings.clear();
			bookingsMade = 0;
		},
		/** How many bookings were actually made, to check a repeat confirm adds none. */
		bookingsMade: () => bookingsMade
	};
}
