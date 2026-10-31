import type { ChatMessage } from "@/components/screens-component/chat-screen/components/bubbles/chat-types";
import { OTHER_TAG_VALUE } from "./taxonomy";
import type { TestCaseDraft, TestCaseIssue, TestCasePayload, TestCaseRole, TestCaseTurn } from "./types";

export const MIN_DESCRIPTION_LENGTH = 20;
// Counted in farmer questions (one question plus its answer is one exchange).
export const MAX_EXCHANGES = 20;
// The agent caps its history around here, so longer chats drift anyway.
export const LONG_CHAT_EXCHANGES = 15;

export function createTurn(role: TestCaseRole, content = ""): TestCaseTurn {
	return { id: crypto.randomUUID(), role, content };
}

export function emptyDraft(source: TestCaseDraft["source"]): TestCaseDraft {
	return {
		source,
		turns: source === "manual" ? [createTurn("user"), createTurn("assistant")] : [],
		description: "",
		caseTypes: [],
		tags: [],
		otherTopic: ""
	};
}

// Whether the bot answered the question at this index, before the next question.
function gotAnswer(messages: ChatMessage[], index: number): boolean {
	for (const message of messages.slice(index + 1)) {
		if (message.type === "text" && message.role === "user") return false;
		if (message.type === "card" && message.role === "assistant" && !message.isError) return true;
	}
	return false;
}

// Only what the farmer typed and what the bot answered become turns. Error cards
// (rate limit, failed request) are app messages, not bot answers, and a question
// that got no answer never reached the bot, so it is no test.
export function turnsFromChat(messages: ChatMessage[]): TestCaseTurn[] {
	const turns: TestCaseTurn[] = [];
	for (const [index, message] of messages.entries()) {
		let role: TestCaseRole | null = null;
		let content = "";
		if (message.type === "text" && message.role === "user") {
			if (!gotAnswer(messages, index)) continue;
			role = "user";
			content = message.text;
		} else if (message.type === "card" && message.role === "assistant" && !message.isError) {
			role = "assistant";
			content = message.body;
		}
		if (!role || !content.trim()) continue;
		turns.push({
			...createTurn(role, content),
			originalContent: content,
			...(role === "assistant" && message.type === "card" && message.traceId ? { traceId: message.traceId } : {})
		});
	}
	return turns;
}

export function activeTurns(draft: TestCaseDraft): TestCaseTurn[] {
	return draft.turns.filter((turn) => !turn.removed);
}

// Whitespace collapsed, so one stray Enter in a kept-wrong answer does not turn a
// negative test into a corrected one.
const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

export function isTurnEdited(turn: TestCaseTurn): boolean {
	return turn.originalContent !== undefined && collapse(turn.content) !== collapse(turn.originalContent);
}

// The role a newly added turn should take: the opposite of the last kept turn.
export function nextRole(draft: TestCaseDraft): TestCaseRole {
	const turns = activeTurns(draft);
	return turns[turns.length - 1]?.role === "user" ? "assistant" : "user";
}

export function validateDraft(draft: TestCaseDraft): TestCaseIssue[] {
	const issues: TestCaseIssue[] = [];
	const turns = activeTurns(draft);
	const exchanges = turns.filter((turn) => turn.role === "user").length;

	if (turns.length === 0) {
		issues.push({ level: "error", message: "Add at least one farmer question and one bot answer." });
	} else {
		if (exchanges === 0) issues.push({ level: "error", message: "Add at least one farmer question." });
		if (!turns.some((turn) => turn.role === "assistant")) {
			issues.push({ level: "error", message: "Add at least one bot answer." });
		}
		const first = turns[0];
		if (exchanges > 0 && first && first.role !== "user") {
			issues.push({ level: "error", message: "The conversation has to start with a farmer question.", turnId: first.id });
		}
	}
	for (const turn of turns) {
		if (!turn.content.trim()) {
			issues.push({ level: "error", message: "A turn is empty. Write it or remove it.", turnId: turn.id });
		}
	}
	if (exchanges > MAX_EXCHANGES) {
		issues.push({ level: "error", message: `Keep it to ${MAX_EXCHANGES} questions or fewer. Split longer chats into separate test cases.` });
	} else if (exchanges > LONG_CHAT_EXCHANGES) {
		issues.push({
			level: "warning",
			message: `Over ${LONG_CHAT_EXCHANGES} questions: the bot starts forgetting early messages around here. Consider removing turns that don't matter for this test.`
		});
	}

	if (draft.source === "chat" && !draft.sessionId) {
		issues.push({ level: "error", message: "This chat has no session id. Go back to the chat and import it again." });
	}

	if (draft.tags.includes(OTHER_TAG_VALUE) && !draft.otherTopic.trim()) {
		issues.push({ level: "error", message: "You picked General / other. Write what the test case is about." });
	}

	const description = draft.description.trim();
	if (!description) {
		issues.push({ level: "error", message: "Describe what this test case checks." });
	} else if (description.length < MIN_DESCRIPTION_LENGTH) {
		issues.push({ level: "error", message: `The description is too short. Write at least ${MIN_DESCRIPTION_LENGTH} characters.` });
	}
	return issues;
}

export function hasErrors(issues: TestCaseIssue[]): boolean {
	return issues.some((issue) => issue.level === "error");
}

// Language of the text by its script, for bulk cases with no language cell. Null when
// the script can't say: Devanagari can be Hindi or Marathi, and the other Indian
// scripts are for a person to name. Only Latin text counts as English.
export function detectLanguage(text: string): string | null {
	if (/[\u0A80-\u0AFF]/.test(text)) return "gu";
	if (/[\u0900-\u0D7F]/.test(text)) return null;
	return "en";
}

export function buildPayload(
	draft: TestCaseDraft,
	options: { submittedBy: string; bulkCaseId?: string }
): TestCasePayload {
	const turns = activeTurns(draft);
	const otherTopic = draft.otherTopic.trim();
	return {
		schema_version: 1,
		source: draft.source,
		submitted_by: options.submittedBy,
		persona: draft.persona ?? "farmer",
		language: draft.language ?? "en",
		description: draft.description.trim(),
		case_types: draft.caseTypes,
		tags: draft.tags,
		...(draft.tags.includes(OTHER_TAG_VALUE) && otherTopic ? { other_topic: otherTopic } : {}),
		turns: turns.map((turn) => ({
			role: turn.role,
			content: turn.content.trim(),
			...(draft.source === "chat" && isTurnEdited(turn) ? { original_content: turn.originalContent?.trim() } : {}),
			...(turn.role === "assistant" && draft.source === "chat" && turn.traceId ? { trace_id: turn.traceId } : {})
		})),
		...(draft.source === "chat" && draft.sessionId
			? { chat: { session_id: draft.sessionId, removed_turn_count: draft.turns.filter((turn) => turn.removed && turn.originalContent !== undefined).length } }
			: {}),
		...(draft.source === "bulk" ? { bulk: { case_id: options.bulkCaseId ?? "" } } : {})
	};
}
