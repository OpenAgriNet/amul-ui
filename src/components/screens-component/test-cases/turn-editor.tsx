import { Bot, Plus, RotateCcw, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createPair, isTurnEdited, pairsOf, type TurnPair } from "@/lib/test-cases/draft";
import type { TestCaseDraft, TestCaseRole, TestCaseTurn } from "@/lib/test-cases/types";

/* eslint-disable no-unused-vars */
type DraftUpdate = (update: (draft: TestCaseDraft) => TestCaseDraft) => void;

type TurnEditorProps = {
	draft: TestCaseDraft;
	onChange: DraftUpdate;
	// Turn ids with a blocking issue, outlined once the tester tried to submit.
	errorTurnIds: Set<string>;
};
/* eslint-enable no-unused-vars */

const ROLE_META: Record<TestCaseRole, { label: string; icon: typeof User; chip: string; placeholder: string }> = {
	user: {
		label: "Farmer question",
		icon: User,
		chip: "bg-[#EEFFF4] text-[#017A38]",
		placeholder: "What the farmer asks…"
	},
	assistant: {
		label: "Amul AI answer",
		icon: Bot,
		chip: "bg-[#FFE2E2] text-[#C53030]",
		placeholder: "The answer the bot should give…"
	}
};

// eslint-disable-next-line no-unused-vars
function mapTurns(draft: TestCaseDraft, ids: Set<string>, update: (turn: TestCaseTurn) => TestCaseTurn): TestCaseDraft {
	return { ...draft, turns: draft.turns.map((turn) => (ids.has(turn.id) ? update(turn) : turn)) };
}

function TurnField({ turn, onChange, hasError }: { turn: TestCaseTurn; onChange: DraftUpdate; hasError: boolean }) {
	const meta = ROLE_META[turn.role];
	const Icon = meta.icon;
	const edited = isTurnEdited(turn);
	const only = new Set([turn.id]);
	return (
		<div className="flex flex-col gap-2">
			<div className="flex min-h-9 items-center gap-2">
				<span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", meta.chip)}>
					<Icon className="size-3.5" />
					{meta.label}
				</span>
				{edited && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Edited</span>}
				{edited && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onChange((d) => mapTurns(d, only, (t) => ({ ...t, content: t.originalContent ?? t.content })))}
						className="ml-auto h-9 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
					>
						<RotateCcw className="size-4" />
						<span className="hidden sm:inline">Undo edit</span>
					</Button>
				)}
			</div>
			<Textarea
				value={turn.content}
				aria-label={meta.label}
				aria-invalid={hasError}
				placeholder={meta.placeholder}
				onChange={(event) => {
					const content = event.target.value;
					onChange((d) => mapTurns(d, only, (t) => ({ ...t, content })));
				}}
				className={cn(
					"max-h-[50vh] min-h-20 resize-y rounded-xl border-gray-200 bg-white text-[15px] leading-relaxed shadow-none placeholder:text-gray-400 focus-visible:border-[#F65151] focus-visible:ring-[#F65151]/20",
					hasError && "border-red-400 ring-2 ring-red-100"
				)}
			/>
		</div>
	);
}

type PairCardProps = {
	pair: TurnPair;
	number: number;
	source: TestCaseDraft["source"];
	onChange: DraftUpdate;
	errorTurnIds: Set<string>;
};

function PairCard({ pair, number, source, onChange, errorTurnIds }: PairCardProps) {
	const ids = new Set(pair.turns.map((turn) => turn.id));
	const kept = !pair.turns[0]?.removed;
	const question = pair.turns.find((turn) => turn.role === "user") ?? pair.turns[0];
	const checkboxId = `test-case-pair-${pair.id}`;

	// Chat turns are ticked in or out, so the backend can still count the ones left
	// out; a pair written by hand is simply deleted.
	const control =
		source === "chat" ? (
			<label htmlFor={checkboxId} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-gray-700">
				<Checkbox
					id={checkboxId}
					checked={kept}
					onCheckedChange={(checked) => onChange((d) => mapTurns(d, ids, (t) => ({ ...t, removed: checked !== true })))}
					className="size-5 border-gray-300 data-[state=checked]:border-[#F65151] data-[state=checked]:bg-[#F65151] data-[state=checked]:text-white focus-visible:ring-[#F65151]/30"
				/>
				Keep in this case
			</label>
		) : (
			<Button
				type="button"
				variant="ghost"
				size="icon"
				aria-label={`Delete question ${number}`}
				onClick={() => onChange((d) => ({ ...d, turns: d.turns.filter((t) => !ids.has(t.id)) }))}
				className="size-9 text-gray-500 hover:bg-[#FFE2E2] hover:text-[#D93B3B]"
			>
				<Trash2 className="size-4" />
			</Button>
		);

	return (
		<div
			className={cn(
				"rounded-2xl border p-3 transition-colors",
				kept ? "border-gray-200 bg-white shadow-sm" : "border-dashed border-gray-300 bg-white/60"
			)}
		>
			<div className="flex items-center gap-2">
				<span className={cn("text-sm font-semibold", kept ? "text-gray-900" : "text-gray-500")}>Question {number}</span>
				<div className="ml-auto">{control}</div>
			</div>
			{kept ? (
				<div className="mt-2 flex flex-col gap-3">
					{pair.turns.map((turn) => (
						<TurnField key={turn.id} turn={turn} onChange={onChange} hasError={errorTurnIds.has(turn.id)} />
					))}
				</div>
			) : (
				<p className="mt-1 truncate text-sm text-gray-500">
					<span className="font-medium">Left out:</span> {question?.content}
				</p>
			)}
		</div>
	);
}

export function TurnEditor({ draft, onChange, errorTurnIds }: TurnEditorProps) {
	return (
		<div className="flex flex-col gap-3">
			{pairsOf(draft.turns).map((pair, index) => (
				<PairCard
					key={pair.id}
					pair={pair}
					number={index + 1}
					source={draft.source}
					onChange={onChange}
					errorTurnIds={errorTurnIds}
				/>
			))}

			{/* A chat draft holds what was said; pairs written by hand go in the Write tab. */}
			{draft.source !== "chat" && (
				<Button
					type="button"
					variant="outline"
					onClick={() => onChange((d) => ({ ...d, turns: [...d.turns, ...createPair()] }))}
					className="min-h-11 self-start rounded-full border-dashed border-[#F65151] bg-white px-5 text-[#F65151] hover:bg-[#FFE2E2] hover:text-[#D93B3B]"
				>
					<Plus className="size-4" />
					Add turn
				</Button>
			)}
		</div>
	);
}
