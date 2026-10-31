import type { TestCaseOptions } from "./options";
import type { TestCaseOption } from "./types";

// A sample of what GET /api/test-cases/options/ sends, for the tests only. The screen
// always reads the real lists from that route.
const CASE_TYPES: TestCaseOption[] = [
	{
		value: "new_flow",
		label: "New flow",
		hint: "Something the bot was never tested on: a new feature or a new kind of question."
	},
	{
		value: "edge_case",
		label: "Edge case",
		hint: "A known flow that breaks in an unusual situation (missing data, odd wording, mixed language)."
	},
	{
		value: "wrong_answer",
		label: "Wrong answer",
		hint: "The bot answered wrongly. Fix the answer above, or leave it and explain in the description what is wrong."
	},
	{
		value: "good_answer",
		label: "Good answer to keep",
		hint: "The bot got it right and must keep getting it right."
	},
	{
		value: "should_not_happen",
		label: "Must never happen",
		hint: "Advice or behaviour the bot must avoid, e.g. a medicine that is unsafe in this situation."
	}
];

const FEATURE_TAGS: TestCaseOption[] = [
	{ value: "veterinary_advisory", label: "Veterinary advisory", hint: "Animal health, disease, treatment, heat, pregnancy." },
	{ value: "ait_booking", label: "AIT booking", hint: "Booking an artificial insemination technician, and its status." },
	{ value: "milk_collection", label: "Milk collection", hint: "Farmer's milk pouring records, fat/SNF, quantities." },
	{ value: "milk_earnings", label: "Milk earnings & bonus", hint: "Payments, earnings, bonus calculation." },
	{ value: "union_schemes", label: "Union schemes", hint: "Schemes of the milk union (e.g. a specific district union)." },
	{ value: "government_schemes", label: "Government schemes", hint: "State and central government schemes and subsidies." },
	{ value: "animal_nutrition", label: "Feed & nutrition", hint: "Cattle feed, fodder, mineral mixture." },
	{ value: "weather", label: "Weather", hint: "Forecasts and weather-based advice." },
	{ value: "market_prices", label: "Market prices (APMC)", hint: "Mandi / APMC prices for crops." },
	{ value: "crop_advisory", label: "Crop advisory", hint: "Farming, crops, soil, pests." },
	{ value: "farmer_profile", label: "Farmer profile & sign-in", hint: "Farmer ID, society, account details." },
	{ value: "animal_records", label: "Animal records", hint: "Animal tag numbers, vaccination and breeding records." },
	{ value: "cattle_trade", label: "Cattle trade", hint: "Buying and selling cattle." },
	{ value: "soil_health_card", label: "Soil health card", hint: "Soil health card reports and what they mean." },
	{ value: "loan", label: "Loan", hint: "Loans and credit for farmers." },
	{ value: "vet_office", label: "Vet office", hint: "Finding a vet office or a veterinarian." },
	{ value: "general", label: "General / other", hint: "Greetings, small talk, out-of-scope questions." }
];

export const TEST_OPTIONS: TestCaseOptions = {
	testers: [
		{ id: "kanav", label: "Kanav" },
		{ id: "suraj", label: "Suraj" },
		{ id: "vishal", label: "Vishal" }
	],
	caseTypes: CASE_TYPES,
	tags: FEATURE_TAGS
};
