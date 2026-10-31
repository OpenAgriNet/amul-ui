import { optionRows, templateRows } from "./csv";
import type { TestCaseOptions } from "./options";

// The Excel libraries are imported on use, so they only download when someone
// opens Bulk upload and not with the chat.

// Dates read as Date objects and numbers as numbers (a case_id of 1 is a number);
// the sheet parser wants text.
function cellToText(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (value instanceof Date) return value.toISOString();
	return String(value);
}

// The first sheet of an .xlsx file, as text rows with the header first.
export async function readXlsxRows(file: Blob): Promise<string[][]> {
	const { readSheet } = await import("read-excel-file/browser");
	const sheet = await readSheet(file);
	return sheet.map((row) => row.map(cellToText));
}

export async function downloadTemplateXlsx(options: TestCaseOptions): Promise<void> {
	const { default: writeExcelFile } = await import("write-excel-file/browser");
	await writeExcelFile(
		[
			{ sheet: "Test cases", data: templateRows(options), columns: [{ width: 9 }, { width: 11 }, { width: 60 }, { width: 60 }, { width: 24 }, { width: 24 }, { width: 24 }, { width: 10 }, { width: 10 }] },
			{ sheet: "Allowed values", data: optionRows(options), columns: [{ width: 12 }, { width: 26 }, { width: 80 }] }
		]
	).toFile("amul-ai-test-cases-template.xlsx");
}
