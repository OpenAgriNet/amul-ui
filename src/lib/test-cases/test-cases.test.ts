import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@/components/screens-component/chat-screen/components/bubbles/chat-types";
import { buildTemplateCsv, parseBulkCsv, parseCsv } from "./csv";
import { buildPayload, emptyDraft, hasErrors, nextRole, turnsFromChat, validateDraft } from "./draft";
import type { TestCaseDraft } from "./types";

const at = "2026-10-29T00:00:00.000Z";

describe("test case drafts", () => {
	it("keeps farmer questions and bot answers from the chat, without error cards", () => {
		const messages: ChatMessage[] = [
			{ id: "1", role: "user", type: "text", text: "Hello", createdAt: at },
			{ id: "2", role: "assistant", type: "card", body: "Hi!", createdAt: at },
			{ id: "3", role: "assistant", type: "card", body: "Limit reached", isError: true, createdAt: at },
			{ id: "4", role: "system", type: "system", text: "joined", createdAt: at }
		];
		const turns = turnsFromChat(messages);
		expect(turns.map((t) => [t.role, t.content])).toEqual([
			["user", "Hello"],
			["assistant", "Hi!"]
		]);
		expect(turns[0]?.originalContent).toBe("Hello");
	});

	it("requires a description and a conversation that starts with the farmer", () => {
		const draft: TestCaseDraft = {
			...emptyDraft("chat"),
			turns: [
				{ id: "a", role: "assistant", content: "Hi" },
				{ id: "u", role: "user", content: "" }
			]
		};
		const messages = validateDraft(draft).map((i) => i.message);
		expect(messages).toContain("The conversation has to start with a farmer question.");
		expect(messages).toContain("A turn is empty. Write it or remove it.");
		expect(messages).toContain("Describe what this test case checks.");
	});

	it("ignores removed turns and reports edits in the payload", () => {
		const draft: TestCaseDraft = {
			...emptyDraft("chat"),
			description: "Bot gave the wrong dose for a calf.",
			turns: [
				{ id: "1", role: "user", content: "Dose for a calf?", originalContent: "Dose for a calf?" },
				{ id: "2", role: "assistant", content: "Give 5 ml.", originalContent: "Give 50 ml." },
				{ id: "3", role: "user", content: "Thanks", originalContent: "Thanks", removed: true }
			]
		};
		expect(hasErrors(validateDraft(draft))).toBe(false);
		expect(nextRole(draft)).toBe("user");
		const payload = buildPayload(draft);
		expect(payload.turns).toEqual([
			{ role: "user", content: "Dose for a calf?", edited: false },
			{ role: "assistant", content: "Give 5 ml.", edited: true, original_content: "Give 50 ml." }
		]);
		expect(payload.metadata.removed_turn_count).toBe(1);
		expect(payload.metadata.edited_turn_count).toBe(1);
	});
});

describe("bulk CSV", () => {
	it("parses quoted cells with commas, quotes and newlines", () => {
		expect(parseCsv('\uFEFFa,b\r\n"x, y","say ""hi""\nthere"\n')).toEqual([
			["a", "b"],
			["x, y", 'say "hi"\nthere']
		]);
	});

	it("reads the template back as two valid cases", () => {
		const { cases, fileError } = parseBulkCsv(buildTemplateCsv());
		expect(fileError).toBeUndefined();
		expect(cases.map((c) => [c.caseId, c.draft.turns.length, c.draft.tags, c.draft.caseType])).toEqual([
			["1", 2, ["veterinary_advisory"], "should_not_happen"],
			["2", 4, ["milk_earnings"], "edge_case"]
		]);
		expect(cases.every((c) => !hasErrors(c.issues))).toBe(true);
	});

	it("carries a blank case_id down and reports bad rows", () => {
		const csv = [
			"Case ID,Role,Content,Description,Tags",
			"7,farmer,Is it going to rain?,Weather question for the farmer's village,Weather",
			",bot,Light rain tomorrow.,,",
			",robot,???,,",
			",user,,,"
		].join("\n");
		const bulkCase = parseBulkCsv(csv).cases[0]!;
		expect(bulkCase.caseId).toBe("7");
		expect(bulkCase.draft.turns).toHaveLength(2);
		expect(bulkCase.draft.tags).toEqual(["weather"]);
		expect(bulkCase.issues.map((i) => i.message)).toEqual([
			'Row 4: role "robot" should be user or assistant.',
			"Row 5: content is empty."
		]);
	});

	it("rejects a file without the required columns", () => {
		expect(parseBulkCsv("question,answer\nhi,hello").fileError).toMatch(/case_id, role, content/);
	});
});
