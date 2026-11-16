import { Fragment, useEffect, useMemo, useState } from "react";
import {
	AlertCircle,
	Bot,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Loader2,
	RefreshCw,
	Search,
	User,
	X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { LANGUAGES } from "@/components/screens-component/chat-screen/config";
import { cn } from "@/lib/utils";
import {
	DATE_RANGES,
	EMPTY_FILTERS,
	fetchDataset,
	filterChoices,
	filterRows,
	hasFilters,
	NOT_LABELLED,
	optionLabel,
	PAGE_SIZES,
	pageNumbers,
	TURN_RANGES,
	type DatasetFilters,
	type DatasetRow
} from "@/lib/test-cases/dataset";
import type { TestCaseOptions } from "@/lib/test-cases/options";
import type { TestCaseOption } from "@/lib/test-cases/types";
import { FieldSelect } from "./field-select";

// Radix Select can't hold an empty value, so "no filter" has a value of its own.
const ANY = "any";
// A cap for the two text filters, which only filter the cases already loaded.
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

type MultiKey = "caseTypes";
type SelectKey = Exclude<keyof DatasetFilters, "q" | "question" | MultiKey>;
/* eslint-disable no-unused-vars */
type Column = {
	key: string;
	title: string;
	// Fixed, so filtering doesn't resize the columns. Space beyond the sum is shared
	// out in proportion, so Question grows with the screen without taking all of it.
	width?: string;
	// The column's filter: one choice, several (any of them), or, for Question, a text box.
	filter?:
		| { key: SelectKey; choices: Array<{ value: string; label: string }> }
		| { key: MultiKey; multi: true; choices: Array<{ value: string; label: string }> };
	cell: (row: DatasetRow) => React.ReactNode;
};
/* eslint-enable no-unused-vars */

const dash = <span className="text-gray-400">—</span>;
// A case the labeller hasn't reached yet has no label, so the cell stays empty.
const notLabelled = dash;

// One line, so every row keeps the same height: the first chip and a "+N" for the rest.
// The full list is in the title and in the opened row.
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
	const labels = ids.map((id) => optionLabel(list, id));
	return (
		<div className="flex min-w-0 items-center gap-1" title={labels.join(", ")}>
			<span
				className={cn(
					"min-w-0 truncate rounded-full px-2 py-0.5 text-xs",
					tone === "type" ? "bg-[#FFE2E2] text-[#C53030]" : "bg-gray-100 text-gray-700"
				)}
			>
				{labels[0]}
			</span>
			{labels.length > 1 && (
				<span className="shrink-0 rounded-full border border-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
					+{labels.length - 1}
				</span>
			)}
		</div>
	);
}

// Plain text cut to one line; the whole value is in the title.
function Line({ value, empty = dash }: { value: string; empty?: React.ReactNode }) {
	return value ? (
		<span className="block truncate" title={value}>
			{value}
		</span>
	) : (
		<>{empty}</>
	);
}

// A column filter that picks several values; a case with any of them matches.
function MultiFilter({
	id,
	title,
	value,
	choices,
	onChange
}: {
	id: string;
	title: string;
	value: string[];
	choices: Array<{ value: string; label: string }>;
	// eslint-disable-next-line no-unused-vars
	onChange: (value: string[]) => void;
}) {
	const first = choices.find((choice) => value.includes(choice.value))?.label ?? value[0];
	const summary =
		value.length === 0 ? "All" : value.length === 1 ? first : `${value.length} selected`;
	return (
		<Popover>
			<PopoverTrigger
				id={id}
				aria-label={`Filter by ${title.toLowerCase()}`}
				className={cn(
					"flex h-9 w-full min-w-0 cursor-pointer items-center justify-between gap-1 rounded-lg border bg-white px-3 text-left text-sm text-gray-900 transition-colors outline-none hover:border-[#F65151]/60 focus-visible:border-[#F65151] focus-visible:ring-[3px] focus-visible:ring-[#F65151]/20 data-[state=open]:border-[#F65151]",
					value.length > 0 ? "border-[#F65151]/60" : "border-gray-200"
				)}
			>
				<span className="truncate">{summary}</span>
				<ChevronDown className="size-4 shrink-0 opacity-50" />
			</PopoverTrigger>
			<PopoverContent
				align="start"
				collisionPadding={12}
				className="w-64 rounded-xl border-gray-200 bg-white p-1 shadow-lg"
			>
				<div className="max-h-72 overflow-y-auto">
					{choices.map((choice) => {
						const checkboxId = `${id}-${choice.value}`;
						const checked = value.includes(choice.value);
						return (
							<label
								key={choice.value}
								htmlFor={checkboxId}
								className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-[15px] text-gray-800 hover:bg-[#FFE2E2]/60"
							>
								<Checkbox
									id={checkboxId}
									checked={checked}
									onCheckedChange={(next) =>
										onChange(
											next === true
												? [...value, choice.value]
												: value.filter((v) => v !== choice.value)
										)
									}
									className="border-gray-300 data-[state=checked]:border-[#F65151] data-[state=checked]:bg-[#F65151] data-[state=checked]:text-white"
								/>
								<span className="min-w-0 flex-1 truncate">{choice.label}</span>
							</label>
						);
					})}
				</div>
				{value.length > 0 && (
					<button
						type="button"
						onClick={() => onChange([])}
						className="mt-1 w-full cursor-pointer rounded-lg border-t border-gray-100 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
					>
						Clear
					</button>
				)}
			</PopoverContent>
		</Popover>
	);
}

function formatDate(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? ""
		: date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function Turns({
	row,
	details
}: {
	row: DatasetRow;
	details: Array<{ label: string; value: string }>;
}) {
	const shownDetails = details.filter((detail) => detail.value);
	return (
		<div className="flex flex-col gap-3 px-1 py-2">
			{shownDetails.length > 0 && (
				<dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
					{shownDetails.map((detail) => (
						<div key={detail.label} className="flex gap-1.5">
							<dt className="font-semibold text-gray-900">{detail.label}:</dt>
							<dd className="text-gray-700">{detail.value}</dd>
						</div>
					))}
				</dl>
			)}
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
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(PAGE_SIZES[0] ?? 10);

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
	// New filters or a new page size start again at page 1.
	useEffect(() => setPage(1), [filters, pageSize]);
	const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
	const current = Math.min(page, pageCount);
	const pageRows = shown.slice((current - 1) * pageSize, current * pageSize);
	const filtered = hasFilters(filters);
	const setList = (key: MultiKey) => (value: string[]) =>
		setFilters((current) => ({ ...current, [key]: value }));
	const setFilter = (key: Exclude<keyof DatasetFilters, MultiKey>) => (value: string) =>
		setFilters((current) => ({ ...current, [key]: value === ANY ? "" : value }));
	// The text boxes keep what is typed, "any" too; only the selects use ANY for "All".
	const setText = (key: "q" | "question") => (value: string) =>
		setFilters((current) => ({ ...current, [key]: value }));

	const testers: TestCaseOption[] = options.testers.map((t) => ({
		value: t.id,
		label: t.label,
		hint: ""
	}));
	const unlabelled = { value: NOT_LABELLED, label: "No label yet" };
	const isCategory = (id: string) => options.categories.some((option) => option.value === id);

	const columns: Column[] = [
		{
			key: "category",
			title: "Category",
			width: "10rem",
			filter: {
				key: "category",
				choices: [
					...filterChoices(
						options.categories,
						rows.map((r) => r.category)
					),
					unlabelled
				]
			},
			// The feature the labeller filed the case under. Until it has run, the features
			// the tester tagged stand in, as chips: the same ones the filter finds it under.
			cell: (row) =>
				row.category ? (
					<Line value={optionLabel(options.categories, row.category)} />
				) : (
					<Chips ids={row.tags.filter(isCategory)} list={options.categories} tone="tag" />
				)
		},
		{
			key: "question",
			title: "Question",
			width: "16rem",
			cell: (row) => (
				<span className="line-clamp-2 break-words text-gray-900" title={row.question}>
					{row.question || dash}
				</span>
			)
		},
		{
			key: "answerType",
			title: "Answer type",
			width: "7.5rem",
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
			cell: (row) => (
				<Line
					value={row.answerType ? optionLabel(options.answerTypes, row.answerType) : ""}
					empty={notLabelled}
				/>
			)
		},
		{
			key: "caseType",
			title: "Case type",
			width: "7.5rem",
			filter: {
				key: "caseTypes",
				multi: true,
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
			width: "5.5rem",
			filter: { key: "turns", choices: TURN_RANGES },
			cell: (row) => row.questionCount
		},
		{
			key: "tester",
			title: "Tester",
			width: "6rem",
			filter: {
				key: "tester",
				choices: filterChoices(
					testers,
					rows.map((r) => r.tester)
				)
			},
			cell: (row) => <Line value={row.tester ? optionLabel(testers, row.tester) : ""} />
		},
		{
			key: "source",
			title: "Source",
			width: "6.5rem",
			filter: {
				key: "source",
				choices: filterChoices(
					SOURCE_OPTIONS,
					rows.map((r) => r.source)
				)
			},
			cell: (row) => <Line value={row.source ? optionLabel(SOURCE_OPTIONS, row.source) : ""} />
		},
		{
			key: "persona",
			title: "Persona",
			width: "5.5rem",
			filter: {
				key: "persona",
				choices: filterChoices(
					PERSONA_OPTIONS,
					rows.map((r) => r.persona)
				)
			},
			cell: (row) => <Line value={row.persona ? optionLabel(PERSONA_OPTIONS, row.persona) : ""} />
		},
		{
			key: "language",
			title: "Language",
			width: "6.5rem",
			filter: {
				key: "language",
				choices: filterChoices(
					LANGUAGE_OPTIONS,
					rows.map((r) => r.language)
				)
			},
			cell: (row) => (
				<Line value={row.language ? optionLabel(LANGUAGE_OPTIONS, row.language) : ""} />
			)
		},
		{
			key: "date",
			title: "Date",
			width: "7rem",
			filter: { key: "date", choices: DATE_RANGES },
			cell: (row) => <Line value={formatDate(row.receivedAt)} />
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
						onChange={(event) => setText("q")(event.target.value)}
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
						{/* table-fixed: column widths come from the colgroup, not from the rows shown,
						    so the columns stay put as filters change. */}
						<table className="w-full min-w-[78rem] table-fixed border-collapse text-left text-sm">
							<colgroup>
								{columns.map((column) => (
									<col
										key={column.key}
										style={column.width ? { width: column.width } : undefined}
									/>
								))}
							</colgroup>
							<thead className="bg-gray-50 text-xs text-gray-600">
								<tr>
									{columns.map((column) => (
										<th
											key={column.key}
											scope="col"
											className="truncate px-3 pt-3 pb-1 font-semibold"
										>
											{column.title}
										</th>
									))}
								</tr>
								<tr className="border-b border-gray-200">
									{columns.map((column) => (
										<td key={column.key} className="px-3 pb-3">
											{column.filter && "multi" in column.filter ? (
												<MultiFilter
													id={`dataset-filter-${column.key}`}
													title={column.title}
													value={filters[column.filter.key]}
													choices={column.filter.choices}
													onChange={setList(column.filter.key)}
												/>
											) : column.filter ? (
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
													onChange={(event) => setText("question")(event.target.value)}
													placeholder="Filter questions"
													className="h-9 rounded-lg border-gray-200 bg-white text-sm shadow-none placeholder:text-gray-400 focus-visible:border-[#F65151] focus-visible:ring-[#F65151]/20"
												/>
											)}
										</td>
									))}
								</tr>
							</thead>
							<tbody>
								{pageRows.map((row) => {
									const open = openId === row.id;
									return (
										<Fragment key={row.id}>
											<tr
												onClick={() => setOpenId(open ? null : row.id)}
												className={cn(
													// One height for every row: text is cut to one line (two for Question).
													"h-16 cursor-pointer border-b border-gray-100 align-middle hover:bg-[#FFE2E2]/30",
													open && "bg-[#FFE2E2]/30"
												)}
											>
												{columns.map((column) => (
													<td key={column.key} className="overflow-hidden px-3 py-2 text-gray-700">
														{column.key === "question" ? (
															// The button gives the row a keyboard and screen-reader handle.
															<button
																type="button"
																aria-expanded={open}
																onClick={(event) => {
																	event.stopPropagation();
																	setOpenId(open ? null : row.id);
																}}
																className="flex w-full min-w-0 cursor-pointer items-start gap-1.5 text-left"
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
														<Turns
															row={row}
															details={[
																{
																	label: "Tags",
																	value: row.tags
																		.map((id) => optionLabel(options.tags, id))
																		.join(", ")
																},
																{
																	label: "Case type",
																	value: row.caseTypes
																		.map((id) => optionLabel(options.caseTypes, id))
																		.join(", ")
																},
																{
																	label: "Category",
																	value: row.category
																		? optionLabel(options.categories, row.category)
																		: ""
																},
																{
																	label: "Answer type",
																	value: row.answerType
																		? optionLabel(options.answerTypes, row.answerType)
																		: ""
																}
															]}
														/>
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
					) : (
						<nav
							aria-label="Pages"
							className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 px-3 py-2.5 text-sm text-gray-600"
						>
							<p>
								{(current - 1) * pageSize + 1}–{Math.min(current * pageSize, shown.length)} of{" "}
								{shown.length}
							</p>
							<div className="flex items-center gap-2">
								<span id="dataset-page-size-label">Rows per page</span>
								<FieldSelect
									id="dataset-page-size"
									ariaLabel="Rows per page"
									value={String(pageSize)}
									onValueChange={(value) => setPageSize(Number(value))}
									options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
									className="w-20 rounded-lg text-sm data-[size=default]:h-9"
								/>
							</div>
							<div className="ml-auto flex items-center gap-1">
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label="Previous page"
									disabled={current === 1}
									onClick={() => setPage(current - 1)}
									className="size-9 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
								>
									<ChevronLeft className="size-4" />
								</Button>
								{pageNumbers(current, pageCount).map((n, i) =>
									n === "gap" ? (
										<span key={`gap-${i}`} className="px-1 text-gray-400">
											…
										</span>
									) : (
										<Button
											key={n}
											type="button"
											variant="ghost"
											size="sm"
											aria-label={`Page ${n}`}
											aria-current={n === current ? "page" : undefined}
											onClick={() => setPage(n)}
											className={cn(
												"size-9 p-0 tabular-nums",
												n === current
													? "bg-[#FFE2E2] font-semibold text-[#C53030] hover:bg-[#FFE2E2] hover:text-[#C53030]"
													: "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
											)}
										>
											{n}
										</Button>
									)
								)}
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label="Next page"
									disabled={current === pageCount}
									onClick={() => setPage(current + 1)}
									className="size-9 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
								>
									<ChevronRight className="size-4" />
								</Button>
							</div>
						</nav>
					)}
				</section>
			)}
		</div>
	);
}
