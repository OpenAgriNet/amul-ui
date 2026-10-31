import type { ChatPersona } from "@/lib/chat-persona";

export type TestCaseRole = "user" | "assistant";

export type TestCaseSource = "chat" | "manual" | "bulk";

export type TestCaseTurn = {
	id: string;
	role: TestCaseRole;
	content: string;
	// Text the turn had when it was imported from the chat or the sheet. Kept so the
	// payload can tell the judge which answers a tester corrected.
	originalContent?: string;
	// X-Trace-Id of the chat response that produced this answer (assistant turns of chat cases).
	traceId?: string;
	removed?: boolean;
};

export type TestCaseDraft = {
	source: TestCaseSource;
	turns: TestCaseTurn[];
	description: string;
	caseTypes: string[];
	tags: string[];
	// What the case is about when the tester picked "General / other".
	otherTopic: string;
	// Chat context at import time; empty for manual and bulk entries.
	sessionId?: string;
	language?: string;
	persona?: ChatPersona;
};

export type TestCaseOption = { value: string; label: string; hint: string };

export type TestCaseIssue = { level: "error" | "warning"; message: string; turnId?: string };

// Wire shape for POST /api/test-cases/ (payload v1, agreed in amul-ui#2). The API
// answers 422 for any field not listed here, so do not add one without the backend.
// There is no timestamp or random value: the same body always gets the same id, so
// a retry is stored once.
export type TestCasePayload = {
	schema_version: 1;
	source: TestCaseSource;
	submitted_by: string;
	persona: ChatPersona;
	language: string;
	description: string;
	case_types: string[];
	tags: string[];
	// Only when "general" is in tags.
	other_topic?: string;
	turns: Array<{
		role: TestCaseRole;
		content: string;
		// Only when the tester edited the turn.
		original_content?: string;
		// Only on assistant turns of chat cases.
		trace_id?: string;
	}>;
	// Chat cases carry chat; bulk cases carry bulk; manual cases carry neither.
	chat?: { session_id: string; removed_turn_count: number };
	bulk?: { case_id: string };
};

export type SubmitTestCaseResult = { id: string; status: "received" };
