// Sends one chat operation to POST /api/chat/ and reads the reply.
//
// Why not the SDK's HttpAgent: it posts the accumulated messages and state on
// every run, and the backend contract (#593) rejects that; it also expects
// AG-UI on every response, while the backend answers in plain text when its
// flag is off. So this file owns the request and the format check, and the SDK
// owns the hard part: SSE framing (transformHttpEventStream) and event order
// checks (verifyEvents).

import { runHttpRequest, transformHttpEventStream, verifyEvents } from "@ag-ui/client";
import type { BaseEvent } from "@ag-ui/core";
import { v4 as uuidv4 } from "uuid";
import type { AguiRequestBody, AmulRequestProps, ChatError, ChatFormat, ChatOperation } from "./types";

/* eslint-disable no-unused-vars */
export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export type ChatTurnHandlers = {
	onFormat?: (format: ChatFormat) => void;
	onTraceId?: (traceId: string) => void;
	/** agui-v1: every event, in order, after the SDK has checked it. */
	onEvent?: (event: BaseEvent) => void;
	/** text-v1: raw text chunks, for the existing marker parser. */
	onTextChunk?: (chunk: string) => void;
};
/* eslint-enable no-unused-vars */

export type ChatTurnRequest = {
	apiUrl: string;
	authToken: string | null;
	threadId: string;
	operation: ChatOperation;
	sourceLang: string;
	targetLang: string;
	persona?: "farmer" | "doctor";
	signal?: AbortSignal;
	fetchFn?: FetchFn;
};

/** An HTTP error the backend returned before streaming started. */
export class ChatRequestError extends Error {
	readonly status: number;
	readonly body: ChatError | null;

	constructor(status: number, body: ChatError | null) {
		super(body?.error.message ?? `HTTP error! status: ${status}`);
		this.name = "ChatRequestError";
		this.status = status;
		this.body = body;
	}

	get code(): string | undefined {
		return this.body?.error.code;
	}
}

/** Builds the request body: exactly one operation, empty state, no history. */
export function buildRequestBody(request: Omit<ChatTurnRequest, "apiUrl" | "authToken" | "signal" | "fetchFn">): AguiRequestBody {
	const { operation } = request;
	const forwardedProps: AmulRequestProps = {
		version: 1,
		channel: "web",
		source_lang: request.sourceLang,
		target_lang: request.targetLang,
		...(request.persona && { persona: request.persona }),
		...(operation.kind === "message" && { input_method: operation.inputMethod ?? "typed" }),
		...(operation.kind === "ui_action" && { ui_action: operation.action }),
		...(operation.kind === "command" && { command: operation.command })
	};
	return {
		threadId: request.threadId,
		runId: uuidv4(),
		state: {},
		messages: operation.kind === "message" ? [{ id: uuidv4(), role: "user", content: operation.text }] : [],
		tools: [],
		context: [],
		forwardedProps
	};
}

async function readErrorBody(response: Response): Promise<ChatError | null> {
	try {
		const body = (await response.json()) as Partial<ChatError>;
		return body?.error && typeof body.error.message === "string" ? (body as ChatError) : null;
	} catch {
		return null;
	}
}

async function readTextStream(response: Response, onTextChunk?: (chunk: string) => void): Promise<void> {
	const reader = response.body?.getReader();
	if (!reader) throw new Error("Response body is not readable");
	const decoder = new TextDecoder();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		onTextChunk?.(decoder.decode(value, { stream: true }));
	}
	const tail = decoder.decode();
	if (tail) onTextChunk?.(tail);
}

function readAguiStream(response: Response, onEvent?: (event: BaseEvent) => void, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const subscription = transformHttpEventStream(runHttpRequest(() => Promise.resolve(response)))
			.pipe(verifyEvents())
			.subscribe({
				next: (event) => onEvent?.(event),
				error: (error: unknown) => reject(error),
				complete: () => resolve()
			});
		signal?.addEventListener("abort", () => {
			subscription.unsubscribe();
			resolve();
		});
	});
}

/**
 * Runs one turn. Resolves with the format the server chose once the stream
 * ends; rejects with ChatRequestError for errors sent before the stream.
 * The response header decides the format, and the request is never re-sent.
 */
export async function runChatTurn(request: ChatTurnRequest, handlers: ChatTurnHandlers = {}): Promise<ChatFormat> {
	const fetchFn: FetchFn = request.fetchFn ?? ((url, init) => fetch(url, init));
	const body = buildRequestBody(request);

	const response = await fetchFn(`${request.apiUrl}/api/chat/`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "text/event-stream, text/plain",
			Authorization: request.authToken ? `Bearer ${request.authToken}` : "NA"
		},
		body: JSON.stringify(body),
		signal: request.signal
	});

	if (!response.ok) {
		throw new ChatRequestError(response.status, await readErrorBody(response));
	}

	const traceId = response.headers.get("X-Trace-Id");
	if (traceId) handlers.onTraceId?.(traceId);

	const format: ChatFormat = response.headers.get("X-Chat-Format") === "agui-v1" ? "agui-v1" : "text-v1";
	handlers.onFormat?.(format);

	if (format === "agui-v1") {
		await readAguiStream(response, handlers.onEvent, request.signal);
	} else {
		await readTextStream(response, handlers.onTextChunk);
	}
	return format;
}
