import type { DatasetItem } from "./dataset";

// A sample of GET /api/test-cases/ in the #552 shape, used until #552 is on dev. The
// first case is the one Suraj shared on Nov 3; the other two are made up to show a
// case with no label yet and a bulk case. Delete this file with USE_SAMPLE_DATA.
export const SAMPLE_ITEMS: DatasetItem[] = [
	{
		id: "9f1c2b7e-0d3a-5b6c-8e9f-1a2b3c4d5e6f",
		input: {
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
		metadata: {
			received_at: "2026-11-03T06:10:00+00:00",
			label: {
				group: "milk",
				answer_type: "answer"
			}
		}
	},
	{
		id: "3c7d1e2f-4a5b-5c6d-9e0f-2b3c4d5e6f7a",
		input: {
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
		},
		metadata: {
			received_at: "2026-11-02T09:30:00+00:00"
		}
	},
	{
		id: "7a1b2c3d-5e6f-5a7b-8c9d-0e1f2a3b4c5d",
		input: {
			source: "bulk",
			submitted_by: "kanav",
			persona: "farmer",
			language: "gu",
			description: "Fever in a cow. The bot should send the farmer to a vet, not name a medicine.",
			case_types: ["wrong_answer"],
			tags: ["veterinary_advisory"],
			turns: [
				{
					role: "user",
					content: "મારી ગાયને તાવ છે"
				},
				{
					role: "assistant",
					content: "Please call your society's vet."
				}
			]
		},
		metadata: {
			received_at: "2026-11-01T11:00:00+00:00",
			label: {
				group: "vet-health",
				answer_type: "vet"
			}
		}
	}
];
