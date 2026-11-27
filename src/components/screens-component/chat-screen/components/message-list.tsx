import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageChrome } from "./message-chrome";
import { ChatMessage } from "./bubbles/chat-types";
import { Bubble } from "./bubbles";
import { AILoader } from "./ai-loader";
import {
	markAnswerRendered,
	logResponseEvent,
	startTelemetry,
	endTelemetry,
} from "@/lib/telemetry";
import { useChatStore } from "@/hooks/store/chat";

/* eslint-disable no-unused-vars */
type MessageListProps = {
	messages: ChatMessage[];
	isAssistantTyping?: boolean;
	welcome?: React.ReactNode;
	onQuickReply?: (payload: string) => void;
};
/* eslint-enable no-unused-vars */

export function MessageList(props: MessageListProps) {
	const bottomRef = useRef<HTMLDivElement | null>(null);
	const loggedResponseQidsRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		if (props.messages.length > 0) {
			bottomRef.current?.scrollIntoView({ behavior: "smooth" });
		} else {
			// Scroll to top when there are no messages (WelcomePanel visible)
			const scrollArea = bottomRef.current?.closest("[data-radix-scroll-area-viewport]");
			if (scrollArea) {
				scrollArea.scrollTo({ top: 0, behavior: "smooth" });
			}
		}

		// Performance + response telemetry tracking.
		// Process all completed assistant messages so follow-up Q&A pairs are not skipped.
		if (props.isAssistantTyping) return;

		const sessionId = useChatStore.getState().sessionId;
		const userDetails = useChatStore.getState().getUserForTelemetry();
		if (!sessionId) return;

		for (const msg of props.messages) {
			if (msg.role !== "assistant" || msg.type !== "card") continue;
			if (!msg.questionId || !msg.questionText || !msg.body) continue;
			if (!msg.showListenRow) continue;

			const questionId = msg.questionId;
			if (loggedResponseQidsRef.current.has(questionId)) continue;

			loggedResponseQidsRef.current.add(questionId);
			markAnswerRendered(questionId, async () => {
				try {
					await startTelemetry(sessionId, userDetails);
					logResponseEvent(
						questionId,
						sessionId,
						msg.questionText!,
						msg.body,
					);
					endTelemetry();
				} catch (error) {
					console.warn("Telemetry failed (response event)", error);
					loggedResponseQidsRef.current.delete(questionId);
				}
			});
		}
	}, [props.messages.length, props.isAssistantTyping, props.messages]);

	// AG-UI controls (pickers, review card) arrive in a state snapshot after the
	// message text, without changing `messages`; bring them into view too.
	const uiRevision = useChatStore((s) => s.amulUi.state_revision);
	useEffect(() => {
		if (uiRevision > 0 && props.messages.length > 0) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [uiRevision, props.messages.length]);

	return (
		// Radix wraps the viewport content in an inline `display: table` div, which grows to the
		// widest child: one wide markdown table pushed every bubble past the screen edge. Block
		// layout pins the column to the viewport so tables scroll inside their own wrapper.
		<ScrollArea className="h-full [&_[data-slot=scroll-area-viewport]>div]:block!">
			<div className="mx-auto flex max-w-3xl flex-col gap-3 px-2 pt-3 pb-14 sm:px-4">
				{props.welcome}
				{props.messages.map((m) => (
					<Bubble key={m.id} message={m} onQuickReply={props.onQuickReply} />
				))}
				{props.isAssistantTyping && props.messages[props.messages.length - 1]?.role !== "assistant" ? (
					<MessageChrome role="assistant" showLabel={true}>
						<AILoader className="px-1" />
					</MessageChrome>
				) : null}
				<div ref={bottomRef} />
			</div>
		</ScrollArea>
	);
}
