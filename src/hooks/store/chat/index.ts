import { create } from "zustand";
import type { ChatMessage, TextMessage } from "@/components/screens-component/chat-screen/components/bubbles/chat-types";

import { fetchSuggestions, type Suggestion } from "@/components/screens-component/chat-screen/api/suggestions-api";
import apiService from "@/lib/api-service";
import { environment } from "@/lib/config/environment";
import { resolveChatPersona, type ChatPersona } from "@/lib/chat-persona";
import * as telemetry from "@/lib/telemetry";
import { randomPick, shuffle, filterVariableValues } from "@/lib/qa-utils";
import { v4 as uuidv4 } from 'uuid';
import { useAuthStore } from "@/hooks/store/auth";
import type { ToastType } from "@/components/screens-component/chat-screen/components/toast";
import { parseChatWire, type ChatArtifact } from "@/lib/chat-artifacts";

import enData from "../../../../translations/en.json";
import guData from "../../../../translations/gu.json";
import hiData from "../../../../translations/hi.json";
import bnData from "../../../../translations/bn.json";
import mrData from "../../../../translations/mr.json";
import paData from "../../../../translations/pa.json";

const translations: Record<string, any> = {
	en: enData,
	gu: guData,
	hi: hiData,
	bn: bnData,
	mr: mrData,
	pa: paData
};

// Static set of QA templates and the variable placeholders they need
const QA_TEMPLATES: Array<{ key: string; vars?: string[] }> = [
  { key: "qa.market.price.today", vars: ["crop", "market"] },
  { key: "qa.market.price.modal", vars: ["crop", "district"] },
  { key: "qa.weather.forecast.5day" },
  { key: "qa.crop.weeds.management_practices", vars: ["crop"] },
  { key: "qa.livestock.health.mastitis_treatment", vars: ["animal"] },
  { key: "qa.fruit.irrigation.schedule", vars: ["fruit crop"] },
  { key: "qa.flowers.requirements.sunlight_and_shade", vars: ["Flower crop"] },
  { key: "qa.schemes.machinery.subsidy_how_to_get", vars: ["Scheme name"] }
];

/* eslint-disable no-unused-vars */
export type QuickAction = {
	id: string;
	title: string;
	description: string;
	icon: "tractor" | "wheat" | "cow" | "cloud" | "schemes";
	prompt: string;
	kind: "ask" | "open_faq_panel";
};

type ChatStore = {
	messages: ChatMessage[];
	quickActions: QuickAction[];
	draft: string;
	suggestions: Suggestion[];
	isAssistantTyping: boolean;
	isListening: boolean;
	isTranscribing: boolean;
	isFetchingSuggestions: boolean;
	sessionId: string | null;
	persona: ChatPersona;
	setPersona: (persona: ChatPersona) => void;
	initializeSession: (user: any) => void;
	sendText: (text: string, language: string) => Promise<void>;
	sendAudio: (blob: Blob, sessionId: string, language: string) => Promise<void>;
	sendQuickAction: (id: string, language: string) => void;
	sendQuickReply: (payload: string, language: string) => void;
	setDraft: (value: string) => void;
	startListening: () => void;
	stopListening: () => void;
	clearChat: () => void;
	// AMUL-78: welcome question list shown over an existing conversation.
	showQuestionList: boolean;
	openQuestionList: () => void;
	closeQuestionList: () => void;
	setIsTranscribing: (value: boolean) => void;
	setSuggestions: (suggestions: Suggestion[]) => void;
	clearSuggestions: () => void;
	fetchSuggestionsForMessage: (messageId: string) => Promise<void>;
	generateQuickActions: (t: any) => void;
	playTTS: (text: string, language: string) => Promise<void>;
	submitMessageFeedback: (messageId: string, isPositive: boolean, reason?: string, feedback?: string, meta?: { serviceLabel?: string; rating?: number }) => Promise<void>;
	toast: { message: string; type: ToastType } | null;
	setToast: (toast: { message: string; type: ToastType } | null) => void;
	fetchLocation: (t: any) => void;
    getUserForTelemetry: () => { preferred_username: string; email: string };
};
/* eslint-enable no-unused-vars */

// AMUL-72/AMUL-118: ten questions plus the "more useful questions" card.
const QUICK_ACTION_COUNT = 11;
// AMUL-87: the third pinned slot is the weather question, which has to sit
// above the FAQ card rather than with the fixed questions below it.
const PINNED_ACTION_COUNT = 3;

// Ordered: the first entry with a keyword in the question wins, so the money
// and scheme rows are matched before the broad "પશુ"/"દૂધ" cow keywords that
// the AMUL-72 questions also contain.
const KEYWORD_ICON_MAP: Array<{ icon: QuickAction["icon"]; keywords: string[] }> = [
	{
		icon: "schemes",
		keywords: ["યોજન", "સહાય", "योजना", "सहाय", "প্রকল্প", "যোজনা", "ভর্তুকি", "योजने", "अनुदान", "ਸਕੀਮ", "ਸਬਸਿਡੀ", "scheme", "subsidy", "yojana"]
	},
	{
		icon: "wheat",
		keywords: ["કમાણી", "આવક", "બોનસ", "ભાવ", "એપીએમસી", "कमाई", "आय", "बोनस", "भाव", "আয়", "উপার্জন", "বোনাস", "দাম", "ਆਮਦਨ", "ਭਾਅ", "apmc", "earning", "income", "bonus", "price", "rate", "પાક", "સજીવ", "ফসল", "জৈব", "crop", "cultivation", "organic", "soil", "उत्पन्न", "दर", "पीक", "सेंद्रिय"]
	},
	{
		icon: "cow",
		keywords: ["ગાય", "ભેંસ", "પશુ", "દૂધ", "গরু", "মহিষ", "পশু", "দুধ", "বাছুর", "ਗਾਂ", "ਮੱਝ", "ਪਸ਼ੂ", "ਦੁੱਧ", "ਵੱਛਾ", "cow", "buffalo", "animal", "milk", "mastitis", "calving", "bred", "pregnant", "yield", "calf", "calves", "production", "ઉત્પાદન", "गाय", "म्हैस", "जनावर", "दूध", "वासरू"]
	},
	{
		icon: "cloud",
		keywords: ["હવામાન", "আবহাওয়া", "বৃষ্টি", "ਮੌਸਮ", "ਮੀਂਹ", "weather", "rain", "forecast", "मौसम", "हवामान", "पाऊस"]
	}
];

function pickIconForQuestion(question: string): QuickAction["icon"] {
	const lowerQ = question.toLowerCase();
	return KEYWORD_ICON_MAP.find(m => m.keywords.some(k => lowerQ.includes(k)))?.icon
		|| randomPick(["tractor", "wheat", "cow", "cloud"] as const);
}

function toQuickAction(question: string, index: number): QuickAction {
	return {
		id: String(index + 1),
		title: question,
		description: "",
		icon: pickIconForQuestion(question),
		prompt: question,
		kind: "ask"
	};
}

export function buildQuickActions(t: (key: string, params?: Record<string, string>) => string | string[]): QuickAction[] {
	const pinned = t("pinnedQuestions");
	const pinnedQuestions = Array.isArray(pinned)
		? pinned.filter((q): q is string => typeof q === "string")
		: [];
	const pinnedLimited = pinnedQuestions.slice(0, PINNED_ACTION_COUNT);
	// AMUL-62/AMUL-72: these questions are pinned directly below the FAQ card so
	// they always land in the same slots. `t` returns the key itself when neither
	// the active language nor the English fallback defines it, so the array check
	// also rejects a missing key.
	const fixedRaw = t("fixedQuestions");
	const fixedQuestions = Array.isArray(fixedRaw)
		? fixedRaw
			.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
			.map((q) => q.trim())
		: [];
	const pinnedSet = new Set(pinnedLimited);
	// Keep them out of the random pool so the tail slots can never duplicate them.
	fixedQuestions.forEach((q) => pinnedSet.add(q));
	const randomCount = Math.max(
		0,
		QUICK_ACTION_COUNT - pinnedLimited.length - 1 - fixedQuestions.length
	);
	const faqAction: QuickAction = {
		id: String(pinnedLimited.length + 1),
		title: String(t("moreUsefulQuestions")),
		description: "",
		icon: "cloud",
		prompt: "",
		kind: "open_faq_panel"
	};
	const pinnedActions = pinnedLimited.map(toQuickAction);
	// Rendered after faqAction, so their ids continue from the FAQ card's.
	const fixedActions = fixedQuestions.map((question, index) =>
		toQuickAction(question, pinnedLimited.length + 1 + index)
	);

	const staticQuestions = t("questions");
	if (Array.isArray(staticQuestions) && staticQuestions.length >= 3) {
		const pool = staticQuestions.filter((q) => typeof q === "string" && !pinnedSet.has(q));
		const randomQuestions = shuffle(pool).slice(0, randomCount)
			.map((question, index) =>
				toQuickAction(question, pinnedActions.length + 1 + fixedActions.length + index)
			);
		return [...pinnedActions, faqAction, ...fixedActions, ...randomQuestions].slice(
			0,
			QUICK_ACTION_COUNT
		);
	}

	const VARS = {
		crop: t("variables.crop") as string[],
		"fruit crop": t("variables.fruit crop") as string[],
		"Flower crop": t("variables.Flower crop") as string[],
		market: t("variables.market") as string[],
		district: t("variables.district") as string[],
		animal: t("variables.animal") as string[],
		"Scheme name": t("variables.Scheme name") as string[]
	} as const;

	const templateActions: QuickAction[] = shuffle(QA_TEMPLATES)
		.slice(0, randomCount)
		.map(({ key, vars }, index) => {
			let prompt = "";
			if (vars) {
				const params: Record<string, string> = {};
				vars.forEach(v => {
					const rawValues = (VARS as any)[v] as string[];
					if (rawValues) {
						const scopedValues = filterVariableValues(key, v, rawValues);
						params[v] = randomPick(scopedValues);
					} else {
						params[v] = "";
					}
				});
				prompt = t(key, params) as string;
			} else {
				prompt = t(key) as string;
			}

			let icon: QuickAction["icon"] = "tractor";
			if (key.includes("livestock")) icon = "cow";
			else if (key.includes("market") || key.includes("crop")) icon = "wheat";
			else if (key.includes("weather")) icon = "cloud";

			return {
				id: String(pinnedLimited.length + index + 1),
				title: prompt,
				description: "",
				icon,
				prompt,
				kind: "ask"
			};
		});

	const normalizedTemplateActions = templateActions.map((action, index) => ({
		...action,
		id: String(pinnedActions.length + 2 + fixedActions.length + index)
	}));
	return [...pinnedActions, faqAction, ...fixedActions, ...normalizedTemplateActions].slice(
		0,
		QUICK_ACTION_COUNT
	);
}


function makeUserMessage(text: string): TextMessage {
	return {
		id: crypto.randomUUID(),
		role: "user",
		type: "text",
		text,
		status: "sent",
		createdAt: new Date().toISOString()
	};
}

function makeAssistantMessage(text: string, isError = false, showListenRow = false): ChatMessage {
	return {
		id: crypto.randomUUID(),
		role: "assistant",
		type: "card",
		body: text,
		createdAt: new Date().toISOString(),
		showListenRow,
		isError
	};
}

function normalizeAssistantBodyForDisplay(text: string): string {
	// Backend guardrail prefixes milk-collection payloads with a success line.
	// Remove that prefix so the chat starts directly with markdown sections/tables.
	return text.replace(/^Farmer milk collection details fetched successfully:\s*\n*/i, "");
}

import { playTTS as playTTSHelper } from "@/lib/audio-utils";
import { ANONYMOUS_BOOTSTRAP_SESSION_KEY } from "@/lib/anonymous-bootstrap";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchSuggestionsWithRetry(
	sessionId: string,
	language: string,
	isStale?: () => boolean,
) {
	const retryDelaysMs = [300, 700, 1200, 2000];
	for (let attempt = 0; attempt < retryDelaysMs.length; attempt++) {
		if (isStale?.()) return [];
		const suggestions = await apiService.getSuggestions(sessionId, language);
		if (suggestions.length > 0) {
			return suggestions;
		}
		await wait(retryDelaysMs[attempt] ?? 0);
	}
	if (isStale?.()) return [];
	return await apiService.getSuggestions(sessionId, language);
}

export const useChatStore = create<ChatStore>((set, get) => ({
	messages: [],
	quickActions: [],
	draft: "",
	suggestions: [],
	isAssistantTyping: false,
	isListening: false,
	isTranscribing: false,
	isFetchingSuggestions: false,
	sessionId: null,
	persona: "farmer",
	showQuestionList: false,
	toast: null,

	setToast: (toast) => set({ toast }),

	initializeSession: (user) => {
		const sid =
			(typeof sessionStorage !== "undefined" &&
				sessionStorage.getItem(ANONYMOUS_BOOTSTRAP_SESSION_KEY)) ||
			uuidv4();
		if (typeof sessionStorage !== "undefined") {
			sessionStorage.removeItem(ANONYMOUS_BOOTSTRAP_SESSION_KEY);
		}
		const persona = resolveChatPersona(
			user?.userType ?? user?.user_type ?? user?.user_metadata?.user_type,
			environment.doctorPersonaSelectorEnabled,
		);
		set({ sessionId: sid, persona });
		apiService.setSessionId(sid);
		try {
			telemetry.startTelemetry(sid, { 
				preferred_username: user?.user_metadata?.name || user?.email || "guest", 
				email: user?.email || "" 
			});
		} catch (e) {
			console.warn("Telemetry failed to start", e);
		}
	},

    getUserForTelemetry: () => {
        const user = useAuthStore.getState().user;
        return {
            preferred_username: user?.user_metadata?.name || user?.email || "guest",
            email: user?.email || ""
        };
    },

	setDraft: (value) => set(() => ({ draft: value })),

	setPersona: (persona) => {
		// Only the flagged-on build has a selector to call this; ignore anything
		// else so the persona cannot be switched on a build that hides it.
		if (!environment.doctorPersonaSelectorEnabled) return;
		if (get().persona === persona) return;
		const sid = uuidv4();
		set({
			persona,
			sessionId: sid,
			messages: [],
			draft: "",
			suggestions: [],
			isAssistantTyping: false,
			isListening: false,
			isTranscribing: false,
			isFetchingSuggestions: false,
			showQuestionList: false,
		});
		apiService.setSessionId(sid);
	},

	fetchLocation: (t) => {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const locationData = {
						latitude: position.coords.latitude,
						longitude: position.coords.longitude,
					};
					apiService.setLocationData(locationData);
				},
				(error) => {
					console.log("Unable to retrieve location:", error, t);
					// Localized toasts for location errors could be added here if needed
				}
			);
		}
	},

	setIsTranscribing: (value) => set(() => ({ isTranscribing: value })),
	setSuggestions: (suggestions) => set({ suggestions }),
	clearSuggestions: () => set({ suggestions: [] }),

	startListening: () => set(() => ({ isListening: true })),
	stopListening: () => set(() => ({ isListening: false })),

	clearChat: () =>
		set(() => ({
			messages: [],
			draft: "",
			suggestions: [],
			isAssistantTyping: false,
			isListening: false,
			isTranscribing: false,
			isFetchingSuggestions: false,
			showQuestionList: false
		})),

	// AMUL-78: brings the welcome question list back without clearing the
	// conversation; sendText closes it again, so a picked question continues the
	// same chat. Not while an answer is streaming: sendText does not guard against
	// a second turn starting mid-stream.
	openQuestionList: () => {
		if (get().isAssistantTyping) return;
		set({ showQuestionList: true });
	},
	closeQuestionList: () => set({ showQuestionList: false }),

	sendText: async (text, language) => {
		const trimmed = text.trim();
		if (!trimmed) return;

		const questionId = uuidv4(); // Generate early to attach to message
		const userMessage = makeUserMessage(trimmed);
		userMessage.questionId = questionId; // Attach questionId
		userMessage.questionText = trimmed;
		set((state) => ({
			messages: [...state.messages, userMessage],
			draft: "",
			suggestions: [],
			isAssistantTyping: true,
			showQuestionList: false
		}));

		const { sessionId, persona } = get();
		const currentSession = sessionId || uuidv4();
		if (!sessionId) {
			set({ sessionId: currentSession });
			apiService.setSessionId(currentSession);
		}
		const isTurnStale = () =>
			get().sessionId !== currentSession || get().persona !== persona;

		telemetry.markServerRequestStart(questionId);
		try {
			const userDetails = get().getUserForTelemetry();
			await telemetry.startTelemetry(currentSession, userDetails);
			telemetry.logQuestionEvent(questionId, currentSession, trimmed);
			telemetry.endTelemetry();
		} catch (e) {
			console.warn("Telemetry failed (question event)", e);
		}

		try {
			let wireText = "";
			let streamingText = "";
			let streamedArtifacts: ChatArtifact[] = [];
			let inlineSuggestions: string[] | null = null;
			const _response = await apiService.sendUserQuery(
				trimmed,
				currentSession,
				language, // source
				language, // target
				(chunk) => {
					if (isTurnStale()) return;
					wireText += chunk;
					const parsed = parseChatWire(wireText);
					streamingText = parsed.text;
					streamedArtifacts = parsed.artifacts;
					if (parsed.suggestions.length > 0) inlineSuggestions = parsed.suggestions;

					set((state) => {
						const displayBody = normalizeAssistantBodyForDisplay(streamingText);
						const lastMsg = state.messages[state.messages.length - 1];
						if (lastMsg && lastMsg.role === "assistant" && lastMsg.type === "card") {
							return {
								messages: [
									...state.messages.slice(0, -1),
									{ ...lastMsg, body: displayBody, artifacts: streamedArtifacts }
								]
							};
						} else {
							return {
								messages: [...state.messages, { ...makeAssistantMessage(displayBody), artifacts: streamedArtifacts, questionId, questionText: trimmed }]
							};
						}
					});
				},
				environment.doctorPersonaSelectorEnabled ? persona : undefined,
			);
			if (isTurnStale()) return;

			set((state) => {
				const lastMsg = state.messages[state.messages.length - 1];
				if (lastMsg && lastMsg.role === "assistant" && lastMsg.type === "card") {
					return {
						messages: [
							...state.messages.slice(0, -1),
							{ ...lastMsg, showListenRow: true }
						],
						isAssistantTyping: false
					};
				}
				return { isAssistantTyping: false };
			});

			// Use inline suggestions from stream if available, fall back to API
			const parsedInlineSuggestions = Array.isArray(inlineSuggestions) ? inlineSuggestions : [];
			if (parsedInlineSuggestions.length > 0) {
				set({ suggestions: parsedInlineSuggestions.map((q: string) => ({ id: uuidv4(), text: q, label: q })) });
			} else if (persona === "farmer") {
				// Abort retries early if a new turn started (bounds the worst-case
				// retry tail and prevents stale suggestions overwriting a newer turn).
				const isStale = () =>
					get().sessionId !== currentSession || get().isAssistantTyping;
				const suggestions = await fetchSuggestionsWithRetry(currentSession, language, isStale);
				if (!isStale()) {
					set({ suggestions: suggestions.map(s => ({ id: uuidv4(), text: s.question, label: s.question })) });
				}
			}

			// Show success for text completion if needed, though usually silent is better for chat.
			// But user asked for success too
			// set({ toast: { message: "Response received", type: "success" } });

		} catch (error: any) {
			if (isTurnStale()) return;
			console.error("Error sending text:", error);
			set({ isAssistantTyping: false });
			
			const isRateLimitError = error?.status === 429 || error?.response?.status === 429 || (error instanceof Error && error.message.includes('Rate limit'));
			
			if (isRateLimitError) {
				const currentLang = language || "en";
				const tData = translations[currentLang] || translations["en"];
				const limitMessage = tData.limitMessage || "Dear user, you have reached the allotted question limit for today. You may continue to explore the other features of the Amul AI app.";
				
				set((state) => ({
					messages: [...state.messages, makeAssistantMessage(limitMessage, true, true)]
				}));
				try { telemetry.logErrorEvent(questionId, currentSession, "Rate limit error (429)"); } catch (e) { console.warn("Telemetry failed (error event)", e); }
			} else {
				set({ toast: { message: "Sorry, there was an error processing your request. Please try again.", type: "error" } });
				try { telemetry.logErrorEvent(questionId, currentSession, String(error)); } catch (e) { console.warn("Telemetry failed (error event)", e); }
			}
		}
	},

	fetchSuggestionsForMessage: async (messageId) => {
		set({ isFetchingSuggestions: true });
		try {
			const suggestions = await fetchSuggestions(messageId);
			set({ suggestions, isFetchingSuggestions: false });
		} catch (error) {
			console.error("Error fetching suggestions:", error);
			set({ isFetchingSuggestions: false });
			set({ toast: { message: "Failed to load suggestions.", type: "error" } });
		}
	},

	sendAudio: async (blob, sessionId, language) => {
		if (!blob) return;
		
		set({ isTranscribing: true });

		try {
			const base64Audio = await apiService.blobToBase64(blob);
			const transcription = await apiService.transcribeAudio(base64Audio, sessionId, language);
			
			if (transcription && transcription.text) {
				set((state) => ({
					draft: state.draft ? `${state.draft} ${transcription.text}` : transcription.text,
					isTranscribing: false
				}));
				set({ toast: { message: "Transcribed successfully", type: "success" } });
			} else {
				set({ isTranscribing: false });
			}
		} catch (error) {
			console.error("Transcription error:", error);
			set({ isAssistantTyping: false, isTranscribing: false });
			set({ toast: { message: "Transcription failed. Please try again.", type: "error" } });
			throw error;
		}
	},

	sendQuickAction: (id, language) => {
		const action = get().quickActions.find((qa) => qa.id === id);
		if (!action || action.kind === "open_faq_panel") return;
		get().sendText(action.prompt, language);
	},

	sendQuickReply: (payload, language) => {
		get().sendText(payload, language);
	},

	generateQuickActions: (t) => {
		set({ quickActions: buildQuickActions(t) });
	},

	playTTS: async (text, language) => {
		const { sessionId } = get();
		if (!sessionId) return;
		try {
			await playTTSHelper(text, language, sessionId);
		} catch (error) {
			console.error("TTS Playback failed:", error);
			set({ toast: { message: "Error Playing Audio. Please try again.", type: "error" } });
		}
	},

	submitMessageFeedback: async (messageId, isPositive, reason, feedback, meta) => {
		const { sessionId, messages } = get();
		if (!sessionId) return;

		const msg = messages.find(m => m.id === messageId);
		if (!msg) return;

		const feedbackQuestionId = msg.questionId || messageId;
		const userMsg = messages.findLast((m) => m.role === 'user' && m.questionId === msg.questionId);
		const questionText = userMsg && userMsg.type === 'text' ? userMsg.text : "";
		const responseText = msg && msg.type === 'card' ? msg.body : "";
		const feedbackType = isPositive ? "like" : "dislike";
		const feedbackMsg = isPositive ? "Liked the response" : (feedback || reason || "Negative feedback");
		const feedbackMeta = meta;

		try {
			const user = useAuthStore.getState().user;
			await telemetry.startTelemetry(sessionId, {
				preferred_username: user?.user_metadata?.name || user?.email || "guest",
				email: user?.email || ""
			});
			telemetry.logFeedbackEvent(
				feedbackQuestionId,
				sessionId,
				feedbackMsg,
				feedbackType,
				questionText,
				responseText,
				feedbackMeta
			);
			telemetry.endTelemetry();
		} catch (e) {
			console.warn("Telemetry failed (feedback)", e);
		}

		if (isPositive) {
			set({ toast: { message: "Thank you for your feedback! We're glad this response was helpful.", type: "success" } });
		} else {
			set({ toast: { message: "Thank you for your feedback. We'll use it to improve our responses.", type: "success" } });
		}
	}
}));
