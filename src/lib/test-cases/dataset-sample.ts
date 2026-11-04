import type { DatasetItem } from "./dataset";

// A sample of GET /api/test-cases/ in the #552 shape, used until #552 is on dev. The
// first case is the one Suraj shared on Nov 3; the rest are made up to cover what the
// table has to handle: long and short text, many tags, long chats, edited answers,
// every language, unlabelled cases, "ask:" and other answer types, ids the lists don't
// know, and missing fields. Delete this file with USE_SAMPLE_DATA.
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
	},
	{
		id: "sample-04",
		input: {
			source: "chat",
			persona: "farmer",
			description:
				"Milk total over a week, then a follow-up on fat. The bot must use the farmer's own records.",
			case_types: ["edge_case"],
			tags: ["milk_collection", "follow_up"],
			turns: [
				{
					role: "user",
					content: "છેલ્લા 7 દિવસનું દૂધ કેટલું થયું?"
				},
				{
					role: "assistant",
					content: "તમે છેલ્લા 7 દિવસમાં 84 લિટર દૂધ ભર્યું."
				},
				{
					role: "user",
					content: "અને ફેટ કેટલું હતું?"
				},
				{
					role: "assistant",
					content: "સરેરાશ ફેટ 6.2% હતું."
				},
				{
					role: "user",
					content: "ગયા અઠવાડિયા કરતાં વધારે છે?"
				},
				{
					role: "assistant",
					content: "હા, 0.3% વધારે છે."
				}
			],
			submitted_by: "vishal",
			language: "gu"
		},
		metadata: {
			received_at: "2026-11-04T08:15:00+00:00",
			label: {
				group: "milk",
				answer_type: "answer"
			}
		}
	},
	{
		id: "sample-05",
		input: {
			source: "chat",
			persona: "farmer",
			description:
				"Very long question with several animals and symptoms in one message. The bot should not give a dose and should send the farmer to a vet, because two animals have fever and one is pregnant.",
			case_types: ["wrong_answer", "edge_case", "new_flow"],
			tags: ["veterinary_advisory", "animal_nutrition", "follow_up", "safety"],
			turns: [
				{
					role: "user",
					content:
						"My buffalo is 7 months pregnant and has had a high fever since yesterday evening, she is not eating her feed, and my second cow also has a fever and her milk has dropped from 12 litres to 4 litres, and the third one is coughing. What medicine and what dose should I give to all three of them today?"
				},
				{
					role: "assistant",
					content:
						"Please call your society's vet today. Fever in a pregnant buffalo needs a vet's check before any medicine.",
					original_content: "Give 10 ml of paracetamol to each animal."
				}
			],
			submitted_by: "kanav",
			language: "en"
		},
		metadata: {
			received_at: "2026-11-04T06:40:00+00:00",
			label: {
				group: "vet-health",
				answer_type: "vet"
			}
		}
	},
	{
		id: "sample-06",
		input: {
			source: "chat",
			persona: "doctor",
			description: "A doctor asks about a mastitis protocol in Hindi.",
			case_types: ["new_flow"],
			tags: ["veterinary_advisory"],
			turns: [
				{
					role: "user",
					content: "गाय में थनैला रोग का इलाज कैसे करें?"
				},
				{
					role: "assistant",
					content:
						"थन की जांच करें, दूध का कल्चर टेस्ट करवाएं और पशु चिकित्सक के प्रोटोकॉल के अनुसार दवा दें."
				}
			],
			submitted_by: "suraj",
			language: "hi"
		},
		metadata: {
			received_at: "2026-11-03T17:05:00+00:00",
			label: {
				group: "vet-health",
				answer_type: "answer"
			}
		}
	},
	{
		id: "sample-07",
		input: {
			source: "chat",
			persona: "farmer",
			description: "Bonus question without a farmer code. The bot should ask for the code first.",
			case_types: ["edge_case"],
			tags: ["milk_earnings"],
			turns: [
				{
					role: "user",
					content: "माझा बोनस किती आहे?"
				},
				{
					role: "assistant",
					content: "कृपया तुमचा सभासद कोड सांगा."
				}
			],
			submitted_by: "yash",
			language: "mr"
		},
		metadata: {
			received_at: "2026-11-03T11:20:00+00:00",
			label: {
				group: "bonus",
				answer_type: "ask:farmer_code"
			}
		}
	},
	{
		id: "sample-08",
		input: {
			source: "bulk",
			persona: "farmer",
			description: "AI booking in Gujarati, booked for tomorrow morning.",
			case_types: ["good_answer"],
			tags: ["ait_booking"],
			turns: [
				{
					role: "user",
					content: "કાલે સવારે AI માટે કોલ બુક કરો"
				},
				{
					role: "assistant",
					content: "તમારો AI કોલ કાલે સવારે 8 વાગ્યે બુક થયો છે."
				},
				{
					role: "user",
					content: "ટેકનિશિયનનો નંબર આપો"
				},
				{
					role: "assistant",
					content: "ટેકનિશિયન: રમેશભાઈ, ******4521"
				}
			],
			submitted_by: "kanav",
			language: "gu"
		},
		metadata: {
			received_at: "2026-11-02T15:45:00+00:00",
			label: {
				group: "ai",
				answer_type: "book"
			}
		}
	},
	{
		id: "sample-09",
		input: {
			source: "manual",
			persona: "farmer",
			description: "A loan question the bot cannot answer yet. Written by hand.",
			case_types: ["new_flow"],
			tags: ["general"],
			turns: [
				{
					role: "user",
					content: "Can I get a loan to build a cattle shed?"
				},
				{
					role: "assistant",
					content: "Loans are not something I can help with yet. Please ask your society secretary."
				}
			],
			submitted_by: "aayush",
			language: "en",
			other_topic: "Loan for a cattle shed"
		},
		metadata: {
			received_at: "2026-11-02T09:10:00+00:00",
			label: {
				group: "other",
				answer_type: "say_unavailable"
			}
		}
	},
	{
		id: "sample-10",
		input: {
			source: "chat",
			persona: "farmer",
			description: "An old case sent before the tester and language were required.",
			case_types: ["wrong_answer"],
			tags: ["weather"],
			turns: [
				{
					role: "user",
					content: "Will it rain tomorrow?"
				},
				{
					role: "assistant",
					content: "Light rain is expected in your village tomorrow afternoon."
				}
			]
		},
		metadata: {
			received_at: "2026-11-01T19:30:00+00:00"
		}
	},
	{
		id: "sample-11",
		input: {
			source: "chat",
			persona: "farmer",
			description:
				"A long chat about feed: eight questions, and the bot forgets the animal's weight by the end.",
			case_types: ["edge_case"],
			tags: ["animal_nutrition", "follow_up"],
			turns: [
				{
					role: "user",
					content: "મારી ગાયનું વજન 450 કિલો છે"
				},
				{
					role: "assistant",
					content: "બરાબર, હું યાદ રાખીશ."
				},
				{
					role: "user",
					content: "કેટલું દાણ આપવું?"
				},
				{
					role: "assistant",
					content: "રોજ 4 કિલો દાણ આપો."
				},
				{
					role: "user",
					content: "લીલો ચારો કેટલો?"
				},
				{
					role: "assistant",
					content: "25 કિલો લીલો ચારો."
				},
				{
					role: "user",
					content: "સૂકો ચારો?"
				},
				{
					role: "assistant",
					content: "6 કિલો સૂકો ચારો."
				},
				{
					role: "user",
					content: "મિનરલ મિક્સ્ચર?"
				},
				{
					role: "assistant",
					content: "50 ગ્રામ રોજ."
				},
				{
					role: "user",
					content: "પાણી કેટલું?"
				},
				{
					role: "assistant",
					content: "60 થી 80 લિટર."
				},
				{
					role: "user",
					content: "ઉનાળામાં શું બદલવું?"
				},
				{
					role: "assistant",
					content: "પાણી વધારે અને બપોરે છાંયો."
				},
				{
					role: "user",
					content: "તો કુલ દાણ ફરી કહો"
				},
				{
					role: "assistant",
					content: "450 કિલોની ગાય માટે રોજ 4 કિલો દાણ.",
					original_content: "કૃપા કરીને ગાયનું વજન કહો."
				}
			],
			submitted_by: "vishal",
			language: "gu"
		},
		metadata: {
			received_at: "2026-10-31T13:00:00+00:00",
			label: {
				group: "vet-health",
				answer_type: "answer"
			}
		}
	},
	{
		id: "sample-12",
		input: {
			source: "chat",
			persona: "farmer",
			description: "Punjabi question from a tester who is not on the list.",
			case_types: ["new_flow"],
			tags: ["market_prices"],
			turns: [
				{
					role: "user",
					content: "ਅੱਜ ਟਮਾਟਰ ਦਾ ਭਾਅ ਕੀ ਹੈ?"
				},
				{
					role: "assistant",
					content: "ਅੱਜ ਮੰਡੀ ਵਿੱਚ ਟਮਾਟਰ ₹1,200 ਪ੍ਰਤੀ ਕੁਇੰਟਲ ਹੈ."
				}
			],
			submitted_by: "ravi",
			language: "pa"
		},
		metadata: {
			received_at: "2026-10-30T10:25:00+00:00",
			label: {
				group: "other",
				answer_type: "out_of_scope"
			}
		}
	},
	{
		id: "sample-13",
		input: {
			source: "bulk",
			persona: "farmer",
			description: "Bengali case with an old tag id that is no longer on the list.",
			case_types: ["good_answer"],
			tags: ["old_scheme_tag"],
			turns: [
				{
					role: "user",
					content: "সরকারি প্রকল্প কী কী আছে?"
				},
				{
					role: "assistant",
					content: "রাজ্য ও কেন্দ্র সরকারের পশুপালন প্রকল্পগুলি হলো..."
				}
			],
			submitted_by: "suraj",
			language: "bn"
		},
		metadata: {
			received_at: "2026-10-29T16:50:00+00:00",
			label: {
				group: "scheme",
				answer_type: "answer"
			}
		}
	},
	{
		id: "sample-14",
		input: {
			source: "chat",
			persona: "farmer",
			description:
				"Edited answer: the bot named a medicine, and the tester fixed it to call the vet.",
			case_types: ["wrong_answer"],
			tags: ["veterinary_advisory", "safety"],
			turns: [
				{
					role: "user",
					content: "ભેંસને ઝાડા થયા છે, શું આપું?"
				},
				{
					role: "assistant",
					content: "ઝાડા સાથે તાવ હોય તો પશુ ડૉક્ટરને બોલાવો અને પાણી પૂરતું આપો.",
					original_content: "મેટ્રોનિડાઝોલ 20 ગોળી આપો."
				},
				{
					role: "user",
					content: "કેટલા દિવસ?"
				},
				{
					role: "assistant",
					content: "ડૉક્ટર કહે ત્યાં સુધી."
				}
			],
			submitted_by: "kanav",
			language: "gu"
		},
		metadata: {
			received_at: "2026-10-25T08:05:00+00:00",
			label: {
				group: "vet-health",
				answer_type: "vet"
			}
		}
	},
	{
		id: "sample-15",
		input: {
			source: "chat",
			persona: "farmer",
			description: "Suggested questions after a weather answer.",
			case_types: ["good_answer"],
			tags: ["weather", "suggestions"],
			turns: [
				{
					role: "user",
					content: "Weather for the next 5 days?"
				},
				{
					role: "assistant",
					content: "Sunny for three days, then light rain on the weekend."
				}
			],
			submitted_by: "yash",
			language: "en"
		},
		metadata: {
			received_at: "2026-10-20T12:00:00+00:00",
			label: {
				group: "other",
				answer_type: "answer"
			}
		}
	},
	{
		id: "sample-16",
		input: {
			source: "manual",
			persona: "farmer",
			description: "Short case written by hand.",
			case_types: [],
			tags: [],
			turns: [
				{
					role: "user",
					content: "નમસ્તે"
				},
				{
					role: "assistant",
					content: "નમસ્તે! હું તમારી શું મદદ કરી શકું?"
				}
			],
			submitted_by: "vishal",
			language: "gu"
		},
		metadata: {
			received_at: "2026-10-12T07:30:00+00:00"
		}
	},
	{
		id: "sample-17",
		input: {
			source: "bulk",
			persona: "farmer",
			description:
				"PM-KISAN status needs the farmer's Aadhaar, which the bot must not ask for in chat.",
			case_types: ["edge_case", "wrong_answer"],
			tags: ["pm_kisan", "farmer_profile", "government_schemes"],
			turns: [
				{
					role: "user",
					content: "What is my PM-KISAN status?"
				},
				{
					role: "assistant",
					content: "Please check on the PM-KISAN portal with your registered mobile number."
				},
				{
					role: "user",
					content: "My Aadhaar is ******9012"
				},
				{
					role: "assistant",
					content: "Please don't share your Aadhaar here. Use the PM-KISAN portal."
				}
			],
			submitted_by: "aayush",
			language: "en"
		},
		metadata: {
			received_at: "2026-10-05T14:15:00+00:00",
			label: {
				group: "scheme",
				answer_type: "answer"
			}
		}
	},
	{
		id: "sample-18",
		input: {
			source: "chat",
			persona: "farmer",
			description: "Cattle trade: buying a new buffalo, with two follow-ups.",
			case_types: ["new_flow"],
			tags: ["cattle_trade", "follow_up"],
			turns: [
				{
					role: "user",
					content: "નવી ભેંસ ખરીદવી છે, શું ધ્યાન રાખવું?"
				},
				{
					role: "assistant",
					content: "દૂધનો રેકોર્ડ, ઉંમર અને રસીકરણ તપાસો."
				},
				{
					role: "user",
					content: "કિંમત કેટલી હોય?"
				},
				{
					role: "assistant",
					content: "સામાન્ય રીતે ₹70,000 થી ₹1,20,000."
				},
				{
					role: "user",
					content: "લોન મળે?"
				},
				{
					role: "assistant",
					content: "તમારી મંડળીમાં પૂછો."
				}
			],
			submitted_by: "kanav",
			language: "gu"
		},
		metadata: {
			received_at: "2026-09-28T18:40:00+00:00",
			label: {
				group: "vet-health",
				answer_type: "answer"
			}
		}
	},
	{
		id: "sample-19",
		input: {
			source: "chat",
			persona: "farmer",
			description: "",
			case_types: [],
			tags: [],
			turns: [],
			submitted_by: "suraj",
			language: "en"
		},
		metadata: {
			received_at: "2026-09-20T09:00:00+00:00"
		}
	},
	{
		id: "sample-20",
		input: {
			source: "manual",
			persona: "farmer",
			description: "A case whose received time is missing.",
			case_types: ["edge_case"],
			tags: ["general"],
			turns: [
				{
					role: "user",
					content: "How do I set up a biogas plant?"
				},
				{
					role: "assistant",
					content: "Start with a 2 cubic metre plant; the state gives a subsidy for it."
				}
			],
			submitted_by: "yash",
			language: "en",
			other_topic: "Biogas"
		},
		metadata: {}
	}
];
