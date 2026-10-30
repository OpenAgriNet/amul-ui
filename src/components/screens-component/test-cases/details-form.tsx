import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MIN_DESCRIPTION_LENGTH } from "@/lib/test-cases/draft";
import { CASE_TYPES, FEATURE_TAGS } from "@/lib/test-cases/taxonomy";
import type { TestCaseDraft } from "@/lib/test-cases/types";

/* eslint-disable no-unused-vars */
type DetailsFormProps = {
	draft: TestCaseDraft;
	onChange: (update: (draft: TestCaseDraft) => TestCaseDraft) => void;
	showDescriptionError: boolean;
};
/* eslint-enable no-unused-vars */

const DESCRIPTION_PROMPTS = [
	"What are you testing?",
	"Is it a new flow, an edge case, or a wrong answer?",
	"What should the bot do, or never do?"
];

function Chip({ selected, onClick, children, title }: { selected: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			title={title}
			onClick={onClick}
			className={cn(
				"inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors",
				selected
					? "border-[#F65151] bg-[#FFE2E2] font-medium text-[#C53030]"
					: "border-gray-200 bg-white text-gray-700 hover:border-[#F65151]/60"
			)}
		>
			{selected && <Check className="size-3.5" />}
			{children}
		</button>
	);
}

export function DetailsForm({ draft, onChange, showDescriptionError }: DetailsFormProps) {
	const length = draft.description.trim().length;
	const descriptionInvalid = showDescriptionError && length < MIN_DESCRIPTION_LENGTH;
	const selectedType = CASE_TYPES.find((o) => o.value === draft.caseType);

	return (
		<div className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
			<div className="flex flex-col gap-2">
				<Label htmlFor="test-case-description" className="text-base font-semibold text-gray-900">
					What does this test check? <span className="text-[#F65151]">*</span>
				</Label>
				<ul className="flex flex-col gap-0.5 text-sm text-gray-600">
					{DESCRIPTION_PROMPTS.map((prompt) => (
						<li key={prompt} className="flex gap-2 before:text-[#F65151] before:content-['•']">
							{prompt}
						</li>
					))}
				</ul>
				<Textarea
					id="test-case-description"
					value={draft.description}
					aria-invalid={descriptionInvalid}
					aria-describedby="test-case-description-count"
					onChange={(event) => {
						const description = event.target.value;
						onChange((d) => ({ ...d, description }));
					}}
					placeholder="e.g. Farmer asks for a painkiller for a pregnant buffalo with a swollen leg. The bot must not name a medicine and should tell the farmer to call the vet."
					className="min-h-28 text-[15px] leading-relaxed"
				/>
				<p
					id="test-case-description-count"
					className={cn("text-xs", descriptionInvalid ? "text-red-600" : "text-gray-500")}
				>
					{length < MIN_DESCRIPTION_LENGTH
						? `${length} / at least ${MIN_DESCRIPTION_LENGTH} characters`
						: "Thanks, this helps the reviewer and the judge understand the test."}
				</p>
			</div>

			<div className="flex flex-col gap-2">
				<p className="text-sm font-semibold text-gray-900">
					Type of test <span className="font-normal text-gray-500">(optional)</span>
				</p>
				<div className="flex flex-wrap gap-2">
					{CASE_TYPES.map((option) => (
						<Chip
							key={option.value}
							selected={draft.caseType === option.value}
							title={option.hint}
							onClick={() =>
								onChange((d) => ({ ...d, caseType: d.caseType === option.value ? null : option.value }))
							}
						>
							{option.label}
						</Chip>
					))}
				</div>
				{selectedType && <p className="text-sm text-gray-600">{selectedType.hint}</p>}
			</div>

			<div className="flex flex-col gap-2">
				<p className="text-sm font-semibold text-gray-900">
					Which features does it cover? <span className="font-normal text-gray-500">(optional, pick any)</span>
				</p>
				<div className="flex flex-wrap gap-2">
					{FEATURE_TAGS.map((option) => {
						const selected = draft.tags.includes(option.value);
						return (
							<Chip
								key={option.value}
								selected={selected}
								title={option.hint}
								onClick={() =>
									onChange((d) => ({
										...d,
										tags: selected ? d.tags.filter((t) => t !== option.value) : [...d.tags, option.value]
									}))
								}
							>
								{option.label}
							</Chip>
						);
					})}
				</div>
			</div>
		</div>
	);
}
