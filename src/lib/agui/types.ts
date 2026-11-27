// Types for the AG-UI chat contract proposed on OpenAgriNet/amul-oan-api#593,
// plus the AI booking additions from #636 (backend PR #637, docs/AGUI_DEVELOPMENT.md).
// They mirror the backend's Pydantic models; when the backend publishes its
// JSON Schema, regenerate or check these against it.

import type { ChatArtifact } from "@/lib/chat-artifacts";

export type ChatFormat = "agui-v1" | "text-v1";

export type UIAction =
	| {
			component_id: string;
			revision: number;
			kind: "choice";
			value: { option_id: string };
	  }
	| {
			component_id: string;
			revision: number;
			kind: "date_range";
			value: { fromdate: string; todate: string };
	  }
	| {
			component_id: string;
			revision: number;
			kind: "confirm";
			value: { confirmed: boolean };
	  }
	| {
			component_id: string;
			revision: number;
			kind: "listing_filters";
			/** The complete filter state; null clears a filter. */
			value: { source: ListingSource; filters: ListingFilters };
	  }
	| {
			component_id: string;
			revision: number;
			kind: "open_listing";
			value: { listing_ref: string };
	  };

export type ChatCommand =
	| { kind: "change_milk_account"; state_revision: number }
	// #636: reopens the technician or animal picker; needs a fresh confirmation.
	| { kind: "edit_ai_booking"; workflow_id: string; state_revision: number; field: BookingField }
	// #636: cancels the booking at any pending stage.
	| { kind: "cancel_ai_booking"; workflow_id: string; state_revision: number };

export type BookingField = "technician" | "species";

export type AmulRequestProps = {
	version: 1;
	channel?: "web" | "whatsapp";
	source_lang?: string;
	target_lang?: string;
	input_method?: string;
	user_id?: string;
	persona?: "farmer" | "doctor";
	ui_action?: UIAction;
	command?: ChatCommand;
};

export type AguiRequestBody = {
	threadId: string;
	runId: string;
	state: Record<string, never>;
	messages: Array<{ id: string; role: "user"; content: string }>;
	tools: [];
	context: [];
	forwardedProps: AmulRequestProps;
};

/** The one thing a request carries: a new message, a pick, or a command. */
export type ChatOperation =
	| { kind: "message"; text: string; inputMethod?: string }
	| { kind: "ui_action"; action: UIAction }
	| { kind: "command"; command: ChatCommand };

export type ComponentStatus = "pending" | "submitted" | "expired";

type ComponentBase = {
	id: string;
	workflow_id: string;
	message_id: string;
	revision: number;
	title: string;
	status: ComponentStatus;
};

export type ChoiceOption = {
	id: string;
	label: string;
	description: string | null;
	/** #639: extra words the picker search matches (aliases, codes). */
	search_terms?: string[];
};

/** milk_account is #593; ai_technician and ai_species are #636; mandi_location and scheme are #639. */
export type ChoicePurpose = "milk_account" | "ai_technician" | "ai_species" | "mandi_location" | "scheme";

export type ChoiceComponent = ComponentBase & {
	kind: "choice";
	purpose: ChoicePurpose;
	/** #639: show a search box; filtering happens here, the pick is still sent by id. */
	searchable?: boolean;
	options: ChoiceOption[];
	selected: { option_id: string } | null;
};

export type DateRangeComponent = ComponentBase & {
	kind: "date_range";
	purpose: "milk_period";
	constraints: {
		date_format: "YYYY-MM-DD";
		max_difference_days: number;
		// Asked for on the ticket, not yet in the contract.
		min_date?: string;
		max_date?: string;
	};
	selected: { fromdate: string; todate: string } | null;
};

/** #636: what the farmer is about to book. Labels are localised by the backend; names kept as the API returns them. */
export type BookingSummary = {
	account_label: string;
	/** description is the technician's mobile number. */
	technician: ChoiceOption;
	species: "cow" | "buffalo";
	species_label: string;
};

/** Only "confirmed" is a successful booking for this workflow. */
export type BookingOutcomeStatus = "confirmed" | "rejected" | "not_sent" | "unconfirmed" | "already_requested";

export type BookingOutcome = {
	status: BookingOutcomeStatus;
	message: string;
	ticket: string | null;
};

/**
 * #636: the booking review. After Confirm, the same component comes back
 * submitted with its `outcome`.
 */
export type ConfirmComponent = ComponentBase & {
	kind: "confirm";
	purpose: "ai_booking";
	summary: BookingSummary;
	selected: { confirmed: boolean } | null;
	outcome: BookingOutcome | null;
};

/** #639 / backend #641: cattle and fodder listings. */
export type ListingSource = "cattle" | "fodder";

export type ListingFilterValue = string | number | null;
export type ListingFilters = Record<string, ListingFilterValue>;

/**
 * A source fact under a stable key ("asking_price_inr", "price.rate_inr",
 * "location.district.name_en"). Labels are ours; values are shown as sent.
 */
export type ListingFact = { key: string; value: string | number | boolean };

export type ListingCard = {
	/** Opaque; sent back to open the listing. */
	listing_ref: string;
	listing_number: number | null;
	title: string;
	facts: ListingFact[];
};

export type ListingFilterDefinition = {
	name: string;
	kind: "text" | "number" | "select";
	/** Select values, or suggestions for a text filter. */
	options: string[];
	minimum: number | null;
	maximum: number | null;
	unit: string | null;
};

/** Reused: filtering bumps its revision and replaces the cards. */
export type ListingCollectionComponent = ComponentBase & {
	kind: "listing_collection";
	purpose: ListingSource;
	filters: ListingFilters;
	filter_definitions: ListingFilterDefinition[];
	cards: ListingCard[];
	displayed_count: number;
	/** Cattle: matches before the card cap. Fodder: unknown (null). */
	match_count: number | null;
	/** Cattle: everything listed. Fodder: the provider's search total. */
	source_total: number | null;
	/** Cattle matches outside the searched district. */
	elsewhere_count: number | null;
	source_status: string;
	notice: string | null;
	/** Unix seconds. */
	fetched_at: number | null;
	stale: boolean;
};

export type ListingDetailComponent = ComponentBase & {
	kind: "listing_detail";
	purpose: ListingSource;
	collection_id: string;
	listing_ref: string;
	title: string;
	facts: ListingFact[];
	seller: { name?: string | null; mobile?: string | null } | null;
	/** "ok", "not_found" or "unavailable". */
	source_status: string;
	notice: string | null;
	fetched_at: number | null;
	stale: boolean;
};

export type MilkResult = {
	status: "ok" | "no_records";
	account: { option_id: string; label: string };
	period: { fromdate: string; todate: string };
	summary: {
		days_with_milk: number;
		total_quantity_litres: number;
		total_amount_rupees: number;
		weighted_fat: number | null;
		weighted_snf: number | null;
	} | null;
	milk: Array<{
		date: string | null;
		shift: string | null;
		qty: number | null;
		fat: number | null;
		snf: number | null;
		amount: number | null;
	}>;
	deductions: Array<{
		date: string | null;
		account_name: string | null;
		amount: number | null;
	}>;
	daily_quantity: Array<{
		date: string;
		quantity_litres: number | null;
	}>;
	warnings: Array<"unplottable_dates" | "missing_quantities">;
};

export type ChartComponent = ComponentBase & {
	kind: "chart";
	purpose: "milk_records";
	status: "submitted";
	data: MilkResult;
};

export type UIComponent =
	| ChoiceComponent
	| DateRangeComponent
	| ConfirmComponent
	| ChartComponent
	| ListingCollectionComponent
	| ListingDetailComponent;

export type AmulUIState = {
	version: 1;
	state_revision: number;
	selected_milk_account: { option_id: string; label: string } | null;
	components: UIComponent[];
};

export type ChatError = {
	error: {
		code: string;
		message: string;
		retryable: boolean;
		component_id?: string;
		field?: string;
	};
};

export type ArtifactsEventValue = {
	version: 1;
	message_id: string;
	artifacts: ChatArtifact[];
};

/** CUSTOM event names the backend emits. */
export const AGUI_CUSTOM_ARTIFACTS = "amul.artifacts";
export const AGUI_CUSTOM_UI_ERROR = "amul.ui_error";
