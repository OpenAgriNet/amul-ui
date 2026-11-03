import type { Coverage, DatasetCase } from "./dataset";

// Sample responses Suraj shared for amul-oan-api#540 (Nov 3), used until the routes are
// on dev. The list sample had one case of the two counted; the second is made up to
// match the counts (untagged, wrong_answer). Delete this file with USE_SAMPLE_DATA.

export const SAMPLE_COVERAGE: Coverage = {
	total: 2,
	untagged: 1,
	tags: [
		{
			id: "veterinary_advisory",
			label: "Veterinary advisory",
			count: 0
		},
		{
			id: "ait_booking",
			label: "AIT booking",
			count: 0
		},
		{
			id: "milk_collection",
			label: "Milk collection",
			count: 1
		},
		{
			id: "milk_earnings",
			label: "Milk earnings & bonus",
			count: 0
		},
		{
			id: "union_schemes",
			label: "Union schemes",
			count: 0
		},
		{
			id: "government_schemes",
			label: "Government schemes",
			count: 0
		},
		{
			id: "animal_nutrition",
			label: "Feed & nutrition",
			count: 0
		},
		{
			id: "weather",
			label: "Weather",
			count: 0
		},
		{
			id: "market_prices",
			label: "Market prices (APMC)",
			count: 0
		},
		{
			id: "crop_advisory",
			label: "Crop advisory",
			count: 0
		},
		{
			id: "farmer_profile",
			label: "Farmer profile & sign-in",
			count: 0
		},
		{
			id: "animal_records",
			label: "Animal records",
			count: 0
		},
		{
			id: "cattle_trade",
			label: "Cattle trade",
			count: 0
		},
		{
			id: "soil_health_card",
			label: "Soil health card",
			count: 0
		},
		{
			id: "loan",
			label: "Micro-loan",
			count: 0
		},
		{
			id: "vet_office",
			label: "Nearest vet office",
			count: 0
		},
		{
			id: "pm_kisan",
			label: "PM-KISAN status",
			count: 0
		},
		{
			id: "follow_up",
			label: "Follow-up question",
			count: 1
		},
		{
			id: "suggestions",
			label: "Suggested questions",
			count: 0
		},
		{
			id: "safety",
			label: "Safety",
			count: 0
		},
		{
			id: "general",
			label: "General / other",
			count: 0
		}
	],
	case_types: [
		{
			id: "new_flow",
			label: "New flow",
			count: 0
		},
		{
			id: "edge_case",
			label: "Edge case",
			count: 1
		},
		{
			id: "wrong_answer",
			label: "Wrong answer",
			count: 1
		},
		{
			id: "good_answer",
			label: "Good answer to keep",
			count: 0
		}
	]
};

export const SAMPLE_CASES: DatasetCase[] = [
	{
		id: "9f1c2b7e-0d3a-5b6c-8e9f-1a2b3c4d5e6f",
		received_at: "2026-11-03T06:10:00+00:00",
		source: "chat",
		submitted_by: "kanav",
		persona: "farmer",
		language: "gu",
		description: "Milk total for the last 10 days, asked in Gujarati.",
		case_types: ["edge_case"],
		tags: ["milk_collection", "follow_up"],
		turns: [
			{
				role: "user",
				content: "છેલ્લા 10 દિવસનું દૂધ કેટલું થયું?"
			},
			{
				role: "assistant",
				content: "Your milk was 120 litres.",
				original_content: "Wrong total.",
				trace_id: "9b2f4c1e8a7d4f3b9c0e1d2a3b4c5d6e"
			}
		]
	},
	{
		id: "3c7d1e2f-4a5b-5c6d-9e0f-2b3c4d5e6f7a",
		received_at: "2026-11-02T09:30:00+00:00",
		source: "manual",
		submitted_by: "suraj",
		persona: "farmer",
		language: "en",
		description: "Bonus question with no farmer ID. The bot should explain the general rule.",
		case_types: ["wrong_answer"],
		tags: [],
		turns: [
			{
				role: "user",
				content: "How is the bonus calculated?"
			},
			{
				role: "assistant",
				content: "It depends on the milk you poured during the year."
			}
		]
	}
];
