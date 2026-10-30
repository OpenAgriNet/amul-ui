import type { ChatPersona } from "@/lib/chat-persona";

export type TestCaseRole = "user" | "assistant";

export type TestCaseSource = "chat" | "manual" | "bulk";

export type TestCaseTurn = {
	id: string;
	role: TestCaseRole;
	content: string;
	// Text the turn had when it was imported from the chat or the CSV. Kept so the
	// payload can tell the judge which answers a tester corrected.
	originalContent?: string;
	removed?: boolean;
};

export type TestCaseDraft = {
	source: TestCaseSource;
	turns: TestCaseTurn[];
	description: string;
	caseType: string | null;
	tags: string[];
	// Chat context at import time; empty for manual and bulk entries.
	sessionId?: string;
	language?: string;
	persona?: ChatPersona;
};

export type TestCaseIssue = { level: "error" | "warning"; message: string; turnId?: string };

// Wire shape for the submit-test-case API (snake_case, as the Amul OAN API uses).
export type TestCasePayload = {
	source: TestCaseSource;
	description: string;
	case_type: string | null;
	tags: string[];
	turns: Array<{
		role: TestCaseRole;
		content: string;
		edited: boolean;
		original_content?: string;
	}>;
	metadata: {
		session_id?: string;
		language?: string;
		persona?: ChatPersona;
		bulk_case_id?: string;
		turn_count: number;
		edited_turn_count: number;
		removed_turn_count: number;
		submitted_at: string;
	};
};

export type SubmitTestCaseResult = { id: string; status: "received" };
