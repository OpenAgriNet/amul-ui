import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@/components/screens-component/chat-screen/components/bubbles/chat-types";
import { buildTemplateCsv, parseBulkCsv, parseBulkRows, parseCsv } from "./csv";
import { buildPayload, detectLanguage, emptyDraft, hasErrors, MAX_EXCHANGES, nextRole, turnsFromChat, validateDraft } from "./draft";
import { TEST_OPTIONS } from "./test-fixtures";
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

	it("skips a farmer question that only got an error card", () => {
		const messages: ChatMessage[] = [
			{ id: "1", role: "user", type: "text", text: "Lost question", createdAt: at },
			{ id: "2", role: "assistant", type: "card", body: "Something went wrong", isError: true, createdAt: at },
			{ id: "3", role: "user", type: "text", text: "Hello", createdAt: at },
			{ id: "4", role: "assistant", type: "card", body: "Hi!", traceId: "b".repeat(32), createdAt: at }
		];
		const turns = turnsFromChat(messages);
		expect(turns.map((t) => t.content)).toEqual(["Hello", "Hi!"]);
		expect(turns[1]?.traceId).toBe("b".repeat(32));
	});

	it("skips a farmer question that got no answer, with no error card either", () => {
		const messages: ChatMessage[] = [
			{ id: "1", role: "user", type: "text", text: "Failed with a toast", createdAt: at },
			{ id: "2", role: "user", type: "text", text: "Hello", createdAt: at },
			{ id: "3", role: "assistant", type: "card", body: "Hi!", createdAt: at },
			{ id: "4", role: "user", type: "text", text: "Still waiting", createdAt: at }
		];
		expect(turnsFromChat(messages).map((t) => t.content)).toEqual(["Hello", "Hi!"]);
	});

	it("ignores whitespace when checking edits, and counts only imported turns as removed", () => {
		const draft: TestCaseDraft = {
			...emptyDraft("chat"),
			description: "Kept wrong on purpose, so it stays a negative test.",
			sessionId: "s1",
			language: "gu",
			turns: [
				{ id: "1", role: "user", content: "Dose?", originalContent: "Dose?" },
				{ id: "2", role: "assistant", content: "Give 50 ml.\n", originalContent: "Give 50  ml." },
				{ id: "3", role: "user", content: "Thanks", originalContent: "Thanks", removed: true },
				{ id: "4", role: "user", content: "Typed by hand", removed: true }
			]
		};
		const payload = buildPayload(draft, { submittedBy: "vishal" });
		expect(payload.turns[1]).toEqual({ role: "assistant", content: "Give 50 ml." });
		expect(payload.chat?.removed_turn_count).toBe(1);
	});

	it("never sends original_content or trace_id on Write or bulk cases", () => {
		const turns = [
			{ id: "1", role: "user" as const, content: "Hi" },
			{ id: "2", role: "assistant" as const, content: "Hello", originalContent: "Other", traceId: "c".repeat(32) }
		];
		for (const source of ["manual", "bulk"] as const) {
			const payload = buildPayload({ ...emptyDraft(source), description: "x".repeat(25), turns }, { submittedBy: "vishal", bulkCaseId: "1" });
			expect(payload.turns[1]).toEqual({ role: "assistant", content: "Hello" });
		}
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
		const payload = buildPayload(draft, { submittedBy: "Vishal" });
		expect(payload.turns).toEqual([
			{ role: "user", content: "Dose for a calf?" },
			{ role: "assistant", content: "Give 5 ml.", original_content: "Give 50 ml." }
		]);
		expect(payload.chat).toEqual({ session_id: "", removed_turn_count: 1 });
		expect(payload).not.toHaveProperty("bulk");
	});

	it("sends who submitted, several types and the other topic", () => {
		const draft: TestCaseDraft = {
			...emptyDraft("manual"),
			description: "Loan question the bot cannot answer yet.",
			caseTypes: ["new_flow", "edge_case"],
			tags: ["general"],
			otherTopic: " Loans ",
			turns: [
				{ id: "1", role: "user", content: "Can I get a loan?" },
				{ id: "2", role: "assistant", content: "Please ask your society." }
			]
		};
		const payload = buildPayload(draft, { submittedBy: "suraj" });
		expect(payload.submitted_by).toBe("suraj");
		expect(payload.schema_version).toBe(1);
		expect(payload).not.toHaveProperty("client_submission_id");
		expect(payload).not.toHaveProperty("metadata");
		expect(payload.case_types).toEqual(["new_flow", "edge_case"]);
		expect(payload.other_topic).toBe("Loans");
		expect(buildPayload({ ...draft, tags: ["weather"] }, { submittedBy: "suraj" })).not.toHaveProperty("other_topic");
	});

	it("asks what General / other is about, and keeps chats to the turn limit", () => {
		const turns = Array.from({ length: MAX_EXCHANGES + 1 }, (_, i) => [
			{ id: `u${i}`, role: "user" as const, content: "Q" },
			{ id: `a${i}`, role: "assistant" as const, content: "A" }
		]).flat();
		const draft: TestCaseDraft = { ...emptyDraft("chat"), description: "A long chat about anything.", tags: ["general"], turns };
		const messages = validateDraft(draft).map((i) => i.message);
		expect(messages).toContain("You picked General / other. Write what the test case is about.");
		expect(messages.some((m) => m.startsWith(`Keep it to ${MAX_EXCHANGES} questions`))).toBe(true);
		expect(MAX_EXCHANGES).toBe(20);
	});

	it("builds the v1 body for each source, the same every time", () => {
		const turns = [
			{ id: "1", role: "user" as const, content: "મારી ગાયને તાવ છે" },
			{ id: "2", role: "assistant" as const, content: "Call the vet.", originalContent: "Call the vet.", traceId: "a".repeat(32) }
		];
		const chat: TestCaseDraft = { ...emptyDraft("chat"), description: "Should say call the vet.", sessionId: "s1", language: "gu", turns };
		expect(buildPayload(chat, { submittedBy: "vishal" })).toEqual({
			schema_version: 1,
			source: "chat",
			submitted_by: "vishal",
			persona: "farmer",
			language: "gu",
			description: "Should say call the vet.",
			case_types: [],
			tags: [],
			turns: [
				{ role: "user", content: "મારી ગાયને તાવ છે" },
				{ role: "assistant", content: "Call the vet.", trace_id: "a".repeat(32) }
			],
			chat: { session_id: "s1", removed_turn_count: 0 }
		});
		expect(buildPayload(chat, { submittedBy: "vishal" })).toEqual(buildPayload(chat, { submittedBy: "vishal" }));

		const bulk: TestCaseDraft = { ...emptyDraft("bulk"), description: "Bonus needs farmer data.", language: "gu", turns };
		const bulkPayload = buildPayload(bulk, { submittedBy: "vishal", bulkCaseId: "vet-001" });
		expect(bulkPayload.bulk).toEqual({ case_id: "vet-001" });
		expect(bulkPayload).not.toHaveProperty("test_account");
		expect(bulkPayload).not.toHaveProperty("chat");
		expect(bulkPayload.turns[1]).not.toHaveProperty("trace_id");
	});

	it("works out the language from the script, only when the script is clear", () => {
		expect(detectLanguage("ગાયને તાવ છે")).toBe("gu");
		expect(detectLanguage("How much bonus?")).toBe("en");
		expect(detectLanguage("मेरी गाय बीमार है")).toBeNull();
		expect(detectLanguage("আমার গরু অসুস্থ")).toBeNull();
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
		const { cases, fileError } = parseBulkCsv(buildTemplateCsv(TEST_OPTIONS), TEST_OPTIONS);
		expect(fileError).toBeUndefined();
		expect(cases.map((c) => [c.caseId, c.draft.turns.length, c.draft.tags, c.draft.caseTypes])).toEqual([
			["1", 2, ["veterinary_advisory"], ["should_not_happen"]],
			["2", 4, ["milk_earnings"], ["edge_case", "new_flow"]]
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
		const bulkCase = parseBulkCsv(csv, TEST_OPTIONS).cases[0]!;
		expect(bulkCase.caseId).toBe("7");
		expect(bulkCase.draft.turns).toHaveLength(2);
		expect(bulkCase.draft.tags).toEqual(["weather"]);
		expect(bulkCase.issues.map((i) => i.message)).toEqual([
			'Row 4: role "robot" should be user or assistant.',
			"Row 5: content is empty."
		]);
	});

	it("reads types and tags written in one cell, by value or label, and rows read from Excel", () => {
		// Excel hands over numbers as text too, e.g. a case_id of 3.
		const { cases, fileError } = parseBulkRows([
			["case_id", "role", "content", "description", "case_type", "tags"],
			["3", "farmer", "Weather tomorrow?", "Weather question from a farmer in Anand.", "edge_case, wrong_answer", "Weather, crop_advisory"],
			["3", "bot", "Light rain.", "", "", ""],
			["", "", "", "", "", ""]
		], TEST_OPTIONS);
		expect(fileError).toBeUndefined();
		expect(cases).toHaveLength(1);
		expect(cases[0]?.draft.caseTypes).toEqual(["edge_case", "wrong_answer"]);
		expect(cases[0]?.draft.tags).toEqual(["weather", "crop_advisory"]);
		expect(cases[0]?.issues).toEqual([]);
		expect(parseBulkRows([["case_id", "role", "content", "description", "case_type"], ["1", "user", "Hi", "", "dream"]], TEST_OPTIONS).cases[0]?.issues.map((i) => i.message)).toContain(
			'Row 2: unknown case_type "dream".'
		);
	});

	it("checks the sheet against the lists the backend sent, not a built-in list", () => {
		const header = ["case_id", "role", "content", "description", "tags"];
		const issues = (options: typeof TEST_OPTIONS) =>
			parseBulkRows([header, ["1", "user", "Where is the vet office?", "Vet office in Palanpur.", "vet_office, Loan"]], options)
				.cases[0]?.issues.map((i) => i.message)
				.filter((m) => m.startsWith("Row"));
		expect(issues(TEST_OPTIONS)).toEqual([]);
		const narrow = { ...TEST_OPTIONS, tags: TEST_OPTIONS.tags.filter((o) => o.value !== "vet_office") };
		expect(issues(narrow)).toContain('Row 2: unknown tag "vet_office".');
	});

	it("reads other_topic, so a General / other case can pass", () => {
		const header = ["case_id", "role", "content", "description", "tags", "other_topic"];
		const rows = (topic: string) => [
			header,
			["1", "user", "Can I get a loan?", "Loan question the bot cannot answer.", "General / other", topic],
			["1", "assistant", "Ask your society.", "", "", ""]
		];
		const [good] = parseBulkRows(rows(" Loans "), TEST_OPTIONS).cases;
		expect(good?.issues).toEqual([]);
		expect(buildPayload(good!.draft, { submittedBy: "vishal", bulkCaseId: "1" }).other_topic).toBe("Loans");
		expect(hasErrors(parseBulkRows(rows(""), TEST_OPTIONS).cases[0]!.issues)).toBe(true);
	});

	it("reads language names, flags Devanagari with no language, and limits case_id", () => {
		const header = ["case_id", "role", "content", "description", "language"];
		const run = (rows: string[][]) =>
			parseBulkRows([header, ...rows], TEST_OPTIONS).cases.map((c) => [c.draft.language, c.issues.map((i) => i.message).filter((m) => !m.includes("bot answer"))]);
		expect(run([["1", "user", "Hi", "Question about bonus rules.", "Gujarati"]])).toEqual([["gu", []]]);
		expect(run([["1", "user", "ગાયને તાવ છે", "Fever question in Gujarati.", ""]])).toEqual([["gu", []]]);
		const [devanagari] = run([["1", "user", "गाय को बुखार है", "Fever question in Devanagari.", ""]]);
		expect(devanagari?.[1]).toEqual(["Case 1: the script of the questions doesn't say the language. Write it in the language column, like hi or mr."]);
		const [unknown] = run([["1", "user", "Hi", "Question about bonus rules.", "Klingon"]]);
		expect((unknown?.[1] as string[])[0]).toMatch(/language "klingon" is not one of/);
		const [longId] = run([["x".repeat(65), "user", "Hi", "Question about bonus rules.", "en"]]);
		expect((longId?.[1] as string[])[0]).toMatch(/case_id is longer than 64/);
	});

	it("rejects a file without the required columns", () => {
		expect(parseBulkCsv("question,answer\nhi,hello", TEST_OPTIONS).fileError).toMatch(/case_id, role, content/);
	});
});
