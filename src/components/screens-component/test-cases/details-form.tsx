import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MIN_DESCRIPTION_LENGTH } from "@/lib/test-cases/draft";
import { OTHER_TAG_VALUE } from "@/lib/test-cases/taxonomy";
import { LANGUAGES } from "@/components/screens-component/chat-screen/config";
import { useUiFlags } from "@/lib/ui-flags";
import { useTestCaseOptions } from "@/hooks/store/test-cases/options";
import type { TestCaseDraft } from "@/lib/test-cases/types";
import { FieldSelect } from "./field-select";

/* eslint-disable no-unused-vars */
type DetailsFormProps = {
	draft: TestCaseDraft;
	onChange: (update: (draft: TestCaseDraft) => TestCaseDraft) => void;
	// Show what is missing once the tester has tried to submit.
	showErrors: boolean;
};
/* eslint-enable no-unused-vars */

const DESCRIPTION_PROMPTS = [
	"What are you testing?",
	"What should the answer be?",
	"What is missing or wrong in the bot's answer, and what is correct?"
];

const LANGUAGE_OPTIONS = Object.values(LANGUAGES).map(({ code, name }) => ({ value: code, label: name }));

const PERSONA_OPTIONS = [
	{ value: "farmer", label: "Farmer" },
	{ value: "doctor", label: "Doctor" }
];

const FIELD_CLASS =
	"border-gray-200 bg-white text-[15px] shadow-none placeholder:text-gray-400 focus-visible:border-[#F65151] focus-visible:ring-[#F65151]/20";

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

function toggle(list: string[], value: string): string[] {
	return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function DetailsForm({ draft, onChange, showErrors }: DetailsFormProps) {
	const { caseTypes, tags } = useTestCaseOptions((s) => s.options) ?? { caseTypes: [], tags: [] };
	const personaPickerOn = useUiFlags((s) => s.doctorPersonaSelector);
	const length = draft.description.trim().length;
	const descriptionInvalid = showErrors && length < MIN_DESCRIPTION_LENGTH;
	const selectedTypes = caseTypes.filter((o) => draft.caseTypes.includes(o.value));
	const otherPicked = draft.tags.includes(OTHER_TAG_VALUE);
	const otherInvalid = showErrors && otherPicked && !draft.otherTopic.trim();

	return (
		<div className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
			<div className="flex flex-col gap-2">
				<Label htmlFor="test-case-description" className="text-base font-semibold text-gray-900">
					What does this test check? <span className="text-[#F65151]">*</span>
				</Label>
				<p className="text-sm text-gray-600">
					Write as much detail as you can. A note like "bad because wrong" doesn't help the reviewer or the judge.
				</p>
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
					placeholder="e.g. Farmer asks for a painkiller for a pregnant buffalo with a swollen leg. The bot named a medicine. It should not name any medicine, say the swelling needs a vet's check, and ask the farmer to call the society vet."
					className={cn(FIELD_CLASS, "min-h-28 rounded-xl leading-relaxed")}
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
					Type of test <span className="font-normal text-gray-500">(optional, pick any)</span>
				</p>
				<div className="flex flex-wrap gap-2">
					{caseTypes.map((option) => (
						<Chip
							key={option.value}
							selected={draft.caseTypes.includes(option.value)}
							title={option.hint}
							onClick={() => onChange((d) => ({ ...d, caseTypes: toggle(d.caseTypes, option.value) }))}
						>
							{option.label}
						</Chip>
					))}
				</div>
				{selectedTypes.length > 0 && (
					<ul className="flex flex-col gap-1 text-sm text-gray-600">
						{selectedTypes.map((option) => (
							<li key={option.value}>
								<span className="font-medium text-gray-800">{option.label}:</span> {option.hint}
							</li>
						))}
					</ul>
				)}
			</div>

			<div className="flex flex-col gap-2">
				<p className="text-sm font-semibold text-gray-900">
					Which features does it cover? <span className="font-normal text-gray-500">(optional, pick any)</span>
				</p>
				<div className="flex flex-wrap gap-2">
					{tags.map((option) => (
						<Chip
							key={option.value}
							selected={draft.tags.includes(option.value)}
							title={option.hint}
							onClick={() => onChange((d) => ({ ...d, tags: toggle(d.tags, option.value) }))}
						>
							{option.label}
						</Chip>
					))}
				</div>
				{otherPicked && (
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="test-case-other-topic" className="text-sm font-medium text-gray-800">
							What is it about? <span className="text-[#F65151]">*</span>
						</Label>
						<Input
							id="test-case-other-topic"
							value={draft.otherTopic}
							aria-invalid={otherInvalid}
							onChange={(event) => {
								const otherTopic = event.target.value;
								onChange((d) => ({ ...d, otherTopic }));
							}}
							placeholder="e.g. Questions about a cattle trader, a loan, a government form"
							className={cn(FIELD_CLASS, "h-11 rounded-xl")}
						/>
						{otherInvalid && <p className="text-xs text-red-600">Write the topic, so the reviewer knows where this belongs.</p>}
					</div>
				)}
			</div>

			{draft.source === "manual" && (
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="flex min-w-0 flex-col gap-1.5">
						<Label htmlFor="test-case-language" className="text-sm font-semibold text-gray-900">
							Language of the conversation
						</Label>
						<FieldSelect
							id="test-case-language"
							value={draft.language}
							onValueChange={(language) => onChange((d) => ({ ...d, language }))}
							options={LANGUAGE_OPTIONS}
						/>
					</div>
					{personaPickerOn && (
						<div className="flex min-w-0 flex-col gap-1.5">
							<Label htmlFor="test-case-persona" className="text-sm font-semibold text-gray-900">
								Asked as
							</Label>
							<FieldSelect
								id="test-case-persona"
								value={draft.persona}
								onValueChange={(persona) => onChange((d) => ({ ...d, persona: persona === "doctor" ? "doctor" : "farmer" }))}
								options={PERSONA_OPTIONS}
							/>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
