import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bot, ChevronDown, Loader2, Search, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LANGUAGES } from "@/components/screens-component/chat-screen/config";
import { cn } from "@/lib/utils";
import {
	EMPTY_FILTERS,
	fetchCoverage,
	fetchDatasetPage,
	type Coverage,
	type CoverageCount,
	type DatasetCase,
	type DatasetFilters
} from "@/lib/test-cases/dataset";
import type { TestCaseOptions } from "@/lib/test-cases/options";
import { FieldSelect } from "./field-select";

// Radix Select can't hold an empty value, so "no filter" has a value of its own.
const ANY = "any";
const SEARCH_DELAY_MS = 300;
// The list route answers 422 to a longer search.
const MAX_SEARCH_LENGTH = 200;

const SOURCE_LABELS: Record<string, string> = {
	chat: "From chat",
	manual: "Written",
	bulk: "Bulk upload"
};
const LANGUAGE_LABELS: Record<string, string> = Object.fromEntries(
	Object.values(LANGUAGES).map(({ code, name }) => [code, name])
);

const anyOption = { value: ANY, label: "Any" };
const toOptions = (labels: Record<string, string>) => [
	anyOption,
	...Object.entries(labels).map(([value, label]) => ({ value, label }))
];

// page: the page being loaded, so Try again asks for the same one.
type Load = { status: "loading" | "ready" | "error"; error?: string; page?: number };

const errorText = (error: unknown) =>
	error instanceof Error ? error.message : "Something went wrong. Try again.";

function toggle(list: string[], value: string): string[] {
	return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

// One chip per tag or type, with its count. A zero is the gap the team wants to see,
// so it is set apart; a click filters the list by it.
function CoverageChips({
	title,
	counts,
	selected,
	onToggle
}: {
	title: string;
	counts: CoverageCount[];
	selected: string[];
	// eslint-disable-next-line no-unused-vars
	onToggle: (id: string) => void;
}) {
	return (
		<div className="flex flex-col gap-2">
			<p className="text-sm font-semibold text-gray-900">{title}</p>
			<div className="flex flex-wrap gap-2">
				{counts.map(({ id, label, count }) => {
					const on = selected.includes(id);
					return (
						<button
							key={id}
							type="button"
							aria-pressed={on}
							onClick={() => onToggle(id)}
							className={cn(
								"inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
								on
									? "border-[#F65151] bg-[#FFE2E2] font-medium text-[#C53030]"
									: count === 0
										? "border-dashed border-gray-300 bg-white text-gray-500 hover:border-[#F65151]/60"
										: "border-gray-200 bg-white text-gray-700 hover:border-[#F65151]/60"
							)}
						>
							{label}
							<span
								className={cn(
									"rounded-full px-1.5 text-xs font-semibold",
									on
										? "bg-white text-[#C53030]"
										: count === 0
											? "bg-amber-100 text-amber-800"
											: "bg-gray-100 text-gray-700"
								)}
							>
								{count}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}

function CaseCard({
	item,
	labels
}: {
	item: DatasetCase;
	labels: { tags: Map<string, string>; types: Map<string, string>; testers: Map<string, string> };
}) {
	const [open, setOpen] = useState(false);
	const questions = item.turns.filter((turn) => turn.role === "user").length;
	const date = new Date(item.received_at);
	const meta = [
		labels.testers.get(item.submitted_by) ?? item.submitted_by,
		Number.isNaN(date.getTime())
			? null
			: date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
		SOURCE_LABELS[item.source] ?? item.source,
		item.persona === "doctor" ? "Doctor" : "Farmer",
		LANGUAGE_LABELS[item.language] ?? item.language,
		`${questions} question${questions === 1 ? "" : "s"}`
	].filter(Boolean);
	const chips = [
		...item.case_types.map((id) => ({
			id: `type-${id}`,
			label: labels.types.get(id) ?? id,
			kind: "type" as const
		})),
		...item.tags.map((id) => ({
			id: `tag-${id}`,
			label: labels.tags.get(id) ?? id,
			kind: "tag" as const
		}))
	];

	return (
		<li className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
				className="flex w-full cursor-pointer items-start gap-3 text-left"
			>
				<div className="min-w-0 flex-1">
					<p className="text-xs text-gray-500">{meta.join(" · ")}</p>
					<p className={cn("mt-0.5 text-sm font-medium text-gray-900", !open && "line-clamp-2")}>
						{item.description}
					</p>
					{item.other_topic && (
						<p className="mt-0.5 text-xs text-gray-600">Topic: {item.other_topic}</p>
					)}
					{chips.length > 0 && (
						<div className="mt-1.5 flex flex-wrap gap-1">
							{chips.map((chip) => (
								<span
									key={chip.id}
									className={cn(
										"rounded-full px-2 py-0.5 text-xs",
										chip.kind === "type"
											? "bg-[#FFE2E2] text-[#C53030]"
											: "bg-gray-100 text-gray-700"
									)}
								>
									{chip.label}
								</span>
							))}
						</div>
					)}
				</div>
				<ChevronDown
					className={cn(
						"mt-1 size-5 shrink-0 text-gray-400 transition-transform",
						open && "rotate-180"
					)}
				/>
			</button>
			{open && (
				<ol className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
					{item.turns.map((turn, index) => {
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
									<p className="break-words whitespace-pre-wrap text-gray-800">{turn.content}</p>
									{turn.original_content !== undefined && (
										<p className="mt-1 text-xs break-words whitespace-pre-wrap text-gray-500">
											<span className="font-medium text-amber-800">Bot said:</span>{" "}
											{turn.original_content}
										</p>
									)}
								</div>
							</li>
						);
					})}
				</ol>
			)}
		</li>
	);
}

export function DatasetView({ options }: { options: TestCaseOptions }) {
	const [filters, setFilters] = useState<DatasetFilters>(EMPTY_FILTERS);
	const [search, setSearch] = useState("");
	const [coverage, setCoverage] = useState<Coverage | null>(null);
	const [coverageLoad, setCoverageLoad] = useState<Load>({ status: "loading" });
	const [items, setItems] = useState<DatasetCase[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [listLoad, setListLoad] = useState<Load>({ status: "loading" });
	// Only the latest request may fill the list, so a slow answer to old filters can't
	// overwrite a newer one.
	const requestRef = useRef(0);

	const labels = {
		tags: new Map(options.tags.map((o) => [o.value, o.label])),
		types: new Map(options.caseTypes.map((o) => [o.value, o.label])),
		testers: new Map(options.testers.map((t) => [t.id, t.label]))
	};

	const loadCoverage = () => {
		setCoverageLoad({ status: "loading" });
		fetchCoverage()
			.then((result) => {
				setCoverage(result);
				setCoverageLoad({ status: "ready" });
			})
			.catch((error: unknown) => setCoverageLoad({ status: "error", error: errorText(error) }));
	};

	// Page 1 is a new list (new filters, or the first load): the old cases go at once, so
	// a later page can't land under cases from other filters. Other pages add to it.
	const loadPage = (nextPage: number) => {
		const request = ++requestRef.current;
		if (nextPage === 1) {
			setItems([]);
			setTotal(0);
		}
		setListLoad({ status: "loading", page: nextPage });
		fetchDatasetPage(filters, nextPage)
			.then((result) => {
				if (request !== requestRef.current) return;
				setItems((current) => (nextPage === 1 ? result.items : [...current, ...result.items]));
				setTotal(result.total);
				setPage(nextPage);
				setListLoad({ status: "ready" });
			})
			.catch((error: unknown) => {
				if (request === requestRef.current)
					setListLoad({ status: "error", error: errorText(error), page: nextPage });
			});
	};

	useEffect(loadCoverage, []);

	useEffect(() => loadPage(1), [filters]);

	// The text box waits for a pause in typing before it searches.
	useEffect(() => {
		const timer = setTimeout(
			() => setFilters((current) => (current.q === search ? current : { ...current, q: search })),
			SEARCH_DELAY_MS
		);
		return () => clearTimeout(timer);
	}, [search]);

	const setFilter = (key: "source" | "persona" | "language" | "submittedBy") => (value: string) =>
		setFilters((current) => ({ ...current, [key]: value === ANY ? "" : value }));

	const filtered =
		filters.tags.length + filters.caseTypes.length > 0 ||
		Boolean(
			filters.source || filters.persona || filters.language || filters.submittedBy || filters.q
		);

	const clearFilters = () => {
		setSearch("");
		setFilters(EMPTY_FILTERS);
	};

	return (
		<div className="flex flex-col gap-4 pb-6">
			<section className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
				<div>
					<h2 className="text-base font-semibold text-gray-900">What's covered</h2>
					<p className="text-sm text-gray-600">
						See which features and types already have cases before you add new ones. Tap one to see
						its cases.
					</p>
				</div>
				{coverageLoad.status === "error" ? (
					<div
						role="alert"
						className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
					>
						<AlertCircle className="size-4 shrink-0" />
						<span className="min-w-0 flex-1">{coverageLoad.error}</span>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={loadCoverage}
							className="text-red-800 hover:bg-red-100 hover:text-red-900"
						>
							Try again
						</Button>
					</div>
				) : !coverage ? (
					<p className="flex items-center gap-2 text-sm text-gray-500">
						<Loader2 className="size-4 animate-spin" /> Loading the counts…
					</p>
				) : (
					<>
						<p className="text-sm text-gray-700">
							<span className="font-semibold text-gray-900">{coverage.total}</span> case
							{coverage.total === 1 ? "" : "s"} in the dataset
							{coverage.untagged > 0 && `, ${coverage.untagged} with no feature tag`}. Features with{" "}
							<span className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800">
								0
							</span>{" "}
							have no cases yet.
						</p>
						<CoverageChips
							title="Features"
							counts={coverage.tags}
							selected={filters.tags}
							onToggle={(id) =>
								setFilters((current) => ({ ...current, tags: toggle(current.tags, id) }))
							}
						/>
						<CoverageChips
							title="Types of test"
							counts={coverage.case_types}
							selected={filters.caseTypes}
							onToggle={(id) =>
								setFilters((current) => ({ ...current, caseTypes: toggle(current.caseTypes, id) }))
							}
						/>
					</>
				)}
			</section>

			<section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
				<div className="relative">
					<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
					<Input
						type="search"
						aria-label="Search the description and the conversation"
						value={search}
						maxLength={MAX_SEARCH_LENGTH}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search the description and the conversation"
						className="h-11 rounded-xl border-gray-200 bg-white pl-9 text-[15px] shadow-none placeholder:text-gray-400 focus-visible:border-[#F65151] focus-visible:ring-[#F65151]/20"
					/>
				</div>
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					<div className="flex min-w-0 flex-col gap-1.5">
						<Label htmlFor="dataset-tester" className="text-xs font-medium text-gray-600">
							Tester
						</Label>
						<FieldSelect
							id="dataset-tester"
							value={filters.submittedBy || ANY}
							onValueChange={setFilter("submittedBy")}
							options={[
								anyOption,
								...options.testers.map((t) => ({ value: t.id, label: t.label }))
							]}
						/>
					</div>
					<div className="flex min-w-0 flex-col gap-1.5">
						<Label htmlFor="dataset-source" className="text-xs font-medium text-gray-600">
							Added from
						</Label>
						<FieldSelect
							id="dataset-source"
							value={filters.source || ANY}
							onValueChange={setFilter("source")}
							options={toOptions(SOURCE_LABELS)}
						/>
					</div>
					<div className="flex min-w-0 flex-col gap-1.5">
						<Label htmlFor="dataset-persona" className="text-xs font-medium text-gray-600">
							Asked as
						</Label>
						<FieldSelect
							id="dataset-persona"
							value={filters.persona || ANY}
							onValueChange={setFilter("persona")}
							options={toOptions({ farmer: "Farmer", doctor: "Doctor" })}
						/>
					</div>
					<div className="flex min-w-0 flex-col gap-1.5">
						<Label htmlFor="dataset-language" className="text-xs font-medium text-gray-600">
							Language
						</Label>
						<FieldSelect
							id="dataset-language"
							value={filters.language || ANY}
							onValueChange={setFilter("language")}
							options={toOptions(LANGUAGE_LABELS)}
						/>
					</div>
				</div>
				{filtered && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={clearFilters}
						className="self-start text-gray-600 hover:bg-gray-100 hover:text-gray-900"
					>
						<X className="size-4" />
						Clear filters
					</Button>
				)}
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-base font-semibold text-gray-900">
					Cases
					{listLoad.status !== "error" && items.length > 0 && (
						<span className="ml-1 text-sm font-normal text-gray-500">
							showing {items.length} of {total}
						</span>
					)}
				</h2>

				{items.length > 0 && (
					<ul className="flex flex-col gap-2">
						{items.map((item) => (
							<CaseCard key={item.id} item={item} labels={labels} />
						))}
					</ul>
				)}

				{listLoad.status === "error" ? (
					<div
						role="alert"
						className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
					>
						<AlertCircle className="size-4 shrink-0" />
						<span className="min-w-0 flex-1">{listLoad.error}</span>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => loadPage(listLoad.page ?? 1)}
							className="text-red-800 hover:bg-red-100 hover:text-red-900"
						>
							Try again
						</Button>
					</div>
				) : listLoad.status === "loading" ? (
					<p className="flex items-center gap-2 text-sm text-gray-500">
						<Loader2 className="size-4 animate-spin" /> Loading cases…
					</p>
				) : items.length === 0 ? (
					<div className="rounded-2xl border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-600 shadow-sm">
						{filtered ? "No cases match these filters." : "No cases in the dataset yet."}
					</div>
				) : items.length < total ? (
					<Button
						type="button"
						variant="outline"
						onClick={() => loadPage(page + 1)}
						className="min-h-11 self-center rounded-full border-[#F65151] bg-white px-6 text-[#F65151] hover:bg-[#FFE2E2] hover:text-[#D93B3B]"
					>
						Load more
					</Button>
				) : null}
			</section>
		</div>
	);
}
