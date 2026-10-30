import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, RotateCcw, Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { submitTestCase } from "@/lib/test-cases/api";
import { buildTemplateCsv, MAX_BULK_CASES, parseBulkCsv, type BulkCase } from "@/lib/test-cases/csv";
import { buildPayload, hasErrors } from "@/lib/test-cases/draft";
import { FEATURE_TAGS } from "@/lib/test-cases/taxonomy";

/* eslint-disable no-unused-vars */
type BulkUploadProps = {
	onFinished: (result: { submitted: number; failed: number }) => void;
};
/* eslint-enable no-unused-vars */

type RowStatus = "ready" | "invalid" | "submitting" | "submitted" | "failed";

const MAX_FILE_BYTES = 1024 * 1024;
const TAG_LABELS = new Map(FEATURE_TAGS.map((o) => [o.value, o.label]));

const STATUS_META: Record<RowStatus, { label: string; className: string }> = {
	ready: { label: "Ready", className: "bg-[#EEFFF4] text-[#017A38]" },
	invalid: { label: "Needs fixes", className: "bg-red-50 text-red-700" },
	submitting: { label: "Submitting…", className: "bg-gray-100 text-gray-700" },
	submitted: { label: "Submitted", className: "bg-[#EEFFF4] text-[#017A38]" },
	failed: { label: "Failed", className: "bg-red-50 text-red-700" }
};

function downloadTemplate() {
	const blob = new Blob([buildTemplateCsv()], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = "amul-ai-test-cases-template.csv";
	link.click();
	URL.revokeObjectURL(url);
}

export function BulkUpload({ onFinished }: BulkUploadProps) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [fileName, setFileName] = useState<string | null>(null);
	const [fileError, setFileError] = useState<string | null>(null);
	const [cases, setCases] = useState<BulkCase[]>([]);
	const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
	const [running, setRunning] = useState(false);
	const [dragging, setDragging] = useState(false);

	const reset = () => {
		setFileName(null);
		setFileError(null);
		setCases([]);
		setStatuses({});
		if (inputRef.current) inputRef.current.value = "";
	};

	const loadFile = async (file: File) => {
		reset();
		setFileName(file.name);
		if (/\.xlsx?$/i.test(file.name)) {
			setFileError("Excel files can't be read here yet. In Excel, use File → Save As → \"CSV UTF-8\" and upload that file.");
			return;
		}
		if (file.size > MAX_FILE_BYTES) {
			setFileError("The file is larger than 1 MB. Split it into smaller files.");
			return;
		}
		const result = parseBulkCsv(await file.text());
		if (result.fileError) {
			setFileError(result.fileError);
			return;
		}
		setCases(result.cases);
		setStatuses(
			Object.fromEntries(result.cases.map((c) => [c.caseId, hasErrors(c.issues) ? "invalid" : "ready"]))
		);
	};

	const readyIds = cases.filter((c) => statuses[c.caseId] === "ready" || statuses[c.caseId] === "failed").map((c) => c.caseId);
	const invalidCount = cases.filter((c) => statuses[c.caseId] === "invalid").length;
	const submittedCount = cases.filter((c) => statuses[c.caseId] === "submitted").length;

	// Same API as a single test case, called once per row; no bulk endpoint.
	const submitAll = async () => {
		setRunning(true);
		let submitted = 0;
		let failed = 0;
		for (const bulkCase of cases) {
			if (!readyIds.includes(bulkCase.caseId)) continue;
			setStatuses((s) => ({ ...s, [bulkCase.caseId]: "submitting" }));
			try {
				await submitTestCase(buildPayload(bulkCase.draft, { bulkCaseId: bulkCase.caseId }));
				submitted += 1;
				setStatuses((s) => ({ ...s, [bulkCase.caseId]: "submitted" }));
			} catch (error) {
				console.error(`Test case ${bulkCase.caseId} failed:`, error);
				failed += 1;
				setStatuses((s) => ({ ...s, [bulkCase.caseId]: "failed" }));
			}
		}
		setRunning(false);
		onFinished({ submitted, failed });
	};

	return (
		<div className="flex flex-col gap-4">
			<section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
				<h2 className="text-base font-semibold text-gray-900">1. Fill in the template</h2>
				<ul className="flex flex-col gap-1 text-sm text-gray-600">
					<li>
						<span className="font-medium text-gray-800">One row per message.</span> Rows with the same{" "}
						<code className="rounded bg-gray-100 px-1">case_id</code> make one test case.
					</li>
					<li>
						<code className="rounded bg-gray-100 px-1">role</code> is <code className="rounded bg-gray-100 px-1">user</code> for
						the farmer's question and <code className="rounded bg-gray-100 px-1">assistant</code> for the bot's answer.
					</li>
					<li>
						Write the <code className="rounded bg-gray-100 px-1">description</code> (required),{" "}
						<code className="rounded bg-gray-100 px-1">case_type</code> and{" "}
						<code className="rounded bg-gray-100 px-1">tags</code> once, on the first row of each case. Separate tags with{" "}
						<code className="rounded bg-gray-100 px-1">;</code>
					</li>
				</ul>
				<Button
					type="button"
					variant="outline"
					onClick={downloadTemplate}
					className="min-h-11 self-start rounded-full border-[#019444] text-[#017A38] hover:bg-[#EEFFF4] hover:text-[#017A38]"
				>
					<Download className="size-4" />
					Download template (CSV)
				</Button>
			</section>

			<section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
				<h2 className="text-base font-semibold text-gray-900">2. Upload it</h2>
				<label
					onDragOver={(event) => {
						event.preventDefault();
						setDragging(true);
					}}
					onDragLeave={() => setDragging(false)}
					onDrop={(event) => {
						event.preventDefault();
						setDragging(false);
						const file = event.dataTransfer.files[0];
						if (file && !running) void loadFile(file);
					}}
					className={cn(
						"flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
						dragging ? "border-[#F65151] bg-[#FFE2E2]/50" : "border-gray-300 hover:border-[#F65151]/60",
						running && "pointer-events-none opacity-60"
					)}
				>
					{fileName ? <FileSpreadsheet className="size-8 text-[#F65151]" /> : <Upload className="size-8 text-[#F65151]" />}
					<span className="text-sm font-medium text-gray-800">{fileName ?? "Choose a CSV file or drop it here"}</span>
					<span className="text-xs text-gray-500">CSV, up to 1 MB and {MAX_BULK_CASES} test cases</span>
					<input
						ref={inputRef}
						type="file"
						accept=".csv,text/csv"
						className="sr-only"
						disabled={running}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (file) void loadFile(file);
						}}
					/>
				</label>
				{fileError && (
					<div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
						<AlertCircle className="mt-0.5 size-4 shrink-0" />
						{fileError}
					</div>
				)}
			</section>

			{cases.length > 0 && (
				<section className="flex flex-col gap-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div>
							<h2 className="text-base font-semibold text-gray-900">3. Check and submit</h2>
							<p className="text-sm text-gray-500">
								{cases.length} test case{cases.length === 1 ? "" : "s"} found
								{invalidCount > 0 && ` · ${invalidCount} need${invalidCount === 1 ? "s" : ""} fixes in the file`}
								{submittedCount > 0 && ` · ${submittedCount} submitted`}
							</p>
						</div>
						<Button type="button" variant="ghost" size="sm" onClick={reset} disabled={running} className="text-gray-600">
							<RotateCcw className="size-4" />
							Start over
						</Button>
					</div>

					<ul className="flex flex-col gap-2">
						{cases.map((bulkCase) => {
							const status = statuses[bulkCase.caseId] ?? "ready";
							const meta = STATUS_META[status];
							const firstQuestion = bulkCase.draft.turns.find((t) => t.role === "user")?.content;
							const errors = bulkCase.issues.filter((i) => i.level === "error");
							return (
								<li key={bulkCase.caseId} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
									<div className="flex items-start gap-3">
										<div className="min-w-0 flex-1">
											<p className="text-xs text-gray-500">
												Case {bulkCase.caseId} · {bulkCase.draft.turns.length} message
												{bulkCase.draft.turns.length === 1 ? "" : "s"}
											</p>
											<p className="line-clamp-2 text-sm font-medium text-gray-900">
												{firstQuestion || <span className="text-gray-400">No farmer question</span>}
											</p>
											{bulkCase.draft.tags.length > 0 && (
												<div className="mt-1.5 flex flex-wrap gap-1">
													{bulkCase.draft.tags.map((tag) => (
														<span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
															{TAG_LABELS.get(tag) ?? tag}
														</span>
													))}
												</div>
											)}
										</div>
										<span
											className={cn(
												"inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
												meta.className
											)}
										>
											{status === "submitting" && <Loader2 className="size-3 animate-spin" />}
											{status === "submitted" && <CheckCircle2 className="size-3" />}
											{meta.label}
										</span>
									</div>
									{status === "invalid" && errors.length > 0 && (
										<ul className="mt-2 flex flex-col gap-1 border-t border-gray-100 pt-2 text-sm text-red-700">
											{errors.map((issue) => (
												<li key={`${issue.turnId ?? ""}${issue.message}`} className="flex gap-1.5">
													<AlertCircle className="mt-0.5 size-3.5 shrink-0" />
													{issue.message}
												</li>
											))}
										</ul>
									)}
								</li>
							);
						})}
					</ul>

					<div className="sticky bottom-0 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
						<Button
							type="button"
							onClick={submitAll}
							disabled={running || readyIds.length === 0}
							className="min-h-12 w-full rounded-full bg-[#F65151] text-base font-semibold text-white hover:bg-[#D93B3B]"
						>
							{running ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
							{running
								? "Submitting…"
								: readyIds.length > 0
									? `Submit ${readyIds.length} test case${readyIds.length === 1 ? "" : "s"}`
									: invalidCount > 0
										? "Fix the file and upload it again"
										: "All submitted"}
						</Button>
					</div>
				</section>
			)}
		</div>
	);
}
