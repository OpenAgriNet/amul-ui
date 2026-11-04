import { Fragment, useEffect, useMemo, useState } from "react";
import { AlertCircle, Bot, ChevronDown, Loader2, RefreshCw, Search, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LANGUAGES } from "@/components/screens-component/chat-screen/config";
import { cn } from "@/lib/utils";
import {
	DATE_RANGES,
	EMPTY_FILTERS,
	fetchDataset,
	filterChoices,
	filterRows,
	NOT_LABELLED,
	optionLabel,
	TURN_RANGES,
	type DatasetFilters,
	type DatasetRow
} from "@/lib/test-cases/dataset";
import type { TestCaseOptions } from "@/lib/test-cases/options";
import type { TestCaseOption } from "@/lib/test-cases/types";
import { FieldSelect } from "./field-select";

// Radix Select can't hold an empty value, so "no filter" has a value of its own.
const ANY = "any";
// The search box is sent nowhere now, but the old list route answered 422 past this.
const MAX_SEARCH_LENGTH = 200;

const SOURCE_OPTIONS: TestCaseOption[] = [
	{ value: "chat", label: "From chat", hint: "" },
	{ value: "manual", label: "Written", hint: "" },
	{ value: "bulk", label: "Bulk upload", hint: "" }
];
const PERSONA_OPTIONS: TestCaseOption[] = [
	{ value: "farmer", label: "Farmer", hint: "" },
	{ value: "doctor", label: "Doctor", hint: "" }
];
const LANGUAGE_OPTIONS: TestCaseOption[] = Object.values(LANGUAGES).map(({ code, name }) => ({
	value: code,
	label: name,
	hint: ""
}));

type SelectKey = Exclude<keyof DatasetFilters, "q" | "question">;
/* eslint-disable no-unused-vars */
type Column = {
	key: string;
	title: string;
	className?: string;
	// The column's filter; Question has a text box instead.
	filter?: { key: SelectKey; choices: Array<{ value: string; label: string }> };
	cell: (row: DatasetRow) => React.ReactNode;
};
/* eslint-enable no-unused-vars */

const dash = <span className="text-gray-400">—</span>;
const notLabelled = <span className="text-xs text-gray-400 italic">Not labelled yet</span>;

function Chips({
	ids,
	list,
	tone
}: {
	ids: string[];
	list: TestCaseOption[];
	tone: "tag" | "type";
}) {
	if (ids.length === 0) return dash;
	return (
		<div className="flex flex-wrap gap-1">
			{ids.map((id) => (
				<span
					key={id}
					className={cn(
						"rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
						tone === "type" ? "bg-[#FFE2E2] text-[#C53030]" : "bg-gray-100 text-gray-700"
					)}
				>
					{optionLabel(list, id)}
				</span>
			))}
		</div>
	);
}

function formatDate(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? ""
		: date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function Turns({ row }: { row: DatasetRow }) {
	return (
		<div className="flex flex-col gap-3 px-1 py-2">
			{row.description && (
				<p className="text-sm text-gray-800">
					<span className="font-semibold text-gray-900">What it checks:</span> {row.description}
				</p>
			)}
			{row.otherTopic && (
				<p className="text-sm text-gray-700">
					<span className="font-semibold text-gray-900">Topic:</span> {row.otherTopic}
				</p>
			)}
			{row.turns.length === 0 ? (
				<p className="text-sm text-gray-500">This case has no turns.</p>
			) : (
				<ol className="flex max-w-4xl flex-col gap-2">
					{row.turns.map((turn, index) => {
						const Icon = turn.role === "user" ? User : Bot;
						return (
							<li key={index} className="flex gap-2 text-sm">
								<Icon
									className={cn(
										"mt-0.5 size-4 shrink-0",
										turn.role === "user" ? "text-[#017A38]" : "text-[#C53030]"
									)}
								/>
								<div className="min-w-0 flex-1">
									<p className="break-words whitespace-pre-wrap text-gray-800">
										{turn.content || dash}
									</p>
									{turn.originalContent !== undefined && (
										<p className="mt-1 text-xs break-words whitespace-pre-wrap text-gray-500">
											<span className="font-medium text-amber-800">Bot said:</span>{" "}
											{turn.originalContent}
										</p>
									)}
								</div>
							</li>
						);
					})}
				</ol>
			)}
		</div>
	);
}

export function DatasetView({ options }: { options: TestCaseOptions }) {
	const [rows, setRows] = useState<DatasetRow[]>([]);
	const [load, setLoad] = useState<{ status: "loading" | "ready" | "error"; error?: string }>({
		status: "loading"
	});
	const [filters, setFilters] = useState<DatasetFilters>(EMPTY_FILTERS);
	const [openId, setOpenId] = useState<string | null>(null);

	// Every case comes in one answer; the filters below run on it here.
	const loadRows = () => {
		setLoad({ status: "loading" });
		fetchDataset()
			.then((result) => {
				setRows(result);
				setLoad({ status: "ready" });
			})
			.catch((error: unknown) =>
				setLoad({
					status: "error",
					error: error instanceof Error ? error.message : "Couldn't load the dataset. Try again."
				})
			);
	};
	useEffect(loadRows, []);

	const shown = useMemo(() => filterRows(rows, filters), [rows, filters]);
	const filtered = Object.values(filters).some(Boolean);
	const setFilter = (key: keyof DatasetFilters) => (value: string) =>
		setFilters((current) => ({ ...current, [key]: value === ANY ? "" : value }));

	const testers: TestCaseOption[] = options.testers.map((t) => ({
		value: t.id,
		label: t.label,
		hint: ""
	}));
	const unlabelled = { value: NOT_LABELLED, label: "Not labelled yet" };

	const columns: Column[] = [
		{
			key: "group",
			title: "Category",
			className: "min-w-28",
			filter: {
				key: "group",
				choices: [
					...filterChoices(
						options.groups,
						rows.map((r) => r.group)
					),
					unlabelled
				]
			},
			cell: (row) => (row.group ? optionLabel(options.groups, row.group) : notLabelled)
		},
		{
			key: "tag",
			title: "Tag",
			className: "min-w-32",
			filter: {
				key: "tag",
				choices: filterChoices(
					options.tags,
					rows.flatMap((r) => r.tags)
				)
			},
			cell: (row) => <Chips ids={row.tags} list={options.tags} tone="tag" />
		},
		{
			key: "question",
			title: "Question",
			className: "min-w-56",
			cell: (row) => <span className="line-clamp-2 text-gray-900">{row.question || dash}</span>
		},
		{
			key: "answerType",
			title: "Answer type",
			className: "min-w-32",
			filter: {
				key: "answerType",
				choices: [
					...filterChoices(
						options.answerTypes,
						rows.map((r) => r.answerType)
					),
					unlabelled
				]
			},
			cell: (row) =>
				row.answerType ? optionLabel(options.answerTypes, row.answerType) : notLabelled
		},
		{
			key: "caseType",
			title: "Case type",
			className: "min-w-32",
			filter: {
				key: "caseType",
				choices: filterChoices(
					options.caseTypes,
					rows.flatMap((r) => r.caseTypes)
				)
			},
			cell: (row) => <Chips ids={row.caseTypes} list={options.caseTypes} tone="type" />
		},
		{
			key: "turns",
			title: "Turns",
			className: "min-w-24",
			filter: { key: "turns", choices: TURN_RANGES },
			cell: (row) => row.questionCount
		},
		{
			key: "tester",
			title: "Tester",
			className: "min-w-28",
			filter: {
				key: "tester",
				choices: filterChoices(
					testers,
					rows.map((r) => r.tester)
				)
			},
			cell: (row) => (row.tester ? optionLabel(testers, row.tester) : dash)
		},
		{
			key: "source",
			title: "Source",
			className: "min-w-28",
			filter: {
				key: "source",
				choices: filterChoices(
					SOURCE_OPTIONS,
					rows.map((r) => r.source)
				)
			},
			cell: (row) => (row.source ? optionLabel(SOURCE_OPTIONS, row.source) : dash)
		},
		{
			key: "persona",
			title: "Persona",
			className: "min-w-24",
			filter: {
				key: "persona",
				choices: filterChoices(
					PERSONA_OPTIONS,
					rows.map((r) => r.persona)
				)
			},
			cell: (row) => (row.persona ? optionLabel(PERSONA_OPTIONS, row.persona) : dash)
		},
		{
			key: "language",
			title: "Language",
			className: "min-w-28",
			filter: {
				key: "language",
				choices: filterChoices(
					LANGUAGE_OPTIONS,
					rows.map((r) => r.language)
				)
			},
			cell: (row) => (row.language ? optionLabel(LANGUAGE_OPTIONS, row.language) : dash)
		},
		{
			key: "date",
			title: "Date",
			className: "min-w-28",
			filter: { key: "date", choices: DATE_RANGES },
			cell: (row) => <span className="whitespace-nowrap">{formatDate(row.receivedAt) || dash}</span>
		}
	];

	return (
		<div className="flex flex-col gap-4 pb-6">
			<section className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
				<div className="relative min-w-0 flex-1 basis-64">
					<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
					<Input
						type="search"
						aria-label="Search the description and the conversation"
						value={filters.q}
						maxLength={MAX_SEARCH_LENGTH}
						onChange={(event) => setFilter("q")(event.target.value)}
						placeholder="Search the description and the conversation"
						className="h-11 rounded-xl border-gray-200 bg-white pl-9 text-[15px] shadow-none placeholder:text-gray-400 focus-visible:border-[#F65151] focus-visible:ring-[#F65151]/20"
					/>
				</div>
				<p className="text-sm text-gray-600">
					{load.status === "ready" &&
						(filtered ? `${shown.length} of ${rows.length} cases` : `${rows.length} cases`)}
				</p>
				{filtered && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => setFilters(EMPTY_FILTERS)}
						className="text-gray-600 hover:bg-gray-100 hover:text-gray-900"
					>
						<X className="size-4" />
						Clear filters
					</Button>
				)}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={loadRows}
					disabled={load.status === "loading"}
					className="text-gray-600 hover:bg-gray-100 hover:text-gray-900"
				>
					<RefreshCw className={cn("size-4", load.status === "loading" && "animate-spin")} />
					Refresh
				</Button>
			</section>

			{load.status === "error" ? (
				<div
					role="alert"
					className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
				>
					<AlertCircle className="size-4 shrink-0" />
					<span className="min-w-0 flex-1">{load.error}</span>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={loadRows}
						className="text-red-800 hover:bg-red-100 hover:text-red-900"
					>
						Try again
					</Button>
				</div>
			) : (
				<section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
					{/* Wide tables scroll inside the card, so the page itself never scrolls sideways. */}
					<div className="overflow-x-auto">
						<table className="w-full border-collapse text-left text-sm">
							<thead className="bg-gray-50 text-xs text-gray-600">
								<tr>
									{columns.map((column) => (
										<th
											key={column.key}
											scope="col"
											className={cn("px-3 pt-3 pb-1 font-semibold", column.className)}
										>
											{column.title}
										</th>
									))}
								</tr>
								<tr className="border-b border-gray-200">
									{columns.map((column) => (
										<td key={column.key} className="px-3 pb-3">
											{column.filter ? (
												<FieldSelect
													id={`dataset-filter-${column.key}`}
													ariaLabel={`Filter by ${column.title.toLowerCase()}`}
													value={filters[column.filter.key] || ANY}
													onValueChange={setFilter(column.filter.key)}
													options={[{ value: ANY, label: "All" }, ...column.filter.choices]}
													className="rounded-lg text-sm data-[size=default]:h-9"
												/>
											) : (
												<Input
													aria-label="Filter by question"
													value={filters.question}
													maxLength={MAX_SEARCH_LENGTH}
													onChange={(event) => setFilter("question")(event.target.value)}
													placeholder="Filter questions"
													className="h-9 rounded-lg border-gray-200 bg-white text-sm shadow-none placeholder:text-gray-400 focus-visible:border-[#F65151] focus-visible:ring-[#F65151]/20"
												/>
											)}
										</td>
									))}
								</tr>
							</thead>
							<tbody>
								{shown.map((row) => {
									const open = openId === row.id;
									return (
										<Fragment key={row.id}>
											<tr
												onClick={() => setOpenId(open ? null : row.id)}
												className={cn(
													"cursor-pointer border-b border-gray-100 align-top hover:bg-[#FFE2E2]/30",
													open && "bg-[#FFE2E2]/30"
												)}
											>
												{columns.map((column) => (
													<td key={column.key} className="px-3 py-2.5 text-gray-700">
														{column.key === "question" ? (
															// The button gives the row a keyboard and screen-reader handle.
															<button
																type="button"
																aria-expanded={open}
																onClick={(event) => {
																	event.stopPropagation();
																	setOpenId(open ? null : row.id);
																}}
																className="flex w-full cursor-pointer items-start gap-1.5 text-left"
															>
																<ChevronDown
																	className={cn(
																		"mt-0.5 size-4 shrink-0 text-gray-400 transition-transform",
																		open && "rotate-180"
																	)}
																/>
																{column.cell(row)}
															</button>
														) : (
															column.cell(row)
														)}
													</td>
												))}
											</tr>
											{open && (
												<tr className="border-b border-gray-100 bg-gray-50/60">
													<td colSpan={columns.length} className="px-4 py-2">
														<Turns row={row} />
													</td>
												</tr>
											)}
										</Fragment>
									);
								})}
							</tbody>
						</table>
					</div>
					{load.status === "loading" ? (
						<p className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-gray-500">
							<Loader2 className="size-4 animate-spin" /> Loading the dataset…
						</p>
					) : shown.length === 0 ? (
						<p className="px-4 py-8 text-center text-sm text-gray-600">
							{filtered ? "No cases match these filters." : "No cases in the dataset yet."}
						</p>
					) : null}
				</section>
			)}
		</div>
	);
}
