import { exampleRows, optionRows, SHEET_COLUMNS } from "./csv";
import type { TestCaseOptions } from "./options";

// Blank rows of the template that are ready for text, on top of the examples.
const TEMPLATE_BLANK_ROWS = 500;

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

// Every cell, blank ones too, is a text cell. Otherwise Excel turns something like
// 1/2 into a date as a tester types it. A column can't carry a format here, so the
// blank rows are written out.
const textCells = (rows: string[][]) => rows.map((row) => row.map((value) => ({ value, type: String, format: "@" })));

// The first sheet, the one that is read back: only the header and empty rows.
export function templateSheetData() {
	const blankRow = SHEET_COLUMNS.map(() => "");
	return textCells([[...SHEET_COLUMNS], ...Array.from({ length: TEMPLATE_BLANK_ROWS }, () => blankRow)]);
}

const CASE_COLUMNS = [{ width: 9 }, { width: 11 }, { width: 60 }, { width: 60 }, { width: 24 }, { width: 24 }, { width: 24 }, { width: 10 }, { width: 10 }];

export async function downloadTemplateXlsx(options: TestCaseOptions): Promise<void> {
	const { default: writeExcelFile } = await import("write-excel-file/browser");
	await writeExcelFile(
		[
			{ sheet: "Test cases", data: templateSheetData(), columns: CASE_COLUMNS },
			{ sheet: "Examples", data: textCells(exampleRows(options)), columns: CASE_COLUMNS },
			{ sheet: "Allowed values", data: optionRows(options), columns: [{ width: 12 }, { width: 26 }, { width: 80 }] }
		]
	).toFile("amul-ai-test-cases-template.xlsx");
}
