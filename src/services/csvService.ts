import Papa from "papaparse";
import { validateCsvMatrixData, CsvValidationResult, LocationRecord } from "../utils/validation";
import { ColumnSchema } from "../utils/normalizeHeaders";

/**
 * Parses a File object using PapaParse (2D matrix mode so duplicate headers like "Y" are preserved)
 * and validates all rows.
 */
export function parseAndValidateCsvFile(file: File): Promise<{
  validation: CsvValidationResult;
  rawCsvContent: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const rawCsvContent = String(e.target?.result || "");
      if (!rawCsvContent.trim()) {
        reject(new Error("File CSV kosong atau tidak memiliki isi."));
        return;
      }

      Papa.parse<string[]>(rawCsvContent, {
        header: false,
        skipEmptyLines: "greedy",
        complete: (results) => {
          try {
            const validation = validateCsvMatrixData(
              file.name,
              file.size,
              results.data || []
            );
            resolve({
              validation,
              rawCsvContent
            });
          } catch (err: any) {
            reject(
              new Error(
                err.message ||
                  "Header CSV tidak boleh kosong. Pastikan baris pertama berisi nama kolom."
              )
            );
          }
        },
        error: (err: Error) => {
          reject(new Error(`File CSV tidak dapat dibaca: ${err.message}`));
        }
      });
    };

    reader.onerror = () => {
      reject(new Error("File CSV tidak dapat dibaca. Pastikan format file benar."));
    };

    reader.readAsText(file, "UTF-8");
  });
}

/**
 * Parses raw CSV text string directly into validated records using 2D matrix mode.
 */
export function parseRawCsvString(
  rawCsvContent: string,
  sourceName = "Spreadsheet.csv"
): CsvValidationResult {
  const results = Papa.parse<string[]>(rawCsvContent, {
    header: false,
    skipEmptyLines: "greedy"
  });

  return validateCsvMatrixData(
    sourceName,
    rawCsvContent.length,
    results.data || []
  );
}

/**
 * Exports filtered LocationRecords to a downloadable CSV file.
 */
export function exportRecordsToCsv(
  records: LocationRecord[],
  schemas: ColumnSchema[],
  fileNamePrefix = "export_data_lokasi"
): void {
  if (!records || records.length === 0) return;

  const headers = schemas.map((s) => s.originalHeader);
  const rows = records.map((rec) => {
    const rowObj: Record<string, string> = {};
    schemas.forEach((col) => {
      rowObj[col.originalHeader] = rec.rawValues[col.originalHeader] ?? "";
    });
    return rowObj;
  });

  const csvString = Papa.unparse({
    fields: headers,
    data: rows
  });

  const blob = new Blob(["\uFEFF" + csvString], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  link.href = url;
  link.setAttribute("download", `${fileNamePrefix}_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
