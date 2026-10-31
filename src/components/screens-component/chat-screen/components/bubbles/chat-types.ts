export type MessageRole = "user" | "assistant" | "system";

export type DeliveryStatus = "sending" | "sent" | "delivered" | "read";

export type QuickReply = { id: string; label: string; payload?: string };

export type MessageBase = {
	id: string;
	role: MessageRole;
	createdAt: string;
	status?: DeliveryStatus;
	questionId?: string;
	questionText?: string;
};

export type TextMessage = MessageBase & {
	type: "text";
	text: string;
};

export type CardMessage = MessageBase & {
	type: "card";
	title?: string;
	body: string;
	actions?: { id: string; label: string }[];
	showListenRow?: boolean;
	isError?: boolean;
	// X-Trace-Id of the chat response, kept so a saved test case can point at the trace.
	traceId?: string;
	artifacts?: import("@/lib/chat-artifacts").ChatArtifact[];
};

export type QuickRepliesMessage = MessageBase & {
	type: "quick_replies";
	prompt?: string;
	replies: QuickReply[];
};

export type SystemMessage = MessageBase & {
	type: "system";
	text: string;
};

export type AudioMessage = MessageBase & {
	type: "audio";
	audioUrl: string;
	duration: number;
};

export type ChatMessage = TextMessage | CardMessage | QuickRepliesMessage | SystemMessage | AudioMessage;
