import Papa from "papaparse";
import * as XLSX from "xlsx";
import { validateCsvMatrixData, CsvValidationResult, LocationRecord } from "../utils/validation";
import { CanonicalField, ColumnSchema } from "../utils/normalizeHeaders";

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

const LEFT_MAIN_ROLES: CanonicalField[] = ["dil", "nama", "alamat"];

const KOORDINAT_GROUP_ROLES: CanonicalField[] = [
  "koordinat_dil",
  "lokasi_juni",
  "lokasi_juli",
  "lokasi_agustus",
  "lokasi_september",
  "lokasi_oktober",
  "lokasi_november",
  "lokasi_desember"
];

const JARAK_DIL_GROUP_ROLES: CanonicalField[] = [
  "jarak_dil_juni",
  "jarak_dil_juli",
  "jarak_dil_agustus",
  "jarak_dil_september",
  "jarak_dil_oktober",
  "jarak_dil_november",
  "jarak_dil_desember"
];

const JARAK_BULAN_GROUP_ROLES: CanonicalField[] = [
  "jarak_juli",
  "jarak_agustus",
  "jarak_september",
  "jarak_oktober",
  "jarak_november",
  "jarak_desember"
];

const SUB_HEADER_LABELS: Partial<Record<CanonicalField, string>> = {
  sampling: "SAMPLING",
  dil: "DIL",
  nama: "NAMA",
  alamat: "ALAMAT",
  koordinat_dil: "DIL",
  lokasi_juni: "JUNI",
  lokasi_juli: "JULI",
  lokasi_agustus: "AGUSTUS",
  lokasi_september: "SEPTEMBER",
  lokasi_oktober: "OKTOBER",
  lokasi_november: "NOVEMBER",
  lokasi_desember: "DESEMBER",
  jarak_dil_sampling: "DIL",
  jarak_dil_juni: "JUNI",
  jarak_dil_juli: "JULI",
  jarak_dil_agustus: "AGUSTUS",
  jarak_dil_september: "SEPTEMBER",
  jarak_dil_oktober: "OKTOBER",
  jarak_dil_november: "NOVEMBER",
  jarak_dil_desember: "DESEMBER",
  jarak_juli: "JUNI - JULI",
  jarak_agustus: "JULI - AGUSTUS",
  jarak_september: "AGUSTUS SEPTEMBER",
  jarak_oktober: "SEPTEMBER - OKTOBER",
  jarak_november: "OKTOBER - NOVEMBER",
  jarak_desember: "NOVEMBER - DESEMBER"
};

const SAMPLING_JARAK_BULAN_SUB_LABELS: Partial<Record<CanonicalField, string>> = {
  jarak_juli: "SAMPLING - JUNI",
  jarak_agustus: "SAMPLING - JULI",
  jarak_september: "SAMPLING - AGUSTUS",
  jarak_oktober: "SAMPLING - SEPTEMBER",
  jarak_november: "SAMPLING - OKTOBER",
  jarak_desember: "SAMPLING - NOVEMBER"
};

/**
 * Exports filtered LocationRecords to a downloadable Excel (.xlsx) file
 * matching the exact 2-row merged header layout, column order, and cell values
 * displayed in the application's DataTable.
 */
export function exportRecordsToExcel(
  records: LocationRecord[],
  schemas: ColumnSchema[],
  activeSheetName = "Data",
  visibleColumns?: string[],
  fileNamePrefix = "KOMPARA_Data_Lokasi"
): void {
  if (!records || records.length === 0) return;

  const isSamplingSheetSelected =
    (activeSheetName || "").trim().toUpperCase() === "SAMPLING";

  // 1. Build exact column groups matching DataTable.tsx
  const filtered =
    visibleColumns && visibleColumns.length > 0
      ? schemas.filter((s) => visibleColumns.includes(s.normalizedKey))
      : schemas;
  const baseList = filtered.length > 0 ? filtered : schemas.slice(0, 15);

  const pickByRoles = (roles: CanonicalField[]) =>
    roles
      .map((role) => baseList.find((s) => s.canonicalRole === role))
      .filter((s): s is ColumnSchema => Boolean(s));

  let samplingColSchemas: ColumnSchema[] = [];
  if (isSamplingSheetSelected) {
    const foundSampling =
      schemas.find((s) => s.canonicalRole === "sampling") ||
      baseList.find((s) => s.canonicalRole === "sampling");
    if (foundSampling) {
      samplingColSchemas = [foundSampling];
    }
  } else {
    samplingColSchemas = pickByRoles(["sampling"]);
  }

  let jarakDilSamplingCol: ColumnSchema[] = [];
  if (isSamplingSheetSelected) {
    const foundJarakSamplingDil =
      schemas.find((s) => s.canonicalRole === "jarak_dil_sampling") ||
      baseList.find((s) => s.canonicalRole === "jarak_dil_sampling");
    if (foundJarakSamplingDil) {
      jarakDilSamplingCol = [foundJarakSamplingDil];
    }
  }

  let jarakBulanCols: ColumnSchema[] = [];
  if (isSamplingSheetSelected) {
    const samplingBulanRoles: CanonicalField[] = [
      "jarak_juli",
      "jarak_agustus",
      "jarak_september",
      "jarak_oktober"
    ];
    jarakBulanCols = samplingBulanRoles
      .map(
        (role) =>
          baseList.find((s) => s.canonicalRole === role) ||
          schemas.find((s) => s.canonicalRole === role)
      )
      .filter((s): s is ColumnSchema => Boolean(s));
  } else {
    jarakBulanCols = pickByRoles(JARAK_BULAN_GROUP_ROLES);
  }

  const leftCols = pickByRoles(LEFT_MAIN_ROLES);
  const coordCols = [...samplingColSchemas, ...pickByRoles(KOORDINAT_GROUP_ROLES)];
  const jarakDilCols = [
    ...jarakDilSamplingCol,
    ...pickByRoles(JARAK_DIL_GROUP_ROLES)
  ];

  const allGroupedRoles = new Set<CanonicalField>([
    "sampling",
    "jarak_dil_sampling",
    ...LEFT_MAIN_ROLES,
    ...KOORDINAT_GROUP_ROLES,
    ...JARAK_DIL_GROUP_ROLES,
    ...JARAK_BULAN_GROUP_ROLES
  ]);

  const extraCols = baseList.filter(
    (s) => !s.canonicalRole || !allGroupedRoles.has(s.canonicalRole)
  );

  const activeSchemas: ColumnSchema[] = [
    ...leftCols,
    ...coordCols,
    ...jarakDilCols,
    ...jarakBulanCols,
    ...extraCols
  ];

  // 2. Sort records with the same default priority as DataTable.tsx
  const sortedRecords = [...records].sort((a, b) => {
    const aHasMonthly =
      (a.lokasiJuni && a.lokasiJuni !== "-") ||
      (a.lokasiJuli && a.lokasiJuli !== "-") ||
      (a.lokasiAgustus && a.lokasiAgustus !== "-") ||
      (a.lokasiSeptember && a.lokasiSeptember !== "-");
    const bHasMonthly =
      (b.lokasiJuni && b.lokasiJuni !== "-") ||
      (b.lokasiJuli && b.lokasiJuli !== "-") ||
      (b.lokasiAgustus && b.lokasiAgustus !== "-") ||
      (b.lokasiSeptember && b.lokasiSeptember !== "-");

    if (aHasMonthly !== bHasMonthly) {
      return aHasMonthly ? -1 : 1;
    }
    if (a.hasValidCoords !== b.hasValidCoords) {
      return a.hasValidCoords ? -1 : 1;
    }
    return a._rowNumber - b._rowNumber;
  });

  // 3. Cell value resolver matching DataTable.tsx 1:1
  const resolveCellValue = (rec: LocationRecord, col: ColumnSchema): string => {
    const role: CanonicalField | null = col.canonicalRole;
    let val = rec.rawValues[col.originalHeader] || "-";

    if (role === "sampling") {
      val = rec.lokasiSampling && rec.lokasiSampling !== "-" ? rec.lokasiSampling : val;
    } else if (role === "dil") {
      val = rec.dil && rec.dil !== "-" ? rec.dil : val !== "-" ? val : rec.id;
    } else if (role === "nama") {
      val = rec.nama && rec.nama !== "-" ? rec.nama : val;
    } else if (role === "alamat") {
      val = rec.alamat && rec.alamat !== "-" ? rec.alamat : val;
    } else if (role === "koordinat_dil") {
      val = rec.koordinatDil && rec.koordinatDil !== "-" ? rec.koordinatDil : val;
    } else if (role === "lokasi_juni" || col.normalizedKey === "juni") {
      val = rec.lokasiJuni && rec.lokasiJuni !== "-" ? rec.lokasiJuni : val;
    } else if (role === "lokasi_juli" || col.normalizedKey === "juli") {
      val = rec.lokasiJuli && rec.lokasiJuli !== "-" ? rec.lokasiJuli : val;
    } else if (role === "lokasi_agustus" || col.normalizedKey === "agustus") {
      val = rec.lokasiAgustus && rec.lokasiAgustus !== "-" ? rec.lokasiAgustus : val;
    } else if (role === "lokasi_september" || col.normalizedKey === "september") {
      val = rec.lokasiSeptember && rec.lokasiSeptember !== "-" ? rec.lokasiSeptember : val;
    } else if (role === "lokasi_oktober" || col.normalizedKey === "oktober") {
      val = rec.lokasiOktober && rec.lokasiOktober !== "-" ? rec.lokasiOktober : val;
    } else if (role === "lokasi_november" || col.normalizedKey === "november") {
      val = rec.lokasiNovember && rec.lokasiNovember !== "-" ? rec.lokasiNovember : val;
    } else if (role === "lokasi_desember" || col.normalizedKey === "desember") {
      val = rec.lokasiDesember && rec.lokasiDesember !== "-" ? rec.lokasiDesember : val;
    } else if (role === "jarak_dil_sampling") {
      val = rec.jarakSamplingDil && rec.jarakSamplingDil !== "-" ? rec.jarakSamplingDil : val;
    } else if (role === "jarak_dil_juni") {
      val = isSamplingSheetSelected
        ? rec.jarakSamplingJuni && rec.jarakSamplingJuni !== "-"
          ? rec.jarakSamplingJuni
          : "-"
        : rec.jarakDilJuni && rec.jarakDilJuni !== "-"
        ? rec.jarakDilJuni
        : val;
    } else if (role === "jarak_dil_juli") {
      val = isSamplingSheetSelected
        ? rec.jarakSamplingJuli && rec.jarakSamplingJuli !== "-"
          ? rec.jarakSamplingJuli
          : "-"
        : rec.jarakDilJuli && rec.jarakDilJuli !== "-"
        ? rec.jarakDilJuli
        : val;
    } else if (role === "jarak_dil_agustus") {
      val = isSamplingSheetSelected
        ? rec.jarakSamplingAgustus && rec.jarakSamplingAgustus !== "-"
          ? rec.jarakSamplingAgustus
          : "-"
        : rec.jarakDilAgustus && rec.jarakDilAgustus !== "-"
        ? rec.jarakDilAgustus
        : val;
    } else if (role === "jarak_dil_september") {
      val = isSamplingSheetSelected
        ? rec.jarakSamplingSeptember && rec.jarakSamplingSeptember !== "-"
          ? rec.jarakSamplingSeptember
          : "-"
        : rec.jarakDilSeptember && rec.jarakDilSeptember !== "-"
        ? rec.jarakDilSeptember
        : val;
    } else if (role === "jarak_dil_oktober") {
      val = isSamplingSheetSelected
        ? rec.jarakSamplingOktober && rec.jarakSamplingOktober !== "-"
          ? rec.jarakSamplingOktober
          : "-"
        : rec.jarakDilOktober && rec.jarakDilOktober !== "-"
        ? rec.jarakDilOktober
        : val;
    } else if (role === "jarak_dil_november") {
      val = isSamplingSheetSelected
        ? rec.jarakSamplingNovember && rec.jarakSamplingNovember !== "-"
          ? rec.jarakSamplingNovember
          : "-"
        : rec.jarakDilNovember && rec.jarakDilNovember !== "-"
        ? rec.jarakDilNovember
        : val;
    } else if (role === "jarak_dil_desember") {
      val = isSamplingSheetSelected
        ? rec.jarakSamplingDesember && rec.jarakSamplingDesember !== "-"
          ? rec.jarakSamplingDesember
          : "-"
        : rec.jarakDilDesember && rec.jarakDilDesember !== "-"
        ? rec.jarakDilDesember
        : val;
    } else if (role === "jarak_juli") {
      val = isSamplingSheetSelected
        ? rec.jarakSamplingJuni && rec.jarakSamplingJuni !== "-"
          ? rec.jarakSamplingJuni
          : "-"
        : rec.jarakJuli && rec.jarakJuli !== "-"
        ? rec.jarakJuli
        : val;
    } else if (role === "jarak_agustus") {
      val = isSamplingSheetSelected
        ? rec.jarakSamplingJuli && rec.jarakSamplingJuli !== "-"
          ? rec.jarakSamplingJuli
          : "-"
        : rec.jarakAgustus && rec.jarakAgustus !== "-"
        ? rec.jarakAgustus
        : val;
    } else if (role === "jarak_september") {
      val = isSamplingSheetSelected
        ? rec.jarakSamplingAgustus && rec.jarakSamplingAgustus !== "-"
          ? rec.jarakSamplingAgustus
          : "-"
        : rec.jarakSeptember && rec.jarakSeptember !== "-"
        ? rec.jarakSeptember
        : val;
    } else if (role === "jarak_oktober") {
      val = isSamplingSheetSelected
        ? rec.jarakSamplingSeptember && rec.jarakSamplingSeptember !== "-"
          ? rec.jarakSamplingSeptember
          : "-"
        : rec.jarakOktober && rec.jarakOktober !== "-"
        ? rec.jarakOktober
        : val;
    } else if (role === "jarak_november") {
      val = isSamplingSheetSelected
        ? rec.jarakSamplingOktober && rec.jarakSamplingOktober !== "-"
          ? rec.jarakSamplingOktober
          : "-"
        : rec.jarakNovember && rec.jarakNovember !== "-"
        ? rec.jarakNovember
        : val;
    } else if (role === "jarak_desember") {
      val = isSamplingSheetSelected
        ? rec.jarakSamplingNovember && rec.jarakSamplingNovember !== "-"
          ? rec.jarakSamplingNovember
          : "-"
        : rec.jarakDesember && rec.jarakDesember !== "-"
        ? rec.jarakDesember
        : val;
    }

    return val || "-";
  };

  // 4. Construct 2-row header + merges matching the table header in DataTable.tsx
  const headerRow1: string[] = ["No"];
  const headerRow2: string[] = [""];
  const merges: XLSX.Range[] = [
    // "No" spans row 0 to row 1 in column 0
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }
  ];

  let currentCol = 1;

  // Left main columns (DIL, NAMA, ALAMAT) - each spans 2 rows vertically
  for (const col of leftCols) {
    const label =
      (col.canonicalRole && SUB_HEADER_LABELS[col.canonicalRole]) || col.label;
    headerRow1.push(label);
    headerRow2.push("");
    merges.push({ s: { r: 0, c: currentCol }, e: { r: 1, c: currentCol } });
    currentCol++;
  }

  // KOORDINAT group
  if (coordCols.length > 0) {
    const startCol = currentCol;
    coordCols.forEach((col, i) => {
      headerRow1.push(i === 0 ? "KOORDINAT" : "");
      const subLabel =
        (col.canonicalRole && SUB_HEADER_LABELS[col.canonicalRole]) || col.label;
      headerRow2.push(subLabel);
      currentCol++;
    });
    if (coordCols.length > 1) {
      merges.push({
        s: { r: 0, c: startCol },
        e: { r: 0, c: startCol + coordCols.length - 1 }
      });
    }
  }

  // JARAK DENGAN DIL / JARAK DENGAN SAMPLING group
  if (jarakDilCols.length > 0) {
    const startCol = currentCol;
    const groupTitle = isSamplingSheetSelected
      ? "JARAK DENGAN SAMPLING"
      : "JARAK DENGAN DIL";
    jarakDilCols.forEach((col, i) => {
      headerRow1.push(i === 0 ? groupTitle : "");
      const subLabel =
        (col.canonicalRole && SUB_HEADER_LABELS[col.canonicalRole]) || col.label;
      headerRow2.push(subLabel);
      currentCol++;
    });
    if (jarakDilCols.length > 1) {
      merges.push({
        s: { r: 0, c: startCol },
        e: { r: 0, c: startCol + jarakDilCols.length - 1 }
      });
    }
  }

  // JARAK ANTAR BULAN group
  if (jarakBulanCols.length > 0) {
    const startCol = currentCol;
    jarakBulanCols.forEach((col, i) => {
      headerRow1.push(i === 0 ? "JARAK ANTAR BULAN" : "");
      const subLabel =
        (isSamplingSheetSelected &&
          col.canonicalRole &&
          SAMPLING_JARAK_BULAN_SUB_LABELS[col.canonicalRole]) ||
        (col.canonicalRole && SUB_HEADER_LABELS[col.canonicalRole]) ||
        col.label;
      headerRow2.push(subLabel);
      currentCol++;
    });
    if (jarakBulanCols.length > 1) {
      merges.push({
        s: { r: 0, c: startCol },
        e: { r: 0, c: startCol + jarakBulanCols.length - 1 }
      });
    }
  }

  // Extra columns - each spans 2 rows vertically
  for (const col of extraCols) {
    headerRow1.push(col.label);
    headerRow2.push("");
    merges.push({ s: { r: 0, c: currentCol }, e: { r: 1, c: currentCol } });
    currentCol++;
  }

  // 5. Build all data rows matching the table
  const dataRows = sortedRecords.map((rec, idx) => [
    idx + 1,
    ...activeSchemas.map((col) => resolveCellValue(rec, col))
  ]);

  const sheetMatrix = [headerRow1, headerRow2, ...dataRows];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetMatrix);
  worksheet["!merges"] = merges;

  // Auto-size columns for clear readability
  const totalCols = headerRow1.length;
  worksheet["!cols"] = Array.from({ length: totalCols }, (_, colIdx) => {
    const h1 = String(headerRow1[colIdx] || "");
    const h2 = String(headerRow2[colIdx] || "");
    let maxLen = Math.max(h1.length, h2.length);

    for (let r = 0; r < Math.min(dataRows.length, 300); r++) {
      const cellStr = String(dataRows[r][colIdx] ?? "");
      if (cellStr.length > maxLen) maxLen = cellStr.length;
    }

    if (colIdx === 0) return { wch: 6 };
    return { wch: Math.min(Math.max(maxLen + 4, 14), 45) };
  });

  const workbook = XLSX.utils.book_new();
  const safeSheetName = (activeSheetName || "Data").slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  XLSX.writeFile(workbook, `${fileNamePrefix}_${safeSheetName}_${timestamp}.xlsx`);
}

/**
 * Exports filtered LocationRecords to a downloadable CSV file.
 */
export function exportRecordsToCsv(
  records: LocationRecord[],
  schemas: ColumnSchema[],
  fileNamePrefix = "export_data_lokasi"
): void {
  exportRecordsToExcel(records, schemas, "Data", undefined, fileNamePrefix);
}
