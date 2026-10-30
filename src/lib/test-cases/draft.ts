import type { ChatMessage } from "@/components/screens-component/chat-screen/components/bubbles/chat-types";
import type { TestCaseDraft, TestCaseIssue, TestCasePayload, TestCaseRole, TestCaseTurn } from "./types";

export const MIN_DESCRIPTION_LENGTH = 20;
// Counted in farmer questions (one question plus its answer is one exchange).
export const MAX_EXCHANGES = 50;
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
		caseType: null,
		tags: []
	};
}

// Only what the farmer typed and what the bot answered become turns. Error cards
// (rate limit, failed request) are app messages, not bot answers.
export function turnsFromChat(messages: ChatMessage[]): TestCaseTurn[] {
	const turns: TestCaseTurn[] = [];
	for (const message of messages) {
		let role: TestCaseRole | null = null;
		let content = "";
		if (message.type === "text" && message.role === "user") {
			role = "user";
			content = message.text;
		} else if (message.type === "card" && message.role === "assistant" && !message.isError) {
			role = "assistant";
			content = message.body;
		}
		if (!role || !content.trim()) continue;
		turns.push({ ...createTurn(role, content), originalContent: content });
	}
	return turns;
}

export function activeTurns(draft: TestCaseDraft): TestCaseTurn[] {
	return draft.turns.filter((turn) => !turn.removed);
}

export function isTurnEdited(turn: TestCaseTurn): boolean {
	return turn.originalContent !== undefined && turn.content.trim() !== turn.originalContent.trim();
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

export function buildPayload(draft: TestCaseDraft, options: { bulkCaseId?: string } = {}): TestCasePayload {
	const turns = activeTurns(draft);
	return {
		source: draft.source,
		description: draft.description.trim(),
		case_type: draft.caseType,
		tags: draft.tags,
		turns: turns.map((turn) => {
			const edited = isTurnEdited(turn);
			return {
				role: turn.role,
				content: turn.content.trim(),
				edited,
				...(edited ? { original_content: turn.originalContent } : {})
			};
		}),
		metadata: {
			session_id: draft.sessionId,
			language: draft.language,
			persona: draft.persona,
			bulk_case_id: options.bulkCaseId,
			turn_count: turns.length,
			edited_turn_count: turns.filter(isTurnEdited).length,
			removed_turn_count: draft.turns.length - turns.length,
			submitted_at: new Date().toISOString()
		}
	};
}
