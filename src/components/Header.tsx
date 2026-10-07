import React from "react";
import { RefreshCw, Upload, Download, Settings2 } from "lucide-react";

interface HeaderProps {
  onOpenCsvModal: () => void;
  onRefresh: () => void;
  onExportCsv: () => void;
  onOpenConfigModal: () => void;
  isLoading: boolean;
  lastUpdated: string | null;
  activeSheetName: string;
  availableSheets: string[];
  onSelectSheet: (sheet: string) => void;
  canExport: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCsvModal,
  onRefresh,
  onExportCsv,
  onOpenConfigModal,
  isLoading,
  lastUpdated,
  activeSheetName,
  availableSheets,
  onSelectSheet,
  canExport
}) => {
  const formattedTime = React.useMemo(() => {
    if (!lastUpdated) return null;
    try {
      const date = new Date(lastUpdated);
      return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short"
      }).format(date);
    } catch {
      return lastUpdated;
    }
  }, [lastUpdated]);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6 py-2.5 min-h-14 bg-white border-b border-slate-200 gap-3">
      {/* Zone 1: Brand Title & Subtitles */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="flex flex-col shrink-0 group"
      >
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-base lg:text-lg font-extrabold tracking-tight text-blue-700 group-hover:text-blue-800 transition-colors">
            KOMPARA
          </span>
          <span className="text-xs lg:text-sm font-bold text-slate-800">
            — Koordinat Pelanggan Antar Periode
          </span>
        </div>
        <span className="text-[11px] font-medium text-slate-500 leading-tight">
          PLN Electricity Services Unit Layanan Bukittinggi
        </span>
      </a>

      {/* Zone 2: Clean context / navigation links */}
      <nav
        aria-label="Navigasi dan Status Data"
        className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-600"
      >
        <div className="flex items-center gap-2">
          <label htmlFor="header-sheet-select" className="text-slate-500">
            Sheet:
          </label>
          {availableSheets.length > 1 ? (
            <select
              id="header-sheet-select"
              value={activeSheetName}
              onChange={(e) => onSelectSheet(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {availableSheets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-semibold text-slate-800">{activeSheetName || "Data"}</span>
          )}
        </div>

        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>

        {isLoading ? (
          <span className="text-blue-600 font-medium">Memuat data...</span>
        ) : formattedTime ? (
          <span className="text-slate-500 tabular-nums">
            Terakhir diperbarui: <strong className="font-medium text-slate-700">{formattedTime}</strong>
          </span>
        ) : (
          <span className="text-slate-400">Belum disinkronkan</span>
        )}

        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>

        <button
          type="button"
          onClick={onOpenConfigModal}
          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Konfigurasi Database</span>
        </button>
      </nav>

      {/* Zone 3: Primary actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenConfigModal}
          aria-label="Konfigurasi Database"
          title="Konfigurasi Database & Apps Script"
          className="md:hidden inline-flex items-center justify-center p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <Settings2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Refresh Data"
          title="Ambil data terbaru dari Google Spreadsheet"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
          <span className="hidden sm:inline">Refresh Data</span>
        </button>

        <button
          type="button"
          onClick={onExportCsv}
          disabled={!canExport}
          aria-label="Export CSV"
          title="Export data yang sedang ditampilkan ke file CSV"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export CSV</span>
        </button>

        <button
          type="button"
          onClick={onOpenCsvModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload CSV</span>
        </button>
      </div>
    </header>
  );
};
