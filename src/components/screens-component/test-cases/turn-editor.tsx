import { Bot, Plus, RotateCcw, Trash2, Undo2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createTurn, isTurnEdited, nextRole } from "@/lib/test-cases/draft";
import type { TestCaseDraft, TestCaseRole, TestCaseTurn } from "@/lib/test-cases/types";

/* eslint-disable no-unused-vars */
type TurnEditorProps = {
	draft: TestCaseDraft;
	onChange: (update: (draft: TestCaseDraft) => TestCaseDraft) => void;
	// Turn ids with a blocking issue, outlined once the tester tried to submit.
	errorTurnIds: Set<string>;
};
/* eslint-enable no-unused-vars */

const ROLE_META: Record<TestCaseRole, { label: string; noun: string; icon: typeof User; chip: string; card: string }> = {
	user: {
		label: "Farmer question",
		noun: "farmer question",
		icon: User,
		chip: "bg-[#EEFFF4] text-[#017A38]",
		card: "border-[#CDEFD9]"
	},
	assistant: {
		label: "Amul AI answer",
		noun: "Amul AI answer",
		icon: Bot,
		chip: "bg-[#FFE2E2] text-[#C53030]",
		card: "border-[#F7D4D4]"
	}
};

// eslint-disable-next-line no-unused-vars
function mapTurn(draft: TestCaseDraft, id: string, update: (turn: TestCaseTurn) => TestCaseTurn): TestCaseDraft {
	return { ...draft, turns: draft.turns.map((turn) => (turn.id === id ? update(turn) : turn)) };
}

export function TurnEditor({ draft, onChange, errorTurnIds }: TurnEditorProps) {
	const suggestedRole = nextRole(draft);
	// Turns typed by hand that were never filled in can just go; imported ones are
	// kept as "removed" so the tester can bring them back.
	const removeTurn = (turn: TestCaseTurn) =>
		onChange((d) =>
			turn.originalContent === undefined && !turn.content.trim()
				? { ...d, turns: d.turns.filter((t) => t.id !== turn.id) }
				: mapTurn(d, turn.id, (t) => ({ ...t, removed: true }))
		);
	const addTurn = (role: TestCaseRole) => onChange((d) => ({ ...d, turns: [...d.turns, createTurn(role)] }));

	// Numbering skips removed turns, so #3 is the third message that will be submitted.
	const numbers = new Map<string, number>();
	for (const turn of draft.turns) if (!turn.removed) numbers.set(turn.id, numbers.size + 1);
	return (
		<div className="flex flex-col gap-3">
			{draft.turns.map((turn) => {
				const meta = ROLE_META[turn.role];
				const Icon = meta.icon;

				if (turn.removed) {
					return (
						<div
							key={turn.id}
							className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white/60 px-4 py-2.5 text-sm text-gray-500"
						>
							<Trash2 className="size-4 shrink-0" />
							<span className="min-w-0 flex-1 truncate">
								<span className="font-medium">Removed {meta.noun}:</span>{" "}
								<span className="line-through">{turn.content}</span>
							</span>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => onChange((d) => mapTurn(d, turn.id, (t) => ({ ...t, removed: false })))}
								className="shrink-0 text-[#F65151] hover:bg-[#FFE2E2] hover:text-[#D93B3B]"
							>
								<Undo2 className="size-4" />
								Restore
							</Button>
						</div>
					);
				}

				const visibleIndex = numbers.get(turn.id);
				const edited = isTurnEdited(turn);
				const hasError = errorTurnIds.has(turn.id);
				return (
					<div
						key={turn.id}
						className={cn(
							"rounded-2xl border bg-white p-3 shadow-sm",
							meta.card,
							hasError && "border-red-400 ring-2 ring-red-100"
						)}
					>
						<div className="mb-2 flex items-center gap-2">
							<span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", meta.chip)}>
								<Icon className="size-3.5" />
								{meta.label}
							</span>
							<span className="text-xs text-gray-400">#{visibleIndex}</span>
							{edited && (
								<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Edited</span>
							)}
							<div className="ml-auto flex items-center">
								{edited && (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => onChange((d) => mapTurn(d, turn.id, (t) => ({ ...t, content: t.originalContent ?? t.content })))}
										className="h-9 text-gray-600 hover:bg-gray-100"
									>
										<RotateCcw className="size-4" />
										<span className="hidden sm:inline">Undo edit</span>
									</Button>
								)}
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label={`Remove ${meta.noun} #${visibleIndex}`}
									onClick={() => removeTurn(turn)}
									className="size-9 text-gray-500 hover:bg-[#FFE2E2] hover:text-[#D93B3B]"
								>
									<Trash2 className="size-4" />
								</Button>
							</div>
						</div>
						<Textarea
							value={turn.content}
							aria-label={`${meta.label} #${visibleIndex}`}
							placeholder={turn.role === "user" ? "What the farmer asks…" : "The answer the bot should give…"}
							onChange={(event) => {
								const content = event.target.value;
								onChange((d) => mapTurn(d, turn.id, (t) => ({ ...t, content })));
							}}
							className="max-h-[50vh] min-h-20 resize-y border-gray-200 bg-white text-[15px] leading-relaxed"
						/>
					</div>
				);
			})}

			<div className="flex flex-wrap gap-2">
				{(["user", "assistant"] as const).map((role) => {
					const meta = ROLE_META[role];
					const suggested = role === suggestedRole;
					return (
						<Button
							key={role}
							type="button"
							variant="outline"
							onClick={() => addTurn(role)}
							className={cn(
								"min-h-11 flex-1 rounded-full border-dashed bg-white sm:flex-none",
								suggested ? "border-[#F65151] text-[#F65151] hover:bg-[#FFE2E2] hover:text-[#D93B3B]" : "text-gray-600"
							)}
						>
							<Plus className="size-4" />
							Add {meta.noun}
						</Button>
					);
				})}
			</div>
		</div>
	);
}
