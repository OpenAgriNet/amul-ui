import { create } from "zustand";
import type { ChatMessage } from "@/components/screens-component/chat-screen/components/bubbles/chat-types";
import type { ChatPersona } from "@/lib/chat-persona";
import { emptyDraft, turnsFromChat } from "@/lib/test-cases/draft";
import type { TestCaseDraft } from "@/lib/test-cases/types";

export type TestCaseTab = "chat" | "manual" | "bulk";
type DraftKind = "chat" | "manual";

/* eslint-disable no-unused-vars */
type TestCaseStore = {
	tab: TestCaseTab;
	// Drafts live outside the screen so a tester can go back to the chat, ask
	// one more question and return without losing their edits.
	chatDraft: TestCaseDraft | null;
	manualDraft: TestCaseDraft;
	setTab: (tab: TestCaseTab) => void;
	importChat: (messages: ChatMessage[], meta: { sessionId: string | null; language: string; persona: ChatPersona }) => void;
	updateDraft: (kind: DraftKind, update: (draft: TestCaseDraft) => TestCaseDraft) => void;
	resetDraft: (kind: DraftKind) => void;
};
/* eslint-enable no-unused-vars */

export const useTestCaseStore = create<TestCaseStore>((set) => ({
	tab: "chat",
	chatDraft: null,
	manualDraft: emptyDraft("manual"),

	setTab: (tab) => set({ tab }),

	importChat: (messages, meta) =>
		set({
			chatDraft: {
				...emptyDraft("chat"),
				turns: turnsFromChat(messages),
				sessionId: meta.sessionId ?? undefined,
				language: meta.language,
				persona: meta.persona
			}
		}),

	updateDraft: (kind, update) =>
		set((state) =>
			kind === "chat"
				? state.chatDraft
					? { chatDraft: update(state.chatDraft) }
					: {}
				: { manualDraft: update(state.manualDraft) }
		),

	resetDraft: (kind) => set(kind === "chat" ? { chatDraft: null } : { manualDraft: emptyDraft("manual") })
}));
