// Provisional labels a tester can attach as hints for the backend analyzer and
// the judge. The backend owns the real taxonomy (feature labels plus a shallow
// layer of sub-tags); swap these lists for its API once it exists. Values are
// stable ids, so keep them unchanged when only the wording changes.

export type TestCaseOption = { value: string; label: string; hint: string };

export const CASE_TYPES: TestCaseOption[] = [
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

export const FEATURE_TAGS: TestCaseOption[] = [
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
	{ value: "general", label: "General / other", hint: "Greetings, small talk, out-of-scope questions." }
];

export const CASE_TYPE_VALUES = new Set(CASE_TYPES.map((o) => o.value));
export const FEATURE_TAG_VALUES = new Set(FEATURE_TAGS.map((o) => o.value));
