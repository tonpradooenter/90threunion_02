import ExcelJS from "exceljs";
import type { DemoData } from "./demo-types";
import { customerExportRows, exportHeading } from "./export-csv";

type Filters = Parameters<typeof customerExportRows>[1];
const widths = [39, 28, 20, 20, 31, 17, 23, 44, 24, 11, 22, 22, 19, 19, 25, 18];
const safeText = (value: string): string => /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;

export async function exportCustomerXlsx(data: DemoData, filters: Filters = {}): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SISAT 90";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("สถานะลูกค้า", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "landscape" },
  });
  sheet.columns = exportHeading.map((header, index) => ({ header, key: `c${index + 1}`, width: widths[index] }));
  sheet.autoFilter = { from: "A1", to: "P1" };
  sheet.getRow(1).height = 34;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { name: "Aptos", bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF102E60" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "FF03ACD4" } } };
  });
  const rows = customerExportRows(data, filters);
  for (const [index, values] of rows.entries()) {
    const row = sheet.addRow(values.map((value) => typeof value === "string" ? safeText(value) : value));
    const estimatedLines = values.reduce<number>((max, value, column) =>
      Math.max(max, Math.ceil(String(value ?? "").length / Math.max(10, widths[column] - 3))), 1);
    row.height = Math.min(409, Math.max(28, estimatedLines * 17 + 8));
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Aptos", size: 11, color: { argb: "FF173458" } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 ? "FFF1F7FC" : "FFFFFFFF" } };
      cell.border = { bottom: { style: "hair", color: { argb: "FFD8E5EF" } } };
    });
    for (const column of [10, 13, 14]) row.getCell(column).numFmt = '#,##0';
    const state = String(values[10] ?? "");
    if (state.includes("ยกเลิก") || state.includes("คืน")) {
      row.getCell(11).font = { name: "Aptos", size: 11, bold: true, color: { argb: "FFC93939" } };
    } else if (state.includes("ถือ")) {
      row.getCell(11).font = { name: "Aptos", size: 11, bold: true, color: { argb: "FF187B62" } };
    }
  }
  sheet.headerFooter.oddFooter = "SISAT 90 · &P / &N";
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}