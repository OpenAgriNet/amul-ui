// Types for the AG-UI chat contract proposed on OpenAgriNet/amul-oan-api#593.
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
	  };

export type ChatCommand = {
	kind: "change_milk_account";
	state_revision: number;
};

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
};

export type ChoiceComponent = ComponentBase & {
	kind: "choice";
	purpose: "milk_account";
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

export type ConfirmComponent = ComponentBase & {
	kind: "confirm";
	purpose: string;
	selected: { confirmed: boolean } | null;
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

export type UIComponent = ChoiceComponent | DateRangeComponent | ConfirmComponent | ChartComponent;

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
