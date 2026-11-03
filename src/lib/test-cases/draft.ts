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
			messageId: message.id,
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

// A farmer question and every answer after it, up to the next question. A case is
// made of these: the backend refuses a question with no answer, and a chat answer can
// come in more than one message. Answers before the first question form a pair of
// their own, which validateDraft flags.
export type TurnPair = { id: string; turns: TestCaseTurn[] };

export function pairsOf(turns: TestCaseTurn[]): TurnPair[] {
	const pairs: TurnPair[] = [];
	for (const turn of turns) {
		const last = pairs[pairs.length - 1];
		if (turn.role === "user" || !last) pairs.push({ id: turn.id, turns: [turn] });
		else last.turns.push(turn);
	}
	return pairs;
}

// An empty question and its answer, for the Write tab.
export function createPair(): TestCaseTurn[] {
	return [createTurn("user"), createTurn("assistant")];
}

// The draft's chat turns brought up to date with the chat. Turns already in the draft
// keep their edits and their tick, and an answer still streaming in when the draft was
// made gets its full text. A new turn joins its pair's tick; a new pair is kept, unless
// its question was already sent in an earlier case.
export function mergeChatTurns(
	existing: TestCaseTurn[],
	fresh: TestCaseTurn[],
	sentMessageIds: ReadonlySet<string>
): TestCaseTurn[] {
	const known = new Map(existing.flatMap((turn) => (turn.messageId ? [[turn.messageId, turn] as const] : [])));
	const isNew = new Set<string>();
	const merged = fresh.map((turn) => {
		const old = turn.messageId ? known.get(turn.messageId) : undefined;
		if (!old) {
			isNew.add(turn.id);
			return turn;
		}
		if (isTurnEdited(old) || old.originalContent === turn.originalContent) return old;
		return { ...old, content: turn.content, originalContent: turn.originalContent, traceId: turn.traceId ?? old.traceId };
	});
	return pairsOf(merged).flatMap(({ turns }) => {
		const [first] = turns;
		const pairIsNew = first !== undefined && isNew.has(first.id);
		const removed = pairIsNew
			? first.role === "user" && first.messageId !== undefined && sentMessageIds.has(first.messageId)
			: Boolean(first?.removed);
		return turns.map((turn) => (isNew.has(turn.id) ? { ...turn, removed } : turn));
	});
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
		// The backend's pair rule: every question is followed by its answer and the case
		// ends on an answer. Only a chat can have answers in a row, since the bot may
		// send more than one message for a question.
		turns.forEach((turn, index) => {
			const next = turns[index + 1];
			if (turn.role === "user" && next?.role === "user") {
				issues.push({ level: "error", message: "A farmer question has no answer. Add its answer or leave it out.", turnId: turn.id });
			}
			if (draft.source !== "chat" && turn.role === "assistant" && turns[index - 1]?.role === "assistant") {
				issues.push({ level: "error", message: "Two answers in a row. Give each question one answer.", turnId: turn.id });
			}
		});
		const last = turns[turns.length - 1];
		if (last?.role === "user" && exchanges < turns.length) {
			issues.push({ level: "error", message: "The conversation has to end with a bot answer.", turnId: last.id });
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
