import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { activeTurns, buildPayload, hasErrors, isTurnEdited, validateDraft } from "@/lib/test-cases/draft";
import { submitTestCase, TestCaseApiError } from "@/lib/test-cases/api";
import type { TestCaseDraft, TestCaseIssue } from "@/lib/test-cases/types";
import { DetailsForm } from "./details-form";
import { TurnEditor } from "./turn-editor";

/* eslint-disable no-unused-vars */
type DraftEditorProps = {
	draft: TestCaseDraft;
	// The tester picked above the tabs; sent as submitted_by.
	submittedBy: string;
	onChange: (update: (draft: TestCaseDraft) => TestCaseDraft) => void;
	onSubmitted: () => void;
	onSubmitFailed: (message: string) => void;
	conversationActions?: React.ReactNode;
};
/* eslint-enable no-unused-vars */

export function DraftEditor({ draft, submittedBy, onChange, onSubmitted, onSubmitFailed, conversationActions }: DraftEditorProps) {
	// Errors stay quiet until the first submit so a half-written draft isn't red.
	const [attempted, setAttempted] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	// What the server refused, shown next to the issues found here. Cleared by any edit.
	const [serverIssues, setServerIssues] = useState<TestCaseIssue[]>([]);
	const issuesRef = useRef<HTMLDivElement | null>(null);
	useEffect(() => setServerIssues([]), [draft]);

	const issues = useMemo<TestCaseIssue[]>(
		() => [
			...validateDraft(draft),
			...(submittedBy ? [] : [{ level: "error" as const, message: "Choose your name in the Tester box at the top." }])
		],
		[draft, submittedBy]
	);
	const blocked = hasErrors(issues);
	const shownIssues = [...(attempted ? issues : issues.filter((issue) => issue.level === "warning")), ...serverIssues];
	const errorTurnIds = useMemo(
		() => new Set([...(attempted ? issues : []), ...serverIssues].flatMap((issue) => (issue.turnId ? [issue.turnId] : []))),
		[attempted, issues, serverIssues]
	);

	const turns = activeTurns(draft);
	const questions = turns.filter((t) => t.role === "user").length;
	const removed = draft.turns.length - turns.length;
	const edited = turns.filter(isTurnEdited).length;
	const summary = [
		`${questions} question${questions === 1 ? "" : "s"}`,
		`${turns.length - questions} answer${turns.length - questions === 1 ? "" : "s"}`,
		edited > 0 && `${edited} edited`,
		removed > 0 && `${removed} removed`
	]
		.filter(Boolean)
		.join(" · ");

	const handleSubmit = async () => {
		setAttempted(true);
		if (blocked) {
			// The issue list only mounts after this render, so scroll on the next tick.
			setTimeout(() => issuesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
			return;
		}
		setSubmitting(true);
		setServerIssues([]);
		try {
			await submitTestCase(buildPayload(draft, { submittedBy }));
			setAttempted(false);
			onSubmitted();
		} catch (error) {
			console.error("Test case submission failed:", error);
			if (error instanceof TestCaseApiError) {
				const kept = activeTurns(draft);
				setServerIssues(
					error.fieldErrors.length > 0
						? error.fieldErrors.map(({ loc, msg }) => {
								// ["turns", 3, "content"]: the fourth turn that was sent.
								const index = loc[0] === "turns" && typeof loc[1] === "number" ? loc[1] : -1;
								return { level: "error" as const, message: msg, turnId: kept[index]?.id };
							})
						: [{ level: "error", message: error.message }]
				);
			}
			onSubmitFailed(error instanceof TestCaseApiError ? error.message : "Couldn't submit the test case. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="flex flex-col gap-6">
			<section className="flex flex-col gap-3">
				<div className="flex flex-wrap items-end justify-between gap-2">
					<div>
						<h2 className="text-base font-semibold text-gray-900">Conversation</h2>
						<p className="text-sm text-gray-500">{summary}</p>
					</div>
					{conversationActions}
				</div>
				<p className="text-sm text-gray-600">
					{draft.source === "manual"
						? "Type the conversation turn by turn: the farmer's question, then the answer the bot should give."
						: "Fix any answer that is wrong so it reads the way the bot should reply, and remove turns that don't matter for this test."}
				</p>
				<TurnEditor draft={draft} onChange={onChange} errorTurnIds={errorTurnIds} />
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-base font-semibold text-gray-900">About this test case</h2>
				<DetailsForm draft={draft} onChange={onChange} showErrors={attempted} />
			</section>

			{shownIssues.length > 0 && (
				<div ref={issuesRef} role="status" className="flex flex-col gap-2">
					{shownIssues.map((issue) => {
						const isError = issue.level === "error";
						const Icon = isError ? AlertCircle : AlertTriangle;
						return (
							<div
								key={`${issue.turnId ?? ""}${issue.message}`}
								className={
									isError
										? "flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
										: "flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
								}
							>
								<Icon className="mt-0.5 size-4 shrink-0" />
								{issue.message}
							</div>
						);
					})}
				</div>
			)}

			<div className="sticky bottom-0 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
				<Button
					type="button"
					onClick={handleSubmit}
					disabled={submitting}
					className="min-h-12 w-full rounded-full bg-[#F65151] text-base font-semibold text-white hover:bg-[#D93B3B]"
				>
					{submitting ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
					{submitting ? "Submitting…" : "Submit test case"}
				</Button>
			</div>
		</div>
	);
}
