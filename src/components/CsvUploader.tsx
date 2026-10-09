import React from "react";
import {
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  Layers
} from "lucide-react";
import { parseAndValidateCsvFile } from "../services/csvService";
import { CsvValidationResult, LocationRecord } from "../utils/validation";
import { ImportMode } from "../services/spreadsheetService";
import {
  TargetMonthlySheet,
  TARGET_MONTHLY_SHEETS
} from "../utils/normalizeHeaders";

interface CsvUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (params: {
    targetSheet: TargetMonthlySheet;
    mode: ImportMode;
    headers: string[];
    recordsToImport: LocationRecord[];
    rawCsvContent: string;
    fileName: string;
    saveToDrive: boolean;
  }) => Promise<void>;
  folderId: string;
  spreadsheetId: string;
  sheetName: string;
}

const MONTH_BLTH_MAP: Record<TargetMonthlySheet, string> = {
  DIL: "202609",
  JUNI: "202606",
  JULI: "202607",
  AGUSTUS: "202608",
  SEPTEMBER: "202609",
  OKTOBER: "202610",
  NOVEMBER: "202611",
  DESEMBER: "202612",
  SAMPLING: "202609"
};

function getSheetColumnGuideText(targetSheet: TargetMonthlySheet): string {
  if (targetSheet === "DIL") {
    return "DIL, NAMA, ALAMAT, TARIF, DAYA, NO RBM, LATITUDE, LONGITUDE";
  }
  if (targetSheet === "SAMPLING") {
    return "IDPEL, ULP, KOORDINAT";
  }
  return "IDPEL, BLTH, LATITUDE, LONGITUDE";
}

function buildMonthlyTemplateCsv(targetSheet: TargetMonthlySheet, includeSampleRows = true): string {
  const blth = MONTH_BLTH_MAP[targetSheet] || "202609";

  if (targetSheet === "DIL") {
    const header = "DIL,NAMA,ALAMAT,TARIF,DAYA,NO RBM,LATITUDE,LONGITUDE";
    if (!includeSampleRows) {
      return header + "\n";
    }
    const rows = [
      `131000010536,PT Sinar Minang Sejahtera,Jl. Sudirman No. 42 Bukittinggi,B2,16500,RBM01,-0.305120,100.369450`,
      `131000041251,Hotel Grand Royal Jam Gadang,Jl. Yos Sudarso No. 12 Benteng Pasar Atas,B2,33000,RBM02,-0.304280,100.368810`,
      `131000051292,RSUD Dr. Achmad Mochtar,Jl. Dr. A. Rivai No. 1 Bukittinggi,S3,197000,RBM03,-0.300890,100.366120`,
      `131000051682,Pasar Aur Kuning Blok A,Jl. Bypass Aur Kuning Bukittinggi,B1,5500,RBM04,-0.316450,100.384210`,
      `131000052790,Kantor Wali Kota Bukittinggi,Jl. Kusuma Bhakti Gulai Bancah,P1,41500,RBM05,-0.289650,100.374800`
    ];
    return [header, ...rows].join("\n");
  }

  if (targetSheet === "SAMPLING") {
    const header = "IDPEL,ULP,KOORDINAT";
    if (!includeSampleRows) {
      return header + "\n";
    }
    const rows = [
      `131000010536,BUKITTINGGI,"-0.305120, 100.369450"`,
      `131000041251,BUKITTINGGI,"-0.304280, 100.368810"`,
      `131000051292,BUKITTINGGI,"-0.300890, 100.366120"`,
      `131000051682,BUKITTINGGI,"-0.316450, 100.384210"`,
      `131000052790,BUKITTINGGI,"-0.289650, 100.374800"`
    ];
    return [header, ...rows].join("\n");
  }

  const header = "IDPEL,BLTH,LATITUDE,LONGITUDE";
  if (!includeSampleRows) {
    return header + "\n";
  }

  const rows = [
    `131000010536,${blth},-0.305120,100.369450`,
    `131000041251,${blth},-0.304280,100.368810`,
    `131000051292,${blth},-0.300890,100.366120`,
    `131000051682,${blth},-0.316450,100.384210`,
    `131000052790,${blth},-0.289650,100.374800`
  ];
  return [header, ...rows].join("\n");
}

export const CsvUploader: React.FC<CsvUploaderProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
  folderId,
  spreadsheetId,
  sheetName
}) => {
  const [targetSheet, setTargetSheet] = React.useState<TargetMonthlySheet>("SEPTEMBER");
  const [validationResult, setValidationResult] =
    React.useState<CsvValidationResult | null>(null);
  const [rawCsvContent, setRawCsvContent] = React.useState<string>("");
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [importMode, setImportMode] = React.useState<ImportMode>("append");
  const [onlyImportValid, setOnlyImportValid] = React.useState<boolean>(true);
  const [saveToDrive, setSaveToDrive] = React.useState<boolean>(true);
  const [confirmReplaceChecked, setConfirmReplaceChecked] =
    React.useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      const upperActive = (sheetName || "").trim().toUpperCase() as TargetMonthlySheet;
      if (TARGET_MONTHLY_SHEETS.includes(upperActive)) {
        setTargetSheet(upperActive);
      }
    } else {
      setValidationResult(null);
      setRawCsvContent("");
      setParseError(null);
      setImportMode("append");
      setOnlyImportValid(true);
      setConfirmReplaceChecked(false);
      setIsSubmitting(false);
    }
  }, [isOpen, sheetName]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Auto-detect sheet name if filename contains one of the month names
    const upperName = file.name.toUpperCase();
    for (const m of TARGET_MONTHLY_SHEETS) {
      if (upperName.includes(m)) {
        setTargetSheet(m);
        break;
      }
    }

    setParseError(null);
    try {
      const { validation, rawCsvContent: raw } = await parseAndValidateCsvFile(file);
      setValidationResult(validation);
      setRawCsvContent(raw);
    } catch (err: any) {
      setValidationResult(null);
      setRawCsvContent("");
      setParseError(
        err.message || "File CSV tidak dapat dibaca. Pastikan format file benar."
      );
    }
  };

  const handleLoadSampleTemplate = async () => {
    setParseError(null);
    const csvContent = buildMonthlyTemplateCsv(targetSheet, true);
    const sampleFile = new File(
      [csvContent],
      `Data_${targetSheet}.csv`,
      { type: "text/csv" }
    );
    try {
      const { validation, rawCsvContent: raw } = await parseAndValidateCsvFile(sampleFile);
      setValidationResult(validation);
      setRawCsvContent(raw);
    } catch (err: any) {
      setParseError(err.message);
    }
  };

  const handleDownloadTemplate = (withSampleRows = true) => {
    const csvText = buildMonthlyTemplateCsv(targetSheet, withSampleRows);
    const blob = new Blob(["\uFEFF" + csvText], {
      type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = withSampleRows
      ? `Format_Upload_Sheet_${targetSheet}.csv`
      : `Format_Kosong_Sheet_${targetSheet}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExecuteImport = async () => {
    if (!validationResult) return;
    if (importMode === "replace" && !confirmReplaceChecked) return;

    const targetRecords = onlyImportValid
      ? validationResult.validRows
      : validationResult.allRecords;

    if (targetRecords.length === 0) {
      setParseError("Tidak ada baris data yang dapat diimport.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmImport({
        targetSheet,
        mode: importMode,
        headers: validationResult.headers,
        recordsToImport: targetRecords,
        rawCsvContent,
        fileName: validationResult.fileName,
        saveToDrive
      });
      onClose();
    } catch (err: any) {
      setParseError(err.message || "Gagal mengimport data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatNum = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-upload-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <h2
              id="csv-upload-dialog-title"
              className="text-sm font-bold text-slate-900"
            >
              Upload & Import File CSV ke Google Spreadsheet
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog Upload CSV"
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Step 1: Target Sheet Selection & Download Format CSV */}
          <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <label
                    htmlFor="target-sheet-select"
                    className="block text-xs font-bold text-slate-900"
                  >
                    1. Pilih Sheet Tujuan Upload CSV
                  </label>
                  <p className="text-[11px] text-slate-600">
                    Data CSV yang diupload akan masuk ke Sheet bulan yang dipilih di bawah ini:
                  </p>
                </div>
              </div>

              {/* Download Format CSV Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Format CSV ({targetSheet})</span>
                </button>
              </div>
            </div>

            {/* 7 Monthly Sheet Buttons + Dropdown */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {TARGET_MONTHLY_SHEETS.map((sheet) => {
                const isSelected = targetSheet === sheet;
                return (
                  <button
                    key={sheet}
                    type="button"
                    onClick={() => setTargetSheet(sheet)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {sheet}
                  </button>
                );
              })}

              <select
                id="target-sheet-select"
                value={targetSheet}
                onChange={(e) => setTargetSheet(e.target.value as TargetMonthlySheet)}
                aria-label="Pilih Sheet Tujuan"
                className="ml-auto bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              >
                {TARGET_MONTHLY_SHEETS.map((sheet) => (
                  <option key={sheet} value={sheet}>
                    Sheet: {sheet}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-[11px] text-slate-600 bg-white/80 px-3 py-2 rounded border border-blue-100 flex flex-wrap items-center justify-between gap-2">
              <span>
                Pedoman Kolom Sheet <strong className="font-mono text-slate-900">{targetSheet}</strong>:{" "}
                <code className="font-mono font-semibold text-blue-700">
                  {getSheetColumnGuideText(targetSheet)}
                </code>
              </span>
              <button
                type="button"
                onClick={() => handleDownloadTemplate(false)}
                className="text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
              >
                Unduh Format Kosong (.csv)
              </button>
            </div>
          </div>

          {/* Step 2: File Picker Box */}
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-5 text-center bg-slate-50/60 hover:bg-slate-50 transition-colors">
            <input
              ref={fileInputRef}
              id="csv-file-input"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="sr-only"
            />
            <label
              htmlFor="csv-file-input"
              className="inline-flex flex-col items-center cursor-pointer"
            >
              <Upload className="w-6 h-6 text-blue-600 mb-2" />
              <span className="text-xs font-semibold text-slate-800">
                2. Pilih File CSV untuk Diupload ke Sheet{" "}
                <span className="text-blue-600 font-mono">{targetSheet}</span>
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5">
                Mendukung koma (,) atau titik koma (;). Kolom Latitude (Kolom 3) & Longitude (Kolom 4) akan divalidasi otomatis.
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-3 pt-3 border-t border-slate-200/70">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Pilih File CSV dari Komputer
              </button>
              <button
                type="button"
                onClick={handleLoadSampleTemplate}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
              >
                Muat Contoh CSV {targetSheet}
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTemplate(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Format CSV</span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {parseError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">File CSV tidak dapat dibaca.</p>
                <p className="mt-0.5 text-red-700">{parseError}</p>
              </div>
            </div>
          )}

          {/* Validation Summary & Preview */}
          {validationResult && (
            <div className="space-y-4">
              {/* Summary Box */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px] font-sans">
                    Sheet Tujuan
                  </span>
                  <strong className="text-blue-700 block">
                    {targetSheet}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-sans">
                    File
                  </span>
                  <strong
                    className="text-slate-900 truncate block"
                    title={validationResult.fileName}
                  >
                    {validationResult.fileName}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-sans">
                    Jumlah Data
                  </span>
                  <strong className="text-slate-900 tabular-nums">
                    {formatNum(validationResult.totalRows)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-sans">
                    Valid
                  </span>
                  <strong className="text-emerald-700 tabular-nums">
                    {formatNum(validationResult.validRows.length)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-sans">
                    Invalid
                  </span>
                  <strong className="text-amber-700 tabular-nums">
                    {formatNum(validationResult.invalidRows.length)}
                  </strong>
                </div>
              </div>

              {/* Preview Table (First 5 rows) */}
              <div>
                <h3 className="text-xs font-semibold text-slate-800 mb-1.5">
                  Preview 5 Baris Pertama (Akan Masuk ke Sheet{" "}
                  <span className="font-mono text-blue-700">{targetSheet}</span>)
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      {targetSheet === "DIL" ? (
                        <tr>
                          <th className="py-1.5 px-2.5 font-mono">#</th>
                          <th className="py-1.5 px-2.5 whitespace-nowrap">DIL</th>
                          <th className="py-1.5 px-2.5 whitespace-nowrap">NAMA</th>
                          <th className="py-1.5 px-2.5 whitespace-nowrap">ALAMAT</th>
                          <th className="py-1.5 px-2.5 whitespace-nowrap">TARIF</th>
                          <th className="py-1.5 px-2.5 whitespace-nowrap">DAYA</th>
                          <th className="py-1.5 px-2.5 whitespace-nowrap">NO RBM</th>
                          <th className="py-1.5 px-2.5 whitespace-nowrap">LATITUDE</th>
                          <th className="py-1.5 px-2.5 whitespace-nowrap">LONGITUDE</th>
                          <th className="py-1.5 px-2.5">Validasi</th>
                        </tr>
                      ) : targetSheet === "SAMPLING" ? (
                        <tr>
                          <th className="py-1.5 px-2.5 font-mono">#</th>
                          <th className="py-1.5 px-2.5 whitespace-nowrap">IDPEL</th>
                          <th className="py-1.5 px-2.5 whitespace-nowrap">ULP</th>
                          <th className="py-1.5 px-2.5 whitespace-nowrap">KOORDINAT</th>
                          <th className="py-1.5 px-2.5">Validasi</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="py-1.5 px-2.5 font-mono">#</th>
                          <th className="py-1.5 px-2.5 whitespace-nowrap">IDPEL</th>
                          <th className="py-1.5 px-2.5 whitespace-nowrap">BLTH</th>
                          <th className="py-1.5 px-2.5 whitespace-nowrap">LATITUDE</th>
                          <th className="py-1.5 px-2.5 whitespace-nowrap">LONGITUDE</th>
                          <th className="py-1.5 px-2.5">Validasi</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {validationResult.allRecords.slice(0, 5).map((rec, i) => {
                        const rowErr = validationResult.validationErrors.find(
                          (ve) => ve.rowNumber === i + 2
                        );
                        const idOrDil = rec.id !== "-" ? rec.id : rec.dil;
                        const coordPreview =
                          rec.latitude !== null && rec.longitude !== null
                            ? `${rec.latitude}, ${rec.longitude}`
                            : rec.lokasiSampling !== "-"
                            ? rec.lokasiSampling
                            : rec.koordinatDil !== "-"
                            ? rec.koordinatDil
                            : "-";

                        const getRawCaseInsensitive = (keyNames: string[], fallback = "-") => {
                          for (const k of Object.keys(rec.rawValues)) {
                            if (keyNames.includes(k.trim().toUpperCase())) {
                              const v = rec.rawValues[k]?.trim();
                              if (v) return v;
                            }
                          }
                          return fallback;
                        };

                        return (
                          <tr key={rec._rowId}>
                            <td className="py-1.5 px-2.5 font-mono text-slate-400">
                              {i + 1}
                            </td>
                            <td className="py-1.5 px-2.5 font-mono font-semibold text-slate-800">
                              {idOrDil}
                            </td>
                            {targetSheet === "DIL" ? (
                              <>
                                <td className="py-1.5 px-2.5 max-w-[140px] truncate">
                                  {rec.nama}
                                </td>
                                <td className="py-1.5 px-2.5 max-w-[160px] truncate">
                                  {rec.alamat}
                                </td>
                                <td className="py-1.5 px-2.5 font-mono">
                                  {getRawCaseInsensitive(["TARIF"])}
                                </td>
                                <td className="py-1.5 px-2.5 font-mono">
                                  {getRawCaseInsensitive(["DAYA"])}
                                </td>
                                <td className="py-1.5 px-2.5 font-mono">
                                  {getRawCaseInsensitive(["NO RBM", "NO_RBM", "NORBM", "RBM"])}
                                </td>
                                <td className="py-1.5 px-2.5 font-mono text-blue-700">
                                  {rec.latitude !== null ? rec.latitude : "-"}
                                </td>
                                <td className="py-1.5 px-2.5 font-mono text-blue-700">
                                  {rec.longitude !== null ? rec.longitude : "-"}
                                </td>
                              </>
                            ) : targetSheet === "SAMPLING" ? (
                              <>
                                <td className="py-1.5 px-2.5 font-mono">
                                  {rec.unit !== "-" ? rec.unit : getRawCaseInsensitive(["ULP", "UNIT"])}
                                </td>
                                <td className="py-1.5 px-2.5 font-mono text-blue-700 whitespace-nowrap">
                                  {coordPreview}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-1.5 px-2.5 font-mono">
                                  {getRawCaseInsensitive(["BLTH"], MONTH_BLTH_MAP[targetSheet])}
                                </td>
                                <td className="py-1.5 px-2.5 font-mono text-blue-700">
                                  {rec.latitude !== null ? rec.latitude : "-"}
                                </td>
                                <td className="py-1.5 px-2.5 font-mono text-blue-700">
                                  {rec.longitude !== null ? rec.longitude : "-"}
                                </td>
                              </>
                            )}
                            <td className="py-1.5 px-2.5 whitespace-nowrap">
                              {rowErr ? (
                                <span className="text-amber-700 font-medium inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{rowErr.errors[0]}</span>
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Valid</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Validation Error List (if any) */}
              {validationResult.validationErrors.length > 0 && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-amber-900">
                      Daftar Baris dengan Catatan Validasi ({validationResult.validationErrors.length} baris)
                    </p>
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onlyImportValid}
                        onChange={(e) => setOnlyImportValid(e.target.checked)}
                        className="rounded border-amber-400 text-blue-600 focus:ring-blue-600"
                      />
                      <span>Import data valid saja ({validationResult.validRows.length} baris)</span>
                    </label>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px] text-amber-800 bg-white/80 p-2.5 rounded border border-amber-200/70">
                    {validationResult.validationErrors.slice(0, 30).map((err) => (
                      <div key={err.rowNumber}>
                        <span className="font-semibold">Baris {err.rowNumber}</span> (
                        {err.idValue}): {err.errors.join(", ")}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Import Mode Selection */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-800">
                  Pilih Mode Import ke Sheet {targetSheet}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      importMode === "append"
                        ? "border-blue-600 bg-blue-50/50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <input
                        type="radio"
                        name="importMode"
                        value="append"
                        checked={importMode === "append"}
                        onChange={() => setImportMode("append")}
                      />
                      <span>Tambahkan Data</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Menambahkan / memperbarui titik koordinat pada Sheet {targetSheet}.
                    </p>
                  </label>

                  <label
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      importMode === "update"
                        ? "border-blue-600 bg-blue-50/50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <input
                        type="radio"
                        name="importMode"
                        value="update"
                        checked={importMode === "update"}
                        onChange={() => setImportMode("update")}
                      />
                      <span>Update Data</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Jika IDPEL / DIL sudah ada di Sheet {targetSheet}, perbarui koordinatnya.
                    </p>
                  </label>

                  <label
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      importMode === "replace"
                        ? "border-red-600 bg-red-50/40"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <input
                        type="radio"
                        name="importMode"
                        value="replace"
                        checked={importMode === "replace"}
                        onChange={() => setImportMode("replace")}
                      />
                      <span>Replace Data</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Hapus seluruh data lama di Sheet {targetSheet} dan ganti dengan CSV baru.
                    </p>
                  </label>
                </div>

                {/* Replace Confirmation Guard */}
                {importMode === "replace" && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center gap-2">
                    <input
                      id="confirm-replace-checkbox"
                      type="checkbox"
                      checked={confirmReplaceChecked}
                      onChange={(e) => setConfirmReplaceChecked(e.target.checked)}
                      className="rounded border-red-400 text-red-600 focus:ring-red-600"
                    />
                    <label
                      htmlFor="confirm-replace-checkbox"
                      className="text-xs font-medium cursor-pointer"
                    >
                      Saya yakin ingin menghapus data lama pada Sheet "{targetSheet}" dan menggantinya dengan data baru ini.
                    </label>
                  </div>
                )}

                {/* Google Drive Folder Option */}
                <div className="flex items-center justify-between pt-2 text-[11px] text-slate-600">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveToDrive}
                      onChange={(e) => setSaveToDrive(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>
                      Simpan salinan file CSV ke Google Drive Folder (
                      <code className="font-mono text-slate-700">{folderId}</code>)
                    </span>
                  </label>
                  <span className="font-mono text-slate-400">
                    Target: Sheet {targetSheet} ({spreadsheetId.slice(0, 10)}...)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2.5 px-5 py-3 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={() => handleDownloadTemplate(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Format CSV ({targetSheet})</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Batalkan
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={
                !validationResult ||
                isSubmitting ||
                (importMode === "replace" && !confirmReplaceChecked) ||
                (onlyImportValid && validationResult.validRows.length === 0)
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? `Mengupload ke Sheet ${targetSheet}...`
                  : `Import Data ke Sheet ${targetSheet}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
