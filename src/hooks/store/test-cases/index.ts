import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage } from "@/components/screens-component/chat-screen/components/bubbles/chat-types";
import type { ChatPersona } from "@/lib/chat-persona";
import { activeTurns, emptyDraft, mergeChatTurns, turnsFromChat } from "@/lib/test-cases/draft";
import type { TestCaseDraft } from "@/lib/test-cases/types";

export type TestCaseTab = "chat" | "manual" | "bulk";
type DraftKind = "chat" | "manual";
type ChatMeta = { sessionId: string | null; language: string; persona: ChatPersona };

/* eslint-disable no-unused-vars */
type TestCaseStore = {
	tab: TestCaseTab;
	// Who is submitting. Kept on this device so a tester picks their name once.
	submittedBy: string;
	// Drafts live outside the screen so a tester can go back to the chat, ask
	// one more question and return without losing their edits.
	chatDraft: TestCaseDraft | null;
	// Whether the tester changed the chat draft, so a new chat doesn't replace it unasked.
	chatDraftEdited: boolean;
	// Chat messages already sent in a case, per chat session. Their pairs come back
	// left out in the next draft of that chat.
	sentChat: { sessionId: string; messageIds: string[] } | null;
	manualDraft: TestCaseDraft;
	setTab: (tab: TestCaseTab) => void;
	setSubmittedBy: (name: string) => void;
	// Brings the chat draft up to date with the chat. A new chat replaces an unedited
	// draft; an edited one stays until the tester calls loadChat.
	syncChat: (messages: ChatMessage[], meta: ChatMeta) => void;
	// Starts the chat draft over from the current chat.
	loadChat: (messages: ChatMessage[], meta: ChatMeta) => void;
	// After a chat case is sent: the next draft holds the whole chat again, with the
	// pairs just sent left out.
	chatSubmitted: (messages: ChatMessage[], meta: ChatMeta) => void;
	updateDraft: (kind: DraftKind, update: (draft: TestCaseDraft) => TestCaseDraft) => void;
	resetManualDraft: () => void;
};
/* eslint-enable no-unused-vars */

function chatDraftFrom(messages: ChatMessage[], meta: ChatMeta, sentMessageIds: ReadonlySet<string>): TestCaseDraft | null {
	const turns = mergeChatTurns([], turnsFromChat(messages), sentMessageIds);
	if (turns.length === 0) return null;
	return {
		...emptyDraft("chat"),
		turns,
		sessionId: meta.sessionId ?? undefined,
		language: meta.language,
		persona: meta.persona
	};
}

export const useTestCaseStore = create<TestCaseStore>()(
	persist(
		(set, get) => {
			const sentIds = (sessionId: string | null): Set<string> => {
				const { sentChat } = get();
				return new Set(sentChat && sentChat.sessionId === sessionId ? sentChat.messageIds : []);
			};

			return {
				tab: "chat",
				submittedBy: "",
				chatDraft: null,
				chatDraftEdited: false,
				sentChat: null,
				manualDraft: emptyDraft("manual"),

				setTab: (tab) => set({ tab }),

				setSubmittedBy: (submittedBy) => set({ submittedBy }),

				syncChat: (messages, meta) => {
					const { chatDraft, chatDraftEdited } = get();
					const sameChat = chatDraft !== null && chatDraft.sessionId === (meta.sessionId ?? undefined);
					if (!sameChat) {
						if (chatDraft === null || !chatDraftEdited) get().loadChat(messages, meta);
						return;
					}
					const turns = mergeChatTurns(chatDraft.turns, turnsFromChat(messages), sentIds(meta.sessionId));
					set({ chatDraft: { ...chatDraft, turns } });
				},

				loadChat: (messages, meta) =>
					set({ chatDraft: chatDraftFrom(messages, meta, sentIds(meta.sessionId)), chatDraftEdited: false }),

				chatSubmitted: (messages, meta) => {
					const { chatDraft } = get();
					if (chatDraft?.sessionId) {
						const sent = activeTurns(chatDraft).flatMap((turn) => (turn.messageId ? [turn.messageId] : []));
						set({
							sentChat: { sessionId: chatDraft.sessionId, messageIds: [...sentIds(chatDraft.sessionId), ...sent] }
						});
					}
					get().loadChat(messages, meta);
				},

				updateDraft: (kind, update) =>
					set((state) =>
						kind === "chat"
							? state.chatDraft
								? { chatDraft: update(state.chatDraft), chatDraftEdited: true }
								: {}
							: { manualDraft: update(state.manualDraft) }
					),

				resetManualDraft: () => set({ manualDraft: emptyDraft("manual") })
			};
		},
		{
			name: "test-case-tester",
			// Only the name is worth keeping across reloads; drafts stay in memory.
			partialize: (state) => ({ submittedBy: state.submittedBy })
		}
	)
);
